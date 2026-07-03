import { pbkdf2Sync, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const localAuthDir = process.env.AUTH_LOCAL_DIR || join(process.cwd(), ".local", "auth");
const pepperFile = process.env.AUTH_LOCAL_PEPPER_FILE || join(localAuthDir, "pepper.key");
const usersFile = process.env.AUTH_LOCAL_USERS_FILE || join(localAuthDir, "users.json");
const passwordIterations = Number(process.env.PASSWORD_ITERATIONS || 120000);

if (process.env.AUTH_STORE && process.env.AUTH_STORE !== "file") {
  throw new Error("create-admin-user is local-only. Leave AUTH_STORE unset or set AUTH_STORE=file.");
}

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

async function ensureLocalPepper() {
  if (process.env.AUTH_PEPPER) return process.env.AUTH_PEPPER;

  await mkdir(localAuthDir, { recursive: true });
  try {
    return (await readFile(pepperFile, "utf8")).trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const pepper = randomBytes(32).toString("base64url");
  await writeFile(pepperFile, `${pepper}\n`, { mode: 0o600 });
  return pepper;
}

async function readUsers() {
  try {
    return JSON.parse(await readFile(usersFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function hashPassword(password, salt, pepper) {
  return pbkdf2Sync(`${password}:${pepper}`, salt, passwordIterations, 32, "sha256").toString("base64");
}

const email = normalizeEmail(process.env.ADMIN_EMAIL || "admin@nfoifsb.local");
const nickname = String(process.env.ADMIN_NICKNAME || "관리자").trim() || "관리자";
const password = process.env.ADMIN_PASSWORD || randomBytes(18).toString("base64url");
const now = new Date().toISOString();
const salt = randomBytes(16).toString("base64");
const pepper = await ensureLocalPepper();
const users = await readUsers();
const key = userKey(email);

users[key] = {
  ...(users[key] || {}),
  pk: s(key),
  email: s(email),
  nickname: s(nickname),
  passwordHash: s(hashPassword(password, salt, pepper)),
  passwordSalt: s(salt),
  passwordIterations: n(passwordIterations),
  provider: s("site"),
  emailVerified: b(true),
  roles: { SS: ["admin"] },
  createdAt: users[key]?.createdAt || s(now),
  updatedAt: s(now),
};

await mkdir(dirname(usersFile), { recursive: true });
await writeFile(usersFile, `${JSON.stringify(users, null, 2)}\n`, { mode: 0o600 });

const output = [
  "Admin account ready.",
  `ADMIN_EMAIL=${email}`,
  `ADMIN_PASSWORD=${password}`,
  `ADMIN_NICKNAME=${nickname}`,
  `AUTH_LOCAL_USERS_FILE=${usersFile}`,
].join("\n");

process.stdout.write(`${output}\n`);
