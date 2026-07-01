import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const host = process.env.AUTH_DEV_HOST || "127.0.0.1";
const port = Number(process.env.AUTH_DEV_PORT || 4174);
const localAuthDir = process.env.AUTH_LOCAL_DIR || join(process.cwd(), ".local", "auth");
const pepperFile = process.env.AUTH_LOCAL_PEPPER_FILE || join(localAuthDir, "pepper.key");

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

process.env.AUTH_STORE ||= "file";
process.env.AUTH_LOCAL_USERS_FILE ||= join(localAuthDir, "users.json");
process.env.AUTH_ALLOWED_ORIGINS ||= [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
].join(",");
process.env.PASSWORD_ITERATIONS ||= "120000";
process.env.AUTH_PEPPER = await ensureLocalPepper();

const { handler } = await import("./index.mjs");

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function writeNodeResponse(response, lambdaResponse) {
  for (const [key, value] of Object.entries(lambdaResponse.headers || {})) {
    response.setHeader(key, value);
  }
  response.statusCode = lambdaResponse.statusCode || 500;
  response.end(lambdaResponse.body || "");
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);

  if (request.method === "GET" && url.pathname === "/health") {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ ok: true, store: process.env.AUTH_STORE }));
    return;
  }

  try {
    const body = request.method === "OPTIONS" ? "" : await readRequestBody(request);
    const result = await handler({
      headers: request.headers,
      rawPath: url.pathname,
      requestContext: {
        http: {
          method: request.method,
        },
      },
      body,
      isBase64Encoded: false,
    });
    writeNodeResponse(response, result);
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ message: error.message || "Auth dev server failed." }));
  }
});

server.listen(port, host, () => {
  process.stdout.write(`Auth dev API listening on http://${host}:${port}\n`);
  process.stdout.write(`Using local auth store: ${process.env.AUTH_LOCAL_USERS_FILE}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
