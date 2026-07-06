import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { requireAwsCostOptIn } from "./require-aws-cost-opt-in.mjs";

requireAwsCostOptIn("AWS admin account update");

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const stackName = process.env.AUTH_STACK_NAME || "velyx-auth";
const tableName = process.env.AUTH_USERS_TABLE || process.env.USERS_TABLE || `${stackName}-users`;
const functionName = process.env.AUTH_FUNCTION_NAME || `${stackName}-api`;
const outputFile = process.env.ADMIN_OUTPUT_FILE || "admin-output.json";
const bootstrapToken = process.env.AUTH_ADMIN_BOOTSTRAP_TOKEN || "";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolveApiBase() {
  const fromEnv = process.env.AUTH_API_BASE || process.env.VITE_AUTH_API_BASE;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (existsSync("auth-output.json")) {
    const output = JSON.parse(readFileSync("auth-output.json", "utf8"));
    if (output.apiEndpoint) return String(output.apiEndpoint).replace(/\/$/, "");
  }

  throw new Error("AUTH_API_BASE, VITE_AUTH_API_BASE, or auth-output.json apiEndpoint is required.");
}

const email = normalizeEmail(process.env.ADMIN_EMAIL || "admin@velyx.kr");
const nickname = String(process.env.ADMIN_NICKNAME || "Admin").trim() || "Admin";
const password = process.env.ADMIN_PASSWORD || randomBytes(18).toString("base64url");
const apiBase = resolveApiBase();

if (!validateEmail(email)) {
  throw new Error("ADMIN_EMAIL must be a valid email address.");
}
if (password.length < 8 || password.length > 128) {
  throw new Error("ADMIN_PASSWORD must be 8 to 128 characters.");
}
if (!bootstrapToken) {
  throw new Error("AUTH_ADMIN_BOOTSTRAP_TOKEN is required.");
}

if (process.env.GITHUB_ACTIONS === "true") {
  process.stdout.write(`::add-mask::${password}\n`);
  process.stdout.write(`::add-mask::${bootstrapToken}\n`);
}

const now = new Date().toISOString();
const sts = new STSClient({ region });
const identity = await sts.send(new GetCallerIdentityCommand({}));

const response = await fetch(`${apiBase}/auth/admin/bootstrap`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Admin-Bootstrap-Token": bootstrapToken,
  },
  body: JSON.stringify({ email, nickname, password }),
});

const rawPayload = await response.text();
const payload = rawPayload ? JSON.parse(rawPayload) : {};

if (!response.ok || payload.ok !== true) {
  throw new Error(`Admin bootstrap failed (${response.status}): ${JSON.stringify(payload)}`);
}

const output = {
  email,
  password,
  nickname,
  roles: ["admin"],
  tableName,
  functionName,
  apiBase,
  accountId: identity.Account,
  region,
  updatedAt: now,
};

writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });

process.stdout.write(`Production admin account updated: ${email}\n`);
process.stdout.write(`Output written to ${outputFile}\n`);
