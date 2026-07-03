import {
  createHmac,
  createPublicKey,
  createVerify,
  pbkdf2Sync,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DeleteItemCommand, DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const client = new DynamoDBClient({});
const ses = new SESv2Client({ region: process.env.SES_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION });
const tableName = process.env.USERS_TABLE;
const authStore = process.env.AUTH_STORE || (tableName ? "dynamodb" : "file");
const authPepper = process.env.AUTH_PEPPER || (authStore === "file" ? "local-dev-pepper-change-before-production" : "");
const localUsersFile = process.env.AUTH_LOCAL_USERS_FILE || join(process.cwd(), ".local", "auth", "users.json");
const sessionTtlSeconds = Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 14);
const challengeTtlSeconds = Number(process.env.AUTH_CHALLENGE_TTL_SECONDS || 60 * 30);
const allowedOrigins = (process.env.AUTH_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const passwordIterations = Number(process.env.PASSWORD_ITERATIONS || 210000);
const maxBodyBytes = Number(process.env.AUTH_MAX_BODY_BYTES || 16 * 1024);
const emailFrom = process.env.AUTH_EMAIL_FROM || process.env.EMAIL_FROM || "";
const appBaseUrl = (
  process.env.AUTH_APP_BASE_URL ||
  allowedOrigins.find((origin) => origin.startsWith("https://")) ||
  "http://127.0.0.1:5173"
).replace(/\/$/, "");
const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";

let googleKeyCache = {
  expiresAt: 0,
  keys: [],
};

const localRateLimits = new Map();

function isAllowedOrigin(origin) {
  if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes("*")) return true;
  return allowedOrigins.includes(origin);
}

function corsOrigin(origin) {
  if (!origin) return allowedOrigins[0] || "*";
  if (isAllowedOrigin(origin)) return allowedOrigins.includes("*") ? origin : origin;
  return allowedOrigins[0] || "null";
}

function response(statusCode, body, origin, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": corsOrigin(origin),
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "OPTIONS, GET, POST",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      "Content-Type": "application/json; charset=utf-8",
      "Cross-Origin-Resource-Policy": "same-site",
      "Referrer-Policy": "no-referrer",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      Vary: "Origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function clientError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function readBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  if (Buffer.byteLength(raw, "utf8") > maxBodyBytes) {
    throw clientError(413, "요청 본문이 너무 큽니다.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw clientError(400, "JSON 요청 형식이 올바르지 않습니다.");
  }
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

function s(value) {
  return { S: String(value) };
}

function n(value) {
  return { N: String(value) };
}

function b(value) {
  return { BOOL: Boolean(value) };
}

function sourceIp(event) {
  const gatewayIp = event.requestContext?.http?.sourceIp;
  const forwardedFor = event.headers?.["x-forwarded-for"] || event.headers?.["X-Forwarded-For"];
  return String(gatewayIp || forwardedFor || "unknown").split(",")[0].trim() || "unknown";
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

function hashSecret(value) {
  return createHmac("sha256", authPepper).update(String(value)).digest("base64url");
}

async function hitRateLimit(scope, identity, limit, windowSeconds) {
  if (!identity || limit <= 0 || windowSeconds <= 0) return true;

  const now = Math.floor(Date.now() / 1000);
  const windowId = Math.floor(now / windowSeconds);
  const hashedIdentity = hashSecret(`${scope}:${identity}`).slice(0, 48);
  const pk = `RATE#${scope}#${windowId}#${hashedIdentity}`;
  const expiresAtEpoch = (windowId + 1) * windowSeconds + 3600;

  if (authStore === "file") {
    const existing = localRateLimits.get(pk) || { count: 0, expiresAtEpoch };
    if (existing.expiresAtEpoch <= now) localRateLimits.delete(pk);
    if (existing.count >= limit) return false;
    localRateLimits.set(pk, { count: existing.count + 1, expiresAtEpoch });
    return true;
  }

  try {
    await client.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: {
          pk: s(pk),
        },
        UpdateExpression: "SET #expiresAtEpoch = :expiresAtEpoch, #updatedAt = :updatedAt ADD #count :one",
        ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
        ExpressionAttributeNames: {
          "#count": "count",
          "#expiresAtEpoch": "expiresAtEpoch",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":one": n(1),
          ":limit": n(limit),
          ":expiresAtEpoch": n(expiresAtEpoch),
          ":updatedAt": s(new Date(now * 1000).toISOString()),
        },
      }),
    );
    return true;
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return false;
    throw error;
  }
}

async function rateLimitResponse(origin, rules) {
  for (const rule of rules) {
    const ok = await hitRateLimit(rule.scope, rule.identity, rule.limit, rule.windowSeconds);
    if (!ok) {
      return response(
        429,
        { message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        origin,
        { "Retry-After": String(Math.min(rule.windowSeconds, 300)) },
      );
    }
  }
  return null;
}

function secureMatches(expectedHash, value) {
  if (!expectedHash || !value) return false;
  const expected = Buffer.from(expectedHash);
  const actual = Buffer.from(hashSecret(value));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function signSession(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    email: user.email,
    name: user.name,
    provider: user.provider || "site",
    sub: user.sub || "",
    roles: Array.isArray(user.roles) ? user.roles : [],
    emailVerified: Boolean(user.emailVerified),
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

function roleListFromAttribute(attribute) {
  if (!attribute) return [];
  if (Array.isArray(attribute.SS)) return attribute.SS;
  if (attribute.S) return attribute.S.split(",");
  if (Array.isArray(attribute.L)) {
    return attribute.L.map((item) => item.S || "").filter(Boolean);
  }
  return [];
}

function rolesFromItem(item) {
  return [
    ...new Set(
      [...roleListFromAttribute(item.roles), ...roleListFromAttribute(item.role)]
        .map((role) => String(role).trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function publicUser(item, providerOverride = "") {
  return {
    email: item.email.S,
    name: item.nickname?.S || item.name?.S || item.email.S,
    picture: item.picture?.S || "",
    provider: providerOverride || item.provider?.S || "site",
    sub: item.googleSub?.S || "",
    roles: rolesFromItem(item),
    emailVerified: item.emailVerified?.BOOL === true,
    signedInAt: new Date().toISOString(),
  };
}

function getBearerToken(event) {
  const authorization = event.headers?.authorization || event.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(String(authorization).trim());
  return match ? match[1].trim() : "";
}

function verifySessionToken(token) {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) throw clientError(401, "로그인이 필요합니다.");

  const expected = createHmac("sha256", authPepper).update(encodedPayload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw clientError(401, "세션을 확인할 수 없습니다.");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw clientError(401, "세션을 확인할 수 없습니다.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.email || Number(payload.exp || 0) <= now) {
    throw clientError(401, "세션이 만료되었습니다.");
  }
  return payload;
}

async function requireUser(event) {
  const payload = verifySessionToken(getBearerToken(event));
  const item = await getUser(normalizeEmail(payload.email));
  if (!item) throw clientError(401, "계정을 찾을 수 없습니다.");
  return publicUser(item);
}

function isAdminUser(user) {
  return Array.isArray(user?.roles) && user.roles.includes("admin");
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
        pk: s(userKey(email)),
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

async function deleteUser(email) {
  if (authStore === "file") {
    const users = await readLocalUsers();
    delete users[userKey(email)];
    await writeLocalUsers(users);
    return;
  }

  await client.send(
    new DeleteItemCommand({
      TableName: tableName,
      Key: {
        pk: s(userKey(email)),
      },
    }),
  );
}

async function updateUser(email, attributes, removeAttributes = []) {
  if (authStore === "file") {
    const users = await readLocalUsers();
    const key = userKey(email);
    const item = users[key];
    if (!item) {
      const error = new Error("User not found.");
      error.name = "ConditionalCheckFailedException";
      throw error;
    }
    Object.assign(item, attributes);
    for (const name of removeAttributes) delete item[name];
    users[key] = item;
    await writeLocalUsers(users);
    return item;
  }

  const names = {};
  const values = {};
  const sets = [];
  const removes = [];
  let index = 0;

  for (const [name, value] of Object.entries(attributes)) {
    const nameKey = `#n${index}`;
    const valueKey = `:v${index}`;
    names[nameKey] = name;
    values[valueKey] = value;
    sets.push(`${nameKey} = ${valueKey}`);
    index += 1;
  }

  for (const name of removeAttributes) {
    const nameKey = `#n${index}`;
    names[nameKey] = name;
    removes.push(nameKey);
    index += 1;
  }

  const updateParts = [];
  if (sets.length) updateParts.push(`SET ${sets.join(", ")}`);
  if (removes.length) updateParts.push(`REMOVE ${removes.join(", ")}`);

  const result = await client.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: {
        pk: s(userKey(email)),
      },
      UpdateExpression: updateParts.join(" "),
      ConditionExpression: "attribute_exists(pk)",
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: Object.keys(values).length ? values : undefined,
      ReturnValues: "ALL_NEW",
    }),
  );
  return result.Attributes;
}

function createChallenge(prefix) {
  const token = randomBytes(32).toString("base64url");
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + challengeTtlSeconds * 1000).toISOString();
  return {
    token,
    code,
    expiresAt,
    tokenHash: hashSecret(`${prefix}:token:${token}`),
    codeHash: hashSecret(`${prefix}:code:${code}`),
  };
}

function challengeMatches(item, prefix, token, code) {
  const expiresAt = item[`${prefix}ExpiresAt`]?.S;
  if (!expiresAt || Date.parse(expiresAt) < Date.now()) return false;

  const tokenHash = item[`${prefix}TokenHash`]?.S;
  const codeHash = item[`${prefix}CodeHash`]?.S;
  return (
    secureMatches(tokenHash, `${prefix}:token:${token}`) ||
    secureMatches(codeHash, `${prefix}:code:${String(code || "").trim()}`)
  );
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendAuthEmail({ to, subject, text, html }) {
  if (!emailFrom) {
    if (authStore === "file") return { sent: false, reason: "email_not_configured" };
    throw new Error("Auth email sender is not configured.");
  }

  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: emailFrom,
      Destination: {
        ToAddresses: [to],
      },
      Content: {
        Simple: {
          Subject: {
            Charset: "UTF-8",
            Data: subject,
          },
          Body: {
            Text: {
              Charset: "UTF-8",
              Data: text,
            },
            Html: {
              Charset: "UTF-8",
              Data: html,
            },
          },
        },
      },
    }),
  );

  return { sent: true };
}

function emailFailureReason(error) {
  const message = String(error?.message || "").toLowerCase();
  if (error?.name === "MessageRejected" || message.includes("not verified") || message.includes("sandbox")) {
    return "ses_identity_or_sandbox";
  }
  if (error?.name === "AccessDeniedException" || error?.name === "UnauthorizedOperation") {
    return "ses_access_denied";
  }
  if (error?.name === "ThrottlingException" || error?.name === "TooManyRequestsException") {
    return "ses_rate_limited";
  }
  if (!emailFrom) return "email_not_configured";
  return error?.name || "email_delivery_failed";
}

function emailDeliveryFailureResponse(origin, purpose, error) {
  console.error(`${purpose} email delivery failed`, {
    name: error?.name,
    message: error?.message,
    reason: emailFailureReason(error),
  });
  return response(
    502,
    {
      code: "EMAIL_DELIVERY_FAILED",
      message: "메일 발송 설정 문제로 이메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
      emailDelivery: {
        sent: false,
        reason: emailFailureReason(error),
      },
    },
    origin,
  );
}

function buildVerificationUrl(email, token) {
  const params = new URLSearchParams({ mode: "verify", email, token });
  return `${appBaseUrl}/login.html?${params.toString()}`;
}

function buildResetUrl(email, token) {
  const params = new URLSearchParams({ mode: "reset-confirm", email, token });
  return `${appBaseUrl}/login.html?${params.toString()}`;
}

async function sendVerificationEmail(email, challenge) {
  const link = buildVerificationUrl(email, challenge.token);
  const text = [
    "nfoifsb.kr 이메일 인증",
    "",
    `인증 코드: ${challenge.code}`,
    `인증 링크: ${link}`,
    "",
    "30분 안에 인증을 완료해 주세요.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#10201c">
      <h1>nfoifsb.kr 이메일 인증</h1>
      <p>아래 코드를 로그인 화면에 입력하거나 버튼을 눌러 인증을 완료하세요.</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${htmlEscape(challenge.code)}</p>
      <p><a href="${htmlEscape(link)}">이메일 인증하기</a></p>
      <p>이 링크와 코드는 30분 뒤 만료됩니다.</p>
    </div>`;
  const delivery = await sendAuthEmail({ to: email, subject: "nfoifsb.kr 이메일 인증", text, html });
  return { ...delivery, preview: authStore === "file" ? { code: challenge.code, link } : undefined };
}

async function sendPasswordResetEmail(email, challenge) {
  const link = buildResetUrl(email, challenge.token);
  const text = [
    "nfoifsb.kr 비밀번호 재설정",
    "",
    `재설정 코드: ${challenge.code}`,
    `재설정 링크: ${link}`,
    "",
    "30분 안에 새 비밀번호를 설정해 주세요.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#10201c">
      <h1>nfoifsb.kr 비밀번호 재설정</h1>
      <p>아래 코드를 입력하거나 버튼을 눌러 새 비밀번호를 설정하세요.</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${htmlEscape(challenge.code)}</p>
      <p><a href="${htmlEscape(link)}">비밀번호 재설정하기</a></p>
      <p>이 링크와 코드는 30분 뒤 만료됩니다.</p>
    </div>`;
  const delivery = await sendAuthEmail({ to: email, subject: "nfoifsb.kr 비밀번호 재설정", text, html });
  return { ...delivery, preview: authStore === "file" ? { code: challenge.code, link } : undefined };
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "="), "base64");
}

function parseJwt(token) {
  const [headerRaw, payloadRaw, signatureRaw] = String(token || "").split(".");
  if (!headerRaw || !payloadRaw || !signatureRaw) throw new Error("Invalid Google credential.");
  return {
    headerRaw,
    payloadRaw,
    signatureRaw,
    header: JSON.parse(base64UrlDecode(headerRaw).toString("utf8")),
    payload: JSON.parse(base64UrlDecode(payloadRaw).toString("utf8")),
  };
}

async function getGoogleKeys() {
  if (googleKeyCache.keys.length && googleKeyCache.expiresAt > Date.now()) return googleKeyCache.keys;

  const result = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!result.ok) throw new Error("Could not load Google public keys.");
  const payload = await result.json();
  const cacheControl = result.headers.get("cache-control") || "";
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  googleKeyCache = {
    expiresAt: Date.now() + maxAgeSeconds * 1000,
    keys: payload.keys || [],
  };
  return googleKeyCache.keys;
}

async function verifyGoogleCredential(credential) {
  if (!googleClientId) throw new Error("Google client ID is not configured.");
  const token = parseJwt(credential);
  const key = (await getGoogleKeys()).find((candidate) => candidate.kid === token.header.kid);
  if (!key) throw new Error("Google public key was not found.");

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${token.headerRaw}.${token.payloadRaw}`);
  verifier.end();
  const ok = verifier.verify(createPublicKey({ key, format: "jwk" }), base64UrlDecode(token.signatureRaw));
  if (!ok) throw new Error("Invalid Google credential signature.");

  const now = Math.floor(Date.now() / 1000);
  if (!["accounts.google.com", "https://accounts.google.com"].includes(token.payload.iss)) {
    throw new Error("Invalid Google issuer.");
  }
  if (token.payload.aud !== googleClientId) throw new Error("Invalid Google audience.");
  if (Number(token.payload.exp || 0) <= now) throw new Error("Google credential has expired.");
  if (!token.payload.sub || !token.payload.email || token.payload.email_verified !== true) {
    throw new Error("Google email is not verified.");
  }

  return token.payload;
}

async function handleSignup(body, origin) {
  const email = normalizeEmail(body.email);
  const nickname = normalizeNickname(body.nickname);
  const password = String(body.password || "");

  if (!validateEmail(email)) return response(400, { message: "올바른 이메일을 입력해 주세요." }, origin);
  if (nickname.length < 2 || nickname.length > 24) {
    return response(400, { message: "닉네임은 2~24자로 입력해 주세요." }, origin);
  }
  if (password.length < 8 || password.length > 128) {
    return response(400, { message: "비밀번호는 8~128자로 입력해 주세요." }, origin);
  }

  const salt = randomBytes(16).toString("base64");
  const now = new Date().toISOString();
  const challenge = createChallenge("emailVerification");
  const item = {
    pk: s(userKey(email)),
    email: s(email),
    nickname: s(nickname),
    passwordHash: s(hashPassword(password, salt)),
    passwordSalt: s(salt),
    passwordIterations: n(passwordIterations),
    provider: s("site"),
    emailVerified: b(false),
    emailVerificationTokenHash: s(challenge.tokenHash),
    emailVerificationCodeHash: s(challenge.codeHash),
    emailVerificationExpiresAt: s(challenge.expiresAt),
    createdAt: s(now),
    updatedAt: s(now),
  };

  try {
    await putUser(item);
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return response(409, { message: "이미 가입된 이메일입니다." }, origin);
    }
    throw error;
  }

  let delivery;
  try {
    delivery = await sendVerificationEmail(email, challenge);
  } catch (error) {
    await deleteUser(email).catch((rollbackError) => {
      console.error("Failed to roll back signup after email delivery failure", rollbackError);
    });
    return emailDeliveryFailureResponse(origin, "verification", error);
  }
  return response(
    201,
    {
      message: "인증 메일을 보냈습니다. 이메일 인증 후 로그인할 수 있습니다.",
      verificationRequired: true,
      emailDelivery: { sent: delivery.sent, reason: delivery.reason || "" },
      emailPreview: delivery.preview,
    },
    origin,
  );
}

async function handleVerifyEmail(body, origin) {
  const email = normalizeEmail(body.email);
  const token = String(body.token || "").trim();
  const code = String(body.code || "").trim();
  if (!validateEmail(email) || (!token && !code)) {
    return response(400, { message: "이메일과 인증 코드가 필요합니다." }, origin);
  }

  const item = await getUser(email);
  if (!item) return response(400, { message: "인증 정보를 확인하지 못했습니다." }, origin);
  if (item.emailVerified?.BOOL === true) {
    const user = publicUser(item);
    return response(200, { user, session: signSession(user) }, origin);
  }
  if (!challengeMatches(item, "emailVerification", token, code)) {
    return response(400, { message: "인증 코드가 만료되었거나 올바르지 않습니다." }, origin);
  }

  const updated = await updateUser(
    email,
    {
      emailVerified: b(true),
      updatedAt: s(new Date().toISOString()),
    },
    ["emailVerificationTokenHash", "emailVerificationCodeHash", "emailVerificationExpiresAt"],
  );
  const user = publicUser(updated);
  return response(200, { user, session: signSession(user), message: "이메일 인증이 완료되었습니다." }, origin);
}

async function handleResendVerification(body, origin) {
  const email = normalizeEmail(body.email);
  if (!validateEmail(email)) return response(400, { message: "올바른 이메일을 입력해 주세요." }, origin);

  const item = await getUser(email);
  if (!item || item.emailVerified?.BOOL === true) {
    return response(200, { message: "가입 정보가 있으면 인증 메일을 다시 보냅니다." }, origin);
  }

  const challenge = createChallenge("emailVerification");
  await updateUser(email, {
    emailVerificationTokenHash: s(challenge.tokenHash),
    emailVerificationCodeHash: s(challenge.codeHash),
    emailVerificationExpiresAt: s(challenge.expiresAt),
    updatedAt: s(new Date().toISOString()),
  });
  let delivery;
  try {
    delivery = await sendVerificationEmail(email, challenge);
  } catch (error) {
    return emailDeliveryFailureResponse(origin, "verification resend", error);
  }
  return response(
    200,
    {
      message: "인증 메일을 다시 보냈습니다.",
      emailDelivery: { sent: delivery.sent, reason: delivery.reason || "" },
      emailPreview: delivery.preview,
    },
    origin,
  );
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
  if (item.emailVerified?.BOOL !== true) {
    return response(403, { code: "EMAIL_NOT_VERIFIED", message: "이메일 인증 후 로그인할 수 있습니다." }, origin);
  }

  const user = publicUser(item);
  return response(200, { user, session: signSession(user) }, origin);
}

async function handleReset(body, origin) {
  const email = normalizeEmail(body.email);
  if (!validateEmail(email)) return response(400, { message: "올바른 이메일을 입력해 주세요." }, origin);

  const item = await getUser(email);
  let preview;
  if (item) {
    const challenge = createChallenge("passwordReset");
    await updateUser(email, {
      passwordResetTokenHash: s(challenge.tokenHash),
      passwordResetCodeHash: s(challenge.codeHash),
      passwordResetExpiresAt: s(challenge.expiresAt),
      resetRequestedAt: s(new Date().toISOString()),
      updatedAt: s(new Date().toISOString()),
    });
    let delivery;
    try {
      delivery = await sendPasswordResetEmail(email, challenge);
    } catch (error) {
      return emailDeliveryFailureResponse(origin, "password reset", error);
    }
    preview = delivery.preview;
  }

  return response(
    200,
    {
      message: "가입된 계정이면 비밀번호 재설정 메일을 보냈습니다.",
      emailPreview: preview,
    },
    origin,
  );
}

async function handleResetConfirm(body, origin) {
  const email = normalizeEmail(body.email);
  const token = String(body.token || "").trim();
  const code = String(body.code || "").trim();
  const password = String(body.password || "");

  if (!validateEmail(email) || (!token && !code)) {
    return response(400, { message: "이메일과 재설정 코드가 필요합니다." }, origin);
  }
  if (password.length < 8 || password.length > 128) {
    return response(400, { message: "비밀번호는 8~128자로 입력해 주세요." }, origin);
  }

  const item = await getUser(email);
  if (!item || !challengeMatches(item, "passwordReset", token, code)) {
    return response(400, { message: "재설정 코드가 만료되었거나 올바르지 않습니다." }, origin);
  }

  const salt = randomBytes(16).toString("base64");
  const updated = await updateUser(
    email,
    {
      passwordHash: s(hashPassword(password, salt)),
      passwordSalt: s(salt),
      passwordIterations: n(passwordIterations),
      emailVerified: b(true),
      updatedAt: s(new Date().toISOString()),
    },
    ["passwordResetTokenHash", "passwordResetCodeHash", "passwordResetExpiresAt", "resetRequestedAt"],
  );
  const user = publicUser(updated);
  return response(200, { user, session: signSession(user), message: "비밀번호가 변경되었습니다." }, origin);
}

async function handleGoogle(body, origin) {
  const credential = String(body.credential || "");
  if (!credential) return response(400, { message: "Google 인증 정보가 필요합니다." }, origin);

  let payload;
  try {
    payload = await verifyGoogleCredential(credential);
  } catch (error) {
    return response(401, { message: "Google 인증을 확인하지 못했습니다." }, origin);
  }

  const email = normalizeEmail(payload.email);
  const now = new Date().toISOString();
  let item = await getUser(email);
  if (!item) {
    item = {
      pk: s(userKey(email)),
      email: s(email),
      nickname: s(payload.name || email),
      provider: s("google"),
      googleSub: s(payload.sub),
      picture: s(payload.picture || ""),
      emailVerified: b(true),
      createdAt: s(now),
      updatedAt: s(now),
    };
    try {
      await putUser(item);
    } catch (error) {
      if (error.name !== "ConditionalCheckFailedException") throw error;
      item = await getUser(email);
    }
  }

  const updated = await updateUser(email, {
    provider: s("google"),
    googleSub: s(payload.sub),
    picture: s(payload.picture || ""),
    emailVerified: b(true),
    updatedAt: s(now),
  });
  const user = publicUser(updated, "google");
  return response(200, { user, session: signSession(user) }, origin);
}

async function handleMe(event, origin) {
  const user = await requireUser(event);
  return response(200, { user }, origin);
}

async function handleAdminSummary(event, origin) {
  const user = await requireUser(event);
  if (!isAdminUser(user)) {
    return response(403, { message: "관리자 권한이 필요합니다." }, origin);
  }

  return response(
    200,
    {
      user,
      permissions: ["notice:write", "community:moderate", "resources:write", "settings:read"],
      categories: [
        { key: "notice", label: "공지" },
        { key: "community", label: "커뮤니티" },
        { key: "resources", label: "자료실" },
      ],
      checkedAt: new Date().toISOString(),
    },
    origin,
  );
}

async function handleInternalCreateAdminUser(event) {
  const email = normalizeEmail(event.email);
  const nickname = normalizeNickname(event.nickname || "Admin") || "Admin";
  const password = String(event.password || "");

  if (!validateEmail(email)) throw clientError(400, "Admin email is invalid.");
  if (password.length < 8 || password.length > 128) {
    throw clientError(400, "Admin password must be 8 to 128 characters.");
  }

  const salt = randomBytes(16).toString("base64");
  const now = new Date().toISOString();
  const attributes = {
    email: s(email),
    nickname: s(nickname),
    passwordHash: s(hashPassword(password, salt)),
    passwordSalt: s(salt),
    passwordIterations: n(passwordIterations),
    provider: s("site"),
    emailVerified: b(true),
    roles: { SS: ["admin"] },
    updatedAt: s(now),
  };
  const challengeAttributes = [
    "emailVerificationTokenHash",
    "emailVerificationCodeHash",
    "emailVerificationExpiresAt",
    "passwordResetTokenHash",
    "passwordResetCodeHash",
    "passwordResetExpiresAt",
    "resetRequestedAt",
  ];

  const existing = await getUser(email);
  if (existing) {
    await updateUser(email, attributes, challengeAttributes);
  } else {
    try {
      await putUser({
        pk: s(userKey(email)),
        ...attributes,
        createdAt: s(now),
      });
    } catch (error) {
      if (error.name !== "ConditionalCheckFailedException") throw error;
      await updateUser(email, attributes, challengeAttributes);
    }
  }

  return {
    ok: true,
    user: {
      email,
      name: nickname,
      roles: ["admin"],
      emailVerified: true,
    },
    updatedAt: now,
  };
}

export async function handler(event) {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const method = event.requestContext?.http?.method || event.httpMethod || "";
  const path = event.rawPath || event.path || "";

  if (method === "OPTIONS") return response(204, {}, origin);
  if (origin && !isAllowedOrigin(origin)) {
    return response(403, { message: "허용되지 않은 출처입니다." }, origin);
  }

  if (!["dynamodb", "file"].includes(authStore)) {
    return response(500, { message: "Auth store is not supported." }, origin);
  }

  if ((authStore === "dynamodb" && !tableName) || !authPepper) {
    return response(500, { message: "Auth service is not configured." }, origin);
  }

  if (event?.internalTask === "createAdminUser") {
    try {
      return await handleInternalCreateAdminUser(event);
    } catch (error) {
      console.error("Internal admin creation failed", {
        name: error?.name,
        message: error?.message,
      });
      return { ok: false, message: error?.message || "Internal admin creation failed." };
    }
  }

  try {
    const body = readBody(event);
    const ip = sourceIp(event);
    const email = normalizeEmail(body.email);

    if (method === "GET" && path.endsWith("/auth/me")) {
      return await handleMe(event, origin);
    }
    if (method === "GET" && path.endsWith("/auth/admin/summary")) {
      return await handleAdminSummary(event, origin);
    }
    if (method === "POST" && path.endsWith("/auth/signup")) {
      const limited = await rateLimitResponse(origin, [
        { scope: "signup-ip", identity: ip, limit: 30, windowSeconds: 3600 },
        { scope: "signup-email", identity: email, limit: 4, windowSeconds: 3600 },
      ]);
      if (limited) return limited;
      return await handleSignup(body, origin);
    }
    if (method === "POST" && path.endsWith("/auth/verify-email")) {
      const limited = await rateLimitResponse(origin, [
        { scope: "verify-ip", identity: ip, limit: 30, windowSeconds: 900 },
        { scope: "verify-email", identity: email, limit: 10, windowSeconds: 900 },
      ]);
      if (limited) return limited;
      return await handleVerifyEmail(body, origin);
    }
    if (method === "POST" && path.endsWith("/auth/resend-verification")) {
      const limited = await rateLimitResponse(origin, [
        { scope: "resend-ip", identity: ip, limit: 12, windowSeconds: 3600 },
        { scope: "resend-email", identity: email, limit: 4, windowSeconds: 3600 },
      ]);
      if (limited) return limited;
      return await handleResendVerification(body, origin);
    }
    if (method === "POST" && path.endsWith("/auth/login")) {
      const limited = await rateLimitResponse(origin, [
        { scope: "login-ip", identity: ip, limit: 40, windowSeconds: 900 },
        { scope: "login-email", identity: email, limit: 12, windowSeconds: 900 },
      ]);
      if (limited) return limited;
      return await handleLogin(body, origin);
    }
    if (method === "POST" && path.endsWith("/auth/reset/confirm")) {
      const limited = await rateLimitResponse(origin, [
        { scope: "reset-confirm-ip", identity: ip, limit: 30, windowSeconds: 900 },
        { scope: "reset-confirm-email", identity: email, limit: 10, windowSeconds: 900 },
      ]);
      if (limited) return limited;
      return await handleResetConfirm(body, origin);
    }
    if (method === "POST" && path.endsWith("/auth/reset")) {
      const limited = await rateLimitResponse(origin, [
        { scope: "reset-ip", identity: ip, limit: 12, windowSeconds: 3600 },
        { scope: "reset-email", identity: email, limit: 4, windowSeconds: 3600 },
      ]);
      if (limited) return limited;
      return await handleReset(body, origin);
    }
    if (method === "POST" && path.endsWith("/auth/google")) {
      const limited = await rateLimitResponse(origin, [
        { scope: "google-ip", identity: ip, limit: 60, windowSeconds: 900 },
      ]);
      if (limited) return limited;
      return await handleGoogle(body, origin);
    }
    return response(404, { message: "Not found." }, origin);
  } catch (error) {
    if (error.statusCode) {
      return response(error.statusCode, { message: error.message }, origin);
    }
    console.error(error);
    return response(500, { message: "요청을 처리하지 못했습니다." }, origin);
  }
}
