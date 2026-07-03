import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { requireAwsCostOptIn } from "./require-aws-cost-opt-in.mjs";

requireAwsCostOptIn("AWS admin account update");

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const stackName = process.env.AUTH_STACK_NAME || "nfoifsb-auth";
const tableName = process.env.AUTH_USERS_TABLE || process.env.USERS_TABLE || `${stackName}-users`;
const functionName = process.env.AUTH_FUNCTION_NAME || `${stackName}-api`;
const outputFile = process.env.ADMIN_OUTPUT_FILE || "admin-output.json";
const lambda = new LambdaClient({ region });

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

if (process.env.GITHUB_ACTIONS === "true") {
  process.stdout.write(`::add-mask::${password}\n`);
}

const now = new Date().toISOString();
const sts = new STSClient({ region });
const identity = await sts.send(new GetCallerIdentityCommand({}));

const invokeResult = await lambda.send(
  new InvokeCommand({
    FunctionName: functionName,
    Payload: Buffer.from(
      JSON.stringify({
        internalTask: "createAdminUser",
        email,
        nickname,
        password,
      }),
    ),
  }),
);

const rawPayload = Buffer.from(invokeResult.Payload || []).toString("utf8");
const payload = rawPayload ? JSON.parse(rawPayload) : {};

if (invokeResult.FunctionError || payload.ok !== true) {
  throw new Error(`Lambda admin creation failed: ${JSON.stringify(payload)}`);
}

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
