import { requireAwsCostOptIn } from "./require-aws-cost-opt-in.mjs";
import {
  ApiGatewayV2Client,
  CreateApiCommand,
  CreateIntegrationCommand,
  CreateRouteCommand,
  CreateStageCommand,
  GetApisCommand,
  GetIntegrationsCommand,
  GetRoutesCommand,
  GetStagesCommand,
  UpdateApiCommand,
} from "@aws-sdk/client-apigatewayv2";
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";
import {
  AttachRolePolicyCommand,
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  PutRolePolicyCommand,
} from "@aws-sdk/client-iam";
import {
  AddPermissionCommand,
  CreateFunctionCommand,
  GetFunctionCommand,
  GetFunctionConfigurationCommand,
  LambdaClient,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";
import {
  CreateEmailIdentityCommand,
  GetAccountCommand,
  GetEmailIdentityCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

requireAwsCostOptIn("AWS auth backend setup");

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const stackName = process.env.AUTH_STACK_NAME || "velyx-auth";
const projectTag = "velyx";
const siteDomain = process.env.SITE_DOMAIN || "www.velyx.kr";
const localOrigins = ["http://127.0.0.1:5173", "http://localhost:5173"];
const defaultAllowedOrigins = [`https://${siteDomain}`, ...localOrigins].join(",");
const allowedOrigins = process.env.AUTH_ALLOWED_ORIGINS || defaultAllowedOrigins;
const authEmailFrom =
  process.env.AUTH_EMAIL_FROM || process.env.EMAIL_FROM || `no-reply@${siteDomain.replace(/^www\./, "")}`;
const sesIdentity = process.env.AUTH_SES_IDENTITY || authEmailFrom.split("@").at(-1) || authEmailFrom;
const authAppBaseUrl = (process.env.AUTH_APP_BASE_URL || `https://${siteDomain}`).replace(/\/$/, "");
const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
const tableName = process.env.AUTH_USERS_TABLE || `${stackName}-users`;
const roleName = process.env.AUTH_LAMBDA_ROLE || `${stackName}-lambda-role`;
const functionName = process.env.AUTH_LAMBDA_FUNCTION || `${stackName}-api`;
const apiName = process.env.AUTH_API_NAME || `${stackName}-http-api`;
const lambdaSource = join(process.cwd(), "server", "auth", "index.mjs");

const sts = new STSClient({ region });
const dynamodb = new DynamoDBClient({ region });
const iam = new IAMClient({ region });
const lambda = new LambdaClient({ region });
const apigw = new ApiGatewayV2Client({ region });
const ses = new SESv2Client({ region });

function log(message) {
  process.stdout.write(`${message}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAccountId() {
  try {
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    return identity.Account;
  } catch (error) {
    throw new Error(
      "AWS credentials are not configured. Use AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, AWS SSO, or GitHub OIDC.",
      { cause: error },
    );
  }
}

async function ensureRateLimitTtl() {
  try {
    await dynamodb.send(
      new UpdateTimeToLiveCommand({
        TableName: tableName,
        TimeToLiveSpecification: {
          AttributeName: "expiresAtEpoch",
          Enabled: true,
        },
      }),
    );
    log(`Enabled DynamoDB TTL for rate-limit records on ${tableName}`);
  } catch (error) {
    if (error.name === "ValidationException") {
      log(`DynamoDB TTL already configured for ${tableName}`);
      return;
    }
    if (error.name === "AccessDeniedException" || error.name === "UnauthorizedOperation") {
      log("Could not enable DynamoDB TTL for rate-limit records; continuing without failing deploy.");
      return;
    }
    throw error;
  }
}

function canSkipSesError(error) {
  return error.name === "AccessDeniedException" || error.name === "UnauthorizedOperation";
}

async function ensureSesStatus() {
  const status = {
    from: authEmailFrom,
    identity: sesIdentity,
    readyForEmailDelivery: false,
    productionAccessEnabled: null,
    verifiedForSending: null,
    dkimStatus: "",
    dkimTokens: [],
    createdIdentity: false,
    warning: "",
  };

  if (!authEmailFrom) {
    status.warning = "AUTH_EMAIL_FROM is not configured.";
    return status;
  }

  try {
    const account = await ses.send(new GetAccountCommand({}));
    status.productionAccessEnabled = account.ProductionAccessEnabled === true;
  } catch (error) {
    if (canSkipSesError(error)) {
      status.warning = "Deploy role cannot inspect SES account status.";
    } else {
      throw error;
    }
  }

  try {
    const identity = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: sesIdentity }));
    status.verifiedForSending = identity.VerifiedForSendingStatus === true;
    status.dkimStatus = identity.DkimAttributes?.Status || "";
    status.dkimTokens = identity.DkimAttributes?.Tokens || [];
  } catch (error) {
    if (error.name === "NotFoundException") {
      const created = await ses.send(new CreateEmailIdentityCommand({ EmailIdentity: sesIdentity }));
      status.createdIdentity = true;
      status.verifiedForSending = false;
      status.dkimStatus = created.DkimAttributes?.Status || "PENDING";
      status.dkimTokens = created.DkimAttributes?.Tokens || [];
      status.warning = `Created SES identity ${sesIdentity}. Add the DKIM DNS records and wait for verification.`;
      return status;
    }
    if (canSkipSesError(error)) {
      status.warning = status.warning || "Deploy role cannot inspect or create SES identity.";
      return status;
    }
    throw error;
  }

  if (status.productionAccessEnabled === false) {
    status.warning =
      "SES account is still in sandbox. External recipients such as Gmail/Naver will be rejected until production access is approved.";
  } else if (status.verifiedForSending === false) {
    status.warning = `SES identity ${sesIdentity} is not verified for sending.`;
  }
  status.readyForEmailDelivery = status.productionAccessEnabled === true && status.verifiedForSending === true;

  return status;
}

async function ensureTable() {
  try {
    const existing = await dynamodb.send(new DescribeTableCommand({ TableName: tableName }));
    log(`DynamoDB table exists: ${tableName}`);
    await ensureRateLimitTtl();
    return existing.Table.TableArn;
  } catch (error) {
    if (error.name !== "ResourceNotFoundException") throw error;
  }

  const created = await dynamodb.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: "PAY_PER_REQUEST",
      SSESpecification: {
        Enabled: true,
      },
      DeletionProtectionEnabled: true,
      AttributeDefinitions: [
        {
          AttributeName: "pk",
          AttributeType: "S",
        },
      ],
      KeySchema: [
        {
          AttributeName: "pk",
          KeyType: "HASH",
        },
      ],
      Tags: [
        {
          Key: "Project",
          Value: projectTag,
        },
      ],
    }),
  );
  log(`Created DynamoDB table: ${tableName}`);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const table = await dynamodb.send(new DescribeTableCommand({ TableName: tableName }));
    if (table.Table?.TableStatus === "ACTIVE") {
      await ensureRateLimitTtl();
      return table.Table.TableArn;
    }
    await sleep(2000);
  }

  await ensureRateLimitTtl();
  return created.TableDescription.TableArn;
}

async function ensureRole(tableArn) {
  let role;
  try {
    role = await iam.send(new GetRoleCommand({ RoleName: roleName }));
    log(`IAM role exists: ${roleName}`);
  } catch (error) {
    if (error.name !== "NoSuchEntityException") throw error;
    role = await iam.send(
      new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: "lambda.amazonaws.com",
              },
              Action: "sts:AssumeRole",
            },
          ],
        }),
        Tags: [
          {
            Key: "Project",
            Value: projectTag,
          },
        ],
      }),
    );
    log(`Created IAM role: ${roleName}`);
    await sleep(10000);
  }

  await iam.send(
    new AttachRolePolicyCommand({
      RoleName: roleName,
      PolicyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    }),
  );

  await iam.send(
    new PutRolePolicyCommand({
      RoleName: roleName,
      PolicyName: `${stackName}-users-table-access`,
      PolicyDocument: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["dynamodb:DeleteItem", "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"],
            Resource: tableArn,
          },
          {
            Effect: "Allow",
            Action: ["ses:SendEmail"],
            Resource: "*",
          },
        ],
      }),
    }),
  );

  return role.Role.Arn;
}

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      table[index] = value >>> 0;
    }
    crc32.table = table;
  }

  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function zipSingleFile(name, content) {
  const nameBuffer = Buffer.from(name);
  const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const checksum = crc32(data);
  const { dosTime, dosDate } = dosDateTime();
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(dosTime, 10);
  localHeader.writeUInt16LE(dosDate, 12);
  localHeader.writeUInt32LE(checksum, 14);
  localHeader.writeUInt32LE(data.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralOffset = localHeader.length + nameBuffer.length + data.length;
  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(dosTime, 12);
  centralHeader.writeUInt16LE(dosDate, 14);
  centralHeader.writeUInt32LE(checksum, 16);
  centralHeader.writeUInt32LE(data.length, 20);
  centralHeader.writeUInt32LE(data.length, 24);
  centralHeader.writeUInt16LE(nameBuffer.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);

  const centralSize = centralHeader.length + nameBuffer.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localHeader, nameBuffer, data, centralHeader, nameBuffer, end]);
}

async function getExistingEnvironment() {
  try {
    const config = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: functionName }));
    return config.Environment?.Variables || {};
  } catch {
    return {};
  }
}

async function waitForFunctionReady() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const config = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: functionName }));
    if (config.State === "Active" && !["InProgress", "Pending"].includes(config.LastUpdateStatus)) {
      return config;
    }
    await sleep(2000);
  }

  return await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: functionName }));
}

async function sendLambdaWhenReady(commandFactory) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      return await lambda.send(commandFactory());
    } catch (error) {
      if (error.name !== "ResourceConflictException") throw error;
      log("Lambda update is still in progress; waiting before retrying...");
      await waitForFunctionReady();
    }
  }

  return await lambda.send(commandFactory());
}

async function ensureFunction(roleArn) {
  const source = readFileSync(lambdaSource);
  const zipFile = zipSingleFile("index.mjs", source);
  const existingEnvironment = await getExistingEnvironment();
  const existingPepper = existingEnvironment.AUTH_PEPPER || "";
  const authPepper = process.env.AUTH_PEPPER || existingPepper || randomBytes(32).toString("base64url");
  const adminBootstrapToken =
    process.env.AUTH_ADMIN_BOOTSTRAP_TOKEN || existingEnvironment.AUTH_ADMIN_BOOTSTRAP_TOKEN || "";
  const environment = {
    USERS_TABLE: tableName,
    AUTH_PEPPER: authPepper,
    AUTH_ADMIN_BOOTSTRAP_TOKEN: adminBootstrapToken,
    AUTH_ALLOWED_ORIGINS: allowedOrigins,
    AUTH_APP_BASE_URL: authAppBaseUrl,
    AUTH_EMAIL_FROM: authEmailFrom,
    GOOGLE_CLIENT_ID: googleClientId,
    SESSION_TTL_SECONDS: String(process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 14),
    PASSWORD_ITERATIONS: String(process.env.PASSWORD_ITERATIONS || 210000),
  };

  try {
    await lambda.send(new GetFunctionCommand({ FunctionName: functionName }));
    await sendLambdaWhenReady(
      () => new UpdateFunctionCodeCommand({
        FunctionName: functionName,
        ZipFile: zipFile,
      }),
    );
    await waitForFunctionReady();
    await sendLambdaWhenReady(
      () => new UpdateFunctionConfigurationCommand({
        FunctionName: functionName,
        Runtime: "nodejs20.x",
        Handler: "index.handler",
        Timeout: 10,
        MemorySize: 128,
        Environment: {
          Variables: environment,
        },
      }),
    );
    log(`Updated Lambda function: ${functionName}`);
  } catch (error) {
    if (error.name !== "ResourceNotFoundException") throw error;
    await lambda.send(
      new CreateFunctionCommand({
        FunctionName: functionName,
        Runtime: "nodejs20.x",
        Handler: "index.handler",
        Role: roleArn,
        Code: {
          ZipFile: zipFile,
        },
        Timeout: 10,
        MemorySize: 128,
        Environment: {
          Variables: environment,
        },
        Tags: {
          Project: projectTag,
        },
      }),
    );
    log(`Created Lambda function: ${functionName}`);
  }

  if (!existingPepper && !process.env.AUTH_PEPPER) {
    log("Generated a new Lambda AUTH_PEPPER and stored it in the encrypted Lambda environment.");
  }

  const config = await waitForFunctionReady();
  return config.FunctionArn;
}

async function findApi() {
  let nextToken;
  do {
    const page = await apigw.send(new GetApisCommand({ NextToken: nextToken }));
    const api = (page.Items || []).find((item) => item.Name === apiName);
    if (api) return api;
    nextToken = page.NextToken;
  } while (nextToken);
  return null;
}

async function ensureApi() {
  const corsOrigins = allowedOrigins.split(",").map((origin) => origin.trim()).filter(Boolean);
  const cors = {
    AllowOrigins: corsOrigins,
    AllowHeaders: ["Content-Type", "Authorization"],
    AllowMethods: ["OPTIONS", "GET", "POST"],
    MaxAge: 86400,
  };
  const existing = await findApi();
  if (existing) {
    await apigw.send(
      new UpdateApiCommand({
        ApiId: existing.ApiId,
        CorsConfiguration: cors,
      }),
    );
    log(`HTTP API exists: ${existing.ApiId}`);
    return existing;
  }

  const created = await apigw.send(
    new CreateApiCommand({
      Name: apiName,
      ProtocolType: "HTTP",
      CorsConfiguration: cors,
      Tags: {
        Project: projectTag,
      },
    }),
  );
  log(`Created HTTP API: ${created.ApiId}`);
  return created;
}

async function ensureIntegration(apiId, lambdaArn) {
  const integrations = await apigw.send(new GetIntegrationsCommand({ ApiId: apiId }));
  const existing = (integrations.Items || []).find(
    (item) => item.IntegrationType === "AWS_PROXY" && item.IntegrationUri === lambdaArn,
  );
  if (existing) return existing.IntegrationId;

  const created = await apigw.send(
    new CreateIntegrationCommand({
      ApiId: apiId,
      IntegrationType: "AWS_PROXY",
      IntegrationMethod: "POST",
      IntegrationUri: lambdaArn,
      PayloadFormatVersion: "2.0",
    }),
  );
  return created.IntegrationId;
}

async function ensureRoutes(apiId, integrationId) {
  const routes = await apigw.send(new GetRoutesCommand({ ApiId: apiId }));
  const existingKeys = new Set((routes.Items || []).map((route) => route.RouteKey));
  const target = `integrations/${integrationId}`;

  for (const routeKey of [
    "GET /auth/me",
    "GET /auth/admin/summary",
    "POST /auth/signup",
    "POST /auth/verify-email",
    "POST /auth/resend-verification",
    "POST /auth/login",
    "POST /auth/admin/bootstrap",
    "POST /auth/reset",
    "POST /auth/reset/confirm",
    "POST /auth/google",
  ]) {
    if (existingKeys.has(routeKey)) continue;
    await apigw.send(
      new CreateRouteCommand({
        ApiId: apiId,
        RouteKey: routeKey,
        Target: target,
      }),
    );
    log(`Created route: ${routeKey}`);
  }
}

async function ensureStage(apiId) {
  const stages = await apigw.send(new GetStagesCommand({ ApiId: apiId }));
  const exists = (stages.Items || []).some((stage) => stage.StageName === "$default");
  if (exists) return;

  await apigw.send(
    new CreateStageCommand({
      ApiId: apiId,
      StageName: "$default",
      AutoDeploy: true,
    }),
  );
  log("Created HTTP API $default stage");
}

async function allowApiInvoke(functionArn, apiId, accountId) {
  try {
    await lambda.send(
      new AddPermissionCommand({
        FunctionName: functionName,
        StatementId: "AllowHttpApiInvoke",
        Action: "lambda:InvokeFunction",
        Principal: "apigateway.amazonaws.com",
        SourceArn: `arn:aws:execute-api:${region}:${accountId}:${apiId}/*/*`,
      }),
    );
    log("Added Lambda invoke permission for HTTP API");
  } catch (error) {
    if (error.name !== "ResourceConflictException") throw error;
  }
}

async function main() {
  const accountId = await getAccountId();
  log(`AWS account: ${accountId}`);
  log(`AWS region: ${region}`);

  const tableArn = await ensureTable();
  const roleArn = await ensureRole(tableArn);
  const functionArn = await ensureFunction(roleArn);
  const sesStatus = await ensureSesStatus();
  const api = await ensureApi();
  const integrationId = await ensureIntegration(api.ApiId, functionArn);
  await ensureRoutes(api.ApiId, integrationId);
  await ensureStage(api.ApiId);
  await allowApiInvoke(functionArn, api.ApiId, accountId);

  const output = {
    region,
    tableName,
    functionName,
    apiId: api.ApiId,
    apiEndpoint: api.ApiEndpoint,
    viteEnv: {
      VITE_AUTH_API_BASE: api.ApiEndpoint,
    },
    email: {
      from: authEmailFrom,
      appBaseUrl: authAppBaseUrl,
      ses: sesStatus,
      note: sesStatus.readyForEmailDelivery
        ? "Amazon SES is verified and production email delivery is enabled in the configured region."
        : "The sender identity must be verified and SES production access must be enabled before production email delivery works.",
    },
    security: {
      passwordStorage: "PBKDF2-SHA256 with per-user salt and Lambda pepper",
      dynamodbEncryption: "SSE enabled",
      keyStorage: "AUTH_PEPPER stored in encrypted Lambda environment; never committed to git",
      googleLogin: googleClientId
        ? "Google ID tokens are verified server-side before issuing a site session"
        : "Set VITE_GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID to enable server-side Google login",
    },
  };

  writeFileSync("auth-output.json", `${JSON.stringify(output, null, 2)}\n`);
  writeFileSync(".env.auth.generated", `VITE_AUTH_API_BASE=${api.ApiEndpoint}\n`);
  log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(`Auth setup failed: ${error.message}`);
  if (error.cause?.name) console.error(`Cause: ${error.cause.name}`);
  process.exit(1);
});
