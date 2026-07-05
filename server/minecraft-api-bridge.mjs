import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const host = process.env.MINECRAFT_API_HOST || "127.0.0.1";
const port = numberEnv("MINECRAFT_API_PORT", 8787);
const basePath = normalizeBasePath(process.env.MINECRAFT_API_BASE_PATH || "/minecraft");
const serverDir = process.env.MINECRAFT_SERVER_DIR || "/home/ad1969/minecraft-fabric";
const serviceName = process.env.MINECRAFT_SERVICE_NAME || "minecraft-fabric.service";
const stockDataFile = process.env.MINECRAFT_STOCK_DATA_FILE || "/home/ad1969/minecraft/plugins/AuroraLink/stocks.json";
const javaProcessPattern = process.env.MINECRAFT_JAVA_PROCESS_PATTERN || "fabric-server-launch.jar";
const statusHost = process.env.MINECRAFT_STATUS_HOST || "127.0.0.1";
const statusPort = numberEnv("MINECRAFT_STATUS_PORT", 25565);
const statusTimeoutMs = numberEnv("MINECRAFT_STATUS_TIMEOUT_MS", 2500);
const allowedOrigins = splitCsv(
  process.env.MINECRAFT_API_ALLOWED_ORIGINS ||
    "https://www.nfoifsb.kr,https://api.nfoifsb.kr,http://localhost:5173,http://127.0.0.1:5173",
);

const outstandingShares = {
  DMD: 24000,
  FARM: 42000,
  LOG: 36000,
  RED: 28000,
};

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBasePath(value) {
  const text = String(value || "").trim();
  if (!text || text === "/") return "";
  return `/${text.replace(/^\/+|\/+$/g, "")}`;
}

function roundMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

function percentChange(current, open) {
  const currentNumber = Number(current);
  const openNumber = Number(open);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(openNumber) || Math.abs(openNumber) < 0.000001) return 0;
  return Math.round(((currentNumber - openNumber) / openNumber) * 10000) / 100;
}

function asTimestamp(value, fallback = Date.now()) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function iso(value, fallback = Date.now()) {
  return new Date(asTimestamp(value, fallback)).toISOString();
}

function jsonResponse(response, status, payload) {
  const body = Buffer.from(`${JSON.stringify(payload)}\n`, "utf8");
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(body.length),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function routeError(status, message, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.payload = { ok: false, message, ...extra };
  return error;
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes("*"))) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Aurora-Admin-Token");
  response.setHeader("Access-Control-Max-Age", "3600");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function routePath(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  let pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`))) {
    pathname = pathname.slice(basePath.length) || "/";
  }
  return pathname;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw routeError(400, "Invalid JSON body.");
  }
}

async function readJsonFile(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function candlePayload(candle) {
  const close = roundMoney(candle?.close ?? candle?.price ?? candle?.open);
  const open = roundMoney(candle?.open ?? close);
  return {
    time: iso(candle?.startedAt ?? candle?.time ?? candle?.at),
    open,
    high: roundMoney(candle?.high ?? Math.max(open, close)),
    low: roundMoney(candle?.low ?? Math.min(open, close)),
    close,
    volume: Math.max(0, Number(candle?.volume) || 0),
    trades: Math.max(0, Number(candle?.trades) || 0),
  };
}

function stockHistory(stock) {
  return (Array.isArray(stock?.candles) ? stock.candles : [])
    .map(candlePayload)
    .filter((item) => Number.isFinite(Date.parse(item.time)))
    .sort((left, right) => Date.parse(left.time) - Date.parse(right.time));
}

function candlesForWindow(history, windowMs) {
  if (!history.length) return [];
  const lastTime = Date.parse(history.at(-1).time);
  if (!Number.isFinite(lastTime)) return history;
  const cutoff = lastTime - windowMs;
  const window = history.filter((item) => Date.parse(item.time) >= cutoff);
  return window.length ? window : history;
}

function stockPayload(stock) {
  const symbol = String(stock?.symbol || stock?.code || "UNKNOWN").toUpperCase();
  const history = stockHistory(stock);
  const price = roundMoney(stock?.currentPrice ?? stock?.price ?? history.at(-1)?.close);
  const day = candlesForWindow(history, 24 * 60 * 60 * 1000);
  const open24h = roundMoney(day[0]?.open ?? history[0]?.open ?? price);
  const highs = day.map((item) => Number(item.high)).filter(Number.isFinite);
  const lows = day.map((item) => Number(item.low)).filter(Number.isFinite);
  const volume24h = day.reduce((sum, item) => sum + Math.max(0, Number(item.volume) || 0), 0);

  return {
    symbol,
    code: symbol,
    name: stock?.name || symbol,
    price,
    open24h,
    high24h: roundMoney(highs.length ? Math.max(price, ...highs) : price),
    low24h: roundMoney(lows.length ? Math.min(price, ...lows) : price),
    change24h: percentChange(price, open24h),
    volume24h,
    marketCap: roundMoney(price * (outstandingShares[symbol] || 1)),
    history,
    updatedAt: history.at(-1)?.time || iso(stock?.createdAt),
  };
}

function tradePayload(trade) {
  return {
    id: trade?.id,
    symbol: trade?.symbol,
    code: trade?.symbol,
    name: trade?.name,
    side: trade?.side,
    playerName: trade?.playerName,
    quantity: Number(trade?.quantity) || 0,
    price: roundMoney(trade?.price),
    total: roundMoney(trade?.total ?? Number(trade?.quantity) * Number(trade?.price)),
    fee: roundMoney(trade?.fee),
    at: iso(trade?.at ?? trade?.timestamp ?? trade?.createdAt),
  };
}

async function stockMarket() {
  const raw = await readJsonFile(stockDataFile);
  const stocks = Object.values(raw.stocks || {}).map(stockPayload);
  if (!stocks.length) throw routeError(503, "Stock data file has no symbols.");

  const index = stocks.reduce((sum, stock) => sum + Number(stock.price || 0), 0);
  const openIndex = stocks.reduce((sum, stock) => sum + Number(stock.open24h || stock.price || 0), 0);
  const marketCap = stocks.reduce((sum, stock) => sum + Number(stock.marketCap || 0), 0);
  const volume24h = stocks.reduce((sum, stock) => sum + Math.max(0, Number(stock.volume24h) || 0), 0);
  const updatedAt = Math.max(
    asTimestamp(raw.lastAdvancedAt),
    ...stocks.map((stock) => Date.parse(stock.updatedAt)).filter(Number.isFinite),
  );
  const recentTrades = (Array.isArray(raw.trades) ? raw.trades : []).slice(-14).reverse().map(tradePayload);

  return {
    ok: true,
    source: "fabric-file-bridge",
    market: {
      index: roundMoney(index * 10),
      indexChange24h: percentChange(index, openIndex),
      volume24h,
      marketCap: roundMoney(marketCap),
      session: "FABRIC BRIDGE",
      updatedAt: new Date(updatedAt).toISOString(),
    },
    stocks,
    recentTrades,
  };
}

function writeVarInt(value) {
  let number = value >>> 0;
  const bytes = [];
  do {
    let byte = number & 0x7f;
    number >>>= 7;
    if (number !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (number !== 0);
  return Buffer.from(bytes);
}

function readVarInt(buffer, offset = 0) {
  let value = 0;
  let position = 0;
  let currentOffset = offset;
  while (currentOffset < buffer.length) {
    const current = buffer[currentOffset];
    value |= (current & 0x7f) << (7 * position);
    currentOffset += 1;
    if ((current & 0x80) !== 0x80) return { value, offset: currentOffset };
    position += 1;
    if (position > 5) throw new Error("VarInt is too big");
  }
  return null;
}

function writeString(value) {
  const body = Buffer.from(String(value), "utf8");
  return Buffer.concat([writeVarInt(body.length), body]);
}

function packet(body) {
  return Buffer.concat([writeVarInt(body.length), body]);
}

function statusRequestPacket() {
  const hostBody = writeString(statusHost);
  const portBody = Buffer.alloc(2);
  portBody.writeUInt16BE(statusPort);
  const handshake = packet(Buffer.concat([writeVarInt(0), writeVarInt(-1), hostBody, portBody, writeVarInt(1)]));
  const request = packet(writeVarInt(0));
  return Buffer.concat([handshake, request]);
}

function parseStatusResponse(buffer) {
  const length = readVarInt(buffer, 0);
  if (!length) return null;
  if (buffer.length < length.offset + length.value) return null;
  const packetId = readVarInt(buffer, length.offset);
  if (!packetId) return null;
  const jsonLength = readVarInt(buffer, packetId.offset);
  if (!jsonLength) return null;
  const start = jsonLength.offset;
  const end = start + jsonLength.value;
  if (buffer.length < end) return null;
  return JSON.parse(buffer.slice(start, end).toString("utf8"));
}

async function minecraftStatus() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: statusHost, port: statusPort });
    const chunks = [];
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Minecraft status ping timed out."));
    }, statusTimeoutMs);

    socket.once("connect", () => socket.write(statusRequestPacket()));
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      try {
        const parsed = parseStatusResponse(Buffer.concat(chunks));
        if (parsed) {
          clearTimeout(timer);
          socket.end();
          resolve(parsed);
        }
      } catch (error) {
        clearTimeout(timer);
        socket.destroy();
        reject(error);
      }
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.once("close", () => clearTimeout(timer));
  });
}

async function serviceActive() {
  try {
    const { stdout } = await execFileAsync("systemctl", ["is-active", serviceName], { timeout: 1500 });
    return stdout.trim() === "active";
  } catch {
    return false;
  }
}

async function javaPid() {
  try {
    const { stdout } = await execFileAsync("pgrep", ["-f", javaProcessPattern], { timeout: 1500 });
    return stdout
      .trim()
      .split(/\s+/)
      .map((item) => Number(item))
      .filter(Number.isFinite)
      .at(-1);
  } catch {
    return 0;
  }
}

async function parseProperties(file) {
  try {
    const text = await fs.readFile(file, "utf8");
    const values = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      values[key] = rest.join("=").replace(/\\:/g, ":");
    }
    return values;
  } catch {
    return {};
  }
}

function parseByteSize(value) {
  const match = String(value || "").match(/^(\d+(?:\.\d+)?)([kKmMgGtT]?)$/);
  if (!match) return 0;
  const number = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit === "t" ? 1024 ** 4 : unit === "g" ? 1024 ** 3 : unit === "m" ? 1024 ** 2 : unit === "k" ? 1024 : 1;
  return Math.round(number * multiplier);
}

async function xmxBytes() {
  try {
    const text = await fs.readFile(path.join(serverDir, "start.sh"), "utf8");
    const match = text.match(/-Xmx([^\s]+)/);
    return parseByteSize(match?.[1]);
  } catch {
    return 0;
  }
}

async function memorySnapshot() {
  const pid = await javaPid();
  const maxBytes = (await xmxBytes()) || os.totalmem();
  if (!pid) {
    return {
      usedBytes: 0,
      freeBytes: maxBytes,
      totalBytes: maxBytes,
      maxBytes,
      usedPercent: 0,
    };
  }

  try {
    const status = await fs.readFile(`/proc/${pid}/status`, "utf8");
    const rssKb = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0);
    const usedBytes = rssKb * 1024;
    return {
      usedBytes,
      freeBytes: Math.max(0, maxBytes - usedBytes),
      totalBytes: maxBytes,
      maxBytes,
      usedPercent: maxBytes > 0 ? Math.round((usedBytes * 1000) / maxBytes) / 10 : 0,
    };
  } catch {
    return {
      usedBytes: 0,
      freeBytes: maxBytes,
      totalBytes: maxBytes,
      maxBytes,
      usedPercent: 0,
    };
  }
}

async function temperatureSnapshot() {
  const paths = [
    "/sys/class/thermal/thermal_zone0/temp",
    "/sys/class/hwmon/hwmon0/temp1_input",
  ];
  for (const file of paths) {
    try {
      const raw = Number((await fs.readFile(file, "utf8")).trim());
      if (Number.isFinite(raw)) {
        const celsius = raw > 1000 ? raw / 1000 : raw;
        return { available: true, celsius: Math.round(celsius * 10) / 10 };
      }
    } catch {
      // Try the next sensor path.
    }
  }
  return { available: false };
}

async function systemSnapshot() {
  const load = os.loadavg();
  return {
    cpu: {
      availableProcessors: os.cpus().length,
      loadAverage: Math.round(load[0] * 100) / 100,
      systemLoadPercent: Math.round((load[0] / Math.max(1, os.cpus().length)) * 1000) / 10,
    },
    temperature: await temperatureSnapshot(),
  };
}

function plainDescription(description) {
  if (!description) return "";
  if (typeof description === "string") return description;
  if (Array.isArray(description)) return description.map(plainDescription).join("");
  const text = description.text || "";
  const extra = Array.isArray(description.extra) ? description.extra.map(plainDescription).join("") : "";
  return `${text}${extra}`;
}

async function serverOverview() {
  const properties = await parseProperties(path.join(serverDir, "server.properties"));
  const active = await serviceActive();
  let status = null;
  try {
    status = await minecraftStatus();
  } catch {
    // A booting server can be active before the status ping accepts connections.
  }

  const samples = Array.isArray(status?.players?.sample) ? status.players.sample : [];
  const players = {
    online: Number(status?.players?.online ?? 0),
    max: Number(status?.players?.max ?? properties["max-players"] ?? 0),
    list: samples.map((player) => ({
      name: player.name,
      uuid: player.id,
      ping: null,
    })),
  };

  return {
    ok: true,
    online: active && Boolean(status),
    minecraftVersion: status?.version?.name || properties["minecraft-version"] || "",
    serverVersion: status?.version?.name || "",
    motd: plainDescription(status?.description) || properties.motd || "",
    linkedPlayers: 0,
    economyProvider: "Fabric bridge / AuroraLink stock file",
    players,
    tps: [],
    memory: await memorySnapshot(),
    system: await systemSnapshot(),
    updatedAt: new Date().toISOString(),
  };
}

async function readOnlyPortfolio(body) {
  const nickname = String(body?.nickname || "").trim();
  if (!nickname) throw routeError(400, "nickname is required.");
  throw routeError(503, "Portfolio and trading require the Fabric AuroraLink gameplay bridge. Public market data is online.");
}

function unavailableFeature() {
  throw routeError(503, "This player action requires the Fabric AuroraLink gameplay bridge. Public market data and server status are online.");
}

async function handleRoute(request) {
  const method = request.method === "HEAD" ? "GET" : request.method;
  const pathname = routePath(request.url);

  if (method === "GET" && (pathname === "/" || pathname === "/health")) {
    return {
      ok: true,
      service: "nfoifsb-minecraft-api-bridge",
      mode: "fabric-read-only",
      basePath: basePath || "/",
      stockDataFile,
      updatedAt: new Date().toISOString(),
    };
  }

  if (method === "GET" && pathname === "/server/overview") return serverOverview();
  if (method === "GET" && pathname === "/stocks/market") return stockMarket();

  if (method === "POST" && pathname === "/stocks/portfolio") return readOnlyPortfolio(await readBody(request));
  if (method === "POST" && pathname === "/stocks/trade") unavailableFeature();
  if (method === "POST" && (pathname === "/verification/start" || pathname === "/verification/check")) unavailableFeature();
  if (method === "POST" && pathname === "/admin/broadcast") unavailableFeature();
  if (/^\/players\/[^/]+\/inventory$/.test(pathname) && method === "GET") unavailableFeature();
  if (/^\/players\/[^/]+\/actions\/[^/]+$/.test(pathname) && method === "POST") unavailableFeature();

  throw routeError(404, "Route not found.");
}

const server = http.createServer(async (request, response) => {
  applyCors(request, response);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const payload = await handleRoute(request);
    jsonResponse(response, 200, await payload);
  } catch (error) {
    const status = error.status || 500;
    const payload = error.payload || { ok: false, message: status === 500 ? "Internal server error." : error.message };
    if (status >= 500) console.error(error);
    jsonResponse(response, status, payload);
  }
});

server.listen(port, host, () => {
  console.log(`nfoifsb Minecraft API bridge listening on http://${host}:${port}${basePath}`);
});
