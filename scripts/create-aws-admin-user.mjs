import { pbkdf2Sync, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { GetFunctionConfigurationCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { requireAwsCostOptIn } from "./require-aws-cost-opt-in.mjs";

requireAwsCostOptIn("AWS admin account update");

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const stackName = process.env.AUTH_STACK_NAME || "nfoifsb-auth";
const tableName = process.env.AUTH_USERS_TABLE || process.env.USERS_TABLE || `${stackName}-users`;
const functionName = process.env.AUTH_FUNCTION_NAME || `${stackName}-api`;
let authPepper = process.env.AUTH_PEPPER || "";
const passwordIterations = Number(process.env.PASSWORD_ITERATIONS || 210000);
const outputFile = process.env.ADMIN_OUTPUT_FILE || "admin-output.json";
const lambda = new LambdaClient({ region });

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function userKey(email) {
  return `EMAIL#${email}`;
}

function s(value) {
  return { S: String(value) };
}

function n(value) {
  return { N: String(value) };
}

function b(value) {
  return { BOOL: Boolean(value) };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password, salt) {
  return pbkdf2Sync(`${password}:${authPepper}`, salt, passwordIterations, 32, "sha256").toString("base64");
}

async function loadAuthPepper() {
  if (authPepper) return;

  const config = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: functionName }));
  authPepper = config.Environment?.Variables?.AUTH_PEPPER || "";
}

const email = normalizeEmail(process.env.ADMIN_EMAIL || "admin@nfoifsb.kr");
const nickname = String(process.env.ADMIN_NICKNAME || "Admin").trim() || "Admin";
const password = process.env.ADMIN_PASSWORD || randomBytes(18).toString("base64url");

if (!validateEmail(email)) {
  throw new Error("ADMIN_EMAIL must be a valid email address.");
}
if (password.length < 8 || password.length > 128) {
  throw new Error("ADMIN_PASSWORD must be 8 to 128 characters.");
}
if (!Number.isSafeInteger(passwordIterations) || passwordIterations < 100000) {
  throw new Error("PASSWORD_ITERATIONS must be a safe integer greater than or equal to 100000.");
}

if (process.env.GITHUB_ACTIONS === "true") {
  process.stdout.write(`::add-mask::${password}\n`);
}

const now = new Date().toISOString();
const salt = randomBytes(16).toString("base64");
const key = userKey(email);
const dynamodb = new DynamoDBClient({ region });
const sts = new STSClient({ region });
const identity = await sts.send(new GetCallerIdentityCommand({}));

await loadAuthPepper();

if (!authPepper) {
  throw new Error(`AUTH_PEPPER was not provided and could not be read from Lambda function ${functionName}.`);
}

await dynamodb.send(
  new UpdateItemCommand({
    TableName: tableName,
    Key: {
      pk: s(key),
    },
    UpdateExpression: [
      "SET #email = :email",
      "#nickname = :nickname",
      "#passwordHash = :passwordHash",
      "#passwordSalt = :passwordSalt",
      "#passwordIterations = :passwordIterations",
      "#provider = :provider",
      "#emailVerified = :emailVerified",
      "#roles = :roles",
      "#createdAt = if_not_exists(#createdAt, :now)",
      "#updatedAt = :now",
    ].join(", "),
    ExpressionAttributeNames: {
      "#email": "email",
      "#nickname": "nickname",
      "#passwordHash": "passwordHash",
      "#passwordSalt": "passwordSalt",
      "#passwordIterations": "passwordIterations",
      "#provider": "provider",
      "#emailVerified": "emailVerified",
      "#roles": "roles",
      "#createdAt": "createdAt",
      "#updatedAt": "updatedAt",
    },
    ExpressionAttributeValues: {
      ":email": s(email),
      ":nickname": s(nickname),
      ":passwordHash": s(hashPassword(password, salt)),
      ":passwordSalt": s(salt),
      ":passwordIterations": n(passwordIterations),
      ":provider": s("site"),
      ":emailVerified": b(true),
      ":roles": { SS: ["admin"] },
      ":now": s(now),
    },
  }),
);

const output = {
  email,
  password,
  nickname,
  roles: ["admin"],
  tableName,
  functionName,
  accountId: identity.Account,
  region,
  updatedAt: now,
};

writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });

process.stdout.write(`Production admin account updated: ${email}\n`);
process.stdout.write(`Output written to ${outputFile}\n`);
