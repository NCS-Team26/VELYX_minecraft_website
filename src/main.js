import "./styles.css";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
} from "lightweight-charts";

const SERVER_ADDRESS = "nfoifsb.kr";
const STATUS_API = `https://api.mcstatus.io/v2/status/java/${SERVER_ADDRESS}`;
const STATUS_TIMEOUT_MS = 8000;
const PUBLIC_PLAYER_API_BASE = "/minecraft";
const FUNNEL_PLAYER_API_BASE = "https://minecraftserver1.tail16d543.ts.net/minecraft";
const LEGACY_PLAYER_API_BASE = "https://api.nfoifsb.kr/minecraft";
const isHostedSite = ["www.nfoifsb.kr", "nfoifsb.kr"].includes(window.location.hostname);
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
const stockAuthLink = document.querySelector("[data-stock-auth-link]");
const AUTH_STORAGE_KEY = "nfoifsb.googleUser";
const AUTH_EVENT_KEY = "nfoifsb.authEvent";
const PLAYER_PROFILES_KEY = "nfoifsb.playerProfiles";
const STATUS_CACHE_KEY = "nfoifsb.statusCache";
const PLAYER_HISTORY_KEY = "nfoifsb.playerHistory";
const PLAYER_HISTORY_MAX = 48;
const STOCKS = [
  { code: "DMD", name: "다이아 광산", base: 3420, volume: 8420, drift: 0.048, volatility: 0.022, marketBeta: 1.45 },
  { code: "FARM", name: "농산물 조합", base: 1280, volume: 12650, drift: 0.019, volatility: 0.016, marketBeta: 1.05 },
  { code: "LOG", name: "건축 목재", base: 890, volume: 9340, drift: -0.012, volatility: 0.019, marketBeta: 1.22 },
  { code: "RED", name: "레드스톤 공업", base: 2160, volume: 7990, drift: 0.033, volatility: 0.024, marketBeta: 1.55 },
];
const STOCK_MARKET_VOLATILITY_PROFILE = {
  sp500: 0.012,
  nasdaq: 0.019,
  russell1000: 0.017,
  technicalSwing: 0.028,
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
const STOCK_RANGE_CONFIG = {
  "1M": { points: 10, stepMs: 60_000, label: "1분 전" },
  "5M": { points: 16, stepMs: 60_000, label: "5분 전" },
  "15M": { points: 24, stepMs: 60_000, label: "15분 전" },
  "30M": { points: 32, stepMs: 60_000, label: "30분 전" },
  "1H": { points: 40, stepMs: 90_000, label: "1시간 전" },
  "5H": { points: 56, stepMs: 5 * 60_000, label: "5시간 전" },
  "1D": { points: 96, stepMs: 15 * 60_000, label: "1일 전" },
  "1W": { points: 160, stepMs: 60 * 60_000, label: "1주 전" },
  "1MO": { points: 240, stepMs: 3 * 60 * 60_000, label: "1달 전" },
  ALL: { points: Infinity, stepMs: 15 * 60_000, label: "전체" },
};
const PAGE_LINKS = new Map([
  ["/status.html", "status"],
  ["/plugins.html", "plugins"],
  ["/stock.html", "stock"],
  ["/rules.html", "rules"],
  ["/join.html", "join"],
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

function renderAuthState(user = sessionUser || readStoredUser()) {
  renderStockAuthLink(user);
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

  const close = () => {
    nav.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "메뉴 열기");
  };

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
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

function stockCode(stock) {
  return stock?.symbol || stock?.code || "";
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
  const history = Array.isArray(stock?.history) ? stock.history : [];
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

function sortStocks(stocks, sortMode) {
  const sorted = [...stocks];
  if (sortMode === "change") {
    sorted.sort((left, right) => Number(right.change24h || 0) - Number(left.change24h || 0));
  } else if (sortMode === "volume") {
    sorted.sort((left, right) => Number(right.volume24h || 0) - Number(left.volume24h || 0));
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
    throw new Error("VITE_PLAYER_API_BASE가 연결되면 실제 매수/매도가 활성화됩니다.");
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
    const trend = drift * (index / Math.max(1, count - 1));
    const price = Math.max(1, base * (1 + wave + pulse + momentum + breakout + trend));
    const volume = 30 + Math.abs(Math.sin(index * 0.7 + tick + base)) * 72 + Math.abs(momentum + breakout) * 1800;
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
  const history = Array.isArray(stock?.history) ? stock.history : [];
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

  if (series.length >= 2) return rangedStockSeries(series, range);
  const target = STOCK_RANGE_CONFIG[range]?.points || STOCK_RANGE_CONFIG["1D"].points;
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
    { key: "morning", label: "아침 뉴스", hour: 8 },
    { key: "lunch", label: "점심 뉴스", hour: 12 },
    { key: "evening", label: "저녁 뉴스", hour: 18 },
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
    cadence: "매일 08:00 · 12:00 · 18:00 KST",
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
  }[code] || "시장 수급";
}

function stockNewsImagesFor(code) {
  const images = STOCK_NEWS_IMAGES[code] || STOCK_NEWS_IMAGES.DEFAULT;
  return images.length ? images : STOCK_NEWS_IMAGES.DEFAULT;
}

function buildStockNewsDetails(article, context) {
  const { code, name, week, topic, change, bidRatio, volatility, quality } = context;
  const priceDirection = change >= 0 ? "상승" : "하락";
  const orderBookTone = bidRatio >= 55 ? "매수 호가가 우위에 있어 단기 체결 안정성이 높습니다" : "매수 호가가 얇아져 분할 진입과 손절가 관리가 필요합니다";
  const financialTone =
    quality.qualityScore >= 76
      ? "재무 품질은 전문가 관점에서도 공격적인 비중 확대를 검토할 수 있는 구간입니다"
      : quality.qualityScore >= 62
        ? "재무 품질은 중립 이상이지만 변동성 관리가 같이 필요합니다"
        : "재무 품질은 아직 방어적으로 확인해야 하는 구간입니다";

  return [
    `${name}(${code})의 ${week.label} 핵심 이슈는 ${topic}입니다. 이번 기사에서는 ${article.tag} 관점으로 가격 ${priceDirection}률 ${formatStockPercent(change, 1, true)}, 변동성 ${formatStockPercent(volatility)}, 오더북 매수 압력 ${Math.round(bidRatio)}%를 함께 반영했습니다.`,
    `호가창 기준으로는 ${orderBookTone}. 시장가 주문보다 지정가·분할 주문을 우선 확인하고, 돌파 구간에서는 체결강도와 실시간 거래량이 동반되는지 보는 것이 중요합니다.`,
    `AI 재무제표는 ${quality.quarterMeta.label} 기준 매출 ${formatStockKrwCompact(quality.latest.revenue)}, 영업이익률 ${formatStockPercent(quality.latest.operatingMargin)}, FCF Yield ${formatStockPercent(quality.latest.fcfYield)}, 부채비율 ${formatStockPercent(quality.latest.debtRatio)}로 계산됐습니다. ${financialTone}.`,
    `다음 자동 뉴스 생성일은 ${week.nextUpdate} KST입니다. 그 전까지는 ${topic}, ${article.impact}, 거래량 변화, 레버리지 포지션 쏠림을 주요 체크포인트로 추적하세요.`,
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
  const demandWord = pickStockNewsValue(["거래량", "호가 잔량", "체결강도", "회차 수급"], seed, 1);
  const riskWord = pickStockNewsValue(["재고 부담", "단기 과열", "레버리지 쏠림", "마진 둔화"], seed, 2);
  const goodImpact = Math.max(1.2, Math.abs(change) * 0.42 + quality.latest.fcfYield * 0.12 + 1.4);
  const badImpact = -(Math.max(0.8, volatility * 0.26 + Math.abs(50 - bidRatio) * 0.05));
  const articles = [
    {
      tone: isBullish ? "good" : "bad",
      tag: isBullish ? "호재" : "악재",
      title: isBullish
        ? `${name}, ${topic} 개선으로 이번 주 매수 관심 확대`
        : `${name}, ${riskWord} 이슈로 단기 변동성 경계`,
      summary: isBullish
        ? `${demandWord} 지표와 Quality Score ${quality.qualityScore}점이 동시에 개선되며 ${code}의 단기 투자 심리가 강해졌습니다.`
        : `${formatStockPercent(volatility)} 변동성과 ${riskWord} 신호가 겹치며 ${code} 단기 포지션 관리 필요성이 커졌습니다.`,
      impact: isBullish ? `예상 영향 +${goodImpact.toFixed(1)}%` : `예상 영향 ${badImpact.toFixed(1)}%`,
    },
    {
      tone: bidRatio >= 55 ? "good" : "bad",
      tag: bidRatio >= 55 ? "호재" : "악재",
      title: bidRatio >= 55 ? `오더북 매수 압력 ${Math.round(bidRatio)}%, ${code} 유동성 개선` : `매수 압력 ${Math.round(bidRatio)}%, ${code} 호가 공백 주의`,
      summary: bidRatio >= 55
        ? `매수 잔량이 우위를 보이며 지정가 체결 안정성이 높아졌습니다. 단기 돌파 시 거래량 확인이 핵심입니다.`
        : `호가 하단 방어가 약해질 수 있어 시장가 진입보다 분할 주문과 손절가 관리가 유리합니다.`,
      impact: bidRatio >= 55 ? `수급 점수 +${Math.round(bidRatio - 50)}` : `수급 점수 -${Math.max(1, Math.round(Math.abs(50 - bidRatio)))}`,
    },
    {
      tone: quality.latest.fcfYield >= 5 ? "good" : "neutral",
      tag: quality.latest.fcfYield >= 5 ? "호재" : "중립",
      title: `${name} AI 재무 업데이트, FCF Yield ${formatStockPercent(quality.latest.fcfYield)}`,
      summary: `${quality.quarterMeta.label} 기준 영업이익률 ${formatStockPercent(quality.latest.operatingMargin)}, 부채비율 ${formatStockPercent(quality.latest.debtRatio)}로 산출됐습니다. 다음 분기 업데이트는 ${quality.quarterMeta.nextUpdate}입니다.`,
      impact: quality.valuationLabel,
    },
    {
      tone: volatility >= 7 ? "bad" : "neutral",
      tag: volatility >= 7 ? "악재" : "중립",
      title: `${week.label} 체크포인트: ${topic}, ${riskWord}, 거래량`,
      summary: `AI 뉴스룸은 매일 아침·점심·저녁 KST 기준으로 새 이슈를 생성합니다. 이번 ${week.label} ${code}는 ${formatStockPercent(change, 1, true)} 가격 변동과 ${formatStockPercent(volatility)} 변동성을 함께 확인해야 합니다.`,
      impact: `다음 생성 ${week.nextUpdate}`,
    },
  ];

  return {
    week,
    code,
    name,
    title: `${name} AI 뉴스룸`,
    summary: `${week.range} 서버 거래 데이터, 오더북, 재무 품질을 반영해 호재·악재 뉴스를 자동 생성했습니다.`,
    articles: articles.map((article, index) => {
      const images = stockNewsImagesFor(code);
      return {
        ...article,
        image: images[index % images.length],
        details: buildStockNewsDetails(article, { code, name, week, topic, change, bidRatio, volatility, quality }),
        source: "AI MARKET DESK",
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
  const marketCapInput = Number(stock?.marketCap);
  const fallbackShares = Number.isFinite(rawShares) && rawShares > 0 ? rawShares : Math.max(1000, Math.round(Number(stock?.volume24h || 0) / 3));
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
    marketCap * (0.68 + seed * 0.28) + price * Math.max(1, Number(stock?.volume24h || stock?.volume || 1)) * 0.012,
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
  const qualityLabel = qualityScore >= 82 ? "A급 복합 우량" : qualityScore >= 70 ? "안정 성장" : qualityScore >= 58 ? "중립 관찰" : "리스크 점검";
  const valuationLabel = latest.per && latest.per < 12 && latest.fcfYield > 4 ? "저평가 매력" : latest.per && latest.per > 24 ? "프리미엄 구간" : "적정 밸류";

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
    summary: `${stock?.name || code}의 ${quarterMeta.label} AI 분기 실적은 ${formatStockPercent(latest.revenueGrowth, 1, true)} 분기 매출 성장과 ${formatStockPercent(latest.operatingMargin)} 영업이익률을 기록했습니다. ${qualityLabel}·${valuationLabel} 구간이며, 다음 자동 업데이트는 ${quarterMeta.nextUpdate}입니다.`,
  };
}

function financialStatementRows(financials, view) {
  const periods = financials.periods;
  const row = (label, key, format = "krw") => ({ label, format, values: periods.map((period) => period[key]) });
  if (view === "balance") {
    return [
      row("현금성자산", "cash"),
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
      row("영업활동현금흐름", "operatingCashFlow"),
      row("CAPEX", "capex"),
      row("잉여현금흐름", "freeCashFlow"),
      row("재무활동현금흐름", "financingCashFlow"),
      row("감가상각", "depreciation"),
      row("FCF 마진", "fcfMargin", "percent"),
      row("현금전환율", "cashConversion", "percent"),
      row("FCF Yield", "fcfYield", "percent"),
    ];
  }
  if (view === "valuation") {
    return [
      row("시가총액", "marketCap"),
      row("기업가치(EV)", "enterpriseValue"),
      row("PER", "per", "multiple"),
      row("PBR", "pbr", "multiple"),
      row("PSR", "psr", "multiple"),
      row("EV/EBITDA", "evEbitda", "multiple"),
      row("ROE", "roe", "percent"),
      row("ROA", "roa", "percent"),
      row("ROIC", "roic", "percent"),
      row("FCF Yield", "fcfYield", "percent"),
    ];
  }
  return [
    row("매출액", "revenue"),
    row("분기 매출 성장률", "revenueGrowth", "percent-signed"),
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
    mode.textContent = "AI 분기 자동작성";
    const period = document.createElement("strong");
    period.textContent = financials.quarterMeta.label;
    const next = document.createElement("em");
    next.textContent = `KST ${financials.quarterMeta.generatedAt} 생성 · 다음 업데이트 ${financials.quarterMeta.nextUpdate}`;
    elements.clock.append(mode, period, next);
  }
  if (elements.score) {
    elements.score.style.setProperty("--score", `${financials.qualityScore}%`);
    elements.score.replaceChildren();
    const label = document.createElement("span");
    label.textContent = "Quality Score";
    const value = document.createElement("strong");
    value.textContent = String(financials.qualityScore);
    const tone = document.createElement("em");
    tone.textContent = financials.qualityLabel;
    elements.score.append(label, value, tone);
  }
  if (elements.kpis) {
    const kpis = [
      ["매출", formatStockKrwCompact(latest.revenue), `QoQ ${formatStockPercent(latest.revenueGrowth, 1, true)}`, latest.revenueGrowth],
      ["영업이익률", formatStockPercent(latest.operatingMargin), `순이익률 ${formatStockPercent(latest.netMargin)}`, latest.operatingMargin - 12],
      ["FCF", formatStockKrwCompact(latest.freeCashFlow), `FCF 마진 ${formatStockPercent(latest.fcfMargin)}`, latest.freeCashFlow],
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
    elements.diagnosis.textContent = `전문가 메모: ${financials.qualityLabel}. 성장성 ${Math.round(financials.health.growth)}점, 수익성 ${Math.round(financials.health.profitability)}점, 안정성 ${Math.round(financials.health.stability)}점입니다. 거래 전에는 오더북 압력과 FCF 변화를 함께 확인하세요.`;
  }
  if (elements.ratios) {
    const ratioRows = [
      ["부채비율", formatStockPercent(latest.debtRatio)],
      ["유동비율", formatStockPercent(latest.currentRatio)],
      ["FCF Yield", formatStockPercent(latest.fcfYield)],
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
    elements.modalImage.src = article.image.src;
    elements.modalImage.alt = `${news.name} ${article.tag} 상세 뉴스 이미지`;
    elements.modalImage.style.objectPosition = article.image.position;
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
  if (elements.week) elements.week.textContent = `${news.week.label} · 매일 3회 자동생성`;
  if (elements.code) elements.code.textContent = `${news.code} NEWSROOM`;
  if (elements.title) elements.title.textContent = news.title;
  if (elements.summary) elements.summary.textContent = news.summary;
  if (elements.clock) {
    elements.clock.replaceChildren();
    const mode = document.createElement("span");
    mode.textContent = "AI 데일리 자동생성";
    const cycle = document.createElement("strong");
    cycle.textContent = news.week.cadence;
    const next = document.createElement("em");
    next.textContent = `KST 다음 생성 ${news.week.nextUpdate}`;
    elements.clock.append(mode, cycle, next);
  }

  elements.list.replaceChildren(
    ...news.articles.map((article, index) => {
      const card = document.createElement("article");
      card.className = `stock-news-card is-${article.tone}`;
      if (index === 0) card.classList.add("is-lead");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `${article.title} 상세 기사 열기`);
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
      image.src = article.image.src;
      image.alt = `${news.name} ${article.tag} 뉴스 이미지`;
      image.loading = "eager";
      image.decoding = "async";
      image.style.objectPosition = article.image.position;
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
      background: { type: ColorType.Solid, color: "#ffffff" },
      textColor: "#34423c",
      fontSize: 12,
      fontFamily: "Inter, Pretendard, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    },
    grid: {
      vertLines: { color: "rgba(45, 58, 51, 0.07)" },
      horzLines: { color: "rgba(45, 58, 51, 0.08)" },
    },
    localization: {
      priceFormatter: (value) => formatStockKrw(value),
    },
    rightPriceScale: {
      borderColor: "rgba(45, 58, 51, 0.16)",
      scaleMargins: { top: 0.08, bottom: 0.28 },
    },
    timeScale: {
      borderColor: "rgba(45, 58, 51, 0.14)",
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
        color: "rgba(35, 43, 39, 0.52)",
        labelBackgroundColor: "#232b27",
        style: 2,
      },
      horzLine: {
        color: "rgba(35, 43, 39, 0.52)",
        labelBackgroundColor: "#232b27",
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
    upColor: "#e11900",
    downColor: "#1f9ae0",
    borderUpColor: "#151d1a",
    borderDownColor: "#151d1a",
    wickUpColor: "#e11900",
    wickDownColor: "#1f9ae0",
    priceLineColor: "#232b27",
  });
  const line = addStockSeries(chart, LineSeries, {
    color: "#1467d9",
    lineWidth: 3,
    priceLineColor: "#232b27",
    visible: false,
  });
  const area = addStockSeries(chart, AreaSeries, {
    lineColor: "#1467d9",
    topColor: "rgba(20, 103, 217, 0.30)",
    bottomColor: "rgba(20, 103, 217, 0.02)",
    lineWidth: 3,
    priceLineColor: "#232b27",
    visible: false,
  });
  const volume = addStockSeries(chart, HistogramSeries, {
    priceFormat: { type: "volume" },
    priceScaleId: "",
    lastValueVisible: false,
    priceLineVisible: false,
  });
  const ma5 = addStockSeries(chart, LineSeries, {
    color: "#d98913",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  const ma20 = addStockSeries(chart, LineSeries, {
    color: "#7c5cff",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  const vwap = addStockSeries(chart, LineSeries, {
    color: "#0f9ba8",
    lineWidth: 2,
    lineStyle: 2,
    priceLineVisible: false,
    lastValueVisible: false,
  });

  chart.priceScale("").applyOptions({
    scaleMargins: { top: 0.80, bottom: 0 },
  });

  const state = {
    area,
    candle,
    chart,
    chartMount,
    container,
    dataByTime: new Map(),
    line,
    ma5,
    ma20,
    tooltip: container.querySelector("[data-stock-chart-tooltip]"),
    vwap,
    volume,
    viewKey: "",
  };

  chart.subscribeCrosshairMove((param) => renderStockChartTooltip(state, param));
  stockChartStates.set(container, state);
  return state;
}

function setStockSeriesVisible(state, mode) {
  state.candle.applyOptions({ visible: mode === "candle" });
  state.line.applyOptions({ visible: mode === "line" });
  state.area.applyOptions({ visible: mode === "area" });
}

function renderStockChartTooltip(state, param) {
  const { container, tooltip } = state;
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
  const rows = stockChartRows(series, selectedRange, options.scale);
  const last = rows.at(-1) || rows[0];
  const first = rows[0] || last;
  const indicators = options.indicators || new Set();
  const chartMode = options.mode || "candle";
  const state = stockChartStates.get(container) || createStockChartState(container);
  const priceFormatter = options.scale === "percent" ? (value) => `${value.toFixed(2)}%` : (value) => formatStockKrw(value);
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
    color: point.close >= point.open ? "rgba(225, 25, 0, 0.38)" : "rgba(31, 154, 224, 0.42)",
  }));
  const basePrice = Math.max(1, Number(series[0]?.price || series[0]?.close) || 1);
  const closes = rows.map((point) => point.close);
  const toLineData = (values) =>
    values.map((value, index) => ({
      time: rows[index].time,
      value: stockChartValue(value, basePrice, options.scale),
    }));

  state.dataByTime = new Map(rows.map((point) => [String(point.time), point]));
  state.chart.applyOptions({
    localization: { priceFormatter },
    rightPriceScale: { scaleMargins: { top: 0.08, bottom: 0.28 } },
  });
  state.candle.setData(candleData);
  state.line.setData(lineData);
  state.area.setData(lineData);
  state.volume.setData(volumeData);
  state.ma5.setData(indicators.has("ma5") ? toLineData(movingAverage(closes, 5)) : []);
  state.ma20.setData(indicators.has("ma20") ? toLineData(movingAverage(closes, 20)) : []);
  state.vwap.setData(indicators.has("vwap") ? toLineData(vwapSeries(rows)) : []);
  setStockSeriesVisible(state, chartMode);

  const nextViewKey = `${stockCode(stock)}:${selectedRange}:${chartMode}:${options.scale}`;
  if (state.viewKey !== nextViewKey) {
    state.chart.timeScale().fitContent();
    state.viewKey = nextViewKey;
  }

  return {
    price: Number(stock.price ?? last?.close ?? 0),
    change: Number(stock.change24h ?? (((last?.close || 0) - (first?.open || 1)) / Math.max(1, first?.open || 1)) * 100),
    volume: Number(stock.volume24h ?? rows.reduce((sum, point) => sum + point.volume, 0)),
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
    ["1일", 24 * 60 * 60_000],
    ["1주", 7 * 24 * 60 * 60_000],
    ["1달", 30 * 24 * 60 * 60_000],
    ["3달", 90 * 24 * 60 * 60_000],
    ["6달", 180 * 24 * 60 * 60_000],
    ["1년", 365 * 24 * 60 * 60_000],
    ["5년", 5 * 365 * 24 * 60 * 60_000],
    ["최대", 0],
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
    label.textContent = PLAYER_API_BASES.length ? "실제 체결 대기" : "API 연결 전";
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
      label.textContent = `${row.playerName || "Player"} ${row.symbol || row.code} ${buy ? "매수" : "매도"}`;
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
      label.textContent = code;
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

function renderStockRows(list, stocks, activeCode, onSelect) {
  const rows = stocks.map((stock) => {
    const code = stockCode(stock);
    const changePercent = Number(stock.change24h || 0);
    const changeAmount = stockChangeValue(stock);
    const high = Number(stock.high24h || stock.price);
    const low = Number(stock.low24h || stock.price);
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
        { text: `${formatStockNumber(stock.volume24h)}주`, className: "stock-num" },
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

  const volume = Math.max(20, Number(stock?.volume24h || stock?.volume || 1200));
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

function buildStockDepth(stock, groupSize = 1) {
  const price = Math.max(1, Number(stock.price) || 1);
  const volume = Math.max(10, Number(stock.volume24h) || 1200);
  const group = Math.max(1, Number(groupSize) || 1);
  const spread = Math.max(group, price * 0.0025);
  const bestAsk = Math.ceil((price + spread / 2) / group) * group;
  const bestBid = Math.max(group, Math.floor((price - spread / 2) / group) * group);
  const asks = [];
  const bids = [];

  Array.from({ length: 8 }, (_, index) => {
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
    spread.textContent = `스프레드 ${formatStockKrw(depth.spread)} · ${depth.spreadPercent.toFixed(2)}%`;
    options.midPrice.append(price, spread);
  }
  if (options.ratioLabel) {
    options.ratioLabel.textContent = `매수 ${depth.bidRatio}%`;
  }
  if (options.depthMeter) {
    const fill = options.depthMeter.querySelector("span");
    const label = options.depthMeter.querySelector("em");
    if (fill) fill.style.width = `${depth.bidRatio}%`;
    if (label) label.textContent = `매수 압력 ${depth.bidRatio}% · 매도 ${100 - depth.bidRatio}%`;
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
  if (!positions.length) {
    const item = document.createElement("li");
    item.className = "is-empty";
    item.innerHTML = "<span>보유 종목 없음</span><strong>--</strong>";
    list.replaceChildren(item);
    return;
  }
  const stocks = Array.isArray(market?.stocks) ? market.stocks : [];
  list.replaceChildren(
    ...positions.map((position) => {
      const code = position.symbol || position.code;
      const stock = stocks.find((item) => stockCode(item) === code);
      const shares = Number(position.shares ?? position.quantity ?? 0);
      const value = Number(position.value ?? shares * Number(stock?.price || position.price || 0));
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `${code} · ${stock?.name || position.name || "포지션"}`;
      const amount = document.createElement("strong");
      amount.textContent = `${formatStockNumber(shares)}주`;
      const detail = document.createElement("em");
      detail.textContent = formatStockKrw(value);
      item.append(label, amount, detail);
      return item;
    }),
  );
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
  if (score >= 3.5) return "중간";
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
    const leverage = Math.max(1, Math.min(5, Number(orderElements?.leverage?.value || 1)));
    const liq = liquidationPrice(price, leverage, activeSide);
    const risk = orderRiskLabel(leverage, metrics.volatility, depth);
    const pressure = `매수 ${depth?.bidRatio ?? 50}%`;
    const rows = [
      ["예상 청산가", liq ? formatStockKrw(liq) : "현물 없음"],
      ["위험도", risk],
      ["오더북 압력", pressure],
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

function renderOrderTicket(elements, stock, side, playerProfile, portfolio, liveMarket = false, loading = false, expert = {}) {
  if (!elements?.root || !stock) return;
  const quantity = Math.max(1, Math.floor(Number(elements.quantity?.value || 1)));
  const price = Math.max(1, Number(stock.price) || 1);
  const orderType = elements.type?.value || "market";
  const limitPrice = Math.max(0, Number(elements.limit?.value || 0));
  const usesLimitPrice = ["limit", "stop-limit", "oco"].includes(orderType);
  const executionPrice = usesLimitPrice && limitPrice > 0 ? limitPrice : price;
  const leverage = Math.max(1, Math.min(5, Number(elements.leverage?.value || 1)));
  const takeProfit = Math.max(0, Number(elements.takeProfit?.value || 0));
  const stopLoss = Math.max(0, Number(elements.stopLoss?.value || 0));
  const feeRate = 0.003;
  const notional = executionPrice * quantity;
  const margin = notional / leverage;
  const fee = notional * feeRate;
  const total = side === "sell" ? notional - fee : margin + fee;
  const position = stockPosition(portfolio, stockCode(stock));
  const canTrade = Boolean(playerProfile?.verified && playerProfile?.webToken && PLAYER_API_BASES.length && liveMarket && stock && !loading);
  const liq = liquidationPrice(executionPrice, leverage, side);
  const risk = orderRiskLabel(leverage, expert.metrics?.volatility, expert.depth);

  if (elements.symbol) elements.symbol.textContent = stockCode(stock);
  if (elements.side) elements.side.textContent = side === "sell" ? "매도" : "매수";
  if (elements.estimate) {
    elements.estimate.replaceChildren();
    [
      ["예상 체결가", formatStockKrw(executionPrice)],
      ["주문 수량", `${formatStockNumber(quantity)}주`],
      ["레버리지", `${leverage}x`],
      ["주문 금액", formatStockKrw(notional)],
      ["필요 증거금", formatStockKrw(margin)],
      ["수수료", formatStockKrw(fee)],
      [side === "sell" ? "예상 입금" : "예상 필요", formatStockKrw(total)],
      ["청산가", liq ? formatStockKrw(liq) : "현물 없음"],
      ["위험도", risk],
      ["TP / SL", `${takeProfit ? formatStockKrw(takeProfit) : "--"} / ${stopLoss ? formatStockKrw(stopLoss) : "--"}`],
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
        ? "주문 전송 중입니다."
        : !PLAYER_API_BASES.length
        ? "API 연결 전에는 미리보기만 가능합니다."
        : !liveMarket
          ? "실시간 주식 API를 불러오는 중입니다. 잠시 후 다시 시도해 주세요."
          : "로그인 후 캐릭터 인증을 완료하면 주문 버튼이 활성화됩니다.",
      PLAYER_API_BASES.length ? "info" : "error",
    );
  }
}

function initStockExchange() {
  const root = document.querySelector("[data-stock-exchange]");
  const chart = document.querySelector("[data-stock-chart]");
  const list = document.querySelector("[data-stock-list]");
  if (!root || !chart || !list) return;

  const ticker = document.querySelector("[data-stock-ticker]");
  const price = document.querySelector("[data-stock-price]");
  const change = document.querySelector("[data-stock-change]");
  const symbol = document.querySelector("[data-stock-symbol]");
  const stockName = document.querySelector("[data-stock-name]");
  const open = document.querySelector("[data-stock-open]");
  const high = document.querySelector("[data-stock-high]");
  const low = document.querySelector("[data-stock-low]");
  const quoteVolume = document.querySelector("[data-stock-quote-volume]");
  const indexValue = document.querySelector("[data-stock-index]");
  const indexChange = document.querySelector("[data-stock-index-change]");
  const volume = document.querySelector("[data-stock-volume]");
  const cap = document.querySelector("[data-stock-cap]");
  const session = document.querySelector("[data-stock-session]");
  const updated = document.querySelectorAll("[data-stock-updated]");
  const rangeButtons = document.querySelectorAll("[data-stock-range]");
  const sortButtons = document.querySelectorAll("[data-stock-sort]");
  const modeButtons = document.querySelectorAll("[data-stock-chart-mode]");
  const scaleButtons = document.querySelectorAll("[data-stock-scale]");
  const indicatorButtons = document.querySelectorAll("[data-stock-indicator]");
  const financialViewButtons = document.querySelectorAll("[data-stock-financial-view]");
  const axisStart = document.querySelector("[data-stock-axis-start]");
  const chartReadout = document.querySelector("[data-stock-chart-readout]");
  const performance = document.querySelector("[data-stock-performance]");
  const tape = document.querySelector("[data-trade-tape]");
  const orderBook = document.querySelector("[data-stock-order-book]");
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
  const orderForm = document.querySelector("[data-stock-order-form]");
  const orderElements = {
    root: orderForm,
    quantity: document.querySelector("[data-stock-order-quantity]"),
    type: document.querySelector("[data-stock-order-type]"),
    limit: document.querySelector("[data-stock-order-limit]"),
    leverage: document.querySelector("[data-stock-order-leverage]"),
    takeProfit: document.querySelector("[data-stock-order-take-profit]"),
    stopLoss: document.querySelector("[data-stock-order-stop-loss]"),
    postOnly: document.querySelector("[data-stock-order-post-only]"),
    reduceOnly: document.querySelector("[data-stock-order-reduce-only]"),
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
  let activeRange = "1D";
  let activeSort = "market";
  let activeMode = document.querySelector("[data-stock-chart-mode].is-active")?.dataset.stockChartMode || "line";
  let activeScale = document.querySelector("[data-stock-scale].is-active")?.dataset.stockScale || "price";
  let activeFinancialView = document.querySelector("[data-stock-financial-view].is-active")?.dataset.stockFinancialView || "income";
  let activeDepthGroup = Number(document.querySelector("[data-stock-depth-group].is-active")?.dataset.stockDepthGroup || 1);
  let activeIndicators = new Set(
    Array.from(document.querySelectorAll("[data-stock-indicator].is-active")).map(
      (button) => button.dataset.stockIndicator,
    ),
  );
  let activeSide = "buy";
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

  newsElements.modalClose?.addEventListener("click", () => closeStockNewsDetail(newsElements));
  newsElements.modal?.addEventListener("click", (event) => {
    if (event.target === newsElements.modal) closeStockNewsDetail(newsElements);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !newsElements.modal?.hidden) closeStockNewsDetail(newsElements);
  });

  function render() {
    renderStockAuthLink(sessionUser || readStoredUser());
    const rawStocks = Array.isArray(market?.stocks) && market.stocks.length ? market.stocks : buildFallbackMarket(tick).stocks;
    const stocks = sortStocks(rawStocks, activeSort);
    const stock = stocks.find((item) => stockCode(item) === activeCode) || stocks[0];
    activeCode = stockCode(stock);
    const result = renderStockChart(chart, stock, tick, activeRange, {
      mode: activeMode,
      scale: activeScale,
      indicators: activeIndicators,
    });
    const metrics = stockTechnicalMetrics(stock, tick, activeRange);
    const marketMeta = market?.market || {};

    root.classList.toggle("is-live", liveMarket);
    if (symbol) symbol.textContent = activeCode;
    if (stockName) stockName.textContent = stock.name || activeCode;
    if (price) price.textContent = formatStockKrw(result.price);
    if (change) {
      change.textContent = formatStockChange(result.change);
      change.classList.toggle("is-down", result.change < 0);
    }
    if (open) open.textContent = formatStockKrw(stock.open24h || result.open);
    if (high) high.textContent = formatStockKrw(stock.high24h || result.price);
    if (low) low.textContent = formatStockKrw(stock.low24h || result.price);
    if (quoteVolume) quoteVolume.textContent = `${formatStockNumber(stock.volume24h || result.volume)}주`;
    if (indexValue) indexValue.textContent = formatStockNumber(marketMeta.index);
    if (indexChange) {
      const value = Number(marketMeta.indexChange24h || 0);
      indexChange.textContent = formatStockChange(value);
      indexChange.classList.toggle("is-down", value < 0);
    }
    if (volume) volume.textContent = `${formatStockNumber(marketMeta.volume24h || result.volume)}주`;
    if (cap) cap.textContent = formatStockKrwCompact(marketMeta.marketCap);
    if (session) session.textContent = liveMarket ? marketMeta.session || "24H LIVE" : marketMeta.session || "API 대기";
    updated.forEach((label) => {
      label.textContent = liveMarket ? `갱신 ${formatStockTime(marketMeta.updatedAt)}` : "미리보기";
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
    depthGroupButtons.forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.stockDepthGroup || 1) === activeDepthGroup);
    });
    sideButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.stockOrderSide === activeSide);
    });

    const trades = selectedStockTrades(market?.recentTrades, activeCode);
    renderStockTicker(ticker, stocks, activeCode, selectStock);
    renderStockRows(list, stocks, activeCode, selectStock);
    renderStockTape(tape, trades.length ? trades : market?.recentTrades);
    renderStockChartReadout(chartReadout, stock, result);
    renderStockPerformance(performance, stock, tick);
    renderStockDetail(detailElements, stock, result);
    renderStockStrength(strengthElements, stock, trades);
    const depth = renderStockOrderBook(orderBook, stock, {
      asksBook: orderAsks,
      ratioLabel: depthRatio,
      midPrice: depthMid,
      depthMeter,
      groupSize: activeDepthGroup,
    });
    renderStockPortfolio(portfolioList, portfolioBalance, portfolio, market);
    renderExpertPanel(expertElements, metrics, depth, stock, orderElements, activeSide);
    renderStockNews(newsElements, stock, metrics, depth);
    renderStockFinancials(financialElements, stock, metrics, activeFinancialView);
    renderOrderTicket(orderElements, stock, activeSide, playerProfile, portfolio, liveMarket, orderLoading, { metrics, depth });
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
      render();
    });
  });
  scaleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeScale = button.dataset.stockScale || "price";
      render();
    });
  });
  indicatorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const indicator = button.dataset.stockIndicator;
      if (!indicator) return;
      if (activeIndicators.has(indicator)) activeIndicators.delete(indicator);
      else activeIndicators.add(indicator);
      render();
    });
  });
  financialViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFinancialView = button.dataset.stockFinancialView || "income";
      render();
    });
  });
  depthGroupButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeDepthGroup = Math.max(1, Number(button.dataset.stockDepthGroup || 1));
      render();
    });
  });
  sideButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeSide = button.dataset.stockOrderSide || "buy";
      render();
    });
  });
  [
    orderElements.quantity,
    orderElements.type,
    orderElements.limit,
    orderElements.leverage,
    orderElements.takeProfit,
    orderElements.stopLoss,
    orderElements.postOnly,
    orderElements.reduceOnly,
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
    const leverage = Math.max(1, Math.min(5, Number(orderElements.leverage?.value || 1)));
    const takeProfit = Math.max(0, Number(orderElements.takeProfit?.value || 0));
    const stopLoss = Math.max(0, Number(orderElements.stopLoss?.value || 0));
    const sideLabel = activeSide === "buy" ? "매수" : "매도";
    playerProfile = currentPlayerProfile();
    orderLoading = true;
    if (orderElements.submit) orderElements.submit.disabled = true;
    render();
    try {
      const payload = await submitStockTrade(playerProfile, stockCode(stock), activeSide, quantity, {
        orderType,
        limitPrice: usesLimitPrice && limitPrice > 0 ? limitPrice : undefined,
        leverage,
        takeProfit: takeProfit > 0 ? takeProfit : undefined,
        stopLoss: stopLoss > 0 ? stopLoss : undefined,
        postOnly: orderElements.postOnly?.value === "on",
        reduceOnly: orderElements.reduceOnly?.value === "on",
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

document.querySelectorAll("[data-copy-address]").forEach((button) => {
  button.addEventListener("click", copyAddress);
});

initTheme();
initNav();
initPageNavigation();
initStockExchange();
initAnimationStagger();
initScrollReveal();
initLogin();
deferSceneLoad();
if (statusDot || cacheState) {
  startVisiblePoll(refreshStatus, 60000);
}
if (hasRamWidgets()) {
  startVisiblePoll(refreshServerOverview, SERVER_OVERVIEW_INTERVAL_MS);
}
