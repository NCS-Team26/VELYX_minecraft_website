import "./styles.css";
// Final brand layer: keeps legacy selectors working while giving every page the VELYX visual system.
import "./velyx-redesign.css";
// Minecraft skin: last-loaded visual layer, re-skins the site into a pixel/GUI look.
import "./velyx-minecraft.css";
// Final visual frame: VELYX-tailored membership stage inspired by modern luxury web direction.
import "./velyx-sakazuki-frame.css";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
} from "lightweight-charts";

const SERVER_ADDRESS = "velyx.kr";
const STATUS_API = `https://api.mcstatus.io/v2/status/java/${SERVER_ADDRESS}`;
const STATUS_TIMEOUT_MS = 8000;
const PUBLIC_PLAYER_API_BASE = "/minecraft";
const FUNNEL_PLAYER_API_BASE = "https://minecraftserver1.tail16d543.ts.net/minecraft";
const LEGACY_PLAYER_API_BASE = "https://api.velyx.kr/minecraft";
const isHostedSite = ["www.velyx.kr", "velyx.kr"].includes(window.location.hostname);
const PRODUCTION_PLAYER_API_BASE = isHostedSite ? PUBLIC_PLAYER_API_BASE : FUNNEL_PLAYER_API_BASE;
const PRODUCTION_PLAYER_API_FALLBACK_BASE = `${FUNNEL_PLAYER_API_BASE},${LEGACY_PLAYER_API_BASE}`;

function apiBaseList(...values) {
  return [
    ...new Set(
      values
        .flatMap((value) => String(value || "").split(","))
        .map((value) => value.trim().replace(/\/$/, ""))
        .filter(Boolean),
    ),
  ];
}

const isLocalWebHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const LOCAL_PLAYER_API_BASE = isLocalWebHost ? "http://127.0.0.1:8787/minecraft" : "";
const PLAYER_API_BASES = apiBaseList(
  import.meta.env.VITE_PLAYER_API_BASE || PRODUCTION_PLAYER_API_BASE,
  import.meta.env.VITE_PLAYER_API_FALLBACK_BASES || PRODUCTION_PLAYER_API_FALLBACK_BASE,
  LOCAL_PLAYER_API_BASE,
);
const PLAYER_API_BASE = PLAYER_API_BASES[0] || "";
const SERVER_OVERVIEW_TIMEOUT_MS = 6000;
const SERVER_OVERVIEW_INTERVAL_MS = 10000;
const STOCK_MARKET_TIMEOUT_MS = 6000;
const STOCK_TRADE_TIMEOUT_MS = 8000;

const statusDot = document.querySelector("[data-status-dot]");
const statusLabel = document.querySelector("[data-status-label]");
const playerCount = document.querySelector("[data-player-count]");
const playerMeter = document.querySelector("[data-player-meter]");
const versionLabel = document.querySelector("[data-version]");
const copyFeedback = document.querySelector("[data-copy-feedback]");
const loginButton = document.querySelector("[data-open-login]");
const cacheState = document.querySelector("[data-cache-state]");
const lastChecked = document.querySelector("[data-last-checked]");
const latencyLabel = document.querySelector("[data-latency]");
const statusHealth = document.querySelector("[data-status-health]");
const playerSummary = document.querySelector("[data-player-summary]");
const motdLabel = document.querySelector("[data-motd]");
const playerRoster = document.querySelector("[data-player-roster]");
const ramSummaries = document.querySelectorAll("[data-ram-summary]");
const ramPercents = document.querySelectorAll("[data-ram-percent]");
const ramMeters = document.querySelectorAll("[data-ram-meter]");
const ramDetails = document.querySelectorAll("[data-ram-detail]");
const cpuSummaries = document.querySelectorAll("[data-cpu-summary]");
const cpuMeters = document.querySelectorAll("[data-cpu-meter]");
const cpuDetails = document.querySelectorAll("[data-cpu-detail]");
const tempSummaries = document.querySelectorAll("[data-temp-summary]");
const tempMeters = document.querySelectorAll("[data-temp-meter]");
const tempDetails = document.querySelectorAll("[data-temp-detail]");
const playerHeads = document.querySelector("[data-player-heads]");
const playerChart = document.querySelector("[data-player-chart]");
const sectionLinks = document.querySelectorAll("[data-section-link]");
const adminLinks = document.querySelectorAll("[data-admin-link]");
const stockAuthLink = document.querySelector("[data-stock-auth-link]");
const AUTH_STORAGE_KEY = "nfoifsb.googleUser";
const AUTH_EVENT_KEY = "nfoifsb.authEvent";
const PLAYER_PROFILES_KEY = "nfoifsb.playerProfiles";
const STATUS_CACHE_KEY = "nfoifsb.statusCache";
const PLAYER_HISTORY_KEY = "nfoifsb.playerHistory";
const PLAYER_HISTORY_MAX = 48;
const STOCK_HISTORY_CACHE_KEY = "nfoifsb.stockHistoryCache.v1";
const STOCK_HISTORY_BUCKET_MS = 15 * 60 * 1000;
const STOCK_HISTORY_CACHE_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;
const STOCK_HISTORY_CACHE_MAX_POINTS = 4320;
const STOCKS = [
  { code: "DMD", name: "다이아 광산", base: 3420, volume: 8420, drift: 0.048, volatility: 0.022, marketBeta: 1.45 },
  { code: "FARM", name: "농업 길드", base: 1280, volume: 12650, drift: 0.019, volatility: 0.016, marketBeta: 1.05 },
  { code: "LOG", name: "건축 목재", base: 890, volume: 9340, drift: -0.012, volatility: 0.019, marketBeta: 1.22 },
  { code: "RED", name: "레드스톤 공방", base: 2160, volume: 7990, drift: 0.033, volatility: 0.024, marketBeta: 1.55 },
];
const STOCK_INFO_META = {
  DMD: {
    icon: "◆",
    asset: "DMD/KRW",
    category: "채굴 자산",
    rank: 1,
    links: [
      ["Stock", "/stock.html"],
      ["규칙 문서", "/rules.html"],
      ["서버 상태", "/status.html"],
      ["경제 분석", "/plugins.html"],
    ],
  },
  FARM: {
    icon: "♧",
    asset: "FARM/KRW",
    category: "식량 공급",
    rank: 2,
    links: [
      ["Stock", "/stock.html"],
      ["규칙 문서", "/rules.html"],
      ["서버 상태", "/status.html"],
      ["경제 분석", "/plugins.html"],
    ],
  },
  LOG: {
    icon: "▧",
    asset: "LOG/KRW",
    category: "건축 자재",
    rank: 3,
    links: [
      ["Stock", "/stock.html"],
      ["접속 안내", "/join.html"],
      ["서버 상태", "/status.html"],
      ["경제 분석", "/plugins.html"],
    ],
  },
  RED: {
    icon: "✦",
    asset: "RED/KRW",
    category: "레드스톤 산업",
    rank: 4,
    links: [
      ["Stock", "/stock.html"],
      ["규칙 문서", "/rules.html"],
      ["서버 상태", "/status.html"],
      ["경제 분석", "/plugins.html"],
    ],
  },
};
const STOCK_MARKET_VOLATILITY_PROFILE = {
  sp500: 0.018,
  nasdaq: 0.032,
  russell1000: 0.028,
  technicalSwing: 0.042,
};
const FINANCIAL_PERIOD_COUNT = 4;
const FINANCIAL_QUARTER_SEASONALITY = [0.94, 1.0, 1.02, 1.08];
const STOCK_NEWS_IMAGES = {
  DMD: [
    { src: "/assets/stock-news-dmd.jpg", position: "46% 50%" },
    { src: "/assets/stock-news-dmd.jpg", position: "18% 48%" },
    { src: "/assets/stock-news-dmd.jpg", position: "64% 42%" },
    { src: "/assets/stock-news-dmd.jpg", position: "78% 56%" },
  ],
  FARM: [
    { src: "/assets/stock-news-farm.jpg", position: "48% 50%" },
    { src: "/assets/stock-news-farm.jpg", position: "20% 58%" },
    { src: "/assets/stock-news-farm.jpg", position: "62% 42%" },
    { src: "/assets/stock-news-farm.jpg", position: "82% 54%" },
  ],
  LOG: [
    { src: "/assets/stock-news-log.jpg", position: "50% 50%" },
    { src: "/assets/stock-news-log.jpg", position: "18% 54%" },
    { src: "/assets/stock-news-log.jpg", position: "68% 48%" },
    { src: "/assets/stock-news-log.jpg", position: "86% 40%" },
  ],
  RED: [
    { src: "/assets/stock-news-red.jpg", position: "52% 50%" },
    { src: "/assets/stock-news-red.jpg", position: "16% 48%" },
    { src: "/assets/stock-news-red.jpg", position: "66% 50%" },
    { src: "/assets/stock-news-red.jpg", position: "84% 46%" },
  ],
  DEFAULT: [
    { src: "/assets/hero-world-1920.jpg", position: "50% 45%" },
    { src: "/assets/hero-world-960.jpg", position: "18% 42%" },
    { src: "/assets/hero-world.png", position: "72% 52%" },
    { src: "/assets/hero-world-1920.jpg", position: "82% 38%" },
  ],
};
const STOCK_NEWS_SCENE_THEMES = {
  DMD: {
    sky: "#101923",
    horizon: "#1f2b35",
    ground: "#3b4145",
    groundDark: "#23292d",
    groundLight: "#596066",
    accent: "#35d8f2",
    accentSoft: "#93f4ff",
    secondary: "#8b5d2f",
    lamp: "#ffd271",
  },
  FARM: {
    sky: "#8fc3ed",
    horizon: "#f7c76d",
    ground: "#56792e",
    groundDark: "#375327",
    groundLight: "#b99b39",
    accent: "#69c83f",
    accentSoft: "#ffe28a",
    secondary: "#8d5a2f",
    lamp: "#fff0a8",
  },
  LOG: {
    sky: "#9bb8c9",
    horizon: "#d9a867",
    ground: "#65503a",
    groundDark: "#3e3327",
    groundLight: "#a16f34",
    accent: "#c58a3c",
    accentSoft: "#ffd27a",
    secondary: "#304f34",
    lamp: "#ffe6a2",
  },
  RED: {
    sky: "#11151c",
    horizon: "#2a1a24",
    ground: "#282c31",
    groundDark: "#171b20",
    groundLight: "#454b52",
    accent: "#f13b38",
    accentSoft: "#ff8b78",
    secondary: "#5a2730",
    lamp: "#ffb05f",
  },
  DEFAULT: {
    sky: "#20323b",
    horizon: "#4c685f",
    ground: "#4d5b4d",
    groundDark: "#263328",
    groundLight: "#78836c",
    accent: "#68d391",
    accentSoft: "#b8f2cc",
    secondary: "#74593a",
    lamp: "#ffe2a0",
  },
};
const STOCK_RANGE_CONFIG = {
  "1M": { points: 10, stepMs: 60_000, label: "1분 전" },
  "5M": { points: 16, stepMs: 60_000, label: "5분 전" },
  "15M": { points: 24, stepMs: 60_000, label: "15분 전" },
  "30M": { points: 32, stepMs: 60_000, label: "30분 전" },
  "1H": { points: 40, stepMs: 90_000, label: "1시간 전" },
  "5H": { points: 56, stepMs: 5 * 60_000, label: "5시간 전" },
  "1D": { points: 96, stepMs: 15 * 60_000, label: "1일 전" },
  "1W": { points: 160, stepMs: 60 * 60_000, label: "1주 전" },
  "1MO": { points: 240, stepMs: 3 * 60 * 60_000, label: "1개월 전" },
  ALL: { points: Infinity, stepMs: 15 * 60_000, label: "전체" },
};
const STOCK_CHART_SETTINGS_KEY = "nfoifsb.stockChartSettings";
const STOCK_DEPTH_SETTINGS_KEY = "nfoifsb.stockDepthSettings";
const STOCK_MAX_LEVERAGE = 20;
const STOCK_CHART_SETTING_TABS = [
  { id: "main", label: "주요 지표" },
  { id: "sub", label: "보조 지표" },
  { id: "trading", label: "거래 데이터" },
  { id: "custom", label: "사용자 설정" },
  { id: "backtest", label: "백테스트" },
];
const STOCK_LINE_STYLES = [
  { value: "0", label: "실선" },
  { value: "1", label: "점선" },
  { value: "2", label: "파선" },
  { value: "3", label: "긴 파선" },
];
const STOCK_SOURCE_OPTIONS = [
  { value: "close", label: "종가" },
  { value: "open", label: "시가" },
  { value: "high", label: "고가" },
  { value: "low", label: "저가" },
  { value: "hl2", label: "HL2" },
  { value: "hlc3", label: "HLC3" },
  { value: "ohlc4", label: "OHLC4" },
];
const STOCK_CHART_THEME_PRESETS = {
  exchange: {
    label: "거래소 다크",
    background: "#151a23",
    textColor: "#848e9c",
    gridColor: "rgba(94, 102, 115, 0.18)",
  },
  midnight: {
    label: "미드나이트",
    background: "#0b0e11",
    textColor: "#b7bdc6",
    gridColor: "rgba(91, 141, 239, 0.16)",
  },
  light: {
    label: "라이트 데스크",
    background: "#f5f7fb",
    textColor: "#344054",
    gridColor: "rgba(88, 96, 105, 0.18)",
  },
};
const DEFAULT_STOCK_DEPTH_SETTINGS = {
  version: 1,
  mode: "both",
  groupSize: 1,
  rows: 7,
  clickAction: "price",
  midClick: "price",
  autoSide: true,
  showSum: true,
  showDepth: true,
  showMeter: true,
  depthOpacity: 58,
  flashSelection: true,
};
const DEFAULT_STOCK_CHART_SETTINGS = {
  version: 1,
  mode: "candle",
  scale: "price",
  main: {
    ma: {
      enabled: true,
      source: "close",
      items: [
        { id: "ma1", label: "MA1", enabled: true, period: 7, color: "#f0b90b", lineWidth: 2, lineStyle: 0 },
        { id: "ma2", label: "MA2", enabled: false, period: 25, color: "#d946ef", lineWidth: 2, lineStyle: 0 },
        { id: "ma3", label: "MA3", enabled: true, period: 99, color: "#a970ff", lineWidth: 2, lineStyle: 0 },
        { id: "ma4", label: "MA4", enabled: false, period: 0, color: "#e5486d", lineWidth: 2, lineStyle: 2 },
        { id: "ma5", label: "MA5", enabled: false, period: 0, color: "#4caf5b", lineWidth: 2, lineStyle: 2 },
        { id: "ma6", label: "MA6", enabled: false, period: 0, color: "#ff8a1f", lineWidth: 2, lineStyle: 2 },
      ],
    },
    ema: {
      enabled: false,
      source: "close",
      items: [
        { id: "ema1", label: "EMA1", enabled: true, period: 12, color: "#5b8def", lineWidth: 2, lineStyle: 0 },
        { id: "ema2", label: "EMA2", enabled: true, period: 26, color: "#22c55e", lineWidth: 2, lineStyle: 0 },
        { id: "ema3", label: "EMA3", enabled: false, period: 50, color: "#f97316", lineWidth: 2, lineStyle: 2 },
      ],
    },
    wma: {
      enabled: false,
      source: "close",
      items: [
        { id: "wma1", label: "WMA1", enabled: true, period: 9, color: "#38bdf8", lineWidth: 2, lineStyle: 0 },
        { id: "wma2", label: "WMA2", enabled: false, period: 21, color: "#fb7185", lineWidth: 2, lineStyle: 2 },
      ],
    },
    vwap: { enabled: false, color: "#5b8def", lineWidth: 2, lineStyle: 2 },
    boll: {
      enabled: false,
      source: "close",
      period: 20,
      multiplier: 2,
      upperColor: "#f59e0b",
      middleColor: "#94a3b8",
      lowerColor: "#f59e0b",
      lineWidth: 1,
      lineStyle: 2,
    },
  },
  sub: {
    volume: true,
    volumeMa: true,
    volumeMaPeriod: 20,
    volumeMaColor: "#4fd1c5",
    rsi: false,
    rsiPeriod: 14,
    rsiColor: "#f59e0b",
    macd: false,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    macdColor: "#5b8def",
    macdSignalColor: "#f97316",
  },
  trading: {
    tooltip: true,
    ohlc: true,
    performance: true,
    watermark: false,
    priceLine: true,
    lastValue: false,
    crosshair: true,
    scrollZoom: true,
  },
  custom: {
    theme: "exchange",
    background: "#151a23",
    textColor: "#848e9c",
    upColor: "#0ecb81",
    downColor: "#f6465d",
    lineColor: "#f0b90b",
    areaTopColor: "rgba(240, 185, 11, 0.26)",
    areaBottomColor: "rgba(240, 185, 11, 0.02)",
    gridOpacity: 18,
    barSpacing: 7,
    candleBorders: true,
  },
  backtest: {
    strategy: "ma-cross",
    fastPeriod: 7,
    slowPeriod: 25,
    capital: 1000000,
    feeBps: 4,
  },
};
const PAGE_LINKS = new Map([
  ["/status.html", "status"],
  ["/plugins.html", "plugins"],
  ["/stock.html", "stock"],
  ["/notice.html", "notice"],
  ["/community.html", "community"],
  ["/resources.html", "resources"],
  ["/rules.html", "rules"],
  ["/join.html", "join"],
  ["/admin.html", "admin"],
]);

let sessionUser = null;

function startVisiblePoll(task, intervalMs, options = {}) {
  const { immediate = true } = options;
  let running = false;

  const run = () => {
    if (document.visibilityState === "hidden" || running) return;
    running = true;
    Promise.resolve(task()).finally(() => {
      running = false;
    });
  };

  const interval = window.setInterval(run, intervalMs);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") run();
  });
  if (immediate) run();

  return interval;
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto 0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function flashButton(button) {
  if (!button || button.dataset.flashing) return;
  const original = button.innerHTML;
  button.dataset.flashing = "1";
  button.innerHTML = "복사됨 ✓";
  window.setTimeout(() => {
    button.innerHTML = original;
    delete button.dataset.flashing;
  }, 1400);
}

function formatStatusTime(timestamp) {
  if (!timestamp) return "시간 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "--";

  const gib = value / 1024 / 1024 / 1024;
  if (gib >= 1) return `${gib >= 10 ? Math.round(gib) : gib.toFixed(1)} GB`;

  const mib = value / 1024 / 1024;
  if (mib >= 1) return `${mib >= 10 ? Math.round(mib) : mib.toFixed(1)} MB`;

  return `${Math.round(value)} B`;
}

function formatPercent(value) {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return "--";
  const rounded = Math.round(percent * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function formatTemperature(value) {
  const celsius = Number(value);
  if (!Number.isFinite(celsius)) return "--";
  const rounded = Math.round(celsius * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}°C`;
}

function readStatusCache() {
  try {
    const raw = localStorage.getItem(STATUS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStatusCache(data, latencyMs) {
  try {
    localStorage.setItem(
      STATUS_CACHE_KEY,
      JSON.stringify({
        data,
        latencyMs,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // Status rendering still works without persistence.
  }
}

function getMotdText(data) {
  const motd = data?.motd;
  const value = motd?.clean ?? motd?.raw ?? motd?.html ?? "";
  if (Array.isArray(value)) return value.filter(Boolean).join(" ");
  return String(value || "서버 메시지가 비어 있습니다.").replace(/<[^>]*>/g, "");
}

function renderPlayerHeads(data) {
  if (!playerHeads) return;
  const list = Array.isArray(data?.players?.list) ? data.players.list : [];
  playerHeads.replaceChildren();
  if (!list.length) {
    playerHeads.hidden = true;
    return;
  }
  playerHeads.hidden = false;
  // Cap the row so a full server never floods the panel.
  list.slice(0, 24).forEach((player) => {
    const name = player?.name_clean || player?.name || "player";
    const id = player?.uuid || name;
    const img = document.createElement("img");
    img.className = "player-head";
    img.src = `https://mc-heads.net/avatar/${encodeURIComponent(id)}/36`;
    img.alt = name;
    img.title = name;
    img.loading = "lazy";
    img.width = 36;
    img.height = 36;
    playerHeads.appendChild(img);
  });
}

function renderPlayerRoster(data) {
  if (!playerRoster) return;
  const list = Array.isArray(data?.players?.list) ? data.players.list : [];
  const names = list
    .map((player) => String(player?.name_clean || player?.name || "").trim())
    .filter(Boolean)
    .slice(0, 32);
  const minCells = 24;
  const cells = [
    ...names.map((name) => ({ label: name, empty: false })),
    ...Array.from({ length: Math.max(minCells - names.length, 0) }, () => ({
      label: "ACCESS SLOT",
      empty: true,
    })),
  ];

  playerRoster.replaceChildren();
  cells.forEach((slot) => {
    const cell = document.createElement("span");
    cell.className = slot.empty ? "roster-cell is-empty" : "roster-cell";
    cell.textContent = slot.label;
    playerRoster.appendChild(cell);
  });
}

function readPlayerHistory() {
  try {
    const raw = localStorage.getItem(PLAYER_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Record one live sample; cached reads must not pollute the trend.
function pushPlayerHistory(online) {
  if (!Number.isFinite(online)) return;
  try {
    const history = readPlayerHistory();
    history.push({ t: Date.now(), online });
    while (history.length > PLAYER_HISTORY_MAX) history.shift();
    localStorage.setItem(PLAYER_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Chart is decorative; skip persistence when storage is unavailable.
  }
}

function renderPlayerChart() {
  if (!(playerChart instanceof HTMLCanvasElement)) return;
  const ctx = playerChart.getContext("2d");
  if (!ctx) return;

  const history = readPlayerHistory();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = playerChart.clientWidth || 320;
  const h = playerChart.clientHeight || 64;
  playerChart.width = w * dpr;
  playerChart.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (history.length < 2) return;

  const max = Math.max(1, ...history.map((s) => s.online));
  const n = history.length;
  const x = (i) => (i / (n - 1)) * (w - 4) + 2;
  const y = (v) => h - 4 - (v / max) * (h - 10);
  const line = () => {
    ctx.beginPath();
    history.forEach((s, i) => (i ? ctx.lineTo(x(i), y(s.online)) : ctx.moveTo(x(i), y(s.online))));
  };

  line();
  ctx.lineTo(x(n - 1), h);
  ctx.lineTo(x(0), h);
  ctx.closePath();
  ctx.fillStyle = "rgba(76, 154, 94, 0.16)";
  ctx.fill();

  line();
  ctx.strokeStyle = "#3f8a54";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x(n - 1), y(history[n - 1].online), 3, 0, Math.PI * 2);
  ctx.fillStyle = "#3f8a54";
  ctx.fill();
}

function renderStatusData(data, options = {}) {
  const online = Boolean(data?.online);
  const playersOnline = data?.players?.online ?? 0;
  const playersMax = data?.players?.max ?? 10;
  const meterWidth = Math.min(100, Math.round((playersOnline / Math.max(playersMax, 1)) * 100));
  const timestamp = options.timestamp || Date.now();
  const latencyMs = options.latencyMs;

  statusDot?.classList.toggle("is-online", online);
  statusDot?.classList.toggle("is-cached", Boolean(options.cached));
  statusDot?.closest(".status-panel")?.classList.toggle("is-online", online);
  if (statusLabel) {
    statusLabel.textContent = options.cached ? "캐시된 상태" : online ? "온라인" : "오프라인";
  }
  if (playerCount) playerCount.textContent = `${playersOnline} / ${playersMax}`;
  if (playerMeter) playerMeter.style.width = `${meterWidth}%`;
  if (versionLabel) versionLabel.textContent = data?.version?.name_clean || "Paper 26.1.2";
  if (cacheState) cacheState.textContent = options.cached ? "캐시값으로 표시 중" : "실시간 값 표시 중";
  if (lastChecked) {
    lastChecked.textContent = `${options.cached ? "캐시 저장" : "마지막 확인"}: ${formatStatusTime(timestamp)}`;
  }
  if (latencyLabel) latencyLabel.textContent = Number.isFinite(latencyMs) ? `${latencyMs} ms` : "-- ms";
  if (statusHealth) {
    statusHealth.textContent = online
      ? "접속 가능한 상태입니다."
      : options.cached
        ? "실시간 확인 실패로 저장된 값을 보여줍니다."
        : "현재 접속 가능 여부를 확인하지 못했습니다.";
  }
  if (playerSummary) playerSummary.textContent = `${playersOnline}명 접속 / ${playersMax} 슬롯`;
  if (motdLabel) motdLabel.textContent = getMotdText(data);
  renderPlayerHeads(data);
  renderPlayerRoster(data);
  renderPlayerChart();
}

function hasRamWidgets() {
  return (
    ramSummaries.length
    || ramPercents.length
    || ramMeters.length
    || ramDetails.length
    || cpuSummaries.length
    || cpuMeters.length
    || cpuDetails.length
    || tempSummaries.length
    || tempMeters.length
    || tempDetails.length
  );
}

function renderRamUnavailable(message) {
  ramSummaries.forEach((summary) => {
    summary.textContent = "--";
  });
  ramPercents.forEach((percent) => {
    percent.textContent = "--";
  });
  ramMeters.forEach((meter) => {
    meter.style.width = "0%";
  });
  ramDetails.forEach((detail) => {
    detail.textContent = message;
  });
  renderCpuUnavailable(message);
  renderTemperatureUnavailable(message);
}

function renderServerOverview(data) {
  const memory = data?.memory || {};
  const usedBytes = Number(memory.usedBytes);
  const maxBytes = Number(memory.maxBytes);
  const totalBytes = Number(memory.totalBytes);
  const freeBytes = Number(memory.freeBytes);
  const reportedPercent = Number(memory.usedPercent);
  const calculatedPercent =
    Number.isFinite(usedBytes) && Number.isFinite(maxBytes) && maxBytes > 0 ? (usedBytes / maxBytes) * 100 : NaN;
  const usedPercent = Number.isFinite(reportedPercent) ? reportedPercent : calculatedPercent;

  if (!Number.isFinite(usedBytes) || !Number.isFinite(maxBytes) || maxBytes <= 0) {
    renderRamUnavailable("RAM 사용량 데이터를 받을 수 없습니다.");
    renderSystemOverview(data?.system || {}, data?.updatedAt);
    return;
  }

  const clampedPercent = Math.max(0, Math.min(100, usedPercent));
  const summaryText = `${formatBytes(usedBytes)} / ${formatBytes(maxBytes)}`;
  const percentText = `${formatPercent(clampedPercent)} 사용 중`;
  const allocated = Number.isFinite(totalBytes) ? formatBytes(totalBytes) : "--";
  const free = Number.isFinite(freeBytes) ? formatBytes(freeBytes) : "--";
  const updated = formatStatusTime(data?.updatedAt || Date.now());
  const detailText = `할당 ${allocated}, 여유 ${free}. ${updated} 갱신`;

  ramSummaries.forEach((summary) => {
    summary.textContent = summaryText;
  });
  ramPercents.forEach((percent) => {
    percent.textContent = percentText;
  });
  ramMeters.forEach((meter) => {
    meter.style.width = `${Math.round(clampedPercent)}%`;
  });
  ramDetails.forEach((detail) => {
    detail.textContent = detailText;
  });

  renderSystemOverview(data?.system || {}, data?.updatedAt);
}

function renderCpuUnavailable(message) {
  cpuSummaries.forEach((summary) => {
    summary.textContent = "--";
  });
  cpuMeters.forEach((meter) => {
    meter.style.width = "0%";
  });
  cpuDetails.forEach((detail) => {
    detail.textContent = message;
  });
}

function renderTemperatureUnavailable(message) {
  tempSummaries.forEach((summary) => {
    summary.textContent = "--";
  });
  tempMeters.forEach((meter) => {
    meter.style.width = "0%";
  });
  tempDetails.forEach((detail) => {
    detail.textContent = message;
  });
}

function renderSystemOverview(system, updatedAt) {
  const cpu = system?.cpu || {};
  const temperature = system?.temperature || {};
  const updated = formatStatusTime(updatedAt || Date.now());
  const systemLoad = Number(cpu.systemLoadPercent);
  const processLoad = Number(cpu.processLoadPercent);
  const cpuPercent = Number.isFinite(systemLoad) ? systemLoad : processLoad;

  if (Number.isFinite(cpuPercent)) {
    const clampedCpu = Math.max(0, Math.min(100, cpuPercent));
    const cpuText = `${formatPercent(clampedCpu)} 사용 중`;
    const cpuParts = [];
    if (Number.isFinite(systemLoad)) cpuParts.push(`시스템 ${formatPercent(systemLoad)}`);
    if (Number.isFinite(processLoad)) cpuParts.push(`서버 ${formatPercent(processLoad)}`);
    if (Number.isFinite(Number(cpu.availableProcessors))) cpuParts.push(`${Number(cpu.availableProcessors)}코어`);
    if (Number.isFinite(Number(cpu.loadAverage))) cpuParts.push(`부하 ${Number(cpu.loadAverage).toFixed(2)}`);
    const cpuDetail = `${cpuParts.join(", ")}. ${updated} 갱신`;

    cpuSummaries.forEach((summary) => {
      summary.textContent = cpuText;
    });
    cpuMeters.forEach((meter) => {
      meter.style.width = `${Math.round(clampedCpu)}%`;
    });
    cpuDetails.forEach((detail) => {
      detail.textContent = cpuDetail;
    });
  } else {
    renderCpuUnavailable("CPU 사용량 데이터를 받을 수 없습니다.");
  }

  const celsius = Number(temperature.celsius);
  if (temperature.available && Number.isFinite(celsius)) {
    const clampedTemp = Math.max(0, Math.min(100, celsius));
    const source = typeof temperature.source === "string" && temperature.source ? temperature.source : "온도 센서";
    tempSummaries.forEach((summary) => {
      summary.textContent = formatTemperature(celsius);
    });
    tempMeters.forEach((meter) => {
      meter.style.width = `${Math.round(clampedTemp)}%`;
    });
    tempDetails.forEach((detail) => {
      detail.textContent = `${source}. ${updated} 갱신`;
    });
  } else {
    renderTemperatureUnavailable("온도 센서를 읽을 수 없습니다.");
  }
}

async function refreshServerOverview() {
  if (!hasRamWidgets()) return;
  if (!PLAYER_API_BASES.length) {
    renderRamUnavailable("실시간 서버 API가 아직 연결되지 않았습니다.");
    return;
  }

  try {
    renderServerOverview(await fetchPlayerApiJson("/server/overview", SERVER_OVERVIEW_TIMEOUT_MS));
  } catch {
    renderRamUnavailable("서버 지표 브리지를 사용할 수 없습니다.");
  }
}

async function copyAddress(event) {
  // Capture now: event.currentTarget is null once dispatch ends (before any await resolves).
  const button = event?.currentTarget;
  let copied = false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(SERVER_ADDRESS);
      copied = true;
    }
  } catch {
    copied = false;
  }

  if (!copied) {
    try {
      copied = fallbackCopy(SERVER_ADDRESS);
    } catch {
      copied = false;
    }
  }

  if (copied) {
    flashButton(button);
    if (copyFeedback) copyFeedback.textContent = "복사 완료. 마크 서버 주소에 붙여넣으면 돼.";
  } else if (copyFeedback) {
    copyFeedback.textContent = `복사가 막히면 직접 입력: ${SERVER_ADDRESS}`;
  }
}

async function refreshStatus() {
  // Abort a hung request so the status never sits in "확인 중" forever.
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
  const startedAt = performance.now();
  try {
    const response = await fetch(STATUS_API, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const data = await response.json();
    const latencyMs = Math.round(performance.now() - startedAt);
    writeStatusCache(data, latencyMs);
    if (data?.online) pushPlayerHistory(data?.players?.online ?? 0);
    renderStatusData(data, { cached: false, latencyMs, timestamp: Date.now() });
  } catch {
    const cached = readStatusCache();
    if (cached?.data) {
      renderStatusData(cached.data, {
        cached: true,
        latencyMs: cached.latencyMs,
        timestamp: cached.timestamp,
      });
    } else {
      statusDot?.classList.remove("is-online");
      statusDot?.classList.remove("is-cached");
      if (statusLabel) statusLabel.textContent = "상태 확인 실패";
      if (playerCount) playerCount.textContent = "-- / 10";
      if (playerMeter) playerMeter.style.width = "0%";
      if (cacheState) cacheState.textContent = "캐시 없음";
      if (lastChecked) lastChecked.textContent = "저장된 상태 값이 없습니다.";
      if (latencyLabel) latencyLabel.textContent = "-- ms";
      if (statusHealth) statusHealth.textContent = "실시간 API와 캐시를 모두 사용할 수 없습니다.";
      if (playerSummary) playerSummary.textContent = "--";
      if (motdLabel) motdLabel.textContent = "서버 메시지를 확인하지 못했습니다.";
    }
  } finally {
    window.clearTimeout(timer);
  }
}

function readStoredUser() {
  try {
    const sessionUser = sessionStorage.getItem(AUTH_STORAGE_KEY);
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
    const raw = sessionUser || storedUser;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isAdminUser(user) {
  return Array.isArray(user?.roles) && user.roles.includes("admin");
}

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function getUserKey(user) {
  return String(user?.sub || user?.email || user?.name || "local-player").toLowerCase();
}

function readPlayerProfile(user = sessionUser || readStoredUser()) {
  return readJsonStorage(PLAYER_PROFILES_KEY, {})[getUserKey(user)] || null;
}

function renderStockAuthLink(user = sessionUser || readStoredUser()) {
  if (!stockAuthLink) return;
  const playerProfile = readPlayerProfile(user);
  const isVerified = Boolean(user && playerProfile?.verified);
  stockAuthLink.textContent = isVerified ? "인증완료" : "캐릭터 인증";
  stockAuthLink.classList.toggle("is-verified", isVerified);
  stockAuthLink.setAttribute("aria-label", isVerified ? "인증 완료된 캐릭터 정보 보기" : "캐릭터 인증하러 가기");
}

function applyAddressGate(authed) {
  // Server address is only revealed to signed-in players.
  document.querySelectorAll(".address-row code").forEach((code) => {
    code.textContent = authed ? SERVER_ADDRESS : "로그인 후 공개";
  });
  document.querySelectorAll("[data-copy-address]").forEach((btn) => {
    btn.hidden = !authed;
  });
  document.querySelectorAll("[data-login-gate]").forEach((el) => {
    el.hidden = authed;
  });
}

function renderAuthState(user = sessionUser || readStoredUser()) {
  renderStockAuthLink(user);
  applyAddressGate(Boolean(user));
  adminLinks.forEach((link) => {
    link.hidden = !isAdminUser(user);
  });
  if (!loginButton) return;

  if (user) {
    const displayName = user.name || user.email || "Google 사용자";
    loginButton.textContent = displayName;
    loginButton.classList.add("is-authenticated");
    loginButton.setAttribute("aria-label", `${displayName} 로그인 화면 열기`);
    return;
  }

  loginButton.textContent = "Login";
  loginButton.classList.remove("is-authenticated");
  loginButton.setAttribute("aria-label", "Login");
}

function applyAuthEvent(eventData) {
  if (eventData?.type === "login") {
    sessionUser = eventData.user || null;
  } else if (eventData?.type === "logout") {
    sessionUser = null;
  }

  renderAuthState();
}

function initLogin() {
  if (!loginButton) return;

  renderAuthState();

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.source !== "nfoifsb-login") return;
    applyAuthEvent(event.data);
  });

  window.addEventListener("storage", (event) => {
    if (event.key === AUTH_STORAGE_KEY) {
      if (event.newValue) sessionUser = null;
      renderAuthState();
      return;
    }

    if (event.key === AUTH_EVENT_KEY && event.newValue) {
      try {
        applyAuthEvent(JSON.parse(event.newValue));
      } catch {
        renderAuthState();
      }
    }
  });
}

function initTheme() {
  const toggles = document.querySelectorAll("[data-theme-toggle]");
  if (!toggles.length) return;

  const presets = [
    {
      id: "forest",
      label: "숲",
      meta: "#0d1411",
      swatchA: "#13221a",
      swatchB: "#93e2a6",
    },
    {
      id: "cave",
      label: "동굴",
      meta: "#101111",
      swatchA: "#151716",
      swatchB: "#94d7c8",
    },
    {
      id: "amethyst",
      label: "자수정",
      meta: "#16121c",
      swatchA: "#241d2d",
      swatchB: "#c6a6ff",
    },
    {
      id: "ember",
      label: "불빛",
      meta: "#17130f",
      swatchA: "#241b14",
      swatchB: "#ffb06a",
    },
    {
      id: "ocean",
      label: "바다",
      meta: "#0d171a",
      swatchA: "#17282d",
      swatchB: "#76dbe4",
    },
  ];
  const presetById = new Map(presets.map((preset) => [preset.id, preset]));
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  let savedPreset = "";
  try {
    savedPreset = localStorage.getItem("nfoifsb.themePreset") || "";
  } catch {
    savedPreset = "";
  }
  let activePreset = presetById.has(savedPreset) ? savedPreset : "forest";
  const resolved = () =>
    root.getAttribute("data-theme") || (systemDark.matches ? "dark" : "light");

  const ensurePalette = () => {
    document.querySelectorAll(".footer-theme-row").forEach((row) => {
      if (row.querySelector("[data-theme-palette]")) return;

      const customizer = document.createElement("div");
      customizer.className = "footer-theme-customizer";
      customizer.dataset.themeCustomizer = "";

      const label = document.createElement("span");
      label.textContent = "색상";
      customizer.append(label);

      const palette = document.createElement("div");
      palette.className = "theme-palette";
      palette.dataset.themePalette = "";
      presets.forEach((preset) => {
        const button = document.createElement("button");
        button.className = "theme-preset-button";
        button.type = "button";
        button.dataset.themePreset = preset.id;
        button.style.setProperty("--swatch-a", preset.swatchA);
        button.style.setProperty("--swatch-b", preset.swatchB);
        button.setAttribute("aria-label", `${preset.label} 다크모드 색상`);
        button.setAttribute("title", preset.label);
        palette.append(button);
      });
      customizer.append(palette);
      row.append(customizer);
    });
  };

  const sync = () => {
    const theme = resolved();
    const nextTheme = theme === "dark" ? "light" : "dark";
    root.setAttribute("data-theme-preset", activePreset);
    toggles.forEach((toggle) => {
      toggle.dataset.theme = theme;
      toggle.setAttribute("aria-pressed", String(theme === "dark"));
      toggle.setAttribute("aria-label", theme === "dark" ? "라이트모드로 전환" : "다크모드로 전환");
      toggle.querySelectorAll("[data-theme-icon]").forEach((ic) => {
        ic.hidden = ic.dataset.themeIcon !== nextTheme;
      });
      toggle.querySelectorAll("[data-theme-label]").forEach((label) => {
        label.textContent = theme === "dark" ? "라이트모드" : "다크모드";
      });
      toggle.querySelectorAll("[data-theme-description]").forEach((description) => {
        description.textContent =
          theme === "dark" ? "어두운 화면에서 밝은 화면으로 전환" : "밝은 화면에서 어두운 화면으로 전환";
      });
    });
    document.querySelectorAll(".theme-preset-button[data-theme-preset]").forEach((button) => {
      const pressed = button.dataset.themePreset === activePreset;
      button.setAttribute("aria-pressed", String(pressed));
    });
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      // Drop the media filter so the pinned theme's color always wins.
      m.removeAttribute("media");
      m.setAttribute(
        "content",
        theme === "dark" ? presetById.get(activePreset)?.meta || "#0d1411" : "#e8efeb",
      );
    });
  };

  ensurePalette();

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const next = resolved() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("nfoifsb.theme", next);
      } catch {
        // Toggle still works for this session without persistence.
      }
      sync();
    });
  });

  document.querySelectorAll(".theme-preset-button[data-theme-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPreset = button.dataset.themePreset;
      if (!presetById.has(nextPreset)) return;
      activePreset = nextPreset;
      root.setAttribute("data-theme", "dark");
      root.setAttribute("data-theme-preset", activePreset);
      try {
        localStorage.setItem("nfoifsb.theme", "dark");
        localStorage.setItem("nfoifsb.themePreset", activePreset);
      } catch {
        // Palette still works for this session without persistence.
      }
      sync();
    });
  });

  // Follow OS changes only while the user hasn't pinned a theme.
  systemDark.addEventListener("change", () => {
    if (!root.getAttribute("data-theme")) sync();
  });

  sync();
}

function initNav() {
  const nav = document.querySelector(".site-nav");
  const toggle = document.querySelector("[data-nav-toggle]");
  const links = document.querySelector(".nav-links");
  if (!nav || !toggle || !links) return;

  const mobileQuery = window.matchMedia("(max-width: 920px)");
  const mobileProxy = document.createElement("button");
  mobileProxy.type = "button";
  mobileProxy.className = "nav-mobile-proxy";
  mobileProxy.setAttribute("aria-controls", links.id || "primary-nav");
  mobileProxy.setAttribute("aria-expanded", "false");
  mobileProxy.setAttribute("aria-label", "메뉴 열기");
  mobileProxy.textContent = "☰";
  document.body.append(mobileProxy);

  const proxyStyles = {
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    position: "fixed",
    top: "18px",
    left: "min(calc(100vw - 62px), 330px)",
    "z-index": "12000",
    width: "42px",
    height: "42px",
    border: "1px solid rgba(251, 246, 236, 0.38)",
    "border-radius": "999px",
    background: "rgba(7, 6, 4, 0.84)",
    color: "#fbf6ec",
    "font-size": "1.1rem",
    "line-height": "1",
    "box-shadow": "0 12px 32px rgba(0, 0, 0, 0.32)",
    "backdrop-filter": "blur(12px)",
  };

  const syncMobileToggle = () => {
    if (!mobileQuery.matches) {
      [
        "display",
        "align-items",
        "justify-content",
        "visibility",
        "opacity",
        "position",
        "top",
        "left",
        "right",
        "z-index",
        "width",
        "height",
        "border",
        "border-radius",
        "background",
        "color",
      ].forEach((property) => toggle.style.removeProperty(property));
      toggle.querySelector("span")?.removeAttribute("style");
      mobileProxy.style.setProperty("display", "none", "important");
      return;
    }

    const styles = {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      visibility: "visible",
      opacity: "1",
      position: "fixed",
      top: "18px",
      left: "min(calc(100vw - 62px), 330px)",
      right: "auto",
      "z-index": "10020",
      width: "42px",
      height: "42px",
      border: "1px solid rgba(251, 246, 236, 0.34)",
      "border-radius": "999px",
      background: "rgba(251, 246, 236, 0.1)",
      color: "#fbf6ec",
    };

    Object.entries(styles).forEach(([property, value]) => {
      toggle.style.setProperty(property, value, "important");
    });

    const glyph = toggle.querySelector("span");
    if (glyph) {
      glyph.textContent = "☰";
      glyph.style.setProperty("display", "block", "important");
      glyph.style.setProperty("color", "#fbf6ec", "important");
      glyph.style.setProperty("-webkit-text-fill-color", "#fbf6ec", "important");
      glyph.style.setProperty("font-size", "1.1rem", "important");
      glyph.style.setProperty("line-height", "1", "important");
    }

    Object.entries(proxyStyles).forEach(([property, value]) => {
      mobileProxy.style.setProperty(property, value, "important");
    });
  };

  const syncExpandedState = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    mobileProxy.setAttribute("aria-expanded", String(open));
    mobileProxy.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    mobileProxy.textContent = open ? "×" : "☰";
  };

  const close = () => {
    nav.classList.remove("nav-open");
    syncExpandedState(false);
  };

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("nav-open");
    syncExpandedState(open);
  });

  mobileProxy.addEventListener("click", () => {
    toggle.click();
  });

  // Close after navigating or hitting login.
  links.addEventListener("click", (event) => {
    if (event.target.closest("a, .nav-login")) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target)) close();
  });

  syncMobileToggle();
  mobileQuery.addEventListener("change", syncMobileToggle);
  window.addEventListener("resize", syncMobileToggle);
}

function getCurrentPageKey() {
  const path = window.location.pathname.endsWith("/")
    ? `${window.location.pathname}index.html`
    : window.location.pathname;
  return PAGE_LINKS.get(path) || null;
}

function setActivePage(pageKey) {
  sectionLinks.forEach((link) => {
    const active = link.dataset.sectionLink === pageKey;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function initPageNavigation() {
  if (!sectionLinks.length) return;
  setActivePage(getCurrentPageKey());
}

function initAnimationStagger() {
  const animatedGroups = document.querySelectorAll(
    ".detail-grid, .plugin-grid, .feature-grid, .economy-grid, .market-list, .stock-heading, .stock-ticker, [data-stock-list], .section-dashboard, .rules-list, .rules-tools, .join-steps, .stats-inner, .gallery-strip",
  );

  animatedGroups.forEach((group) => {
    Array.from(group.children).forEach((child, index) => {
      child.style.setProperty("--item-index", index);
    });
  });
}

function formatStockNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return new Intl.NumberFormat("ko-KR").format(Math.round(number));
}

function formatStockKrw(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(Math.round(number));
}

function formatStockChange(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "+0.0%";
  const sign = number >= 0 ? "+" : "";
  return `${sign}${number.toFixed(1)}%`;
}

function clampStockValue(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function formatStockPercent(value, digits = 1, signed = false) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const sign = signed && number >= 0 ? "+" : "";
  return `${sign}${number.toFixed(digits)}%`;
}

function formatStockMultiple(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "--";
  return `${number.toFixed(1)}x`;
}

function formatStockKrwCompact(value) {
  return formatStockKrw(value);
}

function formatStockSignedKrw(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const sign = number >= 0 ? "+" : "-";
  return `${sign}${formatStockKrw(Math.abs(number))}`;
}

function formatStockTime(value) {
  if (!value) return "실시간";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "실시간";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatStockDateTime(value) {
  if (!value) return "실시간";
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  if (Number.isNaN(date.getTime())) return "실시간";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function setStockNodeText(target, text) {
  if (!target) return;
  if (target instanceof NodeList || Array.isArray(target)) {
    target.forEach((node) => {
      if (node) node.textContent = text;
    });
    return;
  }
  target.textContent = text;
}

function toggleStockNodeClass(target, className, force) {
  if (!target) return;
  if (target instanceof NodeList || Array.isArray(target)) {
    target.forEach((node) => node?.classList.toggle(className, force));
    return;
  }
  target.classList.toggle(className, force);
}

function stockCode(stock) {
  return stock?.symbol || stock?.code || "";
}

function stockHistoryCache() {
  return readJsonStorage(STOCK_HISTORY_CACHE_KEY, {});
}

function writeStockHistoryCache(cache) {
  try {
    localStorage.setItem(STOCK_HISTORY_CACHE_KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

function stockHistoryTime(value) {
  if (!value) return 0;
  const parsed = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed < 10_000_000_000 ? parsed * 1000 : parsed;
}

function stockHistoryBucketTime(value) {
  const time = stockHistoryTime(value);
  if (!time) return 0;
  return Math.floor(time / STOCK_HISTORY_BUCKET_MS) * STOCK_HISTORY_BUCKET_MS;
}

function normalizeStockHistoryPoint(stock, point, fallbackTime = "") {
  if (!point) return null;
  const close = Number(point.close ?? point.price ?? point.value ?? stock?.price);
  if (!Number.isFinite(close) || close <= 0) return null;
  const open = Number(point.open ?? point.price ?? point.value ?? close);
  const high = Number(point.high ?? Math.max(open, close));
  const low = Number(point.low ?? Math.min(open, close));
  const timeValue = point.time || point.at || point.startedAt || point.timestamp || fallbackTime;
  const bucketTime = stockHistoryBucketTime(timeValue);
  if (!bucketTime) return null;
  return {
    open: Number.isFinite(open) && open > 0 ? open : close,
    high: Number.isFinite(high) && high > 0 ? high : Math.max(open, close),
    low: Number.isFinite(low) && low > 0 ? low : Math.min(open, close),
    close,
    price: close,
    volume: Math.max(0, Number(point.volume) || 0),
    time: new Date(bucketTime).toISOString(),
    _time: bucketTime,
  };
}

function compactStockHistory(points) {
  const cutoff = Date.now() - STOCK_HISTORY_CACHE_MAX_AGE_MS;
  const buckets = new Map();
  points
    .map((point) => normalizeStockHistoryPoint(null, point))
    .filter((point) => point && point._time >= cutoff)
    .sort((left, right) => left._time - right._time)
    .forEach((point) => {
      const existing = buckets.get(point._time);
      if (!existing) {
        buckets.set(point._time, { ...point });
        return;
      }
      existing.high = Math.max(existing.high, point.high);
      existing.low = Math.min(existing.low, point.low);
      existing.close = point.close;
      existing.price = point.close;
      existing.volume = Math.max(existing.volume, point.volume);
      existing.time = point.time;
    });
  return [...buckets.values()]
    .sort((left, right) => left._time - right._time)
    .slice(-STOCK_HISTORY_CACHE_MAX_POINTS)
    .map(({ _time, ...point }) => point);
}

function stockIncomingHistory(stock) {
  const history = Array.isArray(stock?.history) ? stock.history : [];
  const normalized = history
    .map((point) => normalizeStockHistoryPoint(stock, point))
    .filter(Boolean);
  const latestTime = stock?.updatedAt || stock?.lastUpdatedAt || history.at(-1)?.time || history.at(-1)?.at || new Date().toISOString();
  const latestPoint = normalizeStockHistoryPoint(
    stock,
    {
      open: stock?.open ?? stock?.open24h ?? stock?.price,
      high: stock?.high ?? stock?.high24h ?? stock?.price,
      low: stock?.low ?? stock?.low24h ?? stock?.price,
      close: stock?.price,
      price: stock?.price,
      volume: stock?.lastVolume ?? stock?.candleVolume ?? stock?.intervalVolume ?? 0,
      time: latestTime,
    },
    latestTime,
  );
  if (latestPoint) normalized.push(latestPoint);
  return compactStockHistory(normalized);
}

function stockUsesPersistentHistory(stock) {
  return Boolean(stockCode(stock)) && !stock?.preview && !stock?.synthetic && !stock?.fallback;
}

function stockMergedHistory(stock) {
  const incoming = stockIncomingHistory(stock);
  if (!stockUsesPersistentHistory(stock)) return incoming;
  const code = stockCode(stock);
  const cache = stockHistoryCache();
  const cached = Array.isArray(cache[code]) ? cache[code] : [];
  const merged = compactStockHistory([...cached, ...incoming]);
  cache[code] = merged;
  writeStockHistoryCache(cache);
  return merged;
}

function stockOpenPrice(stock) {
  const open = Number(stock?.open24h);
  if (Number.isFinite(open) && open > 0) return open;
  const price = Number(stock?.price);
  const change = Number(stock?.change24h);
  if (Number.isFinite(price) && Number.isFinite(change) && change !== -100) {
    return price / (1 + change / 100);
  }
  return Number.isFinite(price) ? price : 0;
}

function stockChangeValue(stock) {
  const price = Number(stock?.price);
  const open = stockOpenPrice(stock);
  if (!Number.isFinite(price) || !Number.isFinite(open)) return 0;
  return price - open;
}

function latestStockTime(stock) {
  const history = stockMergedHistory(stock);
  const last = history.at(-1);
  return last?.time || last?.at || stock?.updatedAt || stock?.lastUpdatedAt;
}

function rangedStockSeries(series, range) {
  const size = STOCK_RANGE_CONFIG[range]?.points;
  if (!size || series.length <= size) return series;
  return series.slice(-size);
}

function stockRangeStepMs(range) {
  return STOCK_RANGE_CONFIG[range]?.stepMs || STOCK_RANGE_CONFIG["1D"].stepMs;
}

function stockProfile(stock) {
  const code = stockCode(stock);
  return STOCKS.find((item) => item.code === code) || {};
}

function stockActivityVolumeBase(stock) {
  const profile = stockProfile(stock);
  const reported = Number(stock?.volume24h);
  if (Number.isFinite(reported) && reported > 0) return Math.max(60, reported / 72);
  const profileVolume = Number(profile.volume || stock?.volume || 0);
  return Math.max(850, profileVolume * 0.14);
}

function stockDerivedCandleVolume(stock, point, previous, index) {
  const rawVolume = Number(point?.volume);
  if (Number.isFinite(rawVolume) && rawVolume > 0) return rawVolume;
  const open = Number(point?.open ?? previous?.close ?? point?.price ?? 1);
  const close = Number(point?.close ?? point?.price ?? open);
  const high = Number(point?.high ?? Math.max(open, close));
  const low = Number(point?.low ?? Math.min(open, close));
  const reference = Math.max(1, Number(previous?.close ?? open ?? close ?? 1));
  const rangePct = Math.max(0, (high - low) / reference);
  const bodyPct = Math.abs(close - open) / reference;
  const rhythm = 0.78 + Math.abs(Math.sin(index * 0.73 + reference * 0.001)) * 0.58;
  const activity = 0.74 + Math.min(3.4, rangePct * 15 + bodyPct * 26);
  return Math.max(25, Math.round(stockActivityVolumeBase(stock) * rhythm * activity));
}

function stockDisplayVolume24h(stock, tick = 0) {
  const reported = Number(stock?.volume24h);
  if (Number.isFinite(reported) && reported > 0) return reported;
  return Math.round(stockSeries(stock, tick, "1D").reduce((sum, point) => sum + (Number(point.volume) || 0), 0));
}

function stockMarketDisplayVolume24h(stocks, marketMeta, tick = 0) {
  const reported = Number(marketMeta?.volume24h);
  if (Number.isFinite(reported) && reported > 0) return reported;
  return stocks.reduce((sum, stock) => sum + stockDisplayVolume24h(stock, tick), 0);
}

function sortStocks(stocks, sortMode) {
  const sorted = [...stocks];
  if (sortMode === "change") {
    sorted.sort((left, right) => Number(right.change24h || 0) - Number(left.change24h || 0));
  } else if (sortMode === "volume") {
    sorted.sort((left, right) => stockDisplayVolume24h(right) - stockDisplayVolume24h(left));
  }
  return sorted;
}

async function fetchStockMarket() {
  if (!PLAYER_API_BASES.length) return null;
  try {
    const payload = await fetchPlayerApiJson("/stocks/market", STOCK_MARKET_TIMEOUT_MS);
    if (!payload?.ok || !Array.isArray(payload?.stocks)) throw new Error("invalid stock market payload");
    return payload;
  } catch {
    return null;
  }
}

async function fetchPlayerApiJson(path, timeoutMs, options = {}) {
  let lastError = null;
  for (const base of PLAYER_API_BASES) {
    try {
      return await fetchPlayerApiJsonFrom(base, path, timeoutMs, options);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("player api unavailable");
}

async function fetchPlayerApiJsonFrom(base, path, timeoutMs, options = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      cache: "no-store",
      signal: controller.signal,
      headers,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || `player api ${response.status}`);
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchStockPortfolio(playerProfile) {
  if (!playerProfile?.verified || !playerProfile?.webToken) return null;
  if (!PLAYER_API_BASES.length) return null;
  return fetchPlayerApiJson("/stocks/portfolio", STOCK_TRADE_TIMEOUT_MS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${playerProfile.webToken}`,
    },
    body: JSON.stringify({
      nickname: playerProfile.nickname,
      webToken: playerProfile.webToken,
    }),
  });
}

async function submitStockTrade(playerProfile, symbol, side, quantity, order = {}) {
  if (!playerProfile?.verified || !playerProfile?.webToken) {
    throw new Error("캐릭터 인증 후 거래할 수 있습니다.");
  }
  if (!PLAYER_API_BASES.length) {
    throw new Error("VITE_PLAYER_API_BASE가 연결되면 실시간 매수/매도 주문이 활성화됩니다.");
  }
  return fetchPlayerApiJson("/stocks/trade", STOCK_TRADE_TIMEOUT_MS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${playerProfile.webToken}`,
    },
    body: JSON.stringify({
      nickname: playerProfile.nickname,
      webToken: playerProfile.webToken,
      symbol,
      side,
      quantity,
      ...order,
    }),
  });
}

function fallbackStockSeries(stock, tick, length = 96, stepMs = 15 * 60_000) {
  const base = Number(stock.base || stock.price || 1000);
  const volumeSeed = Number(stock.volume || stock.volume24h || 3000);
  const rawDrift = Number(stock.drift || stock.change24h || 0);
  const drift = Math.abs(rawDrift) > 1 ? rawDrift / 100 : rawDrift;
  const beta = Number(stock.marketBeta || 1.2);
  const stockVol = Number(stock.volatility || STOCK_MARKET_VOLATILITY_PROFILE.nasdaq);
  const marketVol =
    (STOCK_MARKET_VOLATILITY_PROFILE.sp500 * 0.34
      + STOCK_MARKET_VOLATILITY_PROFILE.nasdaq * 0.38
      + STOCK_MARKET_VOLATILITY_PROFILE.russell1000 * 0.28)
    * beta;
  let previousClose = base;
  const count = Math.max(8, Math.floor(length));
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin((index + tick * 0.48) * 0.58 + base * 0.001) * (0.018 + marketVol * 1.45);
    const pulse = Math.cos((index + tick * 0.22) * 0.31 + volumeSeed * 0.0008) * (0.010 + stockVol * 0.88);
    const momentum = Math.sin((index + tick * 0.72) * 0.17 + beta * 2.1) * STOCK_MARKET_VOLATILITY_PROFILE.technicalSwing;
    const breakout = Math.sin((index + tick * 0.31) * 1.24 + base * 0.003) * stockVol * 0.72;
    const microMove = Math.sin((index + tick * 0.9) * 2.13 + beta * 4.7) * stockVol * 0.42;
    const shockGate = Math.sin((index + tick * 0.33) * 0.71 + base * 0.002);
    const shock = shockGate > 0.88 ? stockVol * 1.85 : shockGate < -0.9 ? -stockVol * 1.65 : 0;
    const trend = drift * (index / Math.max(1, count - 1));
    const price = Math.max(1, base * (1 + wave + pulse + momentum + breakout + microMove + shock + trend));
    const volume =
      44
      + Math.abs(Math.sin(index * 0.7 + tick + base)) * 96
      + Math.abs(momentum + breakout + microMove + shock) * 2600;
    const open = previousClose;
    const wickSpread = 0.006 + stockVol * 0.55 + Math.abs(Math.sin(index + tick)) * 0.006;
    const high = Math.max(open, price) * (1 + wickSpread);
    const low = Math.min(open, price) * (1 - wickSpread * 0.92);
    previousClose = price;
    return {
      open,
      high,
      low,
      close: price,
      price,
      volume,
      time: new Date(now - (count - 1 - index) * stepMs).toISOString(),
    };
  });
}

function stockSeries(stock, tick, range = "24H") {
  const history = stockMergedHistory(stock);
  const series = history
    .map((point) => ({
      open: Number(point.open ?? point.price ?? point.value ?? point.close),
      high: Number(point.high ?? point.close ?? point.price ?? point.value),
      low: Number(point.low ?? point.close ?? point.price ?? point.value),
      close: Number(point.close ?? point.price ?? point.value),
      price: Number(point.close ?? point.price ?? point.value),
      volume: Number(point.volume ?? 0),
      time: point.time || point.at || point.startedAt,
    }))
    .filter((point) => Number.isFinite(point.price) && point.price > 0);

  const target = STOCK_RANGE_CONFIG[range]?.points || STOCK_RANGE_CONFIG["1D"].points;
  const expectedLength = Number.isFinite(target) ? target : STOCK_RANGE_CONFIG["1D"].points;
  if (series.length >= Math.min(48, expectedLength)) {
    const normalized = series.map((point, index) => ({
      ...point,
      volume: stockDerivedCandleVolume(stock, point, series[index - 1], index),
    }));
    return rangedStockSeries(normalized, range);
  }
  const fallbackLength = Number.isFinite(target) ? target : STOCK_RANGE_CONFIG["1D"].points;
  return rangedStockSeries(fallbackStockSeries(stock, tick, fallbackLength, stockRangeStepMs(range)), range);
}

function buildFallbackMarket(tick) {
  const stocks = STOCKS.map((stock) => {
    const history = fallbackStockSeries(stock, tick);
    const first = history[0];
    const last = history.at(-1);
    return {
      ...stock,
      symbol: stock.code,
      preview: true,
      price: last.price,
      open24h: first.price,
      change24h: ((last.price - first.price) / first.price) * 100,
      volume24h: Math.round(history.reduce((sum, point) => sum + point.volume, 0) * 18),
      marketCap: stock.base * stock.volume,
      history: history.map((point, index) => ({
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.price,
        volume: point.volume,
        time: point.time || new Date(Date.now() - (history.length - 1 - index) * 15 * 60 * 1000).toISOString(),
      })),
    };
  });
  const index = 12480 + Math.round(Math.sin(tick * 0.42) * 82);
  return {
    ok: true,
    preview: true,
    market: {
      index,
      indexChange24h: 0.8 + Math.sin(tick * 0.36) * 0.7,
      volume24h: stocks.reduce((sum, stock) => sum + stock.volume24h, 0),
      marketCap: stocks.reduce((sum, stock) => sum + stock.marketCap, 0),
      session: PLAYER_API_BASES.length ? "API 대기" : "미리보기",
      updatedAt: new Date().toISOString(),
    },
    stocks,
    recentTrades: [],
  };
}

function createSvg(tag, attrs = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
}

function movingAverage(values, windowSize) {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = values.slice(start, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

function vwapSeries(series) {
  let volumeSum = 0;
  let valueSum = 0;
  return series.map((point) => {
    const volume = Math.max(1, Number(point.volume) || 1);
    const typical = ((point.high || point.price) + (point.low || point.price) + (point.close || point.price)) / 3;
    volumeSum += volume;
    valueSum += typical * volume;
    return valueSum / volumeSum;
  });
}

function emaSeries(values, period) {
  const multiplier = 2 / (period + 1);
  let previous = Number(values[0]) || 0;
  return values.map((value, index) => {
    const number = Number(value) || previous;
    previous = index === 0 ? number : number * multiplier + previous * (1 - multiplier);
    return previous;
  });
}

function relativeStrengthIndex(values, period = 14) {
  if (!Array.isArray(values) || values.length < 2) return 50;
  const slice = values.slice(-period - 1);
  let gains = 0;
  let losses = 0;
  for (let index = 1; index < slice.length; index += 1) {
    const change = Number(slice[index]) - Number(slice[index - 1]);
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return 100;
  const rs = gains / Math.max(0.0001, losses);
  return 100 - 100 / (1 + rs);
}

function stockVolatility(values) {
  if (!Array.isArray(values) || values.length < 3) return 0;
  const returns = values.slice(1).map((value, index) => (Number(value) - Number(values[index])) / Math.max(1, Number(values[index])));
  const average = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(returns.length) * 100;
}

function stockTechnicalMetrics(stock, tick, range) {
  const series = stockSeries(stock, tick, range);
  const closes = series.map((point) => Number(point.close || point.price));
  const last = closes.at(-1) || Number(stock?.price) || 0;
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macd = (ema12.at(-1) || last) - (ema26.at(-1) || last);
  const signal = emaSeries(ema12.map((value, index) => value - (ema26[index] || value)), 9).at(-1) || 0;
  const vwap = vwapSeries(series).at(-1) || last;
  const rsi = relativeStrengthIndex(closes);
  const volatility = stockVolatility(closes);
  const vwapGap = vwap ? ((last - vwap) / vwap) * 100 : 0;
  return { rsi, macd, signal, volatility, vwapGap, price: last };
}

function cloneStockChartSettings(value = DEFAULT_STOCK_CHART_SETTINGS) {
  return JSON.parse(JSON.stringify(value));
}

function clampStockSettingNumber(value, min, max, fallback, integer = true) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const clamped = Math.min(max, Math.max(min, number));
  return integer ? Math.round(clamped) : clamped;
}

function stockSettingColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
}

function normalizeStockLineSetting(source, fallback, options = {}) {
  const periodMin = options.allowZeroPeriod ? 0 : 1;
  return {
    ...fallback,
    ...(source || {}),
    enabled: Boolean(source?.enabled ?? fallback.enabled),
    period: clampStockSettingNumber(source?.period, periodMin, 500, fallback.period),
    color: stockSettingColor(source?.color, fallback.color),
    lineWidth: clampStockSettingNumber(source?.lineWidth, 1, 5, fallback.lineWidth),
    lineStyle: clampStockSettingNumber(source?.lineStyle, 0, 3, fallback.lineStyle),
  };
}

function normalizeStockLineGroup(source, fallback, options = {}) {
  const incoming = Array.isArray(source?.items) ? source.items : [];
  return {
    ...fallback,
    ...(source || {}),
    enabled: Boolean(source?.enabled ?? fallback.enabled),
    source: STOCK_SOURCE_OPTIONS.some((item) => item.value === source?.source) ? source.source : fallback.source,
    items: fallback.items.map((item, index) => {
      const candidate = incoming.find((entry) => entry?.id === item.id) || incoming[index];
      return normalizeStockLineSetting(candidate, item, options);
    }),
  };
}

function sanitizeStockChartSettings(source = {}) {
  const fallback = cloneStockChartSettings();
  const customSource = source.custom || {};
  const theme = STOCK_CHART_THEME_PRESETS[customSource.theme] ? customSource.theme : fallback.custom.theme;
  const themePreset = STOCK_CHART_THEME_PRESETS[theme];
  const settings = {
    ...fallback,
    ...(source || {}),
    mode: ["candle", "line", "area"].includes(source.mode) ? source.mode : fallback.mode,
    scale: ["price", "percent"].includes(source.scale) ? source.scale : fallback.scale,
    main: {
      ma: normalizeStockLineGroup(source.main?.ma, fallback.main.ma, { allowZeroPeriod: true }),
      ema: normalizeStockLineGroup(source.main?.ema, fallback.main.ema),
      wma: normalizeStockLineGroup(source.main?.wma, fallback.main.wma),
      vwap: {
        ...fallback.main.vwap,
        ...(source.main?.vwap || {}),
        enabled: Boolean(source.main?.vwap?.enabled ?? fallback.main.vwap.enabled),
        color: stockSettingColor(source.main?.vwap?.color, fallback.main.vwap.color),
        lineWidth: clampStockSettingNumber(source.main?.vwap?.lineWidth, 1, 5, fallback.main.vwap.lineWidth),
        lineStyle: clampStockSettingNumber(source.main?.vwap?.lineStyle, 0, 3, fallback.main.vwap.lineStyle),
      },
      boll: {
        ...fallback.main.boll,
        ...(source.main?.boll || {}),
        enabled: Boolean(source.main?.boll?.enabled ?? fallback.main.boll.enabled),
        source: STOCK_SOURCE_OPTIONS.some((item) => item.value === source.main?.boll?.source)
          ? source.main.boll.source
          : fallback.main.boll.source,
        period: clampStockSettingNumber(source.main?.boll?.period, 2, 300, fallback.main.boll.period),
        multiplier: clampStockSettingNumber(source.main?.boll?.multiplier, 0.5, 5, fallback.main.boll.multiplier, false),
        upperColor: stockSettingColor(source.main?.boll?.upperColor, fallback.main.boll.upperColor),
        middleColor: stockSettingColor(source.main?.boll?.middleColor, fallback.main.boll.middleColor),
        lowerColor: stockSettingColor(source.main?.boll?.lowerColor, fallback.main.boll.lowerColor),
        lineWidth: clampStockSettingNumber(source.main?.boll?.lineWidth, 1, 5, fallback.main.boll.lineWidth),
        lineStyle: clampStockSettingNumber(source.main?.boll?.lineStyle, 0, 3, fallback.main.boll.lineStyle),
      },
    },
    sub: {
      ...fallback.sub,
      ...(source.sub || {}),
      volume: Boolean(source.sub?.volume ?? fallback.sub.volume),
      volumeMa: Boolean(source.sub?.volumeMa ?? fallback.sub.volumeMa),
      volumeMaPeriod: clampStockSettingNumber(source.sub?.volumeMaPeriod, 1, 300, fallback.sub.volumeMaPeriod),
      volumeMaColor: stockSettingColor(source.sub?.volumeMaColor, fallback.sub.volumeMaColor),
      rsi: Boolean(source.sub?.rsi ?? fallback.sub.rsi),
      rsiPeriod: clampStockSettingNumber(source.sub?.rsiPeriod, 2, 100, fallback.sub.rsiPeriod),
      rsiColor: stockSettingColor(source.sub?.rsiColor, fallback.sub.rsiColor),
      macd: Boolean(source.sub?.macd ?? fallback.sub.macd),
      macdFast: clampStockSettingNumber(source.sub?.macdFast, 2, 100, fallback.sub.macdFast),
      macdSlow: clampStockSettingNumber(source.sub?.macdSlow, 3, 200, fallback.sub.macdSlow),
      macdSignal: clampStockSettingNumber(source.sub?.macdSignal, 2, 100, fallback.sub.macdSignal),
      macdColor: stockSettingColor(source.sub?.macdColor, fallback.sub.macdColor),
      macdSignalColor: stockSettingColor(source.sub?.macdSignalColor, fallback.sub.macdSignalColor),
    },
    trading: {
      ...fallback.trading,
      ...(source.trading || {}),
      tooltip: Boolean(source.trading?.tooltip ?? fallback.trading.tooltip),
      ohlc: Boolean(source.trading?.ohlc ?? fallback.trading.ohlc),
      performance: Boolean(source.trading?.performance ?? fallback.trading.performance),
      watermark: Boolean(source.trading?.watermark ?? fallback.trading.watermark),
      priceLine: Boolean(source.trading?.priceLine ?? fallback.trading.priceLine),
      lastValue: Boolean(source.trading?.lastValue ?? fallback.trading.lastValue),
      crosshair: Boolean(source.trading?.crosshair ?? fallback.trading.crosshair),
      scrollZoom: Boolean(source.trading?.scrollZoom ?? fallback.trading.scrollZoom),
    },
    custom: {
      ...fallback.custom,
      ...customSource,
      theme,
      background: stockSettingColor(customSource.background, themePreset.background),
      textColor: stockSettingColor(customSource.textColor, themePreset.textColor),
      upColor: stockSettingColor(customSource.upColor, fallback.custom.upColor),
      downColor: stockSettingColor(customSource.downColor, fallback.custom.downColor),
      lineColor: stockSettingColor(customSource.lineColor, fallback.custom.lineColor),
      areaTopColor: customSource.areaTopColor || fallback.custom.areaTopColor,
      areaBottomColor: customSource.areaBottomColor || fallback.custom.areaBottomColor,
      gridOpacity: clampStockSettingNumber(customSource.gridOpacity, 0, 60, fallback.custom.gridOpacity),
      barSpacing: clampStockSettingNumber(customSource.barSpacing, 3, 18, fallback.custom.barSpacing),
      candleBorders: Boolean(customSource.candleBorders ?? fallback.custom.candleBorders),
    },
    backtest: {
      ...fallback.backtest,
      ...(source.backtest || {}),
      strategy: ["ma-cross", "ema-cross", "price-vwap"].includes(source.backtest?.strategy)
        ? source.backtest.strategy
        : fallback.backtest.strategy,
      fastPeriod: clampStockSettingNumber(source.backtest?.fastPeriod, 2, 100, fallback.backtest.fastPeriod),
      slowPeriod: clampStockSettingNumber(source.backtest?.slowPeriod, 3, 300, fallback.backtest.slowPeriod),
      capital: clampStockSettingNumber(source.backtest?.capital, 1000, 1000000000, fallback.backtest.capital),
      feeBps: clampStockSettingNumber(source.backtest?.feeBps, 0, 100, fallback.backtest.feeBps),
    },
  };
  if (settings.sub.macdFast >= settings.sub.macdSlow) settings.sub.macdSlow = settings.sub.macdFast + 1;
  if (settings.backtest.fastPeriod >= settings.backtest.slowPeriod) settings.backtest.slowPeriod = settings.backtest.fastPeriod + 1;
  return settings;
}

function readStockChartSettings() {
  try {
    const raw = localStorage.getItem(STOCK_CHART_SETTINGS_KEY);
    return sanitizeStockChartSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return sanitizeStockChartSettings();
  }
}

function writeStockChartSettings(settings) {
  try {
    localStorage.setItem(STOCK_CHART_SETTINGS_KEY, JSON.stringify(sanitizeStockChartSettings(settings)));
  } catch {
    // Chart settings still work for the current session without persistence.
  }
}

function cloneStockDepthSettings(value = DEFAULT_STOCK_DEPTH_SETTINGS) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeStockDepthSettings(source = {}) {
  const fallback = cloneStockDepthSettings();
  const groupSize = [1, 5, 10].includes(Number(source.groupSize)) ? Number(source.groupSize) : fallback.groupSize;
  return {
    ...fallback,
    ...(source || {}),
    mode: ["both", "asks", "bids"].includes(source.mode) ? source.mode : fallback.mode,
    groupSize,
    rows: clampStockSettingNumber(source.rows, 5, 14, fallback.rows),
    clickAction: ["price", "price-size"].includes(source.clickAction) ? source.clickAction : fallback.clickAction,
    midClick: ["price", "off"].includes(source.midClick) ? source.midClick : fallback.midClick,
    autoSide: Boolean(source.autoSide ?? fallback.autoSide),
    showSum: Boolean(source.showSum ?? fallback.showSum),
    showDepth: Boolean(source.showDepth ?? fallback.showDepth),
    showMeter: Boolean(source.showMeter ?? fallback.showMeter),
    depthOpacity: clampStockSettingNumber(source.depthOpacity, 0, 90, fallback.depthOpacity),
    flashSelection: Boolean(source.flashSelection ?? fallback.flashSelection),
  };
}

function readStockDepthSettings() {
  try {
    const raw = localStorage.getItem(STOCK_DEPTH_SETTINGS_KEY);
    return sanitizeStockDepthSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return sanitizeStockDepthSettings();
  }
}

function writeStockDepthSettings(settings) {
  try {
    localStorage.setItem(STOCK_DEPTH_SETTINGS_KEY, JSON.stringify(sanitizeStockDepthSettings(settings)));
  } catch {
    // Order book settings still work for the current session without persistence.
  }
}

function stockToolbarIndicatorSet(settings) {
  const enabled = new Set();
  const ma = settings.main?.ma;
  if (!ma?.enabled) return enabled;
  ma.items.forEach((item) => {
    if (item.enabled && item.period > 0) enabled.add(item.id);
  });
  return enabled;
}

function setStockToolbarIndicator(settings, id, enabled) {
  const item = settings.main.ma.items.find((entry) => entry.id === id);
  if (!item) return;
  settings.main.ma.enabled = true;
  item.enabled = enabled;
  if (!item.period) {
    const fallback = DEFAULT_STOCK_CHART_SETTINGS.main.ma.items.find((entry) => entry.id === id);
    item.period = fallback?.period || 7;
  }
}

function stockIndicatorSourceValue(point, source = "close") {
  if (source === "open") return Number(point.open);
  if (source === "high") return Number(point.high);
  if (source === "low") return Number(point.low);
  if (source === "hl2") return (Number(point.high) + Number(point.low)) / 2;
  if (source === "hlc3") return (Number(point.high) + Number(point.low) + Number(point.close)) / 3;
  if (source === "ohlc4") return (Number(point.open) + Number(point.high) + Number(point.low) + Number(point.close)) / 4;
  return Number(point.close || point.price);
}

function weightedMovingAverage(values, period) {
  const windowSize = Math.max(1, Math.round(Number(period) || 1));
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = values.slice(start, index + 1);
    const weightSum = (slice.length * (slice.length + 1)) / 2;
    return slice.reduce((sum, value, sliceIndex) => sum + Number(value) * (sliceIndex + 1), 0) / Math.max(1, weightSum);
  });
}

function bollingerBands(values, period, multiplier) {
  const windowSize = Math.max(2, Math.round(Number(period) || 20));
  const factor = Math.max(0.1, Number(multiplier) || 2);
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = values.slice(start, index + 1).map(Number);
    const mean = slice.reduce((sum, value) => sum + value, 0) / Math.max(1, slice.length);
    const variance = slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, slice.length);
    const deviation = Math.sqrt(variance);
    return { upper: mean + deviation * factor, middle: mean, lower: mean - deviation * factor };
  });
}

function macdSeries(values, fastPeriod, slowPeriod, signalPeriod) {
  const fast = emaSeries(values, fastPeriod);
  const slow = emaSeries(values, slowPeriod);
  const macd = fast.map((value, index) => value - (slow[index] || value));
  const signal = emaSeries(macd, signalPeriod);
  const histogram = macd.map((value, index) => value - (signal[index] || 0));
  return { macd, signal, histogram };
}

function runStockBacktest(series, settings) {
  const rows = Array.isArray(series) ? series : [];
  const closes = rows.map((point) => Number(point.close || point.price)).filter((value) => Number.isFinite(value) && value > 0);
  if (closes.length < 4) {
    return { trades: 0, finalEquity: settings.capital, returnPct: 0, winRate: 0, maxDrawdown: 0 };
  }
  const capital = Math.max(1000, Number(settings.capital) || 1000000);
  const fee = Math.max(0, Number(settings.feeBps) || 0) / 10000;
  const fastPeriod = Math.max(2, Number(settings.fastPeriod) || 7);
  const slowPeriod = Math.max(fastPeriod + 1, Number(settings.slowPeriod) || 25);
  const fast =
    settings.strategy === "ema-cross" ? emaSeries(closes, fastPeriod) : movingAverage(closes, fastPeriod);
  const slow =
    settings.strategy === "price-vwap"
      ? vwapSeries(rows).map((value) => Number(value) || 0)
      : settings.strategy === "ema-cross"
        ? emaSeries(closes, slowPeriod)
        : movingAverage(closes, slowPeriod);
  let cash = capital;
  let quantity = 0;
  let entryPrice = 0;
  let wins = 0;
  let trades = 0;
  let peak = capital;
  let maxDrawdown = 0;
  for (let index = 1; index < closes.length; index += 1) {
    const price = closes[index];
    const previousFast = settings.strategy === "price-vwap" ? closes[index - 1] : fast[index - 1];
    const currentFast = settings.strategy === "price-vwap" ? price : fast[index];
    const previousSlow = slow[index - 1];
    const currentSlow = slow[index];
    const crossUp = previousFast <= previousSlow && currentFast > currentSlow;
    const crossDown = previousFast >= previousSlow && currentFast < currentSlow;
    if (!quantity && crossUp) {
      quantity = (cash * (1 - fee)) / price;
      cash = 0;
      entryPrice = price;
      trades += 1;
    } else if (quantity && crossDown) {
      const proceeds = quantity * price * (1 - fee);
      if (price > entryPrice) wins += 1;
      cash = proceeds;
      quantity = 0;
      trades += 1;
    }
    const equity = cash + quantity * price;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, ((peak - equity) / Math.max(1, peak)) * 100);
  }
  const finalEquity = cash + quantity * closes.at(-1);
  const closedTrades = Math.max(1, Math.floor(trades / 2));
  return {
    trades,
    finalEquity,
    returnPct: ((finalEquity - capital) / capital) * 100,
    winRate: (wins / closedTrades) * 100,
    maxDrawdown,
  };
}

function stockSettingsElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function stockSettingsField(label, control, note = "") {
  const wrapper = stockSettingsElement("label", "stock-chart-setting-field");
  const labelElement = stockSettingsElement("span", "", label);
  wrapper.append(labelElement, control);
  if (note) wrapper.append(stockSettingsElement("small", "", note));
  return wrapper;
}

function stockSettingsCheckbox(label, checked, onChange) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(checked);
  input.addEventListener("change", () => onChange(input.checked));
  const wrapper = stockSettingsElement("label", "stock-chart-setting-check");
  wrapper.append(input, stockSettingsElement("span", "", label));
  return wrapper;
}

function stockSettingsNumber(value, onChange, options = {}) {
  const input = document.createElement("input");
  input.type = "number";
  input.value = String(value ?? 0);
  if (options.min !== undefined) input.min = String(options.min);
  if (options.max !== undefined) input.max = String(options.max);
  input.step = String(options.step ?? 1);
  input.addEventListener("input", () => onChange(input.value));
  return input;
}

function stockSettingsColor(value, onChange) {
  const input = document.createElement("input");
  input.type = "color";
  input.value = stockSettingColor(value, "#f0b90b");
  input.addEventListener("input", () => onChange(input.value));
  return input;
}

function stockSettingsSelect(value, options, onChange) {
  const select = document.createElement("select");
  options.forEach((option) => {
    const node = document.createElement("option");
    node.value = String(option.value);
    node.textContent = option.label;
    if (String(option.value) === String(value)) node.selected = true;
    select.append(node);
  });
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function stockSettingsPanel(title, summary = "") {
  const panel = stockSettingsElement("section", "stock-chart-setting-panel");
  const heading = stockSettingsElement("div", "stock-chart-setting-panel-head");
  heading.append(stockSettingsElement("strong", "", title));
  if (summary) heading.append(stockSettingsElement("span", "", summary));
  panel.append(heading);
  return panel;
}

function appendStockLineRows(panel, group, typeLabel, onStructuralChange) {
  const header = stockSettingsElement("div", "stock-chart-setting-row is-header");
  header.append(
    stockSettingsCheckbox(`${typeLabel} 사용`, group.enabled, (checked) => {
      group.enabled = checked;
      onStructuralChange();
    }),
    stockSettingsField(
      "기준값",
      stockSettingsSelect(group.source, STOCK_SOURCE_OPTIONS, (value) => {
        group.source = value;
      }),
    ),
  );
  panel.append(header);
  group.items.forEach((item) => {
    const row = stockSettingsElement("div", "stock-chart-setting-row");
    row.append(
      stockSettingsCheckbox(item.label, group.enabled && item.enabled, (checked) => {
        group.enabled = true;
        item.enabled = checked;
        onStructuralChange();
      }),
      stockSettingsField(
        "기간",
        stockSettingsNumber(item.period, (value) => {
          item.period = clampStockSettingNumber(value, 0, 500, item.period);
        }, { min: 0, max: 500 }),
      ),
      stockSettingsField(
        "선 스타일",
        stockSettingsSelect(item.lineStyle, STOCK_LINE_STYLES, (value) => {
          item.lineStyle = clampStockSettingNumber(value, 0, 3, item.lineStyle);
        }),
      ),
      stockSettingsField(
        "두께",
        stockSettingsNumber(item.lineWidth, (value) => {
          item.lineWidth = clampStockSettingNumber(value, 1, 5, item.lineWidth);
        }, { min: 1, max: 5 }),
      ),
      stockSettingsField("색상", stockSettingsColor(item.color, (value) => {
        item.color = value;
      })),
    );
    panel.append(row);
  });
}

function renderStockChartSettingsTabs(elements, activeTab, onSelect) {
  if (!elements.tabs) return;
  elements.tabs.replaceChildren(
    ...STOCK_CHART_SETTING_TABS.map((tab) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = tab.label;
      button.className = tab.id === activeTab ? "is-active" : "";
      button.addEventListener("click", () => onSelect(tab.id));
      return button;
    }),
  );
}

function renderStockChartMainSettings(body, draft, rerender) {
  const maPanel = stockSettingsPanel("MA - 이동평균", "이동평균선을 최대 6개까지 설정합니다.");
  appendStockLineRows(maPanel, draft.main.ma, "MA", rerender);
  const emaPanel = stockSettingsPanel("EMA - 지수 이동평균");
  appendStockLineRows(emaPanel, draft.main.ema, "EMA", rerender);
  const wmaPanel = stockSettingsPanel("WMA - 가중 이동평균");
  appendStockLineRows(wmaPanel, draft.main.wma, "WMA", rerender);
  const extras = stockSettingsPanel("VWAP / BOLL");
  const vwapRow = stockSettingsElement("div", "stock-chart-setting-row");
  vwapRow.append(
    stockSettingsCheckbox("VWAP", draft.main.vwap.enabled, (checked) => {
      draft.main.vwap.enabled = checked;
      rerender();
    }),
    stockSettingsField("선 스타일", stockSettingsSelect(draft.main.vwap.lineStyle, STOCK_LINE_STYLES, (value) => {
      draft.main.vwap.lineStyle = clampStockSettingNumber(value, 0, 3, draft.main.vwap.lineStyle);
    })),
    stockSettingsField("두께", stockSettingsNumber(draft.main.vwap.lineWidth, (value) => {
      draft.main.vwap.lineWidth = clampStockSettingNumber(value, 1, 5, draft.main.vwap.lineWidth);
    }, { min: 1, max: 5 })),
    stockSettingsField("색상", stockSettingsColor(draft.main.vwap.color, (value) => {
      draft.main.vwap.color = value;
    })),
  );
  const bollRow = stockSettingsElement("div", "stock-chart-setting-row");
  bollRow.append(
    stockSettingsCheckbox("BOLL", draft.main.boll.enabled, (checked) => {
      draft.main.boll.enabled = checked;
      rerender();
    }),
    stockSettingsField("기간", stockSettingsNumber(draft.main.boll.period, (value) => {
      draft.main.boll.period = clampStockSettingNumber(value, 2, 300, draft.main.boll.period);
    }, { min: 2, max: 300 })),
    stockSettingsField("배수", stockSettingsNumber(draft.main.boll.multiplier, (value) => {
      draft.main.boll.multiplier = clampStockSettingNumber(value, 0.5, 5, draft.main.boll.multiplier, false);
    }, { min: 0.5, max: 5, step: 0.1 })),
    stockSettingsField("기준값", stockSettingsSelect(draft.main.boll.source, STOCK_SOURCE_OPTIONS, (value) => {
      draft.main.boll.source = value;
    })),
    stockSettingsField("상단선", stockSettingsColor(draft.main.boll.upperColor, (value) => {
      draft.main.boll.upperColor = value;
    })),
    stockSettingsField("중앙선", stockSettingsColor(draft.main.boll.middleColor, (value) => {
      draft.main.boll.middleColor = value;
    })),
    stockSettingsField("하단선", stockSettingsColor(draft.main.boll.lowerColor, (value) => {
      draft.main.boll.lowerColor = value;
    })),
  );
  extras.append(vwapRow, bollRow);
  body.append(maPanel, emaPanel, wmaPanel, extras);
}

function renderStockChartSubSettings(body, draft, rerender) {
  const panel = stockSettingsPanel("보조 지표", "거래량, RSI, MACD를 하단 지표 영역에 표시합니다.");
  const volumeRow = stockSettingsElement("div", "stock-chart-setting-row");
  volumeRow.append(
    stockSettingsCheckbox("거래량", draft.sub.volume, (checked) => {
      draft.sub.volume = checked;
      rerender();
    }),
    stockSettingsCheckbox("거래량 이동평균", draft.sub.volumeMa, (checked) => {
      draft.sub.volumeMa = checked;
      rerender();
    }),
    stockSettingsField("거래량 MA 기간", stockSettingsNumber(draft.sub.volumeMaPeriod, (value) => {
      draft.sub.volumeMaPeriod = clampStockSettingNumber(value, 1, 300, draft.sub.volumeMaPeriod);
    }, { min: 1, max: 300 })),
    stockSettingsField("거래량 MA 색상", stockSettingsColor(draft.sub.volumeMaColor, (value) => {
      draft.sub.volumeMaColor = value;
    })),
  );
  const rsiRow = stockSettingsElement("div", "stock-chart-setting-row");
  rsiRow.append(
    stockSettingsCheckbox("RSI", draft.sub.rsi, (checked) => {
      draft.sub.rsi = checked;
      rerender();
    }),
    stockSettingsField("기간", stockSettingsNumber(draft.sub.rsiPeriod, (value) => {
      draft.sub.rsiPeriod = clampStockSettingNumber(value, 2, 100, draft.sub.rsiPeriod);
    }, { min: 2, max: 100 })),
    stockSettingsField("색상", stockSettingsColor(draft.sub.rsiColor, (value) => {
      draft.sub.rsiColor = value;
    })),
  );
  const macdRow = stockSettingsElement("div", "stock-chart-setting-row");
  macdRow.append(
    stockSettingsCheckbox("MACD", draft.sub.macd, (checked) => {
      draft.sub.macd = checked;
      rerender();
    }),
    stockSettingsField("단기", stockSettingsNumber(draft.sub.macdFast, (value) => {
      draft.sub.macdFast = clampStockSettingNumber(value, 2, 100, draft.sub.macdFast);
    }, { min: 2, max: 100 })),
    stockSettingsField("장기", stockSettingsNumber(draft.sub.macdSlow, (value) => {
      draft.sub.macdSlow = clampStockSettingNumber(value, 3, 200, draft.sub.macdSlow);
    }, { min: 3, max: 200 })),
    stockSettingsField("신호", stockSettingsNumber(draft.sub.macdSignal, (value) => {
      draft.sub.macdSignal = clampStockSettingNumber(value, 2, 100, draft.sub.macdSignal);
    }, { min: 2, max: 100 })),
    stockSettingsField("MACD", stockSettingsColor(draft.sub.macdColor, (value) => {
      draft.sub.macdColor = value;
    })),
    stockSettingsField("신호선", stockSettingsColor(draft.sub.macdSignalColor, (value) => {
      draft.sub.macdSignalColor = value;
    })),
  );
  panel.append(volumeRow, rsiRow, macdRow);
  body.append(panel);
}

function renderStockTradingSettings(body, draft, rerender) {
  const panel = stockSettingsPanel("거래 데이터", "차트 표시 정보와 인터랙션을 조정합니다.");
  [
    ["툴팁", "tooltip"],
    ["상단 OHLC", "ohlc"],
    ["성과 요약", "performance"],
    ["워터마크", "watermark"],
    ["현재가 선", "priceLine"],
    ["마지막 값", "lastValue"],
    ["십자선", "crosshair"],
    ["휠 확대", "scrollZoom"],
  ].forEach(([label, key]) => {
    panel.append(
      stockSettingsCheckbox(label, draft.trading[key], (checked) => {
        draft.trading[key] = checked;
        rerender();
      }),
    );
  });
  body.append(panel);
}

function renderStockCustomSettings(body, draft, rerender) {
  const panel = stockSettingsPanel("사용자 설정", "차트 테마, 색상, 축, 간격을 조정합니다.");
  const themeOptions = Object.entries(STOCK_CHART_THEME_PRESETS).map(([value, preset]) => ({ value, label: preset.label }));
  const modeOptions = [
    { value: "candle", label: "캔들" },
    { value: "line", label: "라인" },
    { value: "area", label: "영역" },
  ];
  const scaleOptions = [
    { value: "price", label: "현재가" },
    { value: "percent", label: "등락률" },
  ];
  const row = stockSettingsElement("div", "stock-chart-setting-row");
  row.append(
    stockSettingsField("테마", stockSettingsSelect(draft.custom.theme, themeOptions, (value) => {
      const preset = STOCK_CHART_THEME_PRESETS[value] || STOCK_CHART_THEME_PRESETS.exchange;
      draft.custom.theme = value;
      draft.custom.background = preset.background;
      draft.custom.textColor = preset.textColor;
      rerender();
    })),
    stockSettingsField("차트 유형", stockSettingsSelect(draft.mode, modeOptions, (value) => {
      draft.mode = value;
    })),
    stockSettingsField("축 기준", stockSettingsSelect(draft.scale, scaleOptions, (value) => {
      draft.scale = value;
    })),
    stockSettingsField("배경", stockSettingsColor(draft.custom.background, (value) => {
      draft.custom.background = value;
    })),
    stockSettingsField("글자", stockSettingsColor(draft.custom.textColor, (value) => {
      draft.custom.textColor = value;
    })),
    stockSettingsField("상승", stockSettingsColor(draft.custom.upColor, (value) => {
      draft.custom.upColor = value;
    })),
    stockSettingsField("하락", stockSettingsColor(draft.custom.downColor, (value) => {
      draft.custom.downColor = value;
    })),
    stockSettingsField("라인", stockSettingsColor(draft.custom.lineColor, (value) => {
      draft.custom.lineColor = value;
    })),
    stockSettingsField("격자 투명도", stockSettingsNumber(draft.custom.gridOpacity, (value) => {
      draft.custom.gridOpacity = clampStockSettingNumber(value, 0, 60, draft.custom.gridOpacity);
    }, { min: 0, max: 60 })),
    stockSettingsField("봉 간격", stockSettingsNumber(draft.custom.barSpacing, (value) => {
      draft.custom.barSpacing = clampStockSettingNumber(value, 3, 18, draft.custom.barSpacing);
    }, { min: 3, max: 18 })),
    stockSettingsCheckbox("캔들 테두리", draft.custom.candleBorders, (checked) => {
      draft.custom.candleBorders = checked;
    }),
  );
  panel.append(row);
  body.append(panel);
}

function renderStockBacktestSettings(body, draft, context, rerender) {
  const panel = stockSettingsPanel("백테스트", "현재 보이는 시계열로 전략을 빠르게 시뮬레이션합니다.");
  const strategyOptions = [
    { value: "ma-cross", label: "MA 교차" },
    { value: "ema-cross", label: "EMA 교차" },
    { value: "price-vwap", label: "현재가 / VWAP" },
  ];
  const row = stockSettingsElement("div", "stock-chart-setting-row");
  row.append(
    stockSettingsField("전략", stockSettingsSelect(draft.backtest.strategy, strategyOptions, (value) => {
      draft.backtest.strategy = value;
      rerender();
    })),
    stockSettingsField("단기", stockSettingsNumber(draft.backtest.fastPeriod, (value) => {
      draft.backtest.fastPeriod = clampStockSettingNumber(value, 2, 100, draft.backtest.fastPeriod);
    }, { min: 2, max: 100 })),
    stockSettingsField("장기", stockSettingsNumber(draft.backtest.slowPeriod, (value) => {
      draft.backtest.slowPeriod = clampStockSettingNumber(value, 3, 300, draft.backtest.slowPeriod);
    }, { min: 3, max: 300 })),
    stockSettingsField("초기 자본", stockSettingsNumber(draft.backtest.capital, (value) => {
      draft.backtest.capital = clampStockSettingNumber(value, 1000, 1000000000, draft.backtest.capital);
    }, { min: 1000, max: 1000000000, step: 1000 })),
    stockSettingsField("수수료 bps", stockSettingsNumber(draft.backtest.feeBps, (value) => {
      draft.backtest.feeBps = clampStockSettingNumber(value, 0, 100, draft.backtest.feeBps);
    }, { min: 0, max: 100 })),
  );
  const runButton = document.createElement("button");
  runButton.type = "button";
  runButton.className = "stock-chart-backtest-run";
  runButton.textContent = "백테스트 실행";
  runButton.addEventListener("click", rerender);
  row.append(runButton);
  const result = runStockBacktest(context.series, sanitizeStockChartSettings(draft).backtest);
  const results = stockSettingsElement("div", "stock-chart-backtest-result");
  [
    ["최종 평가금", formatStockKrw(result.finalEquity)],
    ["수익률", formatStockChange(result.returnPct)],
    ["거래 수", formatStockNumber(result.trades)],
    ["승률", `${result.winRate.toFixed(1)}%`],
    ["최대 낙폭", `${result.maxDrawdown.toFixed(1)}%`],
  ].forEach(([label, value]) => {
    const item = stockSettingsElement("span");
    item.append(stockSettingsElement("em", "", label), stockSettingsElement("strong", "", value));
    results.append(item);
  });
  panel.append(row, results);
  body.append(panel);
}

function renderStockChartSettingsBody(elements, draft, activeTab, context, rerender) {
  if (!elements.body) return;
  elements.body.replaceChildren();
  if (activeTab === "sub") renderStockChartSubSettings(elements.body, draft, rerender);
  else if (activeTab === "trading") renderStockTradingSettings(elements.body, draft, rerender);
  else if (activeTab === "custom") renderStockCustomSettings(elements.body, draft, rerender);
  else if (activeTab === "backtest") renderStockBacktestSettings(elements.body, draft, context, rerender);
  else renderStockChartMainSettings(elements.body, draft, rerender);
}

function stockFinancialSeed(code) {
  return (
    String(code || "")
      .split("")
      .reduce((sum, character, index) => sum + character.charCodeAt(0) * (index + 3), 0) % 97
  ) / 96;
}

function periodRatio(numerator, denominator) {
  const top = Number(numerator);
  const bottom = Number(denominator);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) return null;
  return top / bottom;
}

function financialKstParts(source = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(source);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

function financialKstDateTimeParts(source = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(source);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function formatFinancialDate(year, month, day = 1) {
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

function currentFinancialQuarter(source = new Date()) {
  const now = financialKstParts(source);
  const quarter = Math.floor((now.month - 1) / 3) + 1;
  const nextQuarterMonth = quarter === 4 ? 1 : quarter * 3 + 1;
  const nextQuarterYear = quarter === 4 ? now.year + 1 : now.year;
  return {
    year: now.year,
    quarter,
    label: `${now.year} Q${quarter}E`,
    generatedAt: formatFinancialDate(now.year, now.month, now.day),
    nextUpdate: formatFinancialDate(nextQuarterYear, nextQuarterMonth, 1),
  };
}

function financialQuarterPeriods(meta = currentFinancialQuarter(), count = FINANCIAL_PERIOD_COUNT) {
  const periods = [];
  let year = meta.year;
  let quarter = meta.quarter;
  for (let index = 0; index < count; index += 1) {
    periods.push({
      year,
      quarter,
      label: `${year} Q${quarter}${index === 0 ? "E" : ""}`,
      isEstimate: index === 0,
    });
    quarter -= 1;
    if (quarter < 1) {
      quarter = 4;
      year -= 1;
    }
  }
  return periods;
}

function datePartsFromUtcDate(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function shiftKstDateParts(parts, dayOffset) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));
  return datePartsFromUtcDate(date);
}

function formatStockNewsSlot(parts, slot) {
  return `${formatFinancialDate(parts.year, parts.month, parts.day)} ${slot.label}`;
}

function currentStockNewsWeek(source = new Date()) {
  const now = financialKstDateTimeParts(source);
  const slots = [
    { key: "morning", label: "오전 브리프", hour: 8 },
    { key: "lunch", label: "정오 브리프", hour: 12 },
    { key: "evening", label: "저녁 브리프", hour: 18 },
  ];
  let activeSlot = slots[2];
  let activeDate = shiftKstDateParts(now, -1);
  let nextSlot = slots[0];
  let nextDate = { year: now.year, month: now.month, day: now.day };
  if (now.hour >= 18) {
    activeSlot = slots[2];
    activeDate = { year: now.year, month: now.month, day: now.day };
    nextSlot = slots[0];
    nextDate = shiftKstDateParts(now, 1);
  } else if (now.hour >= 12) {
    activeSlot = slots[1];
    activeDate = { year: now.year, month: now.month, day: now.day };
    nextSlot = slots[2];
  } else if (now.hour >= 8) {
    activeSlot = slots[0];
    activeDate = { year: now.year, month: now.month, day: now.day };
    nextSlot = slots[1];
  }
  return {
    key: `${formatFinancialDate(activeDate.year, activeDate.month, activeDate.day)}:${activeSlot.key}`,
    label: formatStockNewsSlot(activeDate, activeSlot),
    range: `${formatStockNewsSlot(activeDate, activeSlot)} 기준`,
    nextUpdate: `${formatFinancialDate(nextDate.year, nextDate.month, nextDate.day)} ${String(nextSlot.hour).padStart(2, "0")}:00`,
    cadence: "매일 08:00 / 12:00 / 18:00 KST",
  };
}

function seededStockNewsNumber(input) {
  let hash = 2166136261;
  String(input || "").split("").forEach((character) => {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });
  return (hash >>> 0) / 4294967295;
}

function pickStockNewsValue(values, seed, offset = 0) {
  if (!values.length) return "";
  const number = seededStockNewsNumber(`${seed}:${offset}`);
  return values[Math.floor(number * values.length) % values.length];
}

function stockNewsTopic(stock) {
  const code = stockCode(stock);
  return {
    DMD: "채굴 효율",
    FARM: "수확량",
    LOG: "건축 수요",
    RED: "자동화 회로",
  }[code] || "시장 흐름";
}

function stockNewsImagesFor(code) {
  const images = STOCK_NEWS_IMAGES[code] || STOCK_NEWS_IMAGES.DEFAULT;
  return images.length ? images : STOCK_NEWS_IMAGES.DEFAULT;
}

const stockNewsSourceImageCache = new Map();
const stockNewsCompositeCache = new Map();

function stockNewsSceneTheme(code) {
  return STOCK_NEWS_SCENE_THEMES[code] || STOCK_NEWS_SCENE_THEMES.DEFAULT;
}

function stockNewsNumber(seed, offset = 0) {
  return seededStockNewsNumber(`${seed}:image:${offset}`);
}

function stockNewsRange(seed, offset, min, max) {
  return min + stockNewsNumber(seed, offset) * (max - min);
}

function stockNewsRng(seed) {
  let state = Math.floor(stockNewsNumber(seed, 777) * 4294967296) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function stockNewsLoadSourceImage(src) {
  if (stockNewsSourceImageCache.has(src)) return stockNewsSourceImageCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load stock news image: ${src}`));
    image.src = src;
  });
  stockNewsSourceImageCache.set(src, promise);
  return promise;
}

function stockNewsPositionRatio(position = "50% 50%") {
  const [x = "50%", y = "50%"] = String(position).split(/\s+/);
  const parse = (value) => {
    const number = Number(String(value).replace("%", ""));
    return Number.isFinite(number) ? clampStockValue(number / 100, 0, 1) : 0.5;
  };
  return { x: parse(x), y: parse(y) };
}

function stockNewsDrawCover(ctx, image, width, height, position) {
  const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  const align = stockNewsPositionRatio(position);
  const dx = (width - drawWidth) * align.x;
  const dy = (height - drawHeight) * align.y;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function stockNewsFillRoundRect(ctx, x, y, width, height, radius) {
  const size = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + size, y);
  ctx.lineTo(x + width - size, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + size);
  ctx.lineTo(x + width, y + height - size);
  ctx.quadraticCurveTo(x + width, y + height, x + width - size, y + height);
  ctx.lineTo(x + size, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - size);
  ctx.lineTo(x, y + size);
  ctx.quadraticCurveTo(x, y, x + size, y);
  ctx.closePath();
}

function stockNewsDrawGlow(ctx, x, y, radius, color, alpha = 0.45) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, color);
  glow.addColorStop(0.36, `${color}99`);
  glow.addColorStop(1, `${color}00`);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function stockNewsDrawColorGrade(ctx, theme, imageData, rng, width, height) {
  const toneColor = imageData.tone === "bad" ? "#e5484d" : imageData.tone === "good" ? "#1faa69" : "#1e64d6";
  ctx.save();
  let gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `${theme.sky}38`);
  gradient.addColorStop(0.52, "rgba(8, 14, 17, 0.04)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.44)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "rgba(4, 10, 13, 0.58)");
  gradient.addColorStop(0.5, "rgba(4, 10, 13, 0)");
  gradient.addColorStop(1, "rgba(4, 10, 13, 0.42)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  stockNewsDrawGlow(ctx, stockNewsRange(imageData.seed, 34, 150, 1380), stockNewsRange(imageData.seed, 35, 80, 400), 420, theme.accent, 0.22);
  stockNewsDrawGlow(ctx, stockNewsRange(imageData.seed, 36, 620, 1500), stockNewsRange(imageData.seed, 37, 420, 820), 520, toneColor, 0.18);

  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i += 1) {
    const y = stockNewsRange(imageData.seed, 50 + i, 0, height);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y));
    ctx.lineTo(width, Math.round(y));
    ctx.stroke();
  }
  ctx.restore();
}

function stockNewsDrawTopicDetails(ctx, theme, imageData, rng, width, height) {
  ctx.save();
  const accent = imageData.tone === "bad" ? "#ff525d" : imageData.tone === "good" ? theme.accent : "#4f8cff";
  ctx.shadowColor = accent;
  ctx.shadowBlur = 22;

  if (imageData.code === "DMD") {
    for (let i = 0; i < 22; i += 1) {
      const x = stockNewsRange(imageData.seed, 120 + i, 80, width - 90);
      const y = stockNewsRange(imageData.seed, 160 + i, 110, height - 90);
      const size = stockNewsRange(imageData.seed, 190 + i, 10, 30);
      ctx.fillStyle = i % 3 === 0 ? theme.accentSoft : theme.accent;
      ctx.globalAlpha = stockNewsRange(imageData.seed, 210 + i, 0.35, 0.86);
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size * 0.9, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size * 0.9, y);
      ctx.closePath();
      ctx.fill();
    }
  } else if (imageData.code === "FARM") {
    for (let i = 0; i < 34; i += 1) {
      const x = stockNewsRange(imageData.seed, 220 + i, 40, width - 40);
      const y = stockNewsRange(imageData.seed, 260 + i, height * 0.45, height - 30);
      const stalk = stockNewsRange(imageData.seed, 300 + i, 36, 96);
      ctx.strokeStyle = i % 2 ? theme.accent : theme.accentSoft;
      ctx.lineWidth = stockNewsRange(imageData.seed, 340 + i, 4, 8);
      ctx.globalAlpha = 0.48;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + stockNewsRange(imageData.seed, 360 + i, -18, 18), y - stalk);
      ctx.stroke();
      ctx.fillStyle = theme.accentSoft;
      ctx.fillRect(x - 8, y - stalk - 10, 16, 20);
    }
  } else if (imageData.code === "LOG") {
    for (let i = 0; i < 12; i += 1) {
      const x = stockNewsRange(imageData.seed, 420 + i, 80, width - 300);
      const y = stockNewsRange(imageData.seed, 450 + i, height * 0.45, height - 110);
      const logWidth = stockNewsRange(imageData.seed, 480 + i, 110, 230);
      const logHeight = stockNewsRange(imageData.seed, 510 + i, 28, 54);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = i % 2 ? "#6f4323" : "#a56831";
      stockNewsFillRoundRect(ctx, x, y, logWidth, logHeight, 12);
      ctx.fill();
      ctx.strokeStyle = "#d39a57";
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 12, y + 8, logWidth - 24, logHeight - 16);
    }
  } else {
    for (let i = 0; i < 10; i += 1) {
      const x = stockNewsRange(imageData.seed, 540 + i, 80, width - 120);
      const y = stockNewsRange(imageData.seed, 570 + i, 120, height - 160);
      const step = stockNewsRange(imageData.seed, 600 + i, 70, 150);
      ctx.strokeStyle = i % 2 ? theme.accent : theme.accentSoft;
      ctx.lineWidth = stockNewsRange(imageData.seed, 630 + i, 7, 14);
      ctx.globalAlpha = 0.56;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + step, y);
      ctx.lineTo(x + step, y + step * 0.45);
      ctx.lineTo(x + step * 1.62, y + step * 0.45);
      ctx.stroke();
      ctx.fillStyle = theme.accent;
      ctx.fillRect(x + step - 13, y - 13, 26, 26);
    }
  }
  ctx.restore();
}

function stockNewsDrawMarketHud(ctx, theme, imageData, rng, width, height) {
  const toneColor = imageData.tone === "bad" ? "#ff4f61" : imageData.tone === "good" ? "#25d38a" : "#4c8dff";
  const panelX = stockNewsRange(imageData.seed, 700, width * 0.54, width * 0.66);
  const panelY = stockNewsRange(imageData.seed, 701, 86, 168);
  const panelWidth = stockNewsRange(imageData.seed, 702, 420, 520);
  const panelHeight = stockNewsRange(imageData.seed, 703, 260, 340);
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "rgba(4, 12, 18, 0.48)";
  stockNewsFillRoundRect(ctx, panelX, panelY, panelWidth, panelHeight, 24);
  ctx.fill();
  ctx.strokeStyle = `${theme.accent}88`;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i += 1) {
    const y = panelY + (panelHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(panelX + 28, y);
    ctx.lineTo(panelX + panelWidth - 28, y);
    ctx.stroke();
  }

  const points = [];
  const pointCount = 9;
  for (let i = 0; i < pointCount; i += 1) {
    const progress = i / (pointCount - 1);
    const drift = imageData.tone === "bad" ? progress * 0.28 : imageData.tone === "good" ? -progress * 0.28 : Math.sin(progress * Math.PI * 2) * 0.08;
    const noise = stockNewsRange(imageData.seed, 740 + i, -0.2, 0.2);
    points.push({
      x: panelX + 34 + progress * (panelWidth - 68),
      y: panelY + panelHeight * (0.56 + drift + noise),
    });
  }
  ctx.globalAlpha = 1;
  ctx.shadowColor = toneColor;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = toneColor;
  ctx.lineWidth = 8;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.shadowBlur = 0;

  for (let i = 0; i < pointCount - 1; i += 1) {
    const candleX = panelX + 44 + i * ((panelWidth - 88) / (pointCount - 1));
    const candleHeight = stockNewsRange(imageData.seed, 780 + i, 42, 136);
    const baseY = panelY + panelHeight - 42;
    ctx.fillStyle = i % 2 || imageData.tone === "bad" ? "#d84d59" : "#2fd084";
    ctx.globalAlpha = 0.78;
    ctx.fillRect(candleX, baseY - candleHeight, 17, candleHeight);
  }

  const volumeBase = panelY + panelHeight + 38;
  for (let i = 0; i < 18; i += 1) {
    const barHeight = stockNewsRange(imageData.seed, 820 + i, 32, 120);
    ctx.fillStyle = i % 3 === 0 ? toneColor : theme.accent;
    ctx.globalAlpha = 0.46;
    ctx.fillRect(panelX + i * 26, volumeBase - barHeight, 14, barHeight);
  }
  ctx.restore();
}

function buildGeneratedStockNewsImage(article, context, index) {
  const { code, name, week, topic, seed } = context;
  const theme = stockNewsSceneTheme(code);
  const fallbackImages = stockNewsImagesFor(code);
  const fallback = fallbackImages[index % fallbackImages.length];
  const imageSeed = `${seed}:${index}:${article.title}:${article.tone}`;
  return {
    src: fallback?.src || "/assets/hero-world-1920.jpg",
    baseSrc: fallback?.src || "/assets/hero-world-1920.jpg",
    position: fallback?.position || "50% 50%",
    key: `${imageSeed}:${fallback?.src || "fallback"}`,
    seed: imageSeed,
    code,
    tone: article.tone,
    visualType: ["lead", "orderbook", "financial", "briefing"][index % 4],
    generated: true,
    fallback: fallback?.src || "/assets/hero-world-1920.jpg",
    description: `${week.label} ${name} ${topic} ${article.tag} Minecraft-style generated image`,
  };
}

async function generateStockNewsComposite(imageData) {
  if (!imageData?.generated || !imageData.baseSrc) return imageData?.src || "";
  if (stockNewsCompositeCache.has(imageData.key)) return stockNewsCompositeCache.get(imageData.key);
  const promise = stockNewsLoadSourceImage(imageData.baseSrc)
    .then((source) => {
      const width = 1600;
      const height = 900;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      const theme = stockNewsSceneTheme(imageData.code);
      const rng = stockNewsRng(imageData.seed);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      stockNewsDrawCover(ctx, source, width, height, imageData.position);
      stockNewsDrawColorGrade(ctx, theme, imageData, rng, width, height);
      stockNewsDrawTopicDetails(ctx, theme, imageData, rng, width, height);
      stockNewsDrawMarketHud(ctx, theme, imageData, rng, width, height);
      return canvas.toDataURL("image/jpeg", 0.9);
    })
    .catch(() => imageData.fallback || imageData.src || "");
  stockNewsCompositeCache.set(imageData.key, promise);
  return promise;
}

function attachStockNewsImage(image, imageData, fallbackAlt) {
  if (!image || !imageData) return;
  image.alt = imageData.description || fallbackAlt;
  image.style.objectPosition = imageData.position || "50% 50%";
  image.dataset.generated = imageData.generated ? "true" : "false";
  image.dataset.compositeReady = "false";
  image.dataset.fallbackUsed = "false";
  image.dataset.newsImageKey = imageData.key || "";
  image.onerror = () => {
    if (imageData.fallback && image.dataset.fallbackUsed !== "true") {
      image.dataset.fallbackUsed = "true";
      image.src = imageData.fallback;
    }
  };
  image.src = imageData.src;
  if (!imageData.generated) return;
  generateStockNewsComposite(imageData).then((src) => {
    if (!src || image.dataset.newsImageKey !== imageData.key) return;
    image.dataset.compositeReady = src === imageData.fallback ? "fallback" : "true";
    image.src = src;
  });
}

function buildStockNewsDetails(article, context) {
  const { code, name, week, topic, change, bidRatio, volatility, quality } = context;
  const priceDirection = change >= 0 ? "상승" : "하락";
  const orderBookTone =
    bidRatio >= 55
      ? "매수 호가 깊이가 우세해 단기 체결 안정성이 개선됐습니다"
      : "매수 호가 방어가 얇아 분할 진입과 손절 관리가 중요합니다";
  const financialTone =
    quality.qualityScore >= 76
      ? "재무 퀄리티가 높아 공격적인 비중 확대 검토가 가능합니다"
      : quality.qualityScore >= 62
        ? "재무 퀄리티는 중립 이상이지만 변동성 통제는 필요합니다"
        : "재무 퀄리티는 아직 방어적인 검토가 필요합니다";

  return [
    `${name}(${code})의 이번 ${week.label} 핵심 주제는 ${topic}입니다. 이번 기사는 ${article.tag} 관점이며, 가격은 ${formatStockPercent(change, 1, true)} ${priceDirection}, 변동성은 ${formatStockPercent(volatility)}, 호가창 매수 압력은 ${Math.round(bidRatio)}%입니다.`,
    `호가창 기준으로 ${orderBookTone}. 시장가 단독 진입보다 지정가와 분할 주문을 우선하고, 돌파 구간에서는 실시간 거래량으로 체결 강도를 확인해야 합니다.`,
    `AI 재무 모델은 ${quality.quarterMeta.label} 매출 ${formatStockKrwCompact(quality.latest.revenue)}, 영업이익률 ${formatStockPercent(quality.latest.operatingMargin)}, FCF 수익률 ${formatStockPercent(quality.latest.fcfYield)}, 부채비율 ${formatStockPercent(quality.latest.debtRatio)}로 산출했습니다. ${financialTone}.`,
    `다음 자동 뉴스 생성 시각은 ${week.nextUpdate} KST입니다. 그 전까지 ${topic}, ${article.impact}, 거래량 변화, 레버리지 포지션 집중도를 함께 확인하세요.`,
  ];
}

function buildStockWeeklyNews(stock, metrics = {}, depth = {}) {
  const code = stockCode(stock);
  const name = stock?.name || code;
  const week = currentStockNewsWeek();
  const seed = `${week.key}:${code}`;
  const topic = stockNewsTopic(stock);
  const change = Number(stock?.change24h || 0);
  const bidRatio = Number(depth?.bidRatio || 50);
  const volatility = Number(metrics?.volatility || 0);
  const quality = buildStockFinancials(stock, metrics);
  const isBullish = change >= 0 || bidRatio >= 54 || quality.qualityScore >= 76;
  const demandWord = pickStockNewsValue(["거래량", "호가 깊이", "체결 강도", "세션 유입"], seed, 1);
  const riskWord = pickStockNewsValue(["재고 부담", "단기 과열", "레버리지 쏠림", "증거금 둔화"], seed, 2);
  const goodImpact = Math.max(1.2, Math.abs(change) * 0.42 + quality.latest.fcfYield * 0.12 + 1.4);
  const badImpact = -(Math.max(0.8, volatility * 0.26 + Math.abs(50 - bidRatio) * 0.05));
  const articles = [
    {
      tone: isBullish ? "good" : "bad",
      tag: isBullish ? "호재" : "악재",
      title: isBullish
        ? `${name}, ${topic} 개선으로 매수 관심 확대`
        : `${name}, ${riskWord}으로 단기 변동성 위험 확대`,
      summary: isBullish
        ? `${demandWord}과 퀄리티 점수 ${quality.qualityScore}점이 동시에 개선되며 ${code} 단기 심리가 강해졌습니다.`
        : `${formatStockPercent(volatility)} 변동성과 ${riskWord}이 겹치며 ${code} 포지션 관리가 더 중요해졌습니다.`,
      impact: isBullish ? `예상 영향 +${goodImpact.toFixed(1)}%` : `예상 영향 ${badImpact.toFixed(1)}%`,
    },
    {
      tone: bidRatio >= 55 ? "good" : "bad",
      tag: bidRatio >= 55 ? "호재" : "악재",
      title:
        bidRatio >= 55
          ? `호가창 매수 압력 ${Math.round(bidRatio)}%, ${code} 유동성 개선`
          : `매수 압력 ${Math.round(bidRatio)}%, ${code} 호가 공백 주의`,
      summary: bidRatio >= 55
        ? `매수 잔량이 우세해 지정가 체결 안정성이 좋아졌습니다. 단기 돌파에서는 거래량 확인이 핵심입니다.`
        : `하단 호가 방어가 약해질 수 있어 시장가 진입보다 분할 주문과 손절 관리가 유리합니다.`,
      impact: bidRatio >= 55 ? `수급 점수 +${Math.round(bidRatio - 50)}` : `수급 점수 -${Math.max(1, Math.round(Math.abs(50 - bidRatio)))}`,
    },
    {
      tone: quality.latest.fcfYield >= 5 ? "good" : "neutral",
      tag: quality.latest.fcfYield >= 5 ? "호재" : "중립",
      title: `${name} AI 재무 업데이트, FCF 수익률 ${formatStockPercent(quality.latest.fcfYield)}`,
      summary: `${quality.quarterMeta.label} 영업이익률은 ${formatStockPercent(quality.latest.operatingMargin)}, 부채비율은 ${formatStockPercent(quality.latest.debtRatio)}입니다. 다음 분기 업데이트는 ${quality.quarterMeta.nextUpdate}입니다.`,
      impact: quality.valuationLabel,
    },
    {
      tone: volatility >= 7 ? "bad" : "neutral",
      tag: volatility >= 7 ? "악재" : "중립",
      title: `${week.label} 체크포인트: ${topic}, ${riskWord}, 거래량`,
      summary: `AI 뉴스룸은 KST 오전, 정오, 저녁에 새 이슈를 생성합니다. 이번 ${week.label}의 ${code}는 ${formatStockPercent(change, 1, true)} 가격 변화와 ${formatStockPercent(volatility)} 변동성을 함께 봐야 합니다.`,
      impact: `다음 생성 ${week.nextUpdate}`,
    },
  ];

  return {
    week,
    code,
    name,
    title: `${name} AI 뉴스룸`,
    summary: `${week.range} 서버 거래 데이터, 호가 압력, 재무 퀄리티 신호로 자동 생성됐습니다.`,
    articles: articles.map((article, index) => {
      const context = { code, name, week, topic, seed, change, bidRatio, volatility, quality };
      return {
        ...article,
        image: buildGeneratedStockNewsImage(article, context, index),
        details: buildStockNewsDetails(article, context),
        source: "AI 시장 데스크",
      };
    }),
  };
}

function buildStockFinancials(stock, metrics = {}) {
  const code = stockCode(stock);
  const seed = stockFinancialSeed(code);
  const quarterMeta = currentFinancialQuarter();
  const periodLabels = financialQuarterPeriods(quarterMeta);
  const price = Math.max(1, Number(stock?.price || stock?.base) || 1);
  const rawShares = Number(stock?.sharesOutstanding ?? stock?.shares ?? stock?.volume);
  const displayVolume = stockDisplayVolume24h(stock);
  const marketCapInput = Number(stock?.marketCap);
  const fallbackShares = Number.isFinite(rawShares) && rawShares > 0 ? rawShares : Math.max(1000, Math.round(displayVolume / 3));
  const marketCap = Number.isFinite(marketCapInput) && marketCapInput > 0 ? marketCapInput : price * fallbackShares;
  const shares = Math.max(1, Number.isFinite(rawShares) && rawShares > 0 ? rawShares : marketCap / price);
  const rawDrift = Number(stock?.drift || 0);
  const change = Number.isFinite(Number(stock?.change24h))
    ? Number(stock.change24h)
    : Math.abs(rawDrift) < 1
      ? rawDrift * 100
      : rawDrift;
  const volatility = Number(metrics?.volatility || 0);
  const annualGrowth = clampStockValue(0.045 + change / 150 + seed * 0.012 - volatility / 900, -0.055, 0.22);
  const quarterlyGrowth = (1 + annualGrowth) ** 0.25 - 1;
  const currentSeasonality = FINANCIAL_QUARTER_SEASONALITY[quarterMeta.quarter - 1] || 1;
  const annualRevenue = Math.max(
    marketCap * (0.68 + seed * 0.28) + price * Math.max(1, displayVolume) * 0.012,
    marketCap * 0.52,
  );
  const grossMargin = clampStockValue(0.34 + seed * 0.16 + annualGrowth * 0.32 - volatility / 500, 0.24, 0.68);
  const operatingMargin = clampStockValue(grossMargin - (0.15 + seed * 0.055), 0.055, 0.38);
  const netMargin = clampStockValue(operatingMargin - 0.036 - seed * 0.016, 0.024, 0.29);
  const assetTurnover = clampStockValue(1.18 + seed * 0.34 + annualGrowth, 0.8, 1.85);
  const liabilityRatio = clampStockValue(0.34 + seed * 0.18 - netMargin * 0.18 + volatility / 260, 0.2, 0.62);

  const periods = periodLabels.map((period, index) => {
    const factor = (1 + quarterlyGrowth) ** -index;
    const seasonality = FINANCIAL_QUARTER_SEASONALITY[period.quarter - 1] || 1;
    const revenue = (annualRevenue / 4) * factor * (seasonality / currentSeasonality);
    const marginStep = index * 0.006;
    const periodGrossMargin = clampStockValue(grossMargin - marginStep * 0.55, 0.2, 0.7);
    const periodOperatingMargin = clampStockValue(operatingMargin - marginStep, 0.035, 0.42);
    const periodNetMargin = clampStockValue(netMargin - marginStep * 0.8, 0.012, 0.32);
    const grossProfit = revenue * periodGrossMargin;
    const operatingIncome = revenue * periodOperatingMargin;
    const depreciation = revenue * (0.035 + seed * 0.025);
    const ebitda = operatingIncome + depreciation;
    const netIncome = revenue * periodNetMargin;
    const cash = revenue * (0.14 + seed * 0.05) + Math.max(0, netIncome) * 0.12;
    const receivables = revenue * (0.105 + seed * 0.025);
    const inventory = revenue * (0.07 + seed * 0.035);
    const currentAssets = cash + receivables + inventory;
    const fixedAssets = revenue / assetTurnover;
    const totalAssets = currentAssets + fixedAssets;
    const totalLiabilities = totalAssets * liabilityRatio;
    const debt = totalLiabilities * (0.44 + seed * 0.18);
    const currentLiabilities = totalLiabilities * (0.38 + seed * 0.08);
    const equity = totalAssets - totalLiabilities;
    const workingCapitalDrag = revenue * clampStockValue(0.012 + Math.max(quarterlyGrowth, 0) * 0.05, 0.004, 0.035);
    const operatingCashFlow = netIncome + depreciation - workingCapitalDrag;
    const capex = -revenue * (0.048 + Math.max(quarterlyGrowth, 0) * 0.16 + seed * 0.016);
    const freeCashFlow = operatingCashFlow + capex;
    const financingCashFlow = -Math.max(0, debt * 0.035 - freeCashFlow * 0.04);
    const enterpriseValue = marketCap + debt - cash;
    const investedCapital = Math.max(1, debt + equity - cash);

    return {
      label: period.label,
      year: period.year,
      quarter: period.quarter,
      isEstimate: period.isEstimate,
      revenue,
      revenueGrowth: index === periodLabels.length - 1 ? null : quarterlyGrowth * 100,
      grossProfit,
      grossMargin: periodGrossMargin * 100,
      operatingIncome,
      operatingMargin: periodOperatingMargin * 100,
      depreciation,
      ebitda,
      netIncome,
      netMargin: periodNetMargin * 100,
      cash,
      receivables,
      inventory,
      currentAssets,
      fixedAssets,
      totalAssets,
      debt,
      currentLiabilities,
      totalLiabilities,
      equity,
      operatingCashFlow,
      capex,
      freeCashFlow,
      financingCashFlow,
      eps: netIncome / shares,
      bps: equity / shares,
      marketCap,
      enterpriseValue,
      per: periodRatio(marketCap, netIncome),
      pbr: periodRatio(marketCap, equity),
      psr: periodRatio(marketCap, revenue),
      evEbitda: periodRatio(enterpriseValue, ebitda),
      fcfYield: periodRatio(freeCashFlow, marketCap) * 100,
      roe: periodRatio(netIncome, equity) * 100,
      roa: periodRatio(netIncome, totalAssets) * 100,
      roic: periodRatio(operatingIncome * 0.78, investedCapital) * 100,
      debtRatio: periodRatio(totalLiabilities, equity) * 100,
      currentRatio: periodRatio(currentAssets, currentLiabilities) * 100,
      cashConversion: periodRatio(operatingCashFlow, netIncome) * 100,
      fcfMargin: periodRatio(freeCashFlow, revenue) * 100,
    };
  });

  const latest = periods[0];
  const previous = periods[1] || latest;
  latest.revenueGrowth = periodRatio(latest.revenue - previous.revenue, previous.revenue) * 100;
  const growthScore = clampStockValue(55 + latest.revenueGrowth * 2.2, 20, 96);
  const profitScore = clampStockValue(42 + latest.operatingMargin * 1.55 + latest.roe * 0.72, 20, 96);
  const stabilityScore = clampStockValue(90 - latest.debtRatio * 0.34 + latest.currentRatio * 0.07, 20, 96);
  const cashScore = clampStockValue(50 + latest.fcfMargin * 2.5 + latest.fcfYield * 2.2, 20, 96);
  const valuationScore = clampStockValue(82 - (latest.per || 24) * 1.15 - (latest.pbr || 3) * 3.8 + latest.fcfYield * 2 + latest.roe * 0.36, 20, 96);
  const qualityScore = Math.round(growthScore * 0.22 + profitScore * 0.26 + stabilityScore * 0.2 + cashScore * 0.2 + valuationScore * 0.12);
  const qualityLabel = qualityScore >= 82 ? "기관급 우량" : qualityScore >= 70 ? "안정 성장" : qualityScore >= 58 ? "중립 관찰" : "위험 검토";
  const valuationLabel = latest.per && latest.per < 12 && latest.fcfYield > 4 ? "저평가 매력" : latest.per && latest.per > 24 ? "프리미엄 구간" : "적정 가치";

  return {
    code,
    name: stock?.name || code,
    periods,
    quarterMeta,
    latest,
    qualityScore,
    qualityLabel,
    valuationLabel,
    health: {
      growth: growthScore,
      profitability: profitScore,
      stability: stabilityScore,
      cash: cashScore,
    },
    summary: `${stock?.name || code} ${quarterMeta.label} AI 분기 실적은 매출 성장률 ${formatStockPercent(latest.revenueGrowth, 1, true)}, 영업이익률 ${formatStockPercent(latest.operatingMargin)}로 산출됐습니다. 진단: ${qualityLabel} / ${valuationLabel}. 다음 자동 업데이트: ${quarterMeta.nextUpdate}.`,
  };
}

function financialStatementRows(financials, view) {
  const periods = financials.periods;
  const row = (label, key, format = "krw") => ({ label, format, values: periods.map((period) => period[key]) });
  if (view === "balance") {
    return [
      row("현금성 자산", "cash"),
      row("매출채권", "receivables"),
      row("재고자산", "inventory"),
      row("유동자산", "currentAssets"),
      row("비유동자산", "fixedAssets"),
      row("총자산", "totalAssets"),
      row("차입금", "debt"),
      row("총부채", "totalLiabilities"),
      row("자본총계", "equity"),
      row("BPS", "bps", "krw-full"),
      row("부채비율", "debtRatio", "percent"),
      row("유동비율", "currentRatio", "percent"),
    ];
  }
  if (view === "cashflow") {
    return [
      row("영업현금흐름", "operatingCashFlow"),
      row("설비투자", "capex"),
      row("잉여현금흐름", "freeCashFlow"),
      row("재무현금흐름", "financingCashFlow"),
      row("감가상각비", "depreciation"),
      row("FCF 마진", "fcfMargin", "percent"),
      row("현금전환율", "cashConversion", "percent"),
      row("FCF 수익률", "fcfYield", "percent"),
    ];
  }
  if (view === "valuation") {
    return [
      row("시가총액", "marketCap"),
      row("기업가치", "enterpriseValue"),
      row("PER", "per", "multiple"),
      row("PBR", "pbr", "multiple"),
      row("PSR", "psr", "multiple"),
      row("EV/EBITDA", "evEbitda", "multiple"),
      row("ROE", "roe", "percent"),
      row("ROA", "roa", "percent"),
      row("ROIC", "roic", "percent"),
      row("FCF 수익률", "fcfYield", "percent"),
    ];
  }
  return [
    row("매출", "revenue"),
    row("전분기 대비 매출 성장", "revenueGrowth", "percent-signed"),
    row("매출총이익", "grossProfit"),
    row("매출총이익률", "grossMargin", "percent"),
    row("영업이익", "operatingIncome"),
    row("영업이익률", "operatingMargin", "percent"),
    row("EBITDA", "ebitda"),
    row("순이익", "netIncome"),
    row("순이익률", "netMargin", "percent"),
    row("EPS", "eps", "krw-full"),
  ];
}

function formatFinancialCell(value, format) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "--";
  if (format === "percent") return formatStockPercent(value);
  if (format === "percent-signed") return formatStockPercent(value, 1, true);
  if (format === "multiple") return formatStockMultiple(value);
  if (format === "krw-full") return formatStockKrw(value);
  return formatStockKrwCompact(value);
}

function renderStockFinancials(elements, stock, metrics, view = "income") {
  if (!elements?.table || !stock) return;
  const financials = buildStockFinancials(stock, metrics);
  const latest = financials.latest;
  const rows = financialStatementRows(financials, view);

  if (elements.period) elements.period.textContent = `${financials.quarterMeta.label} · AI · KRW`;
  if (elements.code) elements.code.textContent = financials.code;
  if (elements.company) elements.company.textContent = financials.name;
  if (elements.summary) elements.summary.textContent = financials.summary;
  if (elements.clock) {
    elements.clock.replaceChildren();
    const mode = document.createElement("span");
    mode.textContent = "AI 분기 자동 리포트";
    const period = document.createElement("strong");
    period.textContent = financials.quarterMeta.label;
    const next = document.createElement("em");
    next.textContent = `${financials.quarterMeta.generatedAt} KST 생성 / 다음 업데이트 ${financials.quarterMeta.nextUpdate}`;
    elements.clock.append(mode, period, next);
  }
  if (elements.score) {
    elements.score.style.setProperty("--score", `${financials.qualityScore}%`);
    elements.score.replaceChildren();
    const label = document.createElement("span");
    label.textContent = "퀄리티 점수";
    const value = document.createElement("strong");
    value.textContent = String(financials.qualityScore);
    const tone = document.createElement("em");
    tone.textContent = financials.qualityLabel;
    elements.score.append(label, value, tone);
  }
  if (elements.kpis) {
    const kpis = [
      ["매출", formatStockKrwCompact(latest.revenue), `전분기 대비 ${formatStockPercent(latest.revenueGrowth, 1, true)}`, latest.revenueGrowth],
      ["영업이익률", formatStockPercent(latest.operatingMargin), `순이익률 ${formatStockPercent(latest.netMargin)}`, latest.operatingMargin - 12],
      ["잉여현금흐름", formatStockKrwCompact(latest.freeCashFlow), `FCF 마진 ${formatStockPercent(latest.fcfMargin)}`, latest.freeCashFlow],
      ["PER / PBR", `${formatStockMultiple(latest.per)} / ${formatStockMultiple(latest.pbr)}`, financials.valuationLabel, latest.fcfYield],
      ["ROE", formatStockPercent(latest.roe), `ROIC ${formatStockPercent(latest.roic)}`, latest.roe - 10],
    ];
    elements.kpis.replaceChildren(
      ...kpis.map(([label, value, caption, tone]) => {
        const item = document.createElement("span");
        const name = document.createElement("em");
        name.textContent = label;
        const metric = document.createElement("strong");
        metric.textContent = value;
        const detail = document.createElement("small");
        detail.textContent = caption;
        detail.classList.toggle("is-down", Number(tone) < 0);
        item.append(name, metric, detail);
        return item;
      }),
    );
  }
  if (elements.head) {
    const metricHead = document.createElement("th");
    metricHead.scope = "col";
    metricHead.textContent = "항목";
    const periodHeads = financials.periods.map((period) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = period.label;
      return th;
    });
    elements.head.replaceChildren(metricHead, ...periodHeads);
  }
  elements.table.replaceChildren(
    ...rows.map((rowData) => {
      const row = document.createElement("tr");
      const label = document.createElement("th");
      label.scope = "row";
      label.textContent = rowData.label;
      row.append(label);
      rowData.values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = formatFinancialCell(value, rowData.format);
        if (rowData.format.includes("percent") || rowData.format === "krw") {
          cell.classList.toggle("is-down", Number(value) < 0);
          cell.classList.toggle("is-up", Number(value) >= 0);
        }
        row.append(cell);
      });
      return row;
    }),
  );
  if (elements.diagnosis) {
    elements.diagnosis.textContent = `애널리스트 메모: ${financials.qualityLabel}. 성장성 ${Math.round(financials.health.growth)}, 수익성 ${Math.round(financials.health.profitability)}, 안정성 ${Math.round(financials.health.stability)}. 거래 전 호가 압력과 FCF 변화를 함께 확인하세요.`;
  }
  if (elements.ratios) {
    const ratioRows = [
      ["부채비율", formatStockPercent(latest.debtRatio)],
      ["유동비율", formatStockPercent(latest.currentRatio)],
      ["FCF 수익률", formatStockPercent(latest.fcfYield)],
      ["EV/EBITDA", formatStockMultiple(latest.evEbitda)],
    ];
    elements.ratios.replaceChildren(
      ...ratioRows.map(([label, value]) => {
        const item = document.createElement("span");
        item.innerHTML = `<em>${label}</em><strong>${value}</strong>`;
        return item;
      }),
    );
  }
  if (elements.health) {
    const healthRows = [
      ["성장성", financials.health.growth],
      ["수익성", financials.health.profitability],
      ["안정성", financials.health.stability],
      ["현금흐름", financials.health.cash],
    ];
    elements.health.replaceChildren(
      ...healthRows.map(([label, value]) => {
        const item = document.createElement("span");
        item.style.setProperty("--value", `${Math.round(value)}%`);
        const name = document.createElement("em");
        name.textContent = label;
        const score = document.createElement("strong");
        score.textContent = `${Math.round(value)}점`;
        item.append(name, score);
        return item;
      }),
    );
  }
}

function closeStockNewsDetail(elements) {
  if (!elements?.modal) return;
  elements.modal.hidden = true;
  document.body.classList.remove("stock-news-modal-open");
}

function openStockNewsDetail(elements, news, article) {
  if (!elements?.modal || !article) return;
  elements.modal.hidden = false;
  document.body.classList.add("stock-news-modal-open");
  elements.modal.dataset.tone = article.tone;
  if (elements.modalImage) {
    attachStockNewsImage(elements.modalImage, article.image, `${news.name} ${article.tag} detailed news image`);
  }
  if (elements.modalTag) elements.modalTag.textContent = article.tag;
  if (elements.modalSource) elements.modalSource.textContent = `${article.source} · ${news.week.range}`;
  if (elements.modalTitle) elements.modalTitle.textContent = article.title;
  if (elements.modalSummary) elements.modalSummary.textContent = article.summary;
  if (elements.modalImpact) elements.modalImpact.textContent = article.impact;
  if (elements.modalDetail) {
    elements.modalDetail.replaceChildren(
      ...(article.details || []).map((paragraph) => {
        const item = document.createElement("p");
        item.textContent = paragraph;
        return item;
      }),
    );
  }
  elements.modalClose?.focus({ preventScroll: true });
}

function renderStockNews(elements, stock, metrics, depth) {
  if (!elements?.list || !stock) return;
  const news = buildStockWeeklyNews(stock, metrics, depth);
  if (elements.week) elements.week.textContent = `${news.week.label} / 하루 3회 AI 생성`;
  if (elements.code) elements.code.textContent = `${news.code} 뉴스룸`;
  if (elements.title) elements.title.textContent = news.title;
  if (elements.summary) elements.summary.textContent = news.summary;
  if (elements.clock) {
    elements.clock.replaceChildren();
    const mode = document.createElement("span");
    mode.textContent = "AI 자동 기사 생성";
    const cycle = document.createElement("strong");
    cycle.textContent = news.week.cadence;
    const next = document.createElement("em");
    next.textContent = `다음 생성 ${news.week.nextUpdate} KST`;
    elements.clock.append(mode, cycle, next);
  }

  elements.list.replaceChildren(
    ...news.articles.map((article, index) => {
      const card = document.createElement("article");
      card.className = `stock-news-card is-${article.tone}`;
      if (index === 0) card.classList.add("is-lead");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `기사 전체 보기: ${article.title}`);
      const openArticle = () => openStockNewsDetail(elements, news, article);
      card.addEventListener("click", openArticle);
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openArticle();
      });

      const imageWrap = document.createElement("div");
      imageWrap.className = "stock-news-image";
      const image = document.createElement("img");
      image.loading = "eager";
      image.decoding = "async";
      attachStockNewsImage(image, article.image, `${news.name} ${article.tag} news image`);
      imageWrap.append(image);

      const body = document.createElement("div");
      const meta = document.createElement("div");
      meta.className = "stock-news-meta";
      const tag = document.createElement("span");
      tag.textContent = article.tag;
      const source = document.createElement("em");
      source.textContent = article.source;
      meta.append(tag, source);
      const title = document.createElement("strong");
      title.textContent = article.title;
      const summary = document.createElement("p");
      summary.textContent = article.summary;
      const impact = document.createElement("small");
      impact.textContent = article.impact;
      body.append(meta, title, summary, impact);
      card.append(imageWrap, body);
      return card;
    }),
  );
}

const stockChartStates = new WeakMap();

function stockChartValue(value, basePrice, scale) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return scale === "percent" ? ((number - basePrice) / basePrice) * 100 : number;
}

function stockChartTimestamp(point, index, length, range) {
  const parsed = Date.parse(point.time);
  if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  const step = Math.max(60, Math.floor(stockRangeStepMs(range) / 1000));
  return Math.floor((Date.now() - (length - 1 - index) * step * 1000) / 1000);
}

function stockChartRows(series, range, scale) {
  const basePrice = Math.max(1, Number(series[0]?.price || series[0]?.close) || 1);
  let previousTime = 0;
  return series
    .map((point, index) => {
      let time = stockChartTimestamp(point, index, series.length, range);
      if (time <= previousTime) time = previousTime + 60;
      previousTime = time;
      const open = Number(point.open ?? point.price);
      const high = Number(point.high ?? point.price);
      const low = Number(point.low ?? point.price);
      const close = Number(point.close ?? point.price);
      const volume = Math.max(0, Number(point.volume) || 0);
      return {
        time,
        open,
        high,
        low,
        close,
        price: close,
        volume,
        scaledOpen: stockChartValue(open, basePrice, scale),
        scaledHigh: stockChartValue(high, basePrice, scale),
        scaledLow: stockChartValue(low, basePrice, scale),
        scaledClose: stockChartValue(close, basePrice, scale),
      };
    })
    .filter((point) => Number.isFinite(point.close) && point.close > 0);
}

function addStockSeries(chart, definition, options) {
  return chart.addSeries(definition, options);
}

function createStockChartState(container) {
  const chartMount = container.querySelector("[data-stock-chart-canvas]") || container;
  const chart = createChart(chartMount, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: "#151a23" },
      textColor: "#848e9c",
      fontSize: 12,
      fontFamily: "Inter, Pretendard, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: "rgba(94, 102, 115, 0.18)" },
      horzLines: { color: "rgba(94, 102, 115, 0.18)" },
    },
    localization: {
      priceFormatter: (value) => formatStockKrw(value),
    },
    rightPriceScale: {
      borderColor: "rgba(94, 102, 115, 0.34)",
      scaleMargins: { top: 0.08, bottom: 0.28 },
    },
    timeScale: {
      borderColor: "rgba(94, 102, 115, 0.32)",
      barSpacing: 7,
      fixLeftEdge: false,
      fixRightEdge: false,
      rightOffset: 8,
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: "rgba(240, 185, 11, 0.58)",
        labelBackgroundColor: "#f0b90b",
        style: 2,
      },
      horzLine: {
        color: "rgba(240, 185, 11, 0.58)",
        labelBackgroundColor: "#f0b90b",
        style: 2,
      },
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
  });

  const candle = addStockSeries(chart, CandlestickSeries, {
    upColor: "#0ecb81",
    downColor: "#f6465d",
    borderUpColor: "#0ecb81",
    borderDownColor: "#f6465d",
    wickUpColor: "#0ecb81",
    wickDownColor: "#f6465d",
    priceLineColor: "#f6465d",
  });
  const line = addStockSeries(chart, LineSeries, {
    color: "#f0b90b",
    lineWidth: 3,
    priceLineColor: "#f0b90b",
    visible: false,
  });
  const area = addStockSeries(chart, AreaSeries, {
    lineColor: "#f0b90b",
    topColor: "rgba(240, 185, 11, 0.26)",
    bottomColor: "rgba(240, 185, 11, 0.02)",
    lineWidth: 3,
    priceLineColor: "#f0b90b",
    visible: false,
  });
  const volume = addStockSeries(chart, HistogramSeries, {
    priceFormat: { type: "volume" },
    priceScaleId: "",
    lastValueVisible: false,
    priceLineVisible: false,
  });
  const ma5 = addStockSeries(chart, LineSeries, {
    color: "#f0b90b",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  const ma20 = addStockSeries(chart, LineSeries, {
    color: "#d946ef",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  const vwap = addStockSeries(chart, LineSeries, {
    color: "#5b8def",
    lineWidth: 2,
    lineStyle: 2,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  const volumeMa = addStockSeries(chart, LineSeries, {
    color: DEFAULT_STOCK_CHART_SETTINGS.sub.volumeMaColor,
    lineWidth: 1,
    priceLineVisible: false,
    lastValueVisible: false,
    priceScaleId: "",
  });
  const rsi = addStockSeries(chart, LineSeries, {
    color: DEFAULT_STOCK_CHART_SETTINGS.sub.rsiColor,
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    priceScaleId: "rsi",
  });
  const macd = addStockSeries(chart, LineSeries, {
    color: DEFAULT_STOCK_CHART_SETTINGS.sub.macdColor,
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    priceScaleId: "macd",
  });
  const macdSignal = addStockSeries(chart, LineSeries, {
    color: DEFAULT_STOCK_CHART_SETTINGS.sub.macdSignalColor,
    lineWidth: 1,
    lineStyle: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    priceScaleId: "macd",
  });
  const macdHistogram = addStockSeries(chart, HistogramSeries, {
    priceLineVisible: false,
    lastValueVisible: false,
    priceScaleId: "macd",
  });

  chart.priceScale("").applyOptions({
    scaleMargins: { top: 0.80, bottom: 0 },
  });
  chart.priceScale("rsi").applyOptions({
    scaleMargins: { top: 0.72, bottom: 0.12 },
    visible: false,
  });
  chart.priceScale("macd").applyOptions({
    scaleMargins: { top: 0.72, bottom: 0.12 },
    visible: false,
  });

  const state = {
    area,
    candle,
    chart,
    chartMount,
    container,
    dataByTime: new Map(),
    indicatorSeries: new Map(),
    line,
    ma5,
    ma20,
    macd,
    macdHistogram,
    macdSignal,
    rsi,
    tooltip: container.querySelector("[data-stock-chart-tooltip]"),
    vwap,
    volume,
    volumeMa,
    viewKey: "",
  };

  chart.subscribeCrosshairMove((param) => renderStockChartTooltip(state, param));
  stockChartStates.set(container, state);
  return state;
}

function stockLineSeriesOptions(setting, settings, priceScaleId = "right") {
  return {
    color: setting.color,
    lineWidth: setting.lineWidth,
    lineStyle: setting.lineStyle,
    lastValueVisible: settings.trading.lastValue,
    priceLineVisible: false,
    priceScaleId,
  };
}

function ensureStockLineSeries(state, id, setting, settings, priceScaleId = "right") {
  let series = state.indicatorSeries.get(id);
  const options = stockLineSeriesOptions(setting, settings, priceScaleId);
  if (!series) {
    series = addStockSeries(state.chart, LineSeries, options);
    state.indicatorSeries.set(id, series);
  } else {
    series.applyOptions(options);
  }
  return series;
}

function clearUnusedStockSeries(state, usedIds) {
  state.indicatorSeries.forEach((series, id) => {
    if (!usedIds.has(id)) series.setData([]);
  });
}

function setStockSeriesVisible(state, mode) {
  state.candle.applyOptions({ visible: mode === "candle" });
  state.line.applyOptions({ visible: mode === "line" });
  state.area.applyOptions({ visible: mode === "area" });
}

function renderStockChartTooltip(state, param) {
  const { container, tooltip } = state;
  if (!state.settings?.trading?.tooltip) {
    if (tooltip) tooltip.hidden = true;
    return;
  }
  if (!tooltip || !param?.point || !param?.time) {
    if (tooltip) tooltip.hidden = true;
    return;
  }

  const point = state.dataByTime.get(String(param.time));
  if (!point || param.point.x < 0 || param.point.y < 0) {
    tooltip.hidden = true;
    return;
  }

  const rows = [
    ["시가", formatStockKrw(point.open)],
    ["고가", formatStockKrw(point.high)],
    ["저가", formatStockKrw(point.low)],
    ["종가", formatStockKrw(point.close)],
    ["거래량", `${formatStockNumber(point.volume)}주`],
  ];
  const title = document.createElement("strong");
  title.textContent = formatStockDateTime(point.time);
  const list = document.createElement("div");
  rows.forEach(([label, value]) => {
    const row = document.createElement("span");
    const labelElement = document.createElement("em");
    const valueElement = document.createElement("b");
    labelElement.textContent = label;
    valueElement.textContent = value;
    row.replaceChildren(labelElement, valueElement);
    list.append(row);
  });
  tooltip.replaceChildren(title, list);
  tooltip.hidden = false;

  const width = tooltip.offsetWidth || 180;
  const height = tooltip.offsetHeight || 160;
  const left = Math.min(Math.max(12, param.point.x + 14), Math.max(12, container.clientWidth - width - 12));
  const top = Math.min(Math.max(12, param.point.y + 14), Math.max(12, container.clientHeight - height - 12));
  tooltip.style.transform = `translate(${left}px, ${top}px)`;
}

function renderStockChart(container, stock, tick, selectedRange = "1D", options = {}) {
  const series = stockSeries(stock, tick, selectedRange);
  const settings = sanitizeStockChartSettings(options.settings || {});
  const chartMode = options.mode || settings.mode || "candle";
  const scale = options.scale || settings.scale || "price";
  const rows = stockChartRows(series, selectedRange, scale);
  const last = rows.at(-1) || rows[0];
  const first = rows[0] || last;
  const state = stockChartStates.get(container) || createStockChartState(container);
  const priceFormatter = scale === "percent" ? (value) => `${value.toFixed(2)}%` : (value) => formatStockKrw(value);
  const gridOpacity = Math.max(0, Math.min(0.6, settings.custom.gridOpacity / 100));
  const gridColor = `rgba(94, 102, 115, ${gridOpacity})`;
  const hasSubPane = settings.sub.volume || settings.sub.volumeMa || settings.sub.rsi || settings.sub.macd;
  const candleData = rows.map((point) => ({
    time: point.time,
    open: point.scaledOpen,
    high: point.scaledHigh,
    low: point.scaledLow,
    close: point.scaledClose,
  }));
  const lineData = rows.map((point) => ({ time: point.time, value: point.scaledClose }));
  const volumeData = rows.map((point) => ({
    time: point.time,
    value: point.volume,
    color: point.close >= point.open ? `${settings.custom.upColor}80` : `${settings.custom.downColor}85`,
  }));
  const basePrice = Math.max(1, Number(series[0]?.price || series[0]?.close) || 1);
  const closes = rows.map((point) => point.close);
  const usedDynamicSeries = new Set();
  const toScaledLineData = (values) =>
    values.map((value, index) => ({
      time: rows[index].time,
      value: stockChartValue(value, basePrice, scale),
    }));
  const toRawLineData = (values) =>
    values.map((value, index) => ({
      time: rows[index].time,
      value: Number(value) || 0,
    }));
  const setDynamicLine = (id, values, setting, priceScaleId = "right", scaled = true) => {
    usedDynamicSeries.add(id);
    const lineSeries = ensureStockLineSeries(state, id, setting, settings, priceScaleId);
    lineSeries.setData(scaled ? toScaledLineData(values) : toRawLineData(values));
  };
  const addLineGroup = (group, calculator) => {
    if (!group.enabled) return;
    const sourceValues = rows.map((point) => stockIndicatorSourceValue(point, group.source));
    group.items.forEach((item) => {
      if (!item.enabled || item.period <= 0) return;
      setDynamicLine(item.id, calculator(sourceValues, item.period), item);
    });
  };

  state.dataByTime = new Map(rows.map((point) => [String(point.time), point]));
  state.settings = settings;
  state.chart.applyOptions({
    layout: {
      background: { type: ColorType.Solid, color: settings.custom.background },
      textColor: settings.custom.textColor,
      fontSize: 12,
      fontFamily: "Inter, Pretendard, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: gridColor },
      horzLines: { color: gridColor },
    },
    localization: { priceFormatter },
    rightPriceScale: { scaleMargins: { top: 0.08, bottom: hasSubPane ? 0.30 : 0.08 } },
    timeScale: {
      barSpacing: settings.custom.barSpacing,
      rightOffset: 8,
      timeVisible: true,
      secondsVisible: selectedRange === "1M",
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: "rgba(240, 185, 11, 0.58)",
        labelBackgroundColor: "#f0b90b",
        style: 2,
        visible: settings.trading.crosshair,
      },
      horzLine: {
        color: "rgba(240, 185, 11, 0.58)",
        labelBackgroundColor: "#f0b90b",
        style: 2,
        visible: settings.trading.crosshair,
      },
    },
    handleScroll: {
      mouseWheel: settings.trading.scrollZoom,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: settings.trading.scrollZoom,
      pinch: settings.trading.scrollZoom,
    },
  });
  state.chart.priceScale("").applyOptions({
    scaleMargins: { top: hasSubPane ? 0.80 : 0.94, bottom: 0 },
    visible: settings.sub.volume || settings.sub.volumeMa,
  });
  state.chart.priceScale("rsi").applyOptions({
    scaleMargins: { top: settings.sub.macd ? 0.70 : 0.76, bottom: settings.sub.macd ? 0.17 : 0.08 },
    visible: settings.sub.rsi,
  });
  state.chart.priceScale("macd").applyOptions({
    scaleMargins: { top: settings.sub.rsi ? 0.82 : 0.76, bottom: 0.04 },
    visible: settings.sub.macd,
  });
  state.candle.applyOptions({
    upColor: settings.custom.upColor,
    downColor: settings.custom.downColor,
    borderUpColor: settings.custom.candleBorders ? settings.custom.upColor : "transparent",
    borderDownColor: settings.custom.candleBorders ? settings.custom.downColor : "transparent",
    wickUpColor: settings.custom.upColor,
    wickDownColor: settings.custom.downColor,
    priceLineColor: settings.custom.downColor,
    priceLineVisible: settings.trading.priceLine,
    lastValueVisible: settings.trading.lastValue,
  });
  state.line.applyOptions({
    color: settings.custom.lineColor,
    lineWidth: 3,
    priceLineColor: settings.custom.lineColor,
    priceLineVisible: settings.trading.priceLine,
    lastValueVisible: settings.trading.lastValue,
  });
  state.area.applyOptions({
    lineColor: settings.custom.lineColor,
    topColor: settings.custom.areaTopColor,
    bottomColor: settings.custom.areaBottomColor,
    priceLineColor: settings.custom.lineColor,
    priceLineVisible: settings.trading.priceLine,
    lastValueVisible: settings.trading.lastValue,
  });
  state.volume.applyOptions({
    lastValueVisible: settings.trading.lastValue,
    priceLineVisible: false,
  });
  state.candle.setData(candleData);
  state.line.setData(lineData);
  state.area.setData(lineData);
  state.volume.setData(settings.sub.volume ? volumeData : []);
  state.ma5.setData([]);
  state.ma20.setData([]);
  state.vwap.setData([]);
  addLineGroup(settings.main.ma, movingAverage);
  addLineGroup(settings.main.ema, emaSeries);
  addLineGroup(settings.main.wma, weightedMovingAverage);
  if (settings.main.vwap.enabled) setDynamicLine("vwap", vwapSeries(rows), settings.main.vwap);
  if (settings.main.boll.enabled) {
    const sourceValues = rows.map((point) => stockIndicatorSourceValue(point, settings.main.boll.source));
    const bands = bollingerBands(sourceValues, settings.main.boll.period, settings.main.boll.multiplier);
    setDynamicLine(
      "boll-upper",
      bands.map((point) => point.upper),
      { ...settings.main.boll, color: settings.main.boll.upperColor },
    );
    setDynamicLine(
      "boll-middle",
      bands.map((point) => point.middle),
      { ...settings.main.boll, color: settings.main.boll.middleColor },
    );
    setDynamicLine(
      "boll-lower",
      bands.map((point) => point.lower),
      { ...settings.main.boll, color: settings.main.boll.lowerColor },
    );
  }
  if (settings.sub.volumeMa) {
    state.volumeMa.applyOptions({
      color: settings.sub.volumeMaColor,
      lastValueVisible: settings.trading.lastValue,
      priceLineVisible: false,
    });
    state.volumeMa.setData(toRawLineData(movingAverage(rows.map((point) => point.volume), settings.sub.volumeMaPeriod)));
  } else {
    state.volumeMa.setData([]);
  }
  if (settings.sub.rsi) {
    const rsiValues = closes.map((_, index) => relativeStrengthIndex(closes.slice(0, index + 1), settings.sub.rsiPeriod));
    state.rsi.applyOptions({
      color: settings.sub.rsiColor,
      lastValueVisible: settings.trading.lastValue,
      priceLineVisible: false,
    });
    state.rsi.setData(toRawLineData(rsiValues));
  } else {
    state.rsi.setData([]);
  }
  if (settings.sub.macd) {
    const macdData = macdSeries(closes, settings.sub.macdFast, settings.sub.macdSlow, settings.sub.macdSignal);
    state.macd.applyOptions({
      color: settings.sub.macdColor,
      lastValueVisible: settings.trading.lastValue,
      priceLineVisible: false,
    });
    state.macdSignal.applyOptions({
      color: settings.sub.macdSignalColor,
      lastValueVisible: settings.trading.lastValue,
      priceLineVisible: false,
    });
    state.macd.setData(toRawLineData(macdData.macd));
    state.macdSignal.setData(toRawLineData(macdData.signal));
    state.macdHistogram.setData(
      macdData.histogram.map((value, index) => ({
        time: rows[index].time,
        value,
        color: value >= 0 ? `${settings.custom.upColor}66` : `${settings.custom.downColor}66`,
      })),
    );
  } else {
    state.macd.setData([]);
    state.macdSignal.setData([]);
    state.macdHistogram.setData([]);
  }
  clearUnusedStockSeries(state, usedDynamicSeries);
  setStockSeriesVisible(state, chartMode);
  container.querySelector(".stock-chart-watermark")?.setAttribute("hidden", "");
  container.style.background = settings.custom.background;

  const nextViewKey = `${stockCode(stock)}:${selectedRange}:${chartMode}:${scale}`;
  if (state.viewKey !== nextViewKey) {
    state.chart.timeScale().fitContent();
    state.viewKey = nextViewKey;
  }

  const reportedVolume = Number(stock.volume24h);
  const displayVolume =
    Number.isFinite(reportedVolume) && reportedVolume > 0
      ? reportedVolume
      : rows.reduce((sum, point) => sum + point.volume, 0);

  return {
    price: Number(stock.price ?? last?.close ?? 0),
    change: Number(stock.change24h ?? (((last?.close || 0) - (first?.open || 1)) / Math.max(1, first?.open || 1)) * 100),
    volume: displayVolume,
    open: Number(first?.open ?? first?.price ?? 0),
    high: Math.max(...rows.map((point) => Number(point.high || point.price))),
    low: Math.min(...rows.map((point) => Number(point.low || point.price))),
  };
}

function renderStockChartReadout(container, stock, result) {
  if (!container || !stock || !result) return;
  const rows = [
    ["현재가", formatStockKrw(result.price)],
    ["시가", formatStockKrw(result.open)],
    ["고가", formatStockKrw(result.high)],
    ["저가", formatStockKrw(result.low)],
    ["거래량", `${formatStockNumber(result.volume)}주`],
  ];
  container.replaceChildren(
    ...rows.map(([label, value]) => {
      const item = document.createElement("span");
      const labelElement = document.createElement("em");
      const valueElement = document.createElement("strong");
      labelElement.textContent = label;
      valueElement.textContent = value;
      item.replaceChildren(labelElement, valueElement);
      return item;
    }),
  );
}

function stockPointMillis(point) {
  const parsed = Date.parse(point?.time);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stockChangeForPeriod(series, periodMs) {
  const last = series.at(-1);
  if (!last) return 0;
  const lastTime = stockPointMillis(last);
  let start = series[0];
  if (periodMs && lastTime) {
    const target = lastTime - periodMs;
    start = series.find((point) => stockPointMillis(point) >= target) || series[0];
  }
  const base = Number(start?.close || start?.price || start?.open || 1);
  const close = Number(last.close || last.price || 0);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(close)) return 0;
  return ((close - base) / base) * 100;
}

function renderStockPerformance(container, stock, tick) {
  if (!container || !stock) return;
  const series = stockSeries(stock, tick, "ALL");
  const periods = [
    ["1D", 24 * 60 * 60_000],
    ["1W", 7 * 24 * 60 * 60_000],
    ["1M", 30 * 24 * 60 * 60_000],
    ["3M", 90 * 24 * 60 * 60_000],
    ["6M", 180 * 24 * 60 * 60_000],
    ["1Y", 365 * 24 * 60 * 60_000],
    ["5Y", 5 * 365 * 24 * 60 * 60_000],
    ["Max", 0],
  ];

  container.replaceChildren(
    ...periods.map(([label, periodMs]) => {
      const change = stockChangeForPeriod(series, periodMs);
      const item = document.createElement("span");
      const title = document.createElement("strong");
      const value = document.createElement("em");
      title.textContent = label;
      value.textContent = formatStockChange(change);
      value.classList.toggle("is-down", change < 0);
      item.replaceChildren(title, value);
      return item;
    }),
  );
}

function renderStockTape(tape, trades) {
  if (!tape) return;
  const rows = Array.isArray(trades) ? trades.slice(0, 6) : [];
  if (!rows.length) {
    const item = document.createElement("li");
    item.className = "is-empty";
    const label = document.createElement("span");
    label.textContent = PLAYER_API_BASES.length ? "실시간 체결 대기 중" : "API 연결 없음";
    const amount = document.createElement("strong");
    amount.textContent = "--";
    item.replaceChildren(label, amount);
    tape.replaceChildren(item);
    return;
  }

  tape.replaceChildren(
    ...rows.map((row) => {
      const item = document.createElement("li");
      const buy = row.side !== "sell";
      item.className = buy ? "is-buy" : "is-sell";
      const label = document.createElement("span");
      label.textContent = `${row.playerName || "플레이어"} ${row.symbol || row.code} ${buy ? "매수" : "매도"}`;
      const amount = document.createElement("strong");
      amount.textContent = `${formatStockNumber(row.quantity)}주 @ ${formatStockKrw(row.price)}`;
      const total = document.createElement("small");
      total.textContent = formatStockKrwCompact(row.total);
      item.append(label, amount, total);
      return item;
    }),
  );
}

function renderStockTicker(ticker, stocks, activeCode, onSelect) {
  if (!ticker) return;
  ticker.replaceChildren(
    ...stocks.map((stock) => {
      const code = stockCode(stock);
      const change = Number(stock.change24h || 0);
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.stockCode = code;
      button.className = code === activeCode ? "is-active" : "";

      const label = document.createElement("strong");
      label.textContent = `${code}/KRW`;
      const price = document.createElement("span");
      price.textContent = formatStockKrw(stock.price);
      const delta = document.createElement("em");
      delta.textContent = formatStockChange(change);
      delta.classList.toggle("is-down", change < 0);

      button.append(label, price, delta);
      button.addEventListener("click", () => onSelect(code));
      return button;
    }),
  );
}

function renderStockRows(list, stocks, activeCode, onSelect, tick = 0) {
  const rows = stocks.map((stock) => {
    const code = stockCode(stock);
    const changePercent = Number(stock.change24h || 0);
    const changeAmount = stockChangeValue(stock);
    const high = Number(stock.high24h || stock.price);
    const low = Number(stock.low24h || stock.price);
    const displayVolume = stockDisplayVolume24h(stock, tick);
    const row = document.createElement(list.tagName === "TBODY" ? "tr" : "article");
    row.dataset.stockCode = code;
    row.className = code === activeCode ? "is-active" : "";
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-pressed", String(code === activeCode));

    const nameCell = document.createElement(list.tagName === "TBODY" ? "th" : "div");
    if (nameCell.tagName === "TH") nameCell.scope = "row";
    const title = document.createElement("strong");
    title.textContent = code;
    const name = document.createElement("span");
    name.textContent = stock.name || code;
    nameCell.append(title, name);

    if (list.tagName !== "TBODY") {
      const price = document.createElement("em");
      price.textContent = formatStockKrw(stock.price);
      price.classList.toggle("is-down", changePercent < 0);
      row.append(nameCell, price);
    } else {
      const values = [
        { text: formatStockKrw(stock.price), className: "stock-num" },
        { text: formatStockKrw(high), className: "stock-num" },
        { text: formatStockKrw(low), className: "stock-num" },
        { text: formatStockSignedKrw(changeAmount), className: changeAmount < 0 ? "is-down" : "is-up" },
        { text: formatStockChange(changePercent), className: changePercent < 0 ? "is-down" : "is-up" },
        { text: `${formatStockNumber(displayVolume)}주`, className: "stock-num" },
        { text: formatStockTime(latestStockTime(stock)), className: "stock-time" },
      ];
      row.append(nameCell);
      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value.text;
        if (value.className) cell.className = value.className;
        row.append(cell);
      });
    }

    const select = () => onSelect(code);
    row.addEventListener("click", select);
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      select();
    });
    return row;
  });

  list.replaceChildren(...rows);
}

function stockPosition(portfolio, code) {
  const positions = Array.isArray(portfolio?.positions) ? portfolio.positions : [];
  return positions.find((position) => (position.symbol || position.code) === code) || null;
}

function selectedStockTrades(trades, code) {
  if (!Array.isArray(trades)) return [];
  return trades.filter((trade) => (trade.symbol || trade.code) === code);
}

function stockTradeTotals(stock, trades) {
  const rows = Array.isArray(trades) ? trades : [];
  const buy = rows
    .filter((trade) => trade.side !== "sell")
    .reduce((sum, trade) => sum + Number(trade.quantity || trade.shares || 0), 0);
  const sell = rows
    .filter((trade) => trade.side === "sell")
    .reduce((sum, trade) => sum + Number(trade.quantity || trade.shares || 0), 0);

  if (buy > 0 || sell > 0) return { buy, sell };

  const volume = Math.max(20, stockDisplayVolume24h(stock));
  const change = Number(stock?.change24h || 0);
  const bias = Math.max(0.22, Math.min(0.78, 0.5 + change / 140));
  return {
    buy: Math.round(volume * bias),
    sell: Math.round(volume * (1 - bias)),
  };
}

function renderStockStrength(elements, stock, trades) {
  if (!elements?.value && !elements?.meter && !elements?.buy && !elements?.sell) return;
  const totals = stockTradeTotals(stock, trades);
  const strength = totals.sell > 0 ? (totals.buy / totals.sell) * 100 : totals.buy > 0 ? 200 : 100;
  const clamped = Math.max(8, Math.min(100, strength / 2));
  const isHot = strength >= 110;
  const isCold = strength <= 90;

  if (elements.value) {
    elements.value.textContent = `${Math.round(strength)}%`;
    elements.value.classList.toggle("is-up", isHot);
    elements.value.classList.toggle("is-down", isCold);
  }
  if (elements.meter) {
    elements.meter.style.width = `${clamped}%`;
    elements.meter.classList.toggle("is-down", isCold);
  }
  if (elements.buy) elements.buy.textContent = `${formatStockNumber(totals.buy)}주`;
  if (elements.sell) elements.sell.textContent = `${formatStockNumber(totals.sell)}주`;
}

function renderStockDetail(elements, stock, result) {
  if (!elements?.symbol && !elements?.name) return;
  const code = stockCode(stock);
  const change = Number(result.change || stock?.change24h || 0);
  const high = Number(stock?.high24h || result.high || result.price);
  const low = Number(stock?.low24h || result.low || result.price);

  if (elements.symbol) elements.symbol.textContent = code;
  if (elements.name) elements.name.textContent = stock?.name || code;
  if (elements.price) elements.price.textContent = formatStockKrw(result.price);
  if (elements.change) {
    elements.change.textContent = formatStockChange(change);
    elements.change.classList.toggle("is-down", change < 0);
    elements.change.classList.toggle("is-up", change >= 0);
  }
  if (elements.range) elements.range.textContent = `${formatStockKrw(low)} - ${formatStockKrw(high)}`;
  if (elements.time) elements.time.textContent = formatStockTime(latestStockTime(stock));
}

function stockInfoMeta(stock) {
  const code = stockCode(stock);
  return STOCK_INFO_META[code] || {
    icon: "●",
    asset: `${code || "NFO"}/KRW`,
    category: "서버 자산",
    rank: 4,
    links: [
      ["Stock", "/stock.html"],
      ["규칙 문서", "/rules.html"],
      ["서버 상태", "/status.html"],
      ["경제 분석", "/plugins.html"],
    ],
  };
}

function stockOutstandingShares(stock, price) {
  const marketCap = Number(stock?.marketCap);
  const current = Math.max(1, Number(price || stock?.price || stock?.base) || 1);
  if (Number.isFinite(marketCap) && marketCap > 0) return Math.max(1, Math.round(marketCap / current));
  const profile = stockProfile(stock);
  return Math.max(1, Math.round(Number(profile.volume || stock?.volume || 1000) * 3));
}

function stockInfoMarketCap(stock, result) {
  const marketCap = Number(stock?.marketCap);
  if (Number.isFinite(marketCap) && marketCap > 0) return marketCap;
  return Math.max(1, Number(result?.price || stock?.price || 1)) * stockOutstandingShares(stock, result?.price);
}

function stockMarketDominance(stock, result, stocks) {
  const marketCap = stockInfoMarketCap(stock, result);
  const total = (Array.isArray(stocks) ? stocks : []).reduce((sum, item) => {
    const price = Number(item?.price || item?.base || 1);
    const cap = Number(item?.marketCap);
    return sum + (Number.isFinite(cap) && cap > 0 ? cap : price * stockOutstandingShares(item, price));
  }, 0);
  return total > 0 ? (marketCap / total) * 100 : 0;
}

function stockFundingRate(stock, metrics) {
  const change = Number(stock?.change24h || 0);
  const volatility = Number(metrics?.volatility || 0);
  return clampStockValue(0.01 + change / 900 + volatility / 2200, -0.045, 0.055);
}

function stockInfoMetricRow(label, value) {
  const row = document.createElement("div");
  const labelElement = document.createElement("span");
  const valueElement = document.createElement("strong");
  labelElement.textContent = label;
  valueElement.textContent = value;
  row.replaceChildren(labelElement, valueElement);
  return row;
}

function stockInfoPill(text, href = "") {
  const link = document.createElement("a");
  link.textContent = text;
  link.href = href || "#";
  return link;
}

function renderStockCoinInfo(container, stock, result, metrics, stocks) {
  const code = stockCode(stock);
  const meta = stockInfoMeta(stock);
  const price = Number(result?.price || stock?.price || stock?.base || 1);
  const shares = stockOutstandingShares(stock, price);
  const marketCap = stockInfoMarketCap(stock, result);
  const volume = Number(result?.volume || stockDisplayVolume24h(stock));
  const dominance = stockMarketDominance(stock, result, stocks);
  const maxSupply = Math.max(shares, Math.round(shares * 1.08));
  const totalSupply = Math.max(shares, Math.round(shares * 1.02));
  const concentration = clampStockValue(8 + Math.abs(Number(stock?.change24h || 0)) * 0.32 + Number(metrics?.volatility || 0) * 0.18, 3, 42);

  const header = document.createElement("div");
  header.className = "stock-info-title";
  const icon = document.createElement("span");
  icon.textContent = meta.icon;
  const title = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = meta.asset || `${code}/KRW`;
  const small = document.createElement("small");
  small.textContent = `${stock?.name || code} · ${meta.category}`;
  title.replaceChildren(strong, small);
  header.replaceChildren(icon, title);

  const stats = document.createElement("div");
  stats.className = "stock-info-stats";
  stats.replaceChildren(
    stockInfoMetricRow("순위", `${meta.rank}위`),
    stockInfoMetricRow("시가총액", formatStockKrw(marketCap)),
    stockInfoMetricRow("완전희석 시가총액", formatStockKrw(marketCap * (maxSupply / Math.max(1, shares)))),
    stockInfoMetricRow("시장 점유율", formatStockPercent(dominance, 2)),
    stockInfoMetricRow("거래량", `${formatStockNumber(volume)}주`),
    stockInfoMetricRow("거래량/시가총액", formatStockPercent((volume * price * 100) / Math.max(1, marketCap), 2)),
    stockInfoMetricRow("유통 주식", `${formatStockNumber(shares)} ${code}`),
    stockInfoMetricRow("최대 주식", `${formatStockNumber(maxSupply)} ${code}`),
    stockInfoMetricRow("총 주식", `${formatStockNumber(totalSupply)} ${code}`),
    stockInfoMetricRow("플랫폼 집중도", formatStockPercent(concentration, 2)),
  );

  const links = document.createElement("aside");
  links.className = "stock-info-links";
  const issue = document.createElement("p");
  issue.className = "stock-info-feedback";
  issue.textContent = "문제가 있나요? ";
  const feedback = document.createElement("a");
  feedback.href = "/status.html";
  feedback.textContent = "피드백 보내기";
  issue.append(feedback);
  const linksTitle = document.createElement("h3");
  linksTitle.textContent = "바로가기";
  const linkGrid = document.createElement("div");
  linkGrid.replaceChildren(...meta.links.map(([label, href]) => stockInfoPill(label, href)));
  const note = document.createElement("p");
  note.className = "stock-info-note";
  note.textContent = "기초 데이터는 AuroraLink 시장 캔들과 마인크래프트 서버 거래 기록을 기준으로 합니다. 이 정보는 게임 내 참고용입니다.";
  links.replaceChildren(issue, linksTitle, linkGrid, note);

  const layout = document.createElement("div");
  layout.className = "stock-info-layout";
  const left = document.createElement("section");
  left.replaceChildren(header, stats);
  layout.replaceChildren(left, links);
  container.replaceChildren(layout);
}

function renderStockTradingInfo(container, stock, result, metrics, depth) {
  const code = stockCode(stock);
  const spread = Number(depth?.spread || 0);
  const volatility = Number(metrics?.volatility || 0);
  const rows = [
    ["종목", `${code}/KRW 현물형`],
    ["호가 단위", "₩1"],
    ["주문 유형", "시장가 / 지정가 / 조건부 / OCO"],
    ["메이커 / 테이커 수수료", "0.30% / 0.30%"],
    ["현재 스프레드", formatStockKrw(spread)],
    ["24시간 변동성", formatStockPercent(volatility, 2)],
    ["최대 주문 수량", "500주"],
    ["결제", "서버 머니"],
  ];
  renderStockInfoTable(container, "거래 조건", rows);
}

function renderStockMarginInfo(container, stock, metrics) {
  const volatility = Number(metrics?.volatility || 0);
  const maintenance = clampStockValue(4 + volatility * 0.42, 4, 18);
  const rows = [
    ["증거금 모드", "교차 / 격리"],
    ["최대 레버리지", "5x"],
    ["초기 증거금", "5x 기준 20.00%"],
    ["유지 증거금", formatStockPercent(maintenance, 2)],
    ["청산 완충폭", formatStockPercent(maintenance + 6, 2)],
    ["자동 디레버리지", volatility >= 8 ? "우선순위 높음" : "보통"],
    ["축소 전용", "지원"],
    ["메이커 전용", "지원"],
  ];
  renderStockInfoTable(container, "레버리지와 증거금", rows);
}

function renderStockFundingInfo(container, stock, metrics) {
  const now = Date.now();
  const rate = stockFundingRate(stock, metrics);
  const rows = Array.from({ length: 8 }, (_, index) => {
    const stepRate = rate + Math.sin(index * 0.9 + Number(stock?.price || 1) * 0.003) * 0.006;
    return [
      formatStockDateTime(new Date(now - index * 3 * 60 * 60 * 1000)),
      formatStockPercent(stepRate, 4, true),
      stepRate >= 0 ? "롱이 숏에 지급" : "숏이 롱에 지급",
    ];
  });
  renderStockInfoTable(container, "자금 이력", rows, ["시간", "비율", "방향"]);
}

function renderStockIndexInfo(container, stock, result, marketMeta, stocks) {
  const marketIndex = Number(marketMeta?.index || 0);
  const marketCap = stockInfoMarketCap(stock, result);
  const totalCap = Math.max(
    1,
    (Array.isArray(stocks) ? stocks : []).reduce((sum, item) => sum + stockInfoMarketCap(item, { price: item?.price }), 0),
  );
  const rows = [
    ["지수 심볼", "NFO 종합"],
    ["지수 값", formatStockNumber(marketIndex)],
    ["표시가", formatStockKrw(result?.price || stock?.price)],
    ["지수 비중", formatStockPercent((marketCap / totalCap) * 100, 2)],
    ["오라클 소스", "AuroraLink API"],
    ["갱신 주기", "60초"],
    ["캔들 간격", "15분"],
    ["세션", marketMeta?.session || "24시간 실시간"],
  ];
  renderStockInfoTable(container, "지수 정보", rows);
}

function renderStockInfoTable(container, title, rows, headers = ["항목", "값"]) {
  const section = document.createElement("section");
  section.className = "stock-info-table-panel";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      tr.append(cell);
    });
    tbody.append(tr);
  });
  table.replaceChildren(thead, tbody);
  section.replaceChildren(heading, table);
  container.replaceChildren(section);
}

function renderStockInfoTerminal(container, stock, result, metrics, depth, stocks, marketMeta, view) {
  if (!container || !stock) return;
  if (view === "trading") renderStockTradingInfo(container, stock, result, metrics, depth);
  else if (view === "margin") renderStockMarginInfo(container, stock, metrics);
  else if (view === "funding") renderStockFundingInfo(container, stock, metrics);
  else if (view === "index") renderStockIndexInfo(container, stock, result, marketMeta, stocks);
  else renderStockCoinInfo(container, stock, result, metrics, stocks);
}

function renderStockRawDataTerminal(summary, table, stock, result, tick, range) {
  if (!summary && !table) return;
  const series = stockSeries(stock, tick, range);
  const rows = stockChartRows(series, range, "price");
  if (summary) {
    const latest = rows.at(-1) || {};
    const first = rows[0] || {};
    const summaryItems = [
      ["종목", stockInfoMeta(stock).asset],
      ["현재가", formatStockKrw(result?.price || latest.close)],
      ["시가", formatStockKrw(first.open || result?.open)],
      ["고가", formatStockKrw(result?.high)],
      ["저가", formatStockKrw(result?.low)],
      ["거래량", `${formatStockNumber(result?.volume)}주`],
    ];
    summary.replaceChildren(
      ...summaryItems.map(([label, value]) => {
        const item = document.createElement("span");
        const em = document.createElement("em");
        const strong = document.createElement("strong");
        em.textContent = label;
        strong.textContent = value;
        item.replaceChildren(em, strong);
        return item;
      }),
    );
  }
  if (table) {
    const bodyRows = rows.slice(-18).reverse().map((point) => {
      const tr = document.createElement("tr");
      [
        formatStockDateTime(point.time),
        formatStockKrw(point.open),
        formatStockKrw(point.high),
        formatStockKrw(point.low),
        formatStockKrw(point.close),
        `${formatStockNumber(point.volume)}주`,
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        tr.append(cell);
      });
      return tr;
    });
    table.replaceChildren(...bodyRows);
  }
}

function stockDataTimeLabel(value) {
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatStockDataCompact(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const absolute = Math.abs(number);
  if (absolute >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${(number / 1_000_000).toFixed(2)}M`;
  if (absolute >= 10_000) return `${(number / 1_000).toFixed(1)}K`;
  return formatStockNumber(Math.round(number));
}

function stockDataRange(values, paddingRatio = 0.12) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) return { min: 0, max: 1 };
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (min === max) {
    const padding = Math.max(0.01, Math.abs(max) * paddingRatio);
    min -= padding;
    max += padding;
  } else {
    const padding = (max - min) * paddingRatio;
    min -= padding;
    max += padding;
  }
  return { min, max };
}

function stockDataAxisLabels(values, formatter = formatStockDataCompact) {
  const range = stockDataRange(values, 0.02);
  return [range.max, (range.max + range.min) / 2, range.min].map((value) => formatter(value));
}

function stockDataY(value, range, top = 18, bottom = 206) {
  const span = Math.max(0.0001, range.max - range.min);
  const normalized = (Number(value) - range.min) / span;
  return bottom - clampStockValue(normalized, 0, 1) * (bottom - top);
}

function stockDataX(index, length, width = 640) {
  if (length <= 1) return 0;
  return (index / (length - 1)) * width;
}

function stockDataLinePath(points, key, range) {
  return points
    .map((point, index) => {
      const x = stockDataX(index, points.length).toFixed(2);
      const y = stockDataY(point[key], range).toFixed(2);
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
}

function appendStockDataGrid(svg) {
  [18, 112, 206].forEach((y) => {
    svg.append(
      createSvg("line", {
        x1: 0,
        x2: 640,
        y1: y,
        y2: y,
        class: "stock-data-grid-line",
      }),
    );
  });
}

function stockDataLegendItem(label, type = "line") {
  const item = document.createElement("span");
  item.className = `stock-data-legend-item is-${type}`;
  const marker = document.createElement("i");
  const text = document.createElement("em");
  text.textContent = label;
  item.replaceChildren(marker, text);
  return item;
}

function stockDataAxis(labelValues, formatter, className = "stock-data-y-axis") {
  const axis = document.createElement("div");
  axis.className = className;
  axis.replaceChildren(
    ...stockDataAxisLabels(labelValues, formatter).map((label) => {
      const span = document.createElement("span");
      span.textContent = label;
      return span;
    }),
  );
  return axis;
}

function stockDataXAxis(points) {
  const axis = document.createElement("div");
  axis.className = "stock-data-x-axis";
  const labelIndexes = [0, Math.floor(points.length * 0.33), Math.floor(points.length * 0.66), points.length - 1];
  axis.replaceChildren(
    ...labelIndexes.map((index) => {
      const span = document.createElement("span");
      const point = points[Math.max(0, Math.min(points.length - 1, index))];
      span.textContent = stockDataTimeLabel(point?.time);
      return span;
    }),
  );
  return axis;
}

function buildStockDerivativePoints(stock, rows, result, tick) {
  const source = rows.slice(-36);
  const codeSeed = stockFinancialSeed(stockCode(stock));
  const firstClose = Math.max(1, Number(source[0]?.close || result?.open || stock?.price || stock?.base || 1));
  const lastPrice = Math.max(1, Number(result?.price || stock?.price || source.at(-1)?.close || firstClose));
  const baseShares = stockOutstandingShares(stock, lastPrice);
  const baseInterest = Math.max(100, baseShares * (3.2 + codeSeed * 1.7));
  const length = Math.max(1, source.length);

  return source.map((point, index) => {
    const close = Math.max(1, Number(point.close || point.price || lastPrice));
    const previous = Math.max(1, Number(source[index - 1]?.close || close));
    const momentum = (close - previous) / previous;
    const totalMove = (close - firstClose) / firstClose;
    const volume = Math.max(1, Number(point.volume) || 1);
    const progress = index / Math.max(1, length - 1);
    const wave = Math.sin(index * 0.46 + tick * 0.17 + codeSeed * 6);
    const pulse = Math.cos(index * 0.29 + tick * 0.11 + codeSeed * 4);
    const volumeBias = Math.log10(volume + 10) / 5;
    const openInterest = Math.max(
      10,
      baseInterest * (1 + progress * (0.08 + codeSeed * 0.06) + totalMove * 0.18 + wave * 0.018 + volumeBias * 0.035),
    );
    const jump = index > length * (0.42 + codeSeed * 0.12) ? 0.035 + codeSeed * 0.035 : 0;
    return {
      time: point.time,
      openInterest,
      notional: openInterest * close,
      accountsRatio: clampStockValue(1.74 + codeSeed * 0.16 + jump + totalMove * 0.18 + wave * 0.005, 1.05, 2.85),
      positionsRatio: clampStockValue(1.08 + codeSeed * 0.14 + totalMove * 0.12 + pulse * 0.012 + momentum * 2.6, 0.72, 2.4),
      longShortRatio: clampStockValue(1.46 + codeSeed * 0.34 + totalMove * 0.22 + wave * 0.009 + momentum * 3.2, 0.65, 3.2),
    };
  });
}

function stockDataPanelShell(title, controls = ["5m"]) {
  const section = document.createElement("section");
  section.className = "stock-data-card";

  const head = document.createElement("div");
  head.className = "stock-data-card-head";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const info = document.createElement("span");
  info.className = "stock-data-info-icon";
  info.textContent = "i";
  head.replaceChildren(heading, info);

  const controlRow = document.createElement("div");
  controlRow.className = "stock-data-controls";
  controlRow.replaceChildren(
    ...controls.map((label) => {
      const control = document.createElement("span");
      control.textContent = label;
      return control;
    }),
  );

  section.append(head, controlRow);
  return section;
}

function renderStockDataLinePanel(definition, points) {
  const section = stockDataPanelShell(definition.title, definition.controls);
  const values = points.map((point) => point[definition.key]);
  const valueRange = stockDataRange(values);
  const frame = document.createElement("div");
  frame.className = "stock-data-chart-frame";
  const plot = document.createElement("div");
  plot.className = "stock-data-plot";
  const svg = createSvg("svg", {
    viewBox: "0 0 640 224",
    preserveAspectRatio: "none",
    role: "img",
    "aria-label": definition.title,
  });

  appendStockDataGrid(svg);
  svg.append(
    createSvg("path", {
      d: stockDataLinePath(points, definition.key, valueRange),
      class: "stock-data-line",
    }),
  );
  points.forEach((point, index) => {
    if (index % 2 !== 0 && index !== points.length - 1) return;
    svg.append(
      createSvg("circle", {
        cx: stockDataX(index, points.length).toFixed(2),
        cy: stockDataY(point[definition.key], valueRange).toFixed(2),
        r: 3.6,
        class: "stock-data-dot",
      }),
    );
  });

  plot.replaceChildren(svg, stockDataXAxis(points));
  frame.replaceChildren(stockDataAxis(values, definition.formatter), plot);

  const legend = document.createElement("div");
  legend.className = "stock-data-legend";
  legend.append(stockDataLegendItem(definition.legend, "line"));

  section.append(frame, legend);
  return section;
}

function renderStockOpenInterestPanel(points) {
  const section = stockDataPanelShell("미결제 약정", ["5분", "단일"]);
  const interestValues = points.map((point) => point.openInterest);
  const notionalValues = points.map((point) => point.notional);
  const interestRange = stockDataRange(interestValues);
  const notionalRange = stockDataRange(notionalValues);

  const frame = document.createElement("div");
  frame.className = "stock-data-chart-frame has-right-axis";
  const plot = document.createElement("div");
  plot.className = "stock-data-plot";
  const svg = createSvg("svg", {
    viewBox: "0 0 640 224",
    preserveAspectRatio: "none",
    role: "img",
    "aria-label": "미결제 약정",
  });
  appendStockDataGrid(svg);

  const barWidth = Math.max(5, (640 / Math.max(1, points.length)) * 0.42);
  points.forEach((point, index) => {
    const x = stockDataX(index, points.length);
    const y = stockDataY(point.openInterest, interestRange);
    const height = Math.max(2, 206 - y);
    svg.append(
      createSvg("rect", {
        x: (x - barWidth / 2).toFixed(2),
        y: y.toFixed(2),
        width: barWidth.toFixed(2),
        height: height.toFixed(2),
        rx: 2,
        class: "stock-data-bar",
      }),
    );
  });
  svg.append(
    createSvg("path", {
      d: stockDataLinePath(points, "notional", notionalRange),
      class: "stock-data-line is-muted",
    }),
  );
  points.forEach((point, index) => {
    if (index % 2 !== 0 && index !== points.length - 1) return;
    svg.append(
      createSvg("circle", {
        cx: stockDataX(index, points.length).toFixed(2),
        cy: stockDataY(point.notional, notionalRange).toFixed(2),
        r: 3.8,
        class: "stock-data-dot is-muted",
      }),
    );
  });

  plot.replaceChildren(svg, stockDataXAxis(points));
  frame.replaceChildren(
    stockDataAxis(interestValues, formatStockDataCompact),
    plot,
    stockDataAxis(notionalValues, formatStockDataCompact, "stock-data-y-axis is-right"),
  );

  const legend = document.createElement("div");
  legend.className = "stock-data-legend";
  legend.replaceChildren(stockDataLegendItem("미결제 약정", "bar"), stockDataLegendItem("명목 가치", "muted-line"));

  section.append(frame, legend);
  return section;
}

function renderStockDataAnalytics(container, stock, rows, result, tick) {
  if (!container) return;
  const points = buildStockDerivativePoints(stock, rows, result, tick);
  if (!points.length) {
    container.replaceChildren();
    return;
  }
  const ratioFormatter = (value) => Number(value).toFixed(2);
  container.replaceChildren(
    renderStockOpenInterestPanel(points),
    renderStockDataLinePanel(
      {
        title: "상위 트레이더 롱/숏 비율(계정)",
        controls: ["5분"],
        key: "accountsRatio",
        legend: "상위 트레이더 롱/숏 비율(계정)",
        formatter: ratioFormatter,
      },
      points,
    ),
    renderStockDataLinePanel(
      {
        title: "상위 트레이더 롱/숏 비율(포지션)",
        controls: ["5분"],
        key: "positionsRatio",
        legend: "상위 트레이더 롱/숏 비율(포지션)",
        formatter: ratioFormatter,
      },
      points,
    ),
    renderStockDataLinePanel(
      {
        title: "롱/숏 비율",
        controls: ["5분"],
        key: "longShortRatio",
        legend: "롱/숏 비율",
        formatter: ratioFormatter,
      },
      points,
    ),
  );
}

function renderStockDataTerminal(analytics, summary, table, stock, result, tick, range) {
  if (!analytics && !summary && !table) return;
  const series = stockSeries(stock, tick, range);
  const rows = stockChartRows(series, range, "price");
  renderStockDataAnalytics(analytics, stock, rows, result, tick);

  if (summary) {
    const latest = rows.at(-1) || {};
    const first = rows[0] || {};
    const summaryItems = [
      ["종목", stockInfoMeta(stock).asset],
      ["현재가", formatStockKrw(result?.price || latest.close)],
      ["시가", formatStockKrw(first.open || result?.open)],
      ["고가", formatStockKrw(result?.high)],
      ["저가", formatStockKrw(result?.low)],
      ["거래량", `${formatStockNumber(result?.volume)}주`],
    ];
    summary.replaceChildren(
      ...summaryItems.map(([label, value]) => {
        const item = document.createElement("span");
        const em = document.createElement("em");
        const strong = document.createElement("strong");
        em.textContent = label;
        strong.textContent = value;
        item.replaceChildren(em, strong);
        return item;
      }),
    );
  }

  if (table) {
    const bodyRows = rows.slice(-18).reverse().map((point) => {
      const tr = document.createElement("tr");
      [
        formatStockDateTime(point.time),
        formatStockKrw(point.open),
        formatStockKrw(point.high),
        formatStockKrw(point.low),
        formatStockKrw(point.close),
        `${formatStockNumber(point.volume)}주`,
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        tr.append(cell);
      });
      return tr;
    });
    table.replaceChildren(...bodyRows);
  }
}

function buildStockDepth(stock, groupSize = 1, rowCount = DEFAULT_STOCK_DEPTH_SETTINGS.rows) {
  const price = Math.max(1, Number(stock.price) || 1);
  const volume = Math.max(10, stockDisplayVolume24h(stock));
  const group = Math.max(1, Number(groupSize) || 1);
  const rows = clampStockSettingNumber(rowCount, 5, 14, DEFAULT_STOCK_DEPTH_SETTINGS.rows);
  const spread = Math.max(group, price * 0.0025);
  const bestAsk = Math.ceil((price + spread / 2) / group) * group;
  const bestBid = Math.max(group, Math.floor((price - spread / 2) / group) * group);
  const asks = [];
  const bids = [];

  Array.from({ length: rows }, (_, index) => {
    const step = index + 1;
    const askQuantity = Math.max(1, Math.round((volume / 118) * (1 + Math.sin(price * 0.01 + step) * 0.28 + step * 0.09)));
    const bidQuantity = Math.max(1, Math.round((volume / 118) * (1 + Math.cos(price * 0.012 + step) * 0.24 + step * 0.1)));
    asks.push({ side: "ask", price: bestAsk + group * (step - 1), quantity: askQuantity });
    bids.push({ side: "bid", price: Math.max(group, bestBid - group * (step - 1)), quantity: bidQuantity });
  });

  let askTotal = 0;
  let bidTotal = 0;
  asks.forEach((level) => {
    askTotal += level.quantity;
    level.total = askTotal;
  });
  bids.forEach((level) => {
    bidTotal += level.quantity;
    level.total = bidTotal;
  });

  const bestAskPrice = asks[0]?.price || price;
  const bestBidPrice = bids[0]?.price || price;
  const realSpread = Math.max(0, bestAskPrice - bestBidPrice);
  const mid = (bestAskPrice + bestBidPrice) / 2;
  const bidRatio = Math.round((bidTotal / Math.max(1, bidTotal + askTotal)) * 100);
  const maxTotal = Math.max(1, askTotal, bidTotal);
  return { asks, bids, askTotal, bidTotal, bidRatio, spread: realSpread, spreadPercent: (realSpread / Math.max(1, mid)) * 100, mid, maxTotal };
}

function renderDepthLevels(list, levels, maxTotal, reverse = false) {
  if (!list) return;
  const rows = (reverse ? [...levels].reverse() : levels).map((level) => {
    const row = document.createElement("li");
    row.className = level.side === "ask" ? "is-ask" : "is-bid";
    row.style.setProperty("--depth", `${Math.max(6, (Number(level.total || 0) / Math.max(1, maxTotal)) * 100).toFixed(1)}%`);

    const price = document.createElement("strong");
    price.className = "stock-depth-price";
    price.textContent = formatStockKrw(level.price);
    const quantity = document.createElement("span");
    quantity.textContent = `${formatStockNumber(level.quantity)}주`;
    const total = document.createElement("em");
    total.textContent = `${formatStockNumber(level.total)}주`;
    row.append(price, quantity, total);
    return row;
  });
  list.replaceChildren(...rows);
}

function renderStockOrderBook(book, stock, options = {}) {
  if (!stock) return null;
  const depth = buildStockDepth(stock, options.groupSize);
  renderDepthLevels(options.asksBook, depth.asks, depth.maxTotal, true);
  renderDepthLevels(book, depth.bids, depth.maxTotal);

  if (options.midPrice) {
    options.midPrice.replaceChildren();
    const price = document.createElement("strong");
    price.textContent = formatStockKrw(depth.mid);
    const spread = document.createElement("span");
    spread.textContent = `스프레드 ${formatStockKrw(depth.spread)} / ${depth.spreadPercent.toFixed(2)}%`;
    options.midPrice.append(price, spread);
  }
  if (options.ratioLabel) {
    options.ratioLabel.textContent = `매수 ${depth.bidRatio}%`;
  }
  if (options.depthMeter) {
    const fill = options.depthMeter.querySelector("span");
    const label = options.depthMeter.querySelector("em");
    if (fill) fill.style.width = `${depth.bidRatio}%`;
    if (label) label.textContent = `매수 압력 ${depth.bidRatio}% / 매도 ${100 - depth.bidRatio}%`;
  }
  return depth;
}

function stockDepthLevelMatches(a, b) {
  if (!a || !b) return false;
  return a.side === b.side && Math.abs(Number(a.price) - Number(b.price)) < 0.0001;
}

function renderInteractiveDepthLevels(list, levels, maxTotal, options = {}) {
  if (!list) return;
  const rows = (options.reverse ? [...levels].reverse() : levels).map((level) => {
    const row = document.createElement("li");
    row.className = level.side === "ask" ? "is-ask" : "is-bid";
    row.classList.toggle("is-clickable", Boolean(options.onSelect));
    row.classList.toggle(
      "is-selected",
      Boolean(options.flashSelection && stockDepthLevelMatches(level, options.selectedLevel)),
    );
    row.style.setProperty(
      "--depth",
      options.showDepth
        ? `${Math.max(6, (Number(level.total || 0) / Math.max(1, maxTotal)) * 100).toFixed(1)}%`
        : "0%",
    );
    row.dataset.stockDepthSide = level.side;
    row.dataset.stockDepthPrice = String(level.price);
    row.dataset.stockDepthQuantity = String(level.quantity);

    if (options.onSelect) {
      const select = () => options.onSelect(level);
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute(
        "aria-label",
        `${level.side === "ask" ? "매도호가" : "매수호가"} ${formatStockKrw(level.price)} 수량 ${formatStockNumber(level.quantity)}주`,
      );
      row.addEventListener("click", select);
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        select();
      });
    }

    const price = document.createElement("strong");
    price.className = "stock-depth-price";
    price.textContent = formatStockKrw(level.price);
    const quantity = document.createElement("span");
    quantity.textContent = formatStockNumber(level.quantity);
    const total = document.createElement("em");
    total.hidden = !options.showSum;
    total.textContent = formatStockNumber(level.total);
    row.append(price, quantity, total);
    return row;
  });
  list.replaceChildren(...rows);
}

function renderStockOrderBookPanel(book, stock, options = {}) {
  if (!stock) return null;
  const settings = sanitizeStockDepthSettings(options.settings || { groupSize: options.groupSize });
  const depth = buildStockDepth(stock, settings.groupSize, settings.rows);
  const showAsks = settings.mode !== "bids";
  const showBids = settings.mode !== "asks";
  const levelOptions = {
    showDepth: settings.showDepth && settings.depthOpacity > 0,
    showSum: settings.showSum,
    flashSelection: settings.flashSelection,
    selectedLevel: options.selectedLevel,
    onSelect: options.onSelect,
  };

  if (options.panel) {
    options.panel.classList.toggle("is-depth-asks-only", settings.mode === "asks");
    options.panel.classList.toggle("is-depth-bids-only", settings.mode === "bids");
    options.panel.classList.toggle("is-depth-sum-hidden", !settings.showSum);
    options.panel.classList.toggle("is-depth-background-off", !settings.showDepth || settings.depthOpacity <= 0);
    options.panel.style.setProperty("--depth-opacity", String(Math.max(0, Math.min(90, settings.depthOpacity)) / 100));
  }
  if (options.asksBook) options.asksBook.hidden = !showAsks;
  if (book) book.hidden = !showBids;

  renderInteractiveDepthLevels(options.asksBook, showAsks ? depth.asks : [], depth.maxTotal, {
    ...levelOptions,
    reverse: true,
  });
  renderInteractiveDepthLevels(book, showBids ? depth.bids : [], depth.maxTotal, levelOptions);

  if (options.midPrice) {
    options.midPrice.replaceChildren();
    options.midPrice.dataset.stockDepthMid = String(depth.mid);
    options.midPrice.classList.toggle("is-clickable", settings.midClick !== "off");
    options.midPrice.tabIndex = settings.midClick !== "off" ? 0 : -1;
    options.midPrice.setAttribute("role", settings.midClick !== "off" ? "button" : "presentation");
    const price = document.createElement("strong");
    price.textContent = formatStockKrw(depth.mid);
    const spread = document.createElement("span");
    spread.textContent = `스프레드 ${formatStockKrw(depth.spread)} / ${depth.spreadPercent.toFixed(2)}%`;
    options.midPrice.append(price, spread);
  }
  if (options.ratioLabel) {
    options.ratioLabel.textContent = `매수 ${depth.bidRatio}%`;
  }
  if (options.depthMeter) {
    options.depthMeter.hidden = !settings.showMeter;
    const fill = options.depthMeter.querySelector("span");
    const label = options.depthMeter.querySelector("em");
    if (fill) fill.style.width = `${depth.bidRatio}%`;
    if (label) label.textContent = `매수 압력 ${depth.bidRatio}% / 매도 ${100 - depth.bidRatio}%`;
  }
  return depth;
}

function renderStockPortfolio(list, balanceLabel, portfolio, market) {
  if (balanceLabel) {
    balanceLabel.textContent =
      portfolio?.balance === undefined ? "인증 후 KRW 잔고 표시" : `KRW 잔고 ${formatStockKrw(portfolio.balance)}`;
  }
  if (!list) return;
  const positions = Array.isArray(portfolio?.positions) ? portfolio.positions : [];
  const stocks = Array.isArray(market?.stocks) ? market.stocks : [];
  const positionByCode = new Map(positions.map((position) => [position.symbol || position.code, position]));
  const rows = stocks.length
    ? stocks.map((stock) => ({ code: stockCode(stock), stock, position: positionByCode.get(stockCode(stock)) }))
    : positions.map((position) => ({ code: position.symbol || position.code, stock: null, position }));

  if (!rows.length) {
    const item = document.createElement("li");
    item.className = "is-empty";
    item.innerHTML = "<span>보유 종목 없음</span><strong>--</strong>";
    list.replaceChildren(item);
    return;
  }

  list.replaceChildren(
    ...rows.map(({ code, stock, position }) => {
      const shares = Number(position?.shares ?? position?.quantity ?? 0);
      const value = Number(position?.value ?? shares * Number(stock?.price || position?.price || 0));
      const item = document.createElement("li");
      if (!shares) item.className = "is-empty";
      const label = document.createElement("span");
      label.textContent = `${code} · ${stock?.name || position?.name || "포지션"}`;
      const amount = document.createElement("strong");
      amount.textContent = `${formatStockNumber(shares)}주`;
      const detail = document.createElement("em");
      detail.textContent = formatStockKrw(value);
      item.append(label, amount, detail);
      return item;
    }),
  );
}

function stockPortfolioPositionValue(portfolio, market) {
  const positions = Array.isArray(portfolio?.positions) ? portfolio.positions : [];
  const stocks = Array.isArray(market?.stocks) ? market.stocks : [];
  return positions.reduce((sum, position) => {
    const code = position.symbol || position.code;
    const stock = stocks.find((item) => stockCode(item) === code);
    const shares = Number(position.shares ?? position.quantity ?? 0);
    const value = Number(position.value ?? shares * Number(stock?.price || position.price || 0));
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function renderStockAccount(elements, portfolio, market) {
  if (!elements?.ratio && !elements?.balance && !elements?.maintenance && !elements?.positionValue) return;
  const cashBalance = Number(portfolio?.balance || 0);
  const positionValue = stockPortfolioPositionValue(portfolio, market);
  const marginBalance = Math.max(0, cashBalance + positionValue);
  const maintenance = positionValue * 0.006;
  const ratio = marginBalance > 0 ? (maintenance / marginBalance) * 100 : 0;
  const clampedRatio = Math.max(0, Math.min(100, ratio));

  if (elements.ratio) elements.ratio.textContent = `${clampedRatio.toFixed(2)}%`;
  if (elements.meter) elements.meter.value = clampedRatio;
  if (elements.maintenance) elements.maintenance.textContent = formatStockKrw(maintenance);
  if (elements.balance) elements.balance.textContent = formatStockKrw(marginBalance);
  if (elements.positionValue) elements.positionValue.textContent = formatStockKrw(positionValue);
  if (elements.mode) elements.mode.textContent = "단일 자산 모드";
}

function stockActivityEmpty(label = "거래하려면 계정을 인증하세요.") {
  const empty = document.createElement("div");
  empty.className = "stock-activity-empty";
  empty.textContent = label;
  return empty;
}

function stockActivityTable(headers, rows) {
  const wrap = document.createElement("div");
  wrap.className = "stock-activity-table-wrap";
  const table = document.createElement("table");
  table.className = "stock-activity-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.replaceChildren(thead, tbody);
  wrap.append(table);
  return wrap;
}

function renderStockActivityPanel(body, buttons, view, portfolio, market, activeCode) {
  const positions = Array.isArray(portfolio?.positions) ? portfolio.positions : [];
  const trades = (Array.isArray(market?.recentTrades) ? market.recentTrades : []).filter(
    (trade) => !activeCode || (trade.symbol || trade.code) === activeCode,
  );
  const stocks = Array.isArray(market?.stocks) ? market.stocks : [];
  const labels = {
    positions: `포지션(${positions.length})`,
    "open-orders": "미체결(0)",
    "order-history": "주문 내역",
    "trade-history": `체결 내역${trades.length ? `(${trades.length})` : ""}`,
    "transaction-history": "입출금 내역",
    "position-history": "포지션 내역",
    bots: "자동매매",
    assets: "자산",
  };

  buttons.forEach((button) => {
    const key = button.dataset.stockActivityView;
    button.classList.toggle("is-active", key === view);
    if (labels[key]) button.textContent = labels[key];
  });
  if (!body) return;

  if (view === "positions" && positions.length) {
    body.replaceChildren(
      stockActivityTable(
        ["종목", "수량", "진입가", "표시가", "평가액"],
        positions.map((position) => {
          const code = position.symbol || position.code;
          const stock = stocks.find((item) => stockCode(item) === code);
          const shares = Number(position.shares ?? position.quantity ?? 0);
          const entry = Number(position.entryPrice || position.price || stock?.price || 0);
          const mark = Number(stock?.price || entry);
          return [code, `${formatStockNumber(shares)}주`, formatStockKrw(entry), formatStockKrw(mark), formatStockKrw(shares * mark)];
        }),
      ),
    );
    return;
  }

  if (view === "trade-history" && trades.length) {
    body.replaceChildren(
      stockActivityTable(
        ["시간", "종목", "방향", "수량", "가격"],
        trades.slice(0, 12).map((trade) => [
          formatStockTime(trade.time || trade.createdAt || trade.at),
          trade.symbol || trade.code || activeCode,
          trade.side === "sell" ? "매도" : "매수",
          `${formatStockNumber(trade.quantity || trade.shares || 0)}주`,
          formatStockKrw(trade.price),
        ]),
      ),
    );
    return;
  }

  if (view === "assets" && stocks.length) {
    body.replaceChildren(
      stockActivityTable(
        ["자산", "이름", "현재가", "24시간"],
        stocks.map((stock) => [stockCode(stock), stock.name || stockCode(stock), formatStockKrw(stock.price), formatStockChange(stock.change24h)]),
      ),
    );
    return;
  }

  const emptyLabels = {
    bots: "실행 중인 자동매매가 없습니다.",
    assets: "불러온 자산이 없습니다.",
    "open-orders": "미체결 주문이 없습니다.",
    "order-history": "주문 내역이 없습니다.",
    "transaction-history": "입출금 내역이 없습니다.",
    "position-history": "종료된 포지션이 없습니다.",
  };
  body.replaceChildren(stockActivityEmpty(emptyLabels[view] || "거래하려면 계정을 인증하세요."));
}

function formatMetricPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function expertSignal(metrics, depth) {
  let score = 0;
  if (metrics.rsi < 35) score += 1;
  if (metrics.rsi > 70) score -= 1;
  if (metrics.macd > metrics.signal) score += 1;
  if (metrics.macd < metrics.signal) score -= 1;
  if (metrics.vwapGap > 0) score += 1;
  if (metrics.vwapGap < 0) score -= 1;
  if ((depth?.bidRatio || 50) >= 58) score += 1;
  if ((depth?.bidRatio || 50) <= 42) score -= 1;
  if (score >= 3) return { label: "강한 매수", tone: "buy" };
  if (score >= 1) return { label: "매수 우위", tone: "buy" };
  if (score <= -3) return { label: "강한 매도", tone: "sell" };
  if (score <= -1) return { label: "매도 우위", tone: "sell" };
  return { label: "중립", tone: "neutral" };
}

function liquidationPrice(price, leverage, side) {
  const entry = Number(price);
  const lev = Number(leverage);
  if (!Number.isFinite(entry) || !Number.isFinite(lev) || lev <= 1) return null;
  const maintenance = 0.006;
  const move = 1 / lev - maintenance;
  return side === "sell" ? entry * (1 + move) : entry * (1 - move);
}

function orderRiskLabel(leverage, volatility, depth) {
  const lev = Number(leverage) || 1;
  const vol = Number(volatility) || 0;
  const imbalance = Math.abs((Number(depth?.bidRatio) || 50) - 50);
  const score = lev * 0.9 + vol * 0.55 + imbalance * 0.06;
  if (score >= 10) return "매우 높음";
  if (score >= 6) return "높음";
  if (score >= 3.5) return "보통";
  return "낮음";
}

function renderExpertPanel(elements, metrics, depth, stock, orderElements, activeSide) {
  if (!elements.metrics && !elements.signal && !elements.risk) return;
  const signal = expertSignal(metrics, depth);
  if (elements.signal) {
    elements.signal.textContent = signal.label;
    elements.signal.classList.toggle("is-buy", signal.tone === "buy");
    elements.signal.classList.toggle("is-sell", signal.tone === "sell");
  }

  if (elements.metrics) {
    const macdGap = Number(metrics.macd) - Number(metrics.signal);
    const items = [
      ["RSI", metrics.rsi.toFixed(1)],
      ["MACD", formatStockSignedKrw(macdGap)],
      ["변동성", `${metrics.volatility.toFixed(2)}%`],
      ["VWAP 괴리", formatMetricPercent(metrics.vwapGap)],
    ];
    elements.metrics.replaceChildren(
      ...items.map(([label, value]) => {
        const item = document.createElement("span");
        item.innerHTML = `<em>${label}</em><strong>${value}</strong>`;
        return item;
      }),
    );
  }

  if (elements.risk) {
    const price = Math.max(1, Number(stock?.price) || metrics.price || 1);
    const leverage = Math.max(1, Math.min(STOCK_MAX_LEVERAGE, Number(orderElements?.leverage?.value || 1)));
    const liq = liquidationPrice(price, leverage, activeSide);
    const risk = orderRiskLabel(leverage, metrics.volatility, depth);
    const pressure = `매수 ${depth?.bidRatio ?? 50}%`;
    const rows = [
      ["예상 청산가", liq ? formatStockKrw(liq) : "현물 포지션 없음"],
      ["위험도", risk],
      ["호가 압력", pressure],
    ];
    elements.risk.replaceChildren(
      ...rows.map(([label, value]) => {
        const item = document.createElement("span");
        item.innerHTML = `<em>${label}</em><strong>${value}</strong>`;
        return item;
      }),
    );
  }
}

function setTradeMessage(element, text, tone = "info") {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("is-error", tone === "error");
  element.classList.toggle("is-success", tone === "success");
}

function stockOrderBalance(stock, portfolio) {
  const balance = Number(portfolio?.balance);
  if (Number.isFinite(balance) && balance > 0) return { value: balance, preview: false };
  const price = Math.max(1, Number(stock?.price || stock?.base) || 1);
  return { value: Math.max(1_000_000, price * 500), preview: true };
}

function stockOrderMaxQuantity(stock, portfolio, side, leverage, executionPrice, reduceOnly = false) {
  const price = Math.max(1, Number(executionPrice || stock?.price) || 1);
  const position = stockPosition(portfolio, stockCode(stock));
  const positionQuantity = Math.max(0, Number(position?.shares ?? position?.quantity ?? 0));
  if (reduceOnly) return Math.floor(positionQuantity);

  const balance = stockOrderBalance(stock, portfolio).value;
  const maxByMargin = Math.floor((balance * Math.max(1, leverage) * 0.98) / price);
  return Math.max(1, Math.min(999_999, maxByMargin));
}

function syncStockOrderPercentControl(elements, quantity, maxQuantity) {
  const percent = maxQuantity > 0 ? Math.min(100, Math.max(0, (Number(quantity) / maxQuantity) * 100)) : 0;
  if (elements.percent) {
    elements.percent.value = String(Math.round(percent));
    elements.percent.style.setProperty("--percent", `${percent.toFixed(1)}%`);
  }
  elements.percentButtons?.forEach((button) => {
    const marker = Number(button.dataset.stockSizePercentButton || 0);
    button.classList.toggle("is-active", Math.abs(marker - percent) <= 3);
  });
}

function renderOrderTicket(elements, stock, side, playerProfile, portfolio, liveMarket = false, loading = false, expert = {}) {
  if (!elements?.root || !stock) return;
  const quantity = Math.max(1, Math.floor(Number(elements.quantity?.value || 1)));
  const price = Math.max(1, Number(stock.price) || 1);
  const orderType = elements.type?.value || "market";
  const limitPrice = Math.max(0, Number(elements.limit?.value || 0));
  const usesLimitPrice = ["limit", "stop-limit", "oco"].includes(orderType);
  const executionPrice = usesLimitPrice && limitPrice > 0 ? limitPrice : price;
  const leverage = Math.max(1, Math.min(STOCK_MAX_LEVERAGE, Number(elements.leverage?.value || 1)));
  const takeProfit = Math.max(0, Number(elements.takeProfit?.value || 0));
  const stopLoss = Math.max(0, Number(elements.stopLoss?.value || 0));
  const tpSlEnabled = elements.tpSlToggle ? Boolean(elements.tpSlToggle.checked) : true;
  const reduceOnly = elements.reduceOnly?.value === "on";
  const timeInForce = elements.timeInForce?.value || "GTC";
  const feeRate = 0.003;
  const notional = executionPrice * quantity;
  const margin = notional / leverage;
  const fee = notional * feeRate;
  const total = side === "sell" ? notional - fee : margin + fee;
  const position = stockPosition(portfolio, stockCode(stock));
  const canTrade = Boolean(playerProfile?.verified && playerProfile?.webToken && PLAYER_API_BASES.length && liveMarket && stock && !loading);
  const liq = liquidationPrice(executionPrice, leverage, side);
  const risk = orderRiskLabel(leverage, expert.metrics?.volatility, expert.depth);
  const balance = stockOrderBalance(stock, portfolio);
  const maxQuantity = stockOrderMaxQuantity(stock, portfolio, side, leverage, executionPrice, reduceOnly);

  if (elements.symbol) elements.symbol.textContent = stockCode(stock);
  if (elements.side) elements.side.textContent = side === "sell" ? "매도" : "매수";
  if (elements.available) {
    elements.available.textContent = formatStockKrw(balance.value);
    elements.available.title = balance.preview ? "미리보기 잔고" : "";
  }
  if (elements.max) elements.max.textContent = `${formatStockNumber(maxQuantity)}주`;
  if (elements.limit) {
    elements.limit.disabled = orderType === "market";
    elements.limit.placeholder = orderType === "market" ? "시장가" : "현재가";
  }
  if (elements.quantity) elements.quantity.max = String(Math.max(1, maxQuantity));
  if (elements.takeProfit) elements.takeProfit.disabled = !tpSlEnabled;
  if (elements.stopLoss) elements.stopLoss.disabled = !tpSlEnabled;
  elements.advanced?.classList.toggle("is-tpsl-off", !tpSlEnabled);
  syncStockOrderPercentControl(elements, quantity, maxQuantity);
  if (elements.estimate) {
    elements.estimate.replaceChildren();
    [
      ["예상 체결가", formatStockKrw(executionPrice)],
      ["주문 수량", `${formatStockNumber(quantity)}주`],
      ["레버리지", `${leverage}x`],
      ["주문 가치", formatStockKrw(notional)],
      ["필요 증거금", formatStockKrw(margin)],
      ["수수료", formatStockKrw(fee)],
      [side === "sell" ? "예상 수령" : "예상 비용", formatStockKrw(total)],
      ["청산가", liq ? formatStockKrw(liq) : "현물 포지션 없음"],
      ["위험도", risk],
      ["익절 / 손절", tpSlEnabled ? `${takeProfit ? formatStockKrw(takeProfit) : "--"} / ${stopLoss ? formatStockKrw(stopLoss) : "--"}` : "끄기"],
      ["TIF / 메이커", `${timeInForce} / ${elements.postOnly?.value === "on" ? "메이커" : "끄기"}`],
      ["최대", `${formatStockNumber(maxQuantity)}주`],
      ["보유", position ? `${formatStockNumber(position.shares ?? position.quantity ?? 0)}주` : "0주"],
    ].forEach(([label, value]) => {
      const item = document.createElement("span");
      item.innerHTML = `<em>${label}</em><strong>${value}</strong>`;
      elements.estimate.append(item);
    });
  }
  if (elements.submit) elements.submit.disabled = !canTrade;
  if (!canTrade) {
    setTradeMessage(
      elements.message,
      loading
        ? "주문 전송 중..."
        : !PLAYER_API_BASES.length
        ? "주식 API 연결 전까지는 미리보기만 가능합니다."
        : !liveMarket
          ? "실시간 주식 API를 불러오는 중입니다. 잠시 후 다시 시도하세요."
          : "실시간 주문은 로그인과 캐릭터 인증 후 사용할 수 있습니다.",
      PLAYER_API_BASES.length ? "info" : "error",
    );
  }
}

function initStockExchange() {
  const root = document.querySelector("[data-stock-exchange]");
  const chart = document.querySelector("[data-stock-chart]");
  const list = document.querySelector("[data-stock-list]");
  if (!root || !chart || !list) return;

  const mainViewButtons = document.querySelectorAll("[data-stock-main-view]");
  const mainPanels = document.querySelectorAll("[data-stock-main-panel]");
  const infoViewButtons = document.querySelectorAll("[data-stock-info-view]");
  const infoBody = document.querySelector("[data-stock-info-body]");
  const dataAnalytics = document.querySelector("[data-stock-data-analytics]");
  const dataSummary = document.querySelector("[data-stock-data-summary]");
  const dataTable = document.querySelector("[data-stock-data-table]");
  const ticker = document.querySelector("[data-stock-ticker]");
  const price = document.querySelectorAll("[data-stock-price]");
  const markPrice = document.querySelectorAll("[data-stock-mark-price]");
  const change = document.querySelectorAll("[data-stock-change]");
  const symbol = document.querySelectorAll("[data-stock-symbol]");
  const stockName = document.querySelectorAll("[data-stock-name]");
  const open = document.querySelectorAll("[data-stock-open]");
  const high = document.querySelectorAll("[data-stock-high]");
  const low = document.querySelectorAll("[data-stock-low]");
  const quoteVolume = document.querySelectorAll("[data-stock-quote-volume]");
  const indexValue = document.querySelectorAll("[data-stock-index]");
  const indexChange = document.querySelectorAll("[data-stock-index-change]");
  const volume = document.querySelectorAll("[data-stock-volume]");
  const cap = document.querySelectorAll("[data-stock-cap]");
  const session = document.querySelectorAll("[data-stock-session]");
  const updated = document.querySelectorAll("[data-stock-updated]");
  const rangeButtons = document.querySelectorAll("[data-stock-range]");
  const sortButtons = document.querySelectorAll("[data-stock-sort]");
  const modeButtons = document.querySelectorAll("[data-stock-chart-mode]");
  const scaleButtons = document.querySelectorAll("[data-stock-scale]");
  const indicatorButtons = document.querySelectorAll("[data-stock-indicator]");
  const chartSettingsElements = {
    open: document.querySelector("[data-stock-chart-settings-open]"),
    modal: document.querySelector("[data-stock-chart-settings-modal]"),
    close: document.querySelector("[data-stock-chart-settings-close]"),
    tabs: document.querySelector("[data-stock-chart-settings-tabs]"),
    body: document.querySelector("[data-stock-chart-settings-body]"),
    reset: document.querySelector("[data-stock-chart-settings-reset]"),
    save: document.querySelector("[data-stock-chart-settings-save]"),
  };
  const financialViewButtons = document.querySelectorAll("[data-stock-financial-view]");
  const axisStart = document.querySelector("[data-stock-axis-start]");
  const chartReadout = document.querySelector("[data-stock-chart-readout]");
  const performance = document.querySelector("[data-stock-performance]");
  const tape = document.querySelector("[data-trade-tape]");
  const orderBook = document.querySelector("[data-stock-order-book]");
  const depthPanel = document.querySelector(".stock-depth-panel");
  const detailElements = {
    symbol: document.querySelector("[data-stock-detail-symbol]"),
    name: document.querySelector("[data-stock-detail-name]"),
    price: document.querySelector("[data-stock-detail-price]"),
    change: document.querySelector("[data-stock-detail-change]"),
    range: document.querySelector("[data-stock-detail-range]"),
    time: document.querySelector("[data-stock-detail-time]"),
  };
  const strengthElements = {
    value: document.querySelector("[data-stock-strength-value]"),
    meter: document.querySelector("[data-stock-strength-meter]"),
    buy: document.querySelector("[data-stock-strength-buy]"),
    sell: document.querySelector("[data-stock-strength-sell]"),
  };
  const orderAsks = document.querySelector("[data-stock-order-asks]");
  const depthRatio = document.querySelector("[data-stock-depth-ratio]");
  const depthMid = document.querySelector("[data-stock-mid-price]");
  const depthMeter = document.querySelector("[data-stock-depth-meter]");
  const depthGroupButtons = document.querySelectorAll("[data-stock-depth-group]");
  const depthModeButtons = document.querySelectorAll("[data-stock-depth-mode]");
  const depthSettingsElements = {
    open: document.querySelector("[data-stock-depth-settings-open]"),
    modal: document.querySelector("[data-stock-depth-settings-modal]"),
    close: document.querySelector("[data-stock-depth-settings-close]"),
    reset: document.querySelector("[data-stock-depth-settings-reset]"),
    save: document.querySelector("[data-stock-depth-settings-save]"),
    inputs: document.querySelectorAll("[data-stock-depth-setting]"),
  };
  const expertElements = {
    signal: document.querySelector("[data-stock-expert-signal]"),
    metrics: document.querySelector("[data-stock-expert-metrics]"),
    risk: document.querySelector("[data-stock-risk-panel]"),
  };
  const newsElements = {
    week: document.querySelector("[data-stock-news-week]"),
    code: document.querySelector("[data-stock-news-code]"),
    title: document.querySelector("[data-stock-news-title]"),
    summary: document.querySelector("[data-stock-news-summary]"),
    clock: document.querySelector("[data-stock-news-clock]"),
    list: document.querySelector("[data-stock-news-list]"),
    modal: document.querySelector("[data-stock-news-modal]"),
    modalClose: document.querySelector("[data-stock-news-close]"),
    modalImage: document.querySelector("[data-stock-news-modal-image]"),
    modalTag: document.querySelector("[data-stock-news-modal-tag]"),
    modalSource: document.querySelector("[data-stock-news-modal-source]"),
    modalTitle: document.querySelector("[data-stock-news-modal-title]"),
    modalSummary: document.querySelector("[data-stock-news-modal-summary]"),
    modalImpact: document.querySelector("[data-stock-news-modal-impact]"),
    modalDetail: document.querySelector("[data-stock-news-modal-detail]"),
  };
  const financialElements = {
    period: document.querySelector("[data-stock-financial-period]"),
    code: document.querySelector("[data-stock-financial-code]"),
    company: document.querySelector("[data-stock-financial-company]"),
    summary: document.querySelector("[data-stock-financial-summary]"),
    clock: document.querySelector("[data-stock-financial-clock]"),
    score: document.querySelector("[data-stock-financial-score]"),
    kpis: document.querySelector("[data-stock-financial-kpis]"),
    head: document.querySelector("[data-stock-financial-head]"),
    table: document.querySelector("[data-stock-financial-table]"),
    diagnosis: document.querySelector("[data-stock-financial-diagnosis]"),
    ratios: document.querySelector("[data-stock-financial-ratios]"),
    health: document.querySelector("[data-stock-financial-health]"),
  };
  const portfolioList = document.querySelector("[data-stock-portfolio]");
  const portfolioBalance = document.querySelector("[data-stock-portfolio-balance]");
  const accountElements = {
    mode: document.querySelector("[data-stock-account-mode]"),
    ratio: document.querySelector("[data-stock-account-margin-ratio]"),
    meter: document.querySelector("[data-stock-account-meter]"),
    maintenance: document.querySelector("[data-stock-account-maintenance]"),
    balance: document.querySelector("[data-stock-account-balance]"),
    positionValue: document.querySelector("[data-stock-account-position-value]"),
  };
  const activityButtons = document.querySelectorAll("[data-stock-activity-view]");
  const activityBody = document.querySelector("[data-stock-activity-body]");
  const orderForm = document.querySelector("[data-stock-order-form]");
  const compactOrderTicket = document.querySelector(".stock-order-ticket.is-compact");
  const orderElements = {
    root: orderForm,
    quantity: document.querySelector("[data-stock-order-quantity]"),
    type: document.querySelector("[data-stock-order-type]"),
    limit: document.querySelector("[data-stock-order-limit]"),
    leverage: document.querySelector("[data-stock-order-leverage]"),
    marginMode: document.querySelector("[data-stock-margin-mode]"),
    available: document.querySelector("[data-stock-order-available]"),
    max: document.querySelector("[data-stock-order-max]"),
    bbo: document.querySelector("[data-stock-order-bbo]"),
    percent: document.querySelector("[data-stock-size-percent]"),
    percentButtons: document.querySelectorAll("[data-stock-size-percent-button]"),
    sizeStepButtons: document.querySelectorAll("[data-stock-size-step]"),
    takeProfit: document.querySelector("[data-stock-order-take-profit]"),
    stopLoss: document.querySelector("[data-stock-order-stop-loss]"),
    tpSlToggle: document.querySelector("[data-stock-order-tpsl-toggle]"),
    postOnly: document.querySelector("[data-stock-order-post-only]"),
    reduceOnly: document.querySelector("[data-stock-order-reduce-only]"),
    timeInForce: document.querySelector("[data-stock-order-time-in-force]"),
    advanced: document.querySelector(".stock-advanced-orders"),
    symbol: document.querySelector("[data-stock-order-symbol]"),
    side: document.querySelector("[data-stock-order-side-label]"),
    estimate: document.querySelector("[data-stock-order-estimate]"),
    submit: document.querySelector("[data-stock-order-submit]"),
    message: document.querySelector("[data-stock-order-message]"),
  };
  const sideButtons = document.querySelectorAll("[data-stock-order-side]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let market = buildFallbackMarket(0);
  let activeCode = market.stocks[0]?.symbol || market.stocks[0]?.code || "DMD";
  let activeMainView = document.querySelector("[data-stock-main-view].is-active")?.dataset.stockMainView || "chart";
  let activeInfoView = document.querySelector("[data-stock-info-view].is-active")?.dataset.stockInfoView || "coin";
  let activeRange = "1D";
  let activeSort = "market";
  let chartSettings = readStockChartSettings();
  let draftChartSettings = cloneStockChartSettings(chartSettings);
  let depthSettings = readStockDepthSettings();
  let draftDepthSettings = cloneStockDepthSettings(depthSettings);
  let activeSettingsTab = "main";
  let activeMode = chartSettings.mode || document.querySelector("[data-stock-chart-mode].is-active")?.dataset.stockChartMode || "line";
  let activeScale = chartSettings.scale || document.querySelector("[data-stock-scale].is-active")?.dataset.stockScale || "price";
  let activeFinancialView = document.querySelector("[data-stock-financial-view].is-active")?.dataset.stockFinancialView || "income";
  let activeActivityView = document.querySelector("[data-stock-activity-view].is-active")?.dataset.stockActivityView || "positions";
  let activeDepthGroup = depthSettings.groupSize || Number(document.querySelector("[data-stock-depth-group].is-active")?.dataset.stockDepthGroup || 1);
  let activeIndicators = stockToolbarIndicatorSet(chartSettings);
  let activeSide = "buy";
  let selectedDepthLevel = null;
  let selectedDepthTimer = 0;
  let portfolio = null;
  let playerProfile = readPlayerProfile(sessionUser || readStoredUser());
  let liveMarket = false;
  let orderLoading = false;
  let tick = 0;

  const selectStock = (code) => {
    activeCode = code;
    render();
  };

  const currentPlayerProfile = () => readPlayerProfile(sessionUser || readStoredUser());

  function currentStock() {
    const stocks = Array.isArray(market?.stocks) && market.stocks.length ? market.stocks : buildFallbackMarket(tick).stocks;
    return stocks.find((item) => stockCode(item) === activeCode) || stocks[0];
  }

  function chartSettingsContext() {
    const stock = currentStock();
    return {
      range: activeRange,
      series: stockSeries(stock, tick, activeRange),
      stock,
    };
  }

  function syncChartSettingsState(settings) {
    chartSettings = sanitizeStockChartSettings(settings);
    activeMode = chartSettings.mode;
    activeScale = chartSettings.scale;
    activeIndicators = stockToolbarIndicatorSet(chartSettings);
  }

  function renderChartSettingsModal() {
    if (!chartSettingsElements.modal || chartSettingsElements.modal.hidden) return;
    const rerender = () => renderChartSettingsModal();
    renderStockChartSettingsTabs(chartSettingsElements, activeSettingsTab, (tab) => {
      activeSettingsTab = tab;
      renderChartSettingsModal();
    });
    renderStockChartSettingsBody(
      chartSettingsElements,
      draftChartSettings,
      activeSettingsTab,
      chartSettingsContext(),
      rerender,
    );
  }

  function openChartSettingsModal() {
    if (!chartSettingsElements.modal) return;
    draftChartSettings = cloneStockChartSettings(chartSettings);
    chartSettingsElements.modal.hidden = false;
    document.body.classList.add("stock-chart-settings-open");
    renderChartSettingsModal();
  }

  function closeChartSettingsModal() {
    if (!chartSettingsElements.modal) return;
    chartSettingsElements.modal.hidden = true;
    document.body.classList.remove("stock-chart-settings-open");
  }

  function saveChartSettingsModal() {
    syncChartSettingsState(draftChartSettings);
    writeStockChartSettings(chartSettings);
    closeChartSettingsModal();
    render();
  }

  function resetChartSettingsModal() {
    draftChartSettings = cloneStockChartSettings();
    syncChartSettingsState(draftChartSettings);
    writeStockChartSettings(chartSettings);
    render();
    renderChartSettingsModal();
  }

  function syncDepthSettingsInputs(settings) {
    const next = sanitizeStockDepthSettings(settings);
    depthSettingsElements.inputs.forEach((input) => {
      const key = input.dataset.stockDepthSetting;
      if (!key || !(key in next)) return;
      if (input.type === "checkbox") input.checked = Boolean(next[key]);
      else input.value = String(next[key]);
    });
  }

  function readDepthSettingsInputs(base = draftDepthSettings) {
    const next = { ...base };
    depthSettingsElements.inputs.forEach((input) => {
      const key = input.dataset.stockDepthSetting;
      if (!key) return;
      next[key] = input.type === "checkbox" ? input.checked : input.value;
    });
    return sanitizeStockDepthSettings(next);
  }

  function syncDepthSettingsState(settings) {
    depthSettings = sanitizeStockDepthSettings(settings);
    activeDepthGroup = depthSettings.groupSize;
  }

  function openDepthSettingsModal() {
    if (!depthSettingsElements.modal) return;
    draftDepthSettings = cloneStockDepthSettings(depthSettings);
    syncDepthSettingsInputs(draftDepthSettings);
    depthSettingsElements.modal.hidden = false;
    document.body.classList.add("stock-depth-settings-open");
  }

  function closeDepthSettingsModal() {
    if (!depthSettingsElements.modal) return;
    depthSettingsElements.modal.hidden = true;
    document.body.classList.remove("stock-depth-settings-open");
  }

  function saveDepthSettingsModal() {
    draftDepthSettings = readDepthSettingsInputs();
    syncDepthSettingsState(draftDepthSettings);
    writeStockDepthSettings(depthSettings);
    closeDepthSettingsModal();
    render();
  }

  function resetDepthSettingsModal() {
    draftDepthSettings = cloneStockDepthSettings();
    syncDepthSettingsState(draftDepthSettings);
    writeStockDepthSettings(depthSettings);
    syncDepthSettingsInputs(depthSettings);
    render();
  }

  function applyDepthRowToOrder(level, options = {}) {
    if (!level || !orderElements.root) return;
    const priceValue = Math.max(1, Math.round(Number(level.price) || 1));
    const quantityValue = Math.max(1, Math.round(Number(level.quantity) || 1));
    selectedDepthLevel = { side: level.side, price: Number(level.price), quantity: Number(level.quantity) };

    if (depthSettings.autoSide && !options.keepSide) {
      activeSide = level.side === "ask" ? "buy" : "sell";
    }
    if (orderElements.limit) orderElements.limit.value = String(priceValue);
    if (orderElements.type?.value === "market") orderElements.type.value = "limit";
    if (depthSettings.clickAction === "price-size" && orderElements.quantity) {
      const min = Math.max(1, Number(orderElements.quantity.min || 1));
      const max = Math.max(min, Number(orderElements.quantity.max || quantityValue));
      orderElements.quantity.value = String(Math.min(max, Math.max(min, quantityValue)));
    }

    window.clearTimeout(selectedDepthTimer);
    if (depthSettings.flashSelection) {
      selectedDepthTimer = window.setTimeout(() => {
        selectedDepthLevel = null;
        render();
      }, 1200);
    }
    const sideLabel = level.side === "ask" ? "매도호가" : "매수호가";
    render();
    setTradeMessage(orderElements.message, `${sideLabel} ${formatStockKrw(priceValue)} 선택됨`, "info");
  }

  function applyDepthMidToOrder() {
    if (depthSettings.midClick === "off" || !depthMid?.dataset.stockDepthMid) return;
    applyDepthRowToOrder(
      {
        side: activeSide === "sell" ? "bid" : "ask",
        price: Number(depthMid.dataset.stockDepthMid),
        quantity: Number(orderElements.quantity?.value || 1),
      },
      { keepSide: true },
    );
  }

  function currentOrderExecutionPrice(stock = currentStock()) {
    const marketPrice = Math.max(1, Number(stock?.price) || 1);
    const orderType = orderElements.type?.value || "market";
    const limitPrice = Math.max(0, Number(orderElements.limit?.value || 0));
    return ["limit", "stop-limit", "oco"].includes(orderType) && limitPrice > 0 ? limitPrice : marketPrice;
  }

  function currentOrderMaxQuantity(stock = currentStock()) {
    const leverage = Math.max(1, Math.min(STOCK_MAX_LEVERAGE, Number(orderElements.leverage?.value || 1)));
    const reduceOnly = orderElements.reduceOnly?.value === "on";
    return stockOrderMaxQuantity(stock, portfolio, activeSide, leverage, currentOrderExecutionPrice(stock), reduceOnly);
  }

  function setOrderQuantity(value, shouldRender = true) {
    if (!orderElements.quantity) return;
    const max = Math.max(1, currentOrderMaxQuantity());
    const next = Math.max(1, Math.min(max, Math.round(Number(value) || 1)));
    orderElements.quantity.value = String(next);
    if (shouldRender) render();
  }

  function applyOrderPercent(percent) {
    const max = Math.max(1, currentOrderMaxQuantity());
    const next = Math.max(1, Math.floor((max * Math.max(0, Math.min(100, Number(percent) || 0))) / 100));
    setOrderQuantity(next);
  }

  function applyBboPrice() {
    const stock = currentStock();
    if (!stock || !orderElements.limit) return;
    const depth = buildStockDepth(stock, activeDepthGroup, depthSettings.rows);
    const level = activeSide === "sell" ? depth.bids[0] : depth.asks[0];
    if (!level) return;
    orderElements.limit.value = String(Math.max(1, Math.round(Number(level.price) || 1)));
    if (orderElements.type) orderElements.type.value = "limit";
    render();
    setTradeMessage(orderElements.message, `최우선 호가 ${formatStockKrw(level.price)} 적용`, "info");
  }

  function toggleMarginMode() {
    if (!orderElements.marginMode) return;
    const next = orderElements.marginMode.dataset.stockMarginMode === "isolated" ? "cross" : "isolated";
    orderElements.marginMode.dataset.stockMarginMode = next;
    orderElements.marginMode.textContent = next === "isolated" ? "격리" : "교차";
    orderElements.marginMode.setAttribute("aria-pressed", String(next === "isolated"));
    render();
  }

  newsElements.modalClose?.addEventListener("click", () => closeStockNewsDetail(newsElements));
  newsElements.modal?.addEventListener("click", (event) => {
    if (event.target === newsElements.modal) closeStockNewsDetail(newsElements);
  });
  chartSettingsElements.open?.addEventListener("click", openChartSettingsModal);
  chartSettingsElements.close?.addEventListener("click", closeChartSettingsModal);
  chartSettingsElements.save?.addEventListener("click", saveChartSettingsModal);
  chartSettingsElements.reset?.addEventListener("click", resetChartSettingsModal);
  chartSettingsElements.modal?.addEventListener("click", (event) => {
    if (event.target === chartSettingsElements.modal) closeChartSettingsModal();
  });
  depthSettingsElements.open?.addEventListener("click", openDepthSettingsModal);
  depthSettingsElements.close?.addEventListener("click", closeDepthSettingsModal);
  depthSettingsElements.save?.addEventListener("click", saveDepthSettingsModal);
  depthSettingsElements.reset?.addEventListener("click", resetDepthSettingsModal);
  depthSettingsElements.inputs.forEach((input) => {
    input.addEventListener("input", () => {
      draftDepthSettings = readDepthSettingsInputs();
    });
    input.addEventListener("change", () => {
      draftDepthSettings = readDepthSettingsInputs();
    });
  });
  depthSettingsElements.modal?.addEventListener("click", (event) => {
    if (event.target === depthSettingsElements.modal) closeDepthSettingsModal();
  });
  depthMid?.addEventListener("click", applyDepthMidToOrder);
  depthMid?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    applyDepthMidToOrder();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !newsElements.modal?.hidden) closeStockNewsDetail(newsElements);
    if (event.key === "Escape" && !chartSettingsElements.modal?.hidden) closeChartSettingsModal();
    if (event.key === "Escape" && !depthSettingsElements.modal?.hidden) closeDepthSettingsModal();
  });

  function syncStockMainPanels() {
    mainViewButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.stockMainView === activeMainView);
    });
    mainPanels.forEach((panel) => {
      const isActive = panel.dataset.stockMainPanel === activeMainView;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
    });
    infoViewButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.stockInfoView === activeInfoView);
    });
  }

  function render() {
    if (activeMainView === "chart") syncStockMainPanels();
    renderStockAuthLink(sessionUser || readStoredUser());
    const rawStocks = Array.isArray(market?.stocks) && market.stocks.length ? market.stocks : buildFallbackMarket(tick).stocks;
    const stocks = sortStocks(rawStocks, activeSort);
    const stock = stocks.find((item) => stockCode(item) === activeCode) || stocks[0];
    activeCode = stockCode(stock);
    chartSettings.mode = activeMode;
    chartSettings.scale = activeScale;
    chartSettings = sanitizeStockChartSettings(chartSettings);
    activeIndicators = stockToolbarIndicatorSet(chartSettings);
    const result = renderStockChart(chart, stock, tick, activeRange, {
      mode: activeMode,
      scale: activeScale,
      settings: chartSettings,
    });
    const metrics = stockTechnicalMetrics(stock, tick, activeRange);
    const marketMeta = market?.market || {};
    const displayedStockVolume = result.volume;
    const displayedMarketVolume = stockMarketDisplayVolume24h(stocks, marketMeta, tick);

    root.classList.toggle("is-live", liveMarket);
    setStockNodeText(symbol, activeCode);
    setStockNodeText(stockName, stock.name || activeCode);
    setStockNodeText(price, formatStockKrw(result.price));
    setStockNodeText(markPrice, formatStockKrw(result.price));
    setStockNodeText(change, formatStockChange(result.change));
    toggleStockNodeClass(change, "is-down", result.change < 0);
    toggleStockNodeClass(change, "is-up", result.change >= 0);
    setStockNodeText(open, formatStockKrw(stock.open24h || result.open));
    setStockNodeText(high, formatStockKrw(stock.high24h || result.price));
    setStockNodeText(low, formatStockKrw(stock.low24h || result.price));
    setStockNodeText(quoteVolume, `${formatStockNumber(displayedStockVolume)}주`);
    setStockNodeText(indexValue, formatStockNumber(marketMeta.index));
    const indexDelta = Number(marketMeta.indexChange24h || 0);
    setStockNodeText(indexChange, formatStockChange(indexDelta));
    toggleStockNodeClass(indexChange, "is-down", indexDelta < 0);
    toggleStockNodeClass(indexChange, "is-up", indexDelta >= 0);
    setStockNodeText(volume, `${formatStockNumber(displayedMarketVolume)}주`);
    setStockNodeText(cap, formatStockKrwCompact(marketMeta.marketCap));
    setStockNodeText(session, liveMarket ? marketMeta.session || "24시간 실시간" : marketMeta.session || "API 대기");
    updated.forEach((label) => {
      label.textContent = liveMarket ? `${formatStockTime(marketMeta.updatedAt)} 갱신` : "미리보기";
    });
    rangeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.stockRange === activeRange);
    });
    sortButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.stockSort === activeSort);
    });
    modeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.stockChartMode === activeMode);
    });
    scaleButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.stockScale === activeScale);
    });
    indicatorButtons.forEach((button) => {
      button.classList.toggle("is-active", activeIndicators.has(button.dataset.stockIndicator));
    });
    financialViewButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.stockFinancialView === activeFinancialView);
    });
    if (axisStart) axisStart.textContent = STOCK_RANGE_CONFIG[activeRange]?.label || `${activeRange} 전`;
    depthSettings = sanitizeStockDepthSettings({ ...depthSettings, groupSize: activeDepthGroup });
    syncDepthSettingsInputs(draftDepthSettings);
    depthModeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.stockDepthMode === depthSettings.mode);
    });
    depthGroupButtons.forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.stockDepthGroup || 1) === activeDepthGroup);
    });
    sideButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.stockOrderSide === activeSide);
    });

    const trades = selectedStockTrades(market?.recentTrades, activeCode);
    renderStockTicker(ticker, stocks, activeCode, selectStock);
    renderStockRows(list, stocks, activeCode, selectStock, tick);
    renderStockTape(tape, trades.length ? trades : market?.recentTrades);
    const chartTop = chart.closest(".stock-chart-shell")?.querySelector(".stock-chart-top");
    if (chartTop) chartTop.hidden = !chartSettings.trading.ohlc;
    if (chartReadout) chartReadout.hidden = !chartSettings.trading.ohlc;
    if (chartSettings.trading.ohlc) renderStockChartReadout(chartReadout, stock, result);
    else chartReadout?.replaceChildren();
    if (performance) performance.hidden = !chartSettings.trading.performance;
    if (chartSettings.trading.performance) renderStockPerformance(performance, stock, tick);
    else performance?.replaceChildren();
    renderStockDetail(detailElements, stock, result);
    renderStockStrength(strengthElements, stock, trades);
    const depth = renderStockOrderBookPanel(orderBook, stock, {
      panel: depthPanel,
      asksBook: orderAsks,
      ratioLabel: depthRatio,
      midPrice: depthMid,
      depthMeter,
      settings: depthSettings,
      selectedLevel: selectedDepthLevel,
      onSelect: applyDepthRowToOrder,
    });
    renderStockInfoTerminal(infoBody, stock, result, metrics, depth, stocks, marketMeta, activeInfoView);
    renderStockDataTerminal(dataAnalytics, dataSummary, dataTable, stock, result, tick, activeRange);
    renderStockPortfolio(portfolioList, portfolioBalance, portfolio, market);
    renderStockAccount(accountElements, portfolio, market);
    renderStockActivityPanel(activityBody, activityButtons, activeActivityView, portfolio, market, activeCode);
    renderExpertPanel(expertElements, metrics, depth, stock, orderElements, activeSide);
    renderStockNews(newsElements, stock, metrics, depth);
    renderStockFinancials(financialElements, stock, metrics, activeFinancialView);
    renderOrderTicket(orderElements, stock, activeSide, playerProfile, portfolio, liveMarket, orderLoading, { metrics, depth });
    syncStockMainPanels();
  }

  async function refreshMarket() {
    const payload = await fetchStockMarket();
    if (payload) {
      market = payload;
      liveMarket = true;
    } else {
      market = buildFallbackMarket(tick);
      liveMarket = false;
    }
    playerProfile = currentPlayerProfile();
    render();
  }

  async function refreshPortfolio() {
    const user = sessionUser || readStoredUser();
    const playerProfile = readPlayerProfile(user);
    if (!playerProfile?.verified || !playerProfile?.webToken || !PLAYER_API_BASES.length) {
      portfolio = null;
      render();
      return;
    }

    let errorMessage = "";
    try {
      const payload = await fetchStockPortfolio(playerProfile);
      if (payload?.ok) portfolio = payload;
    } catch (error) {
      errorMessage = error?.message || "포트폴리오를 불러오지 못했습니다.";
    } finally {
      render();
      if (errorMessage) setTradeMessage(orderElements.message, errorMessage, "error");
    }
  }

  async function refreshTradingState() {
    await refreshMarket();
    await refreshPortfolio();
  }

  function mergeTradePosition(payload) {
    if (!payload?.position) return;
    const positions = Array.isArray(portfolio?.positions) ? [...portfolio.positions] : [];
    const next = payload.position;
    const index = positions.findIndex((position) => position.symbol === next.symbol || position.code === next.symbol);
    if (index >= 0) positions[index] = next;
    else positions.push(next);
    portfolio = {
      ...(portfolio || {}),
      balance: payload.balance,
      positions,
      updatedAt: new Date().toISOString(),
    };
  }

  render();
  mainViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeMainView = button.dataset.stockMainView || "chart";
      render();
    });
  });
  infoViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeInfoView = button.dataset.stockInfoView || "coin";
      activeMainView = "info";
      render();
    });
  });
  rangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeRange = button.dataset.stockRange || "24H";
      render();
    });
  });
  sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeSort = button.dataset.stockSort || "market";
      render();
    });
  });
  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeMode = button.dataset.stockChartMode || "line";
      chartSettings.mode = activeMode;
      writeStockChartSettings(chartSettings);
      render();
    });
  });
  scaleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeScale = button.dataset.stockScale || "price";
      chartSettings.scale = activeScale;
      writeStockChartSettings(chartSettings);
      render();
    });
  });
  indicatorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const indicator = button.dataset.stockIndicator;
      if (!indicator) return;
      const nextState = !activeIndicators.has(indicator);
      setStockToolbarIndicator(chartSettings, indicator, nextState);
      activeIndicators = stockToolbarIndicatorSet(chartSettings);
      writeStockChartSettings(chartSettings);
      render();
    });
  });
  financialViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFinancialView = button.dataset.stockFinancialView || "income";
      render();
    });
  });
  activityButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeActivityView = button.dataset.stockActivityView || "positions";
      render();
    });
  });
  depthModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      depthSettings.mode = button.dataset.stockDepthMode || "both";
      depthSettings = sanitizeStockDepthSettings(depthSettings);
      draftDepthSettings = cloneStockDepthSettings(depthSettings);
      writeStockDepthSettings(depthSettings);
      render();
    });
  });
  depthGroupButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeDepthGroup = Math.max(1, Number(button.dataset.stockDepthGroup || 1));
      depthSettings.groupSize = activeDepthGroup;
      depthSettings = sanitizeStockDepthSettings(depthSettings);
      draftDepthSettings = cloneStockDepthSettings(depthSettings);
      writeStockDepthSettings(depthSettings);
      render();
    });
  });
  sideButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeSide = button.dataset.stockOrderSide || "buy";
      render();
      if (compactOrderTicket && !orderLoading) orderForm?.requestSubmit();
    });
  });
  orderElements.marginMode?.addEventListener("click", toggleMarginMode);
  orderElements.bbo?.addEventListener("click", applyBboPrice);
  orderElements.sizeStepButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      const step = Number(button.dataset.stockSizeStep || 0);
      setOrderQuantity(Number(orderElements.quantity?.value || 1) + step);
    });
  });
  orderElements.percent?.addEventListener("input", () => {
    applyOrderPercent(orderElements.percent.value);
  });
  orderElements.percentButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      applyOrderPercent(button.dataset.stockSizePercentButton || 0);
    });
  });
  [
    orderElements.quantity,
    orderElements.type,
    orderElements.limit,
    orderElements.leverage,
    orderElements.takeProfit,
    orderElements.stopLoss,
    orderElements.tpSlToggle,
    orderElements.postOnly,
    orderElements.reduceOnly,
    orderElements.timeInForce,
  ]
    .filter(Boolean)
    .forEach((element) => {
      element.addEventListener("input", render);
      element.addEventListener("change", render);
    });
  orderForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const stock = market.stocks.find((item) => stockCode(item) === activeCode) || market.stocks[0];
    const quantity = Math.max(1, Math.floor(Number(orderElements.quantity?.value || 1)));
    const orderType = orderElements.type?.value || "market";
    const limitPrice = Math.max(0, Number(orderElements.limit?.value || 0));
    const usesLimitPrice = ["limit", "stop-limit", "oco"].includes(orderType);
    const leverage = Math.max(1, Math.min(STOCK_MAX_LEVERAGE, Number(orderElements.leverage?.value || 1)));
    const takeProfit = Math.max(0, Number(orderElements.takeProfit?.value || 0));
    const stopLoss = Math.max(0, Number(orderElements.stopLoss?.value || 0));
    const tpSlEnabled = orderElements.tpSlToggle ? Boolean(orderElements.tpSlToggle.checked) : true;
    const sideLabel = activeSide === "buy" ? "매수" : "매도";
    playerProfile = currentPlayerProfile();
    const canTrade = Boolean(playerProfile?.verified && playerProfile?.webToken && PLAYER_API_BASES.length && liveMarket && stock);
    if (!canTrade) {
      render();
      setTradeMessage(
        orderElements.message,
        !PLAYER_API_BASES.length
          ? "실시간 주문에는 API 연결이 필요합니다."
          : !liveMarket
            ? "실시간 시장 데이터를 불러오는 중입니다. 잠시 후 다시 시도하세요."
            : "실시간 주문은 로그인과 캐릭터 인증 후 사용할 수 있습니다.",
        PLAYER_API_BASES.length ? "info" : "error",
      );
      return;
    }
    orderLoading = true;
    if (orderElements.submit) orderElements.submit.disabled = true;
    render();
    try {
      const payload = await submitStockTrade(playerProfile, stockCode(stock), activeSide, quantity, {
        orderType,
        limitPrice: usesLimitPrice && limitPrice > 0 ? limitPrice : undefined,
        leverage,
        takeProfit: tpSlEnabled && takeProfit > 0 ? takeProfit : undefined,
        stopLoss: tpSlEnabled && stopLoss > 0 ? stopLoss : undefined,
        postOnly: orderElements.postOnly?.value === "on",
        reduceOnly: orderElements.reduceOnly?.value === "on",
        timeInForce: orderElements.timeInForce?.value || "GTC",
        marginMode: orderElements.marginMode?.dataset.stockMarginMode || "cross",
      });
      if (payload?.market?.ok) {
        market = payload.market;
        liveMarket = true;
      }
      mergeTradePosition(payload);
      portfolio = await fetchStockPortfolio(playerProfile).catch(() => portfolio);
      orderLoading = false;
      render();
      setTradeMessage(orderElements.message, `${activeCode} ${sideLabel} ${formatStockNumber(quantity)}주 체결 완료`, "success");
    } catch (error) {
      orderLoading = false;
      render();
      setTradeMessage(orderElements.message, error?.message || "주문을 처리하지 못했습니다.", "error");
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === AUTH_STORAGE_KEY || event.key === AUTH_EVENT_KEY || event.key === PLAYER_PROFILES_KEY) {
      playerProfile = currentPlayerProfile();
      renderStockAuthLink(sessionUser || readStoredUser());
      refreshPortfolio();
    }
  });
  startVisiblePoll(refreshTradingState, 20000);
  if (!reduceMotion) {
    startVisiblePoll(
      () => {
        tick += 1;
        if (!liveMarket) {
          market = buildFallbackMarket(tick);
          render();
        }
      },
      3200,
      { immediate: false },
    );
  }
}

function initScrollReveal() {
  const targets = document.querySelectorAll("[data-reveal]");
  if (!targets.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Opt into the hidden start state only now that JS runs, so no-JS visitors keep their content.
  document.documentElement.classList.add("js-reveal");

  if (reduceMotion || typeof IntersectionObserver === "undefined") {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        entry.target.addEventListener(
          "transitionend",
          () => {
            entry.target.classList.add("reveal-done");
          },
          { once: true },
        );
        obs.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );

  targets.forEach((el) => observer.observe(el));
}

function loadScene() {
  const canvas = document.querySelector("#minecraft-scene");
  if (!(canvas instanceof HTMLCanvasElement)) return;

  // Skip the heavy WebGL bundle entirely on Data Saver — the CSS gradient sky stands in.
  if (navigator.connection?.saveData) {
    canvas.remove();
    return;
  }

  // Dynamic import keeps three.js (~540kB) out of the initial bundle.
  import("./scene.js")
    .then((module) => module.initMinecraftScene(canvas))
    .catch(() => {
      // Scene is decorative; the CSS hero sky remains if it fails to load.
    });
}

function deferSceneLoad() {
  const canvas = document.querySelector("#minecraft-scene");
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const schedule = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadScene, { timeout: 1200 });
    } else {
      window.setTimeout(loadScene, 250);
    }
  };

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
}

function readUserBoardPosts(board) {
  try {
    const raw = localStorage.getItem(`nfoifsb.userPosts.${board}`);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((post) => post && post.title && post.body) : [];
  } catch {
    return [];
  }
}

function writeUserBoardPosts(board, posts) {
  try {
    localStorage.setItem(`nfoifsb.userPosts.${board}`, JSON.stringify(posts.slice(0, 40)));
    return true;
  } catch {
    return false;
  }
}

function userPostUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("/") || /^https?:\/\//i.test(text)) return text;
  return "";
}

function renderUserBoardPosts(root, posts) {
  const list = root.querySelector("[data-user-post-list]");
  if (!list) return;
  if (!posts.length) {
    const empty = document.createElement("article");
    empty.className = "user-post-card";
    const label = document.createElement("span");
    label.textContent = root.dataset.userPostLabel || "게시판";
    const title = document.createElement("strong");
    title.textContent = "아직 작성된 글이 없습니다.";
    const body = document.createElement("p");
    body.textContent = "첫 글을 작성하면 이곳에 바로 표시됩니다.";
    empty.replaceChildren(label, title, body);
    list.replaceChildren(empty);
    return;
  }

  list.replaceChildren(
    ...posts.map((post) => {
      const card = document.createElement("article");
      card.className = "user-post-card";
      const head = document.createElement("header");
      const category = document.createElement("span");
      category.textContent = post.category || root.dataset.userPostLabel || "게시글";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "삭제";
      remove.addEventListener("click", () => {
        const board = root.dataset.userPosts;
        const nextPosts = readUserBoardPosts(board).filter((item) => item.id !== post.id);
        writeUserBoardPosts(board, nextPosts);
        renderUserBoardPosts(root, nextPosts);
      });
      head.replaceChildren(category, remove);

      const title = document.createElement("strong");
      title.textContent = post.title;
      const meta = document.createElement("small");
      meta.textContent = `${post.author || "익명"} · ${post.createdAt || "방금"}`;
      const body = document.createElement("p");
      body.textContent = post.body;
      card.append(head, title, meta, body);

      const href = userPostUrl(post.url);
      if (href) {
        const link = document.createElement("a");
        link.href = href;
        link.textContent = "자료 열기";
        card.append(link);
      }
      return card;
    }),
  );
}

function initUserPosts() {
  document.querySelectorAll("[data-user-posts]").forEach((root) => {
    const board = root.dataset.userPosts;
    const form = root.querySelector("[data-user-post-form]");
    if (!board || !form) return;
    const status = root.querySelector("[data-user-post-status]");
    let posts = readUserBoardPosts(board);
    renderUserBoardPosts(root, posts);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const title = form.querySelector("[data-user-post-title]")?.value?.trim() || "";
      const body = form.querySelector("[data-user-post-body]")?.value?.trim() || "";
      const author = form.querySelector("[data-user-post-author]")?.value?.trim() || "익명";
      const category = form.querySelector("[data-user-post-category]")?.value?.trim() || root.dataset.userPostLabel || "게시글";
      const url = userPostUrl(form.querySelector("[data-user-post-url]")?.value);
      if (!title || !body) {
        if (status) status.textContent = "제목과 내용을 입력하세요.";
        return;
      }
      const post = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        author,
        body,
        category,
        createdAt: new Intl.DateTimeFormat("ko-KR", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Seoul",
        }).format(new Date()),
        title,
        url,
      };
      posts = [post, ...readUserBoardPosts(board)].slice(0, 40);
      if (!writeUserBoardPosts(board, posts)) {
        if (status) status.textContent = "브라우저 저장 공간이 부족해 글을 저장하지 못했습니다.";
        return;
      }
      form.reset();
      if (status) status.textContent = "게시글이 등록되었습니다.";
      renderUserBoardPosts(root, posts);
    });
  });
}

document.querySelectorAll("[data-copy-address]").forEach((button) => {
  button.addEventListener("click", copyAddress);
});

initTheme();
initNav();
initPageNavigation();
initStockExchange();
initAnimationStagger();
initUserPosts();
initScrollReveal();
initLogin();
deferSceneLoad();
if (statusDot || cacheState) {
  startVisiblePoll(refreshStatus, 60000);
}
if (hasRamWidgets()) {
  startVisiblePoll(refreshServerOverview, SERVER_OVERVIEW_INTERVAL_MS);
}
