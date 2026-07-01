import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const tableName = process.env.USERS_TABLE;
const authStore = process.env.AUTH_STORE || (tableName ? "dynamodb" : "file");
const authPepper = process.env.AUTH_PEPPER || (authStore === "file" ? "local-dev-pepper-change-before-production" : "");
const localUsersFile =
  process.env.AUTH_LOCAL_USERS_FILE || join(process.cwd(), ".local", "auth", "users.json");
const sessionTtlSeconds = Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 14);
const allowedOrigins = (process.env.AUTH_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const passwordIterations = Number(process.env.PASSWORD_ITERATIONS || 210000);

function corsOrigin(origin) {
  if (!origin) return allowedOrigins[0] || "*";
  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return origin;
  return allowedOrigins[0] || origin;
}

function response(statusCode, body, origin) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": corsOrigin(origin),
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "OPTIONS, POST",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      Vary: "Origin",
    },
    body: JSON.stringify(body),
  };
}

function readBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(raw);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeNickname(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function userKey(email) {
  return `EMAIL#${email}`;
}

async function readLocalUsers() {
  try {
    return JSON.parse(await readFile(localUsersFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function writeLocalUsers(users) {
  await mkdir(dirname(localUsersFile), { recursive: true });
  await writeFile(localUsersFile, `${JSON.stringify(users, null, 2)}\n`);
}

function hashPassword(password, salt) {
  return pbkdf2Sync(`${password}:${authPepper}`, salt, passwordIterations, 32, "sha256").toString("base64");
}

function signSession(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    email: user.email,
    name: user.name,
    provider: "site",
    iat: now,
    exp: now + sessionTtlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", authPepper).update(encodedPayload).digest("base64url");
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

function publicUser(item) {
  return {
    email: item.email.S,
    name: item.nickname.S,
    provider: "site",
    signedInAt: new Date().toISOString(),
  };
}

async function getUser(email) {
  if (authStore === "file") {
    const users = await readLocalUsers();
    return users[userKey(email)] || null;
  }

  const result = await client.send(
    new GetItemCommand({
      TableName: tableName,
      Key: {
        pk: { S: userKey(email) },
      },
      ConsistentRead: true,
    }),
  );
  return result.Item || null;
}

async function putUser(item) {
  if (authStore === "file") {
    const users = await readLocalUsers();
    const key = item.pk.S;
    if (users[key]) {
      const error = new Error("User already exists.");
      error.name = "ConditionalCheckFailedException";
      throw error;
    }
    users[key] = item;
    await writeLocalUsers(users);
    return;
  }

  await client.send(
    new PutItemCommand({
      TableName: tableName,
      Item: item,
      ConditionExpression: "attribute_not_exists(pk)",
    }),
  );
}

async function markResetRequested(email, requestedAt) {
  if (authStore === "file") {
    const users = await readLocalUsers();
    const key = userKey(email);
    if (users[key]) {
      users[key].resetRequestedAt = { S: requestedAt };
      users[key].updatedAt = { S: requestedAt };
      await writeLocalUsers(users);
    }
    return;
  }

  await client.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: {
        pk: { S: userKey(email) },
      },
      UpdateExpression: "SET resetRequestedAt = :now",
      ConditionExpression: "attribute_exists(pk)",
      ExpressionAttributeValues: {
        ":now": { S: requestedAt },
      },
    }),
  );
}

async function handleSignup(body, origin) {
  const email = normalizeEmail(body.email);
  const nickname = normalizeNickname(body.nickname);
  const password = String(body.password || "");

  if (!validateEmail(email)) {
    return response(400, { message: "올바른 이메일을 입력해 주세요." }, origin);
  }
  if (nickname.length < 2 || nickname.length > 24) {
    return response(400, { message: "닉네임은 2~24자로 입력해 주세요." }, origin);
  }
  if (password.length < 8 || password.length > 128) {
    return response(400, { message: "비밀번호는 8~128자로 입력해 주세요." }, origin);
  }

  const salt = randomBytes(16).toString("base64");
  const now = new Date().toISOString();
  const item = {
    pk: { S: userKey(email) },
    email: { S: email },
    nickname: { S: nickname },
    passwordHash: { S: hashPassword(password, salt) },
    passwordSalt: { S: salt },
    passwordIterations: { N: String(passwordIterations) },
    provider: { S: "site" },
    createdAt: { S: now },
    updatedAt: { S: now },
  };

  try {
    await putUser(item);
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return response(409, { message: "이미 가입된 이메일입니다." }, origin);
    }
    throw error;
  }

  const user = publicUser(item);
  return response(201, { user, session: signSession(user) }, origin);
}

async function handleLogin(body, origin) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!validateEmail(email) || !password) {
    return response(400, { message: "이메일과 비밀번호를 입력해 주세요." }, origin);
  }

  const item = await getUser(email);
  if (!item?.passwordHash?.S || !item?.passwordSalt?.S) {
    return response(401, { message: "이메일 또는 비밀번호가 올바르지 않습니다." }, origin);
  }

  const expected = Buffer.from(item.passwordHash.S);
  const actual = Buffer.from(hashPassword(password, item.passwordSalt.S));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return response(401, { message: "이메일 또는 비밀번호가 올바르지 않습니다." }, origin);
  }

  const user = publicUser(item);
  return response(200, { user, session: signSession(user) }, origin);
}

async function handleReset(body, origin) {
  const email = normalizeEmail(body.email);
  if (!validateEmail(email)) {
    return response(400, { message: "올바른 이메일을 입력해 주세요." }, origin);
  }

  const now = new Date().toISOString();
  try {
    await markResetRequested(email, now);
  } catch (error) {
    if (error.name !== "ConditionalCheckFailedException") throw error;
  }

  return response(200, { message: "가입된 계정이면 비밀번호 재설정 요청이 기록됩니다." }, origin);
}

export async function handler(event) {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const method = event.requestContext?.http?.method || event.httpMethod || "";
  const path = event.rawPath || event.path || "";

  if (method === "OPTIONS") {
    return response(204, {}, origin);
  }

  if (!["dynamodb", "file"].includes(authStore)) {
    return response(500, { message: "Auth store is not supported." }, origin);
  }

  if ((authStore === "dynamodb" && !tableName) || !authPepper) {
    return response(500, { message: "Auth service is not configured." }, origin);
  }

  try {
    const body = readBody(event);
    if (method === "POST" && path.endsWith("/auth/signup")) return await handleSignup(body, origin);
    if (method === "POST" && path.endsWith("/auth/login")) return await handleLogin(body, origin);
    if (method === "POST" && path.endsWith("/auth/reset")) return await handleReset(body, origin);
    return response(404, { message: "Not found." }, origin);
  } catch (error) {
    console.error(error);
    return response(500, { message: "요청을 처리하지 못했습니다." }, origin);
  }
}
