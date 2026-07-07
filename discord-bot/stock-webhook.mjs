import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { ApiError, getMarket } from "./api.mjs";
import { config } from "./config.mjs";
import { formatMoney, formatNumber, formatPercent, stockDisplayName } from "./format.mjs";

const args = new Set(process.argv.slice(2));
const once = args.has("--once");
const dryRun = boolEnv("DISCORD_STOCK_WEBHOOK_DRY_RUN", false);
const webhookUrl = process.env.DISCORD_STOCK_WEBHOOK_URL || "";
const intervalSeconds = numberEnv("DISCORD_STOCK_WEBHOOK_INTERVAL_SECONDS", 60);
const summaryIntervalSeconds = numberEnv("DISCORD_STOCK_WEBHOOK_SUMMARY_INTERVAL_SECONDS", 900);
const movementThreshold = numberEnv("DISCORD_STOCK_WEBHOOK_MIN_CHANGE_PERCENT", 2.5);
const tradeTotalThreshold = numberEnv("DISCORD_STOCK_WEBHOOK_MIN_TRADE_TOTAL", 25000);
const apiAlertCooldownSeconds = numberEnv("DISCORD_STOCK_WEBHOOK_API_ALERT_COOLDOWN_SECONDS", 1800);
const localDataFile = process.env.DISCORD_STOCK_LOCAL_DATA_FILE || "";
const stateFile = path.resolve(process.env.DISCORD_STOCK_WEBHOOK_STATE_FILE || path.join(config.dataDir, "stock-webhook-state.json"));

const outstandingShares = {
  DMD: 24000,
  FARM: 42000,
  LOG: 36000,
  RED: 28000,
};

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function boolEnv(name, fallback) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function krw(value) {
  const text = formatMoney(value);
  return text === "--" ? text : `₩${text}`;
}

function signedKrw(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const sign = number > 0 ? "+" : number < 0 ? "-" : "";
  return `${sign}${krw(Math.abs(number))}`;
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

function sideLabel(side) {
  return side === "buy" ? "매수" : side === "sell" ? "매도" : String(side || "체결");
}

function tradeKey(trade) {
  return [
    trade?.at || trade?.timestamp || trade?.createdAt || "",
    trade?.playerName || trade?.nickname || "",
    trade?.symbol || "",
    trade?.side || "",
    trade?.quantity || "",
    trade?.price || "",
  ].join("|");
}

function localHistory(stock) {
  return (Array.isArray(stock?.candles) ? stock.candles : []).map((candle) => ({
    time: new Date(Number(candle.startedAt) || Date.now()).toISOString(),
    open: roundMoney(candle.open),
    high: roundMoney(candle.high),
    low: roundMoney(candle.low),
    close: roundMoney(candle.close),
    volume: Math.max(0, Number(candle.volume) || 0),
    trades: Math.max(0, Number(candle.trades) || 0),
  }));
}

function localStockPayload(stock) {
  const history = localHistory(stock);
  const price = roundMoney(stock?.currentPrice);
  const open24h = roundMoney(history[0]?.open ?? price);
  const high24h = roundMoney(Math.max(price, ...history.map((item) => Number(item.high) || price)));
  const low24h = roundMoney(Math.min(price, ...history.map((item) => Number(item.low) || price)));
  const volume24h = history.reduce((sum, item) => sum + Math.max(0, Number(item.volume) || 0), 0);
  const symbol = stock?.symbol || stock?.code || "UNKNOWN";

  return {
    symbol,
    code: symbol,
    name: stock?.name || symbol,
    price,
    open24h,
    high24h,
    low24h,
    change24h: percentChange(price, open24h),
    volume24h,
    marketCap: roundMoney(price * (outstandingShares[symbol] || 1)),
    history,
  };
}

function localTradePayload(trade) {
  return {
    id: trade?.id,
    symbol: trade?.symbol,
    code: trade?.symbol,
    name: trade?.name,
    side: trade?.side,
    playerName: trade?.playerName,
    quantity: trade?.quantity,
    price: roundMoney(trade?.price),
    total: roundMoney(trade?.total),
    fee: roundMoney(trade?.fee),
    at: new Date(Number(trade?.at) || Date.now()).toISOString(),
  };
}

async function loadLocalMarket() {
  if (!localDataFile) return null;
  const raw = JSON.parse(await fs.readFile(localDataFile, "utf8"));
  const stocks = Object.values(raw.stocks || {}).map(localStockPayload);
  const index = stocks.reduce((sum, stock) => sum + Number(stock.price || 0), 0);
  const openIndex = stocks.reduce((sum, stock) => sum + Number(stock.open24h || stock.price || 0), 0);
  const marketCap = stocks.reduce((sum, stock) => sum + Number(stock.marketCap || 0), 0);
  const volume24h = stocks.reduce((sum, stock) => sum + Math.max(0, Number(stock.volume24h) || 0), 0);
  const recentTrades = (Array.isArray(raw.trades) ? raw.trades : [])
    .slice(-14)
    .reverse()
    .map(localTradePayload);

  return {
    ok: true,
    source: "local-file",
    market: {
      index: roundMoney(index * 10),
      indexChange24h: percentChange(index, openIndex),
      volume24h,
      marketCap: roundMoney(marketCap),
      session: "LOCAL FALLBACK",
      updatedAt: new Date(Number(raw.lastAdvancedAt) || Date.now()).toISOString(),
    },
    stocks,
    recentTrades,
  };
}

async function loadState() {
  try {
    return JSON.parse(await fs.readFile(stateFile, "utf8"));
  } catch {
    return {
      lastSummaryAt: 0,
      lastApiAlertAt: 0,
      seenTrades: [],
      movementBuckets: {},
    };
  }
}

async function saveState(state) {
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

function marketFields(payload) {
  const stocks = [...(payload.stocks || [])].sort((left, right) => Math.abs(Number(right.change24h) || 0) - Math.abs(Number(left.change24h) || 0));
  const movers = stocks
    .slice(0, 5)
    .map((stock) => {
      const price = krw(stock.price);
      const change = formatPercent(stock.change24h);
      return `**${stock.symbol}** ${price} (${change})`;
    })
    .join("\n") || "변동 종목 없음";

  const recentTrades = (payload.recentTrades || [])
    .slice(0, 5)
    .map((trade) => {
      const player = trade.playerName || trade.nickname || "Unknown";
      return `${player} ${sideLabel(trade.side)} **${trade.symbol}** ${formatNumber(trade.quantity)}주 @ ${krw(trade.price)}`;
    })
    .join("\n") || "최근 체결 없음";

  return [
    { name: "시장지수", value: krw(payload.market?.index), inline: true },
    { name: "24H 변동", value: formatPercent(payload.market?.indexChange24h), inline: true },
    { name: "거래량", value: formatNumber(payload.market?.volume24h), inline: true },
    { name: "시가총액", value: krw(payload.market?.marketCap), inline: true },
    { name: "주요 변동", value: movers, inline: false },
    { name: "최근 체결", value: recentTrades, inline: false },
  ];
}

function summaryEmbed(payload) {
  return {
    title: "VELYX Economy 브리핑",
    url: `${config.siteUrl}/plugins.html#stock-marketplace`,
    color: 0x56d364,
    fields: marketFields(payload),
    footer: { text: payload.market?.session || "24H LIVE" },
    timestamp: payload.market?.updatedAt || new Date().toISOString(),
  };
}

function movementBucket(change) {
  const value = Number(change);
  if (!Number.isFinite(value) || Math.abs(value) < movementThreshold) return 0;
  const direction = value > 0 ? 1 : -1;
  return direction * Math.floor(Math.abs(value) / movementThreshold);
}

function movementEmbeds(payload, state) {
  const embeds = [];
  for (const stock of payload.stocks || []) {
    const symbol = stock.symbol || stock.code;
    const bucket = movementBucket(stock.change24h);
    if (!symbol || bucket === 0) {
      if (symbol) state.movementBuckets[symbol] = 0;
      continue;
    }

    if (state.movementBuckets[symbol] === bucket) continue;
    state.movementBuckets[symbol] = bucket;

    const price = Number(stock.price);
    const open = Number(stock.open24h);
    const diff = Number.isFinite(price) && Number.isFinite(open) ? price - open : 0;
    embeds.push({
      title: `${bucket > 0 ? "급등" : "급락"} 알림 · ${stockDisplayName(stock)}`,
      url: `${config.siteUrl}/plugins.html#stock-marketplace`,
      color: bucket > 0 ? 0xff5a66 : 0x5b9cff,
      fields: [
        { name: "현재가", value: krw(stock.price), inline: true },
        { name: "24H 변동", value: formatPercent(stock.change24h), inline: true },
        { name: "전일 대비", value: signedKrw(diff), inline: true },
        { name: "거래량", value: formatNumber(stock.volume24h), inline: true },
      ],
      timestamp: payload.market?.updatedAt || new Date().toISOString(),
    });
  }
  return embeds.slice(0, 4);
}

function tradeEmbeds(payload, state) {
  const seen = new Set(state.seenTrades || []);
  const nextSeen = [];
  const embeds = [];

  for (const trade of payload.recentTrades || []) {
    const key = tradeKey(trade);
    if (key) nextSeen.push(key);
    if (!key || seen.has(key)) continue;

    const total = Number(trade.total ?? (Number(trade.price) * Number(trade.quantity)));
    if (!Number.isFinite(total) || total < tradeTotalThreshold) continue;

    embeds.push({
      title: `대형 체결 · ${trade.symbol} ${sideLabel(trade.side)}`,
      url: `${config.siteUrl}/plugins.html#stock-marketplace`,
      color: trade.side === "sell" ? 0x5b9cff : 0xff5a66,
      fields: [
        { name: "플레이어", value: trade.playerName || trade.nickname || "Unknown", inline: true },
        { name: "수량", value: `${formatNumber(trade.quantity)}주`, inline: true },
        { name: "체결가", value: krw(trade.price), inline: true },
        { name: "총액", value: krw(total), inline: true },
      ],
      timestamp: trade.at || trade.timestamp || payload.market?.updatedAt || new Date().toISOString(),
    });
  }

  state.seenTrades = [...new Set([...nextSeen, ...(state.seenTrades || [])])].slice(0, 80);
  return embeds.slice(0, 5);
}

function apiErrorEmbed(error) {
  return {
    title: "주식 API 연결 오류",
    description: "Discord 주식 알림이 AuroraLink 주식 API를 읽지 못했습니다.",
    color: 0xffc857,
    fields: [
      { name: "API", value: config.playerApiBase, inline: false },
      { name: "오류", value: error instanceof ApiError ? `${error.status} ${error.message}` : String(error?.message || error), inline: false },
    ],
    timestamp: new Date().toISOString(),
  };
}

async function postWebhook(embeds) {
  if (!embeds.length) return;
  if (dryRun) {
    console.log(JSON.stringify({ embeds }, null, 2));
    return;
  }
  if (!webhookUrl) throw new Error("Missing DISCORD_STOCK_WEBHOOK_URL");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "VELYX Economy Desk",
      avatar_url: "https://www.velyx.kr/assets/favicon.png",
      embeds,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Discord webhook failed: ${response.status} ${text}`);
  }
}

async function tick() {
  const state = await loadState();
  const current = nowSeconds();

  try {
    let payload;
    try {
      payload = await getMarket();
    } catch (error) {
      const localPayload = await loadLocalMarket();
      if (!localPayload) throw error;
      payload = localPayload;
      console.warn(`stock-webhook using local data fallback: ${localDataFile}`);
    }
    const embeds = [];

    if (once || current - Number(state.lastSummaryAt || 0) >= summaryIntervalSeconds) {
      embeds.push(summaryEmbed(payload));
      state.lastSummaryAt = current;
    }

    embeds.push(...movementEmbeds(payload, state));
    embeds.push(...tradeEmbeds(payload, state));

    await postWebhook(embeds);
    await saveState(state);
    console.log(`stock-webhook tick ok: embeds=${embeds.length}`);
  } catch (error) {
    console.error(error);
    if (current - Number(state.lastApiAlertAt || 0) >= apiAlertCooldownSeconds) {
      await postWebhook([apiErrorEmbed(error)]);
      state.lastApiAlertAt = current;
      await saveState(state);
    }
  }
}

await tick();

if (!once) {
  setInterval(() => {
    tick().catch((error) => console.error(error));
  }, Math.max(10, intervalSeconds) * 1000);
}
