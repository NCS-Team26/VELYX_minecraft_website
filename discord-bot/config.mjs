import "dotenv/config";
import path from "node:path";

const DEFAULT_PLAYER_API_BASE = "https://www.nfoifsb.kr/minecraft";

function stripTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function boolFromEnv(name, fallback = false) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

const defaultDataDir = path.resolve(process.cwd(), "discord-bot", "data");

export const config = {
  token: process.env.DISCORD_TOKEN || "",
  clientId: process.env.DISCORD_CLIENT_ID || "",
  guildId: process.env.DISCORD_GUILD_ID || "",
  playerApiBase: stripTrailingSlash(
    process.env.DISCORD_PLAYER_API_BASE || process.env.VITE_PLAYER_API_BASE || DEFAULT_PLAYER_API_BASE,
  ),
  siteUrl: stripTrailingSlash(process.env.DISCORD_SITE_URL || process.env.AUTH_APP_BASE_URL || "https://www.nfoifsb.kr"),
  minecraftAddress: process.env.DISCORD_MINECRAFT_ADDRESS || "nfoifsb.kr",
  adminToken: process.env.DISCORD_MINECRAFT_ADMIN_TOKEN || process.env.MINECRAFT_ADMIN_TOKEN || "",
  dataDir: path.resolve(process.env.DISCORD_BOT_DATA_DIR || defaultDataDir),
  requestTimeoutMs: numberFromEnv("DISCORD_API_TIMEOUT_MS", 8500),
  publicActionReplies: boolFromEnv("DISCORD_PUBLIC_ACTION_REPLIES", true),
};

export function requireDiscordConfig({ register = false } = {}) {
  const missing = [];
  if (!config.token) missing.push("DISCORD_TOKEN");
  if (!config.clientId) missing.push("DISCORD_CLIENT_ID");
  if (register && !config.guildId) {
    missing.push("DISCORD_GUILD_ID");
  }
  if (!config.playerApiBase) missing.push("DISCORD_PLAYER_API_BASE");

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
