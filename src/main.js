import "./styles.css";

const SERVER_ADDRESS = "nfoifsb.kr";
const STATUS_API = `https://api.mcstatus.io/v2/status/java/${SERVER_ADDRESS}`;
const STATUS_TIMEOUT_MS = 8000;
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

const PLAYER_API_BASES = apiBaseList(
  import.meta.env.VITE_PLAYER_API_BASE,
  import.meta.env.VITE_PLAYER_API_FALLBACK_BASES,
);
const PLAYER_API_BASE = PLAYER_API_BASES[0] || "";
const SERVER_OVERVIEW_TIMEOUT_MS = 6000;
const SERVER_OVERVIEW_INTERVAL_MS = 10000;
const STOCK_MARKET_TIMEOUT_MS = 6000;

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
const AUTH_STORAGE_KEY = "nfoifsb.googleUser";
const AUTH_EVENT_KEY = "nfoifsb.authEvent";
const STATUS_CACHE_KEY = "nfoifsb.statusCache";
const PLAYER_HISTORY_KEY = "nfoifsb.playerHistory";
const PLAYER_HISTORY_MAX = 48;
const STOCKS = [
  { code: "DMD", name: "다이아 광산", base: 3420, volume: 8420, drift: 0.048 },
  { code: "FARM", name: "농산물 조합", base: 1280, volume: 12650, drift: 0.019 },
  { code: "LOG", name: "건축 목재", base: 890, volume: 9340, drift: -0.012 },
  { code: "RED", name: "레드스톤 공업", base: 2160, volume: 7990, drift: 0.033 },
];
const PAGE_LINKS = new Map([
  ["/status.html", "status"],
  ["/plugins.html", "plugins"],
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

function renderAuthState(user = sessionUser || readStoredUser()) {
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

function formatStockChange(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "+0.0%";
  const sign = number >= 0 ? "+" : "";
  return `${sign}${number.toFixed(1)}%`;
}

function formatStockCompact(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  if (Math.abs(number) >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (Math.abs(number) >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return formatStockNumber(number);
}

function formatStockSigned(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const sign = number >= 0 ? "+" : "";
  return `${sign}${formatStockNumber(number)}`;
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
  const sizes = {
    "1H": 6,
    "6H": 14,
    "24H": 32,
  };
  const size = sizes[range];
  if (!size || series.length <= size) return series;
  return series.slice(-size);
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

async function fetchPlayerApiJson(path, timeoutMs) {
  let lastError = null;
  for (const base of PLAYER_API_BASES) {
    try {
      return await fetchPlayerApiJsonFrom(base, path, timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("player api unavailable");
}

async function fetchPlayerApiJsonFrom(base, path, timeoutMs) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`player api ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

function fallbackStockSeries(stock, tick) {
  const base = Number(stock.base || stock.price || 1000);
  const volumeSeed = Number(stock.volume || stock.volume24h || 3000);
  const drift = Number(stock.drift || stock.change24h || 0) / 100;
  return Array.from({ length: 32 }, (_, index) => {
    const wave = Math.sin((index + tick * 0.48) * 0.58 + base * 0.001) * 0.027;
    const pulse = Math.cos((index + tick * 0.22) * 0.31 + volumeSeed * 0.0008) * 0.016;
    const trend = drift * (index / 31);
    const price = base * (1 + wave + pulse + trend);
    const volume = 24 + Math.abs(Math.sin(index * 0.7 + tick + base)) * 58;
    return { price, volume };
  });
}

function stockSeries(stock, tick, range = "24H") {
  const history = Array.isArray(stock?.history) ? stock.history : [];
  const series = history
    .map((point) => ({
      price: Number(point.close ?? point.price ?? point.value),
      volume: Number(point.volume ?? 0),
    }))
    .filter((point) => Number.isFinite(point.price) && point.price > 0);

  if (series.length >= 2) return rangedStockSeries(series, range);
  return rangedStockSeries(fallbackStockSeries(stock, tick), range);
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
        close: point.price,
        volume: point.volume,
        time: new Date(Date.now() - (31 - index) * 45 * 60 * 1000).toISOString(),
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
      session: PLAYER_API_BASE ? "API 대기" : "미리보기",
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

function renderStockChart(svg, stock, tick, selectedRange = "24H") {
  const series = stockSeries(stock, tick, selectedRange);
  const prices = series.map((point) => point.price);
  const min = Math.min(...prices) * 0.985;
  const max = Math.max(...prices) * 1.015;
  const priceRange = Math.max(1, max - min);
  const maxVolume = Math.max(1, ...series.map((point) => Number(point.volume) || 0));
  const left = 28;
  const right = 612;
  const top = 26;
  const chartBottom = 188;
  const volumeBottom = 250;
  const width = right - left;
  const height = chartBottom - top;
  const xStep = width / (series.length - 1);

  const toX = (index) => left + index * xStep;
  const toY = (price) => top + ((max - price) / priceRange) * height;
  const linePoints = series.map((point, index) => `${toX(index).toFixed(1)},${toY(point.price).toFixed(1)}`).join(" ");
  const areaPoints = `${left},${chartBottom} ${linePoints} ${right},${chartBottom}`;

  svg.replaceChildren();
  const defs = createSvg("defs");
  const gradient = createSvg("linearGradient", {
    id: "stock-area-gradient",
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1",
  });
  gradient.append(
    createSvg("stop", { offset: "0%", "stop-color": "#2d75ff", "stop-opacity": "0.24" }),
    createSvg("stop", { offset: "100%", "stop-color": "#2d75ff", "stop-opacity": "0" }),
  );
  defs.append(gradient);
  svg.append(defs);

  [32, 76, 120, 164, 208].forEach((y) => {
    svg.append(createSvg("line", { class: "stock-grid-line", x1: left, x2: right, y1: y, y2: y }));
  });

  series.forEach((point, index) => {
    const barHeight = Math.max(2, ((Number(point.volume) || 0) / maxVolume) * 48);
    svg.append(
      createSvg("rect", {
        class: "stock-volume-bar",
        x: toX(index) - 3,
        y: volumeBottom - barHeight,
        width: 6,
        height: barHeight,
        rx: 3,
      }),
    );
  });

  svg.append(createSvg("polygon", { class: "stock-chart-area", points: areaPoints }));
  svg.append(createSvg("polyline", { class: "stock-chart-line", points: linePoints }));
  const last = series.at(-1);
  svg.append(createSvg("circle", { class: "stock-chart-dot", cx: right, cy: toY(last.price), r: 7 }));
  return {
    price: Number(stock.price ?? last.price),
    change: Number(stock.change24h ?? ((last.price - series[0].price) / series[0].price) * 100),
    volume: Number(stock.volume24h ?? series.reduce((sum, point) => sum + point.volume, 0)),
  };
}

function renderStockTape(tape, trades) {
  if (!tape) return;
  const rows = Array.isArray(trades) ? trades.slice(0, 6) : [];
  if (!rows.length) {
    const item = document.createElement("li");
    item.className = "is-empty";
    const label = document.createElement("span");
    label.textContent = PLAYER_API_BASE ? "실제 체결 대기" : "API 연결 전";
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
      amount.textContent = `${formatStockNumber(row.quantity)}주 @ ${formatStockNumber(row.price)}`;
      const total = document.createElement("small");
      total.textContent = `${formatStockCompact(row.total)} 머니`;
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
      price.textContent = formatStockNumber(stock.price);
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
      price.textContent = formatStockNumber(stock.price);
      price.classList.toggle("is-down", changePercent < 0);
      row.append(nameCell, price);
    } else {
      const values = [
        { text: formatStockNumber(stock.price), className: "stock-num" },
        { text: formatStockNumber(high), className: "stock-num" },
        { text: formatStockNumber(low), className: "stock-num" },
        { text: formatStockSigned(changeAmount), className: changeAmount < 0 ? "is-down" : "is-up" },
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
  const tape = document.querySelector("[data-trade-tape]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let market = buildFallbackMarket(0);
  let activeCode = market.stocks[0]?.symbol || market.stocks[0]?.code || "DMD";
  let activeRange = "24H";
  let activeSort = "market";
  let liveMarket = false;
  let tick = 0;

  const selectStock = (code) => {
    activeCode = code;
    render();
  };

  function render() {
    const rawStocks = Array.isArray(market?.stocks) && market.stocks.length ? market.stocks : buildFallbackMarket(tick).stocks;
    const stocks = sortStocks(rawStocks, activeSort);
    const stock = stocks.find((item) => stockCode(item) === activeCode) || stocks[0];
    activeCode = stockCode(stock);
    const result = renderStockChart(chart, stock, tick, activeRange);
    const marketMeta = market?.market || {};

    root.classList.toggle("is-live", liveMarket);
    if (symbol) symbol.textContent = activeCode;
    if (stockName) stockName.textContent = stock.name || activeCode;
    if (price) price.textContent = formatStockNumber(result.price);
    if (change) {
      change.textContent = formatStockChange(result.change);
      change.classList.toggle("is-down", result.change < 0);
    }
    if (high) high.textContent = formatStockNumber(stock.high24h || result.price);
    if (low) low.textContent = formatStockNumber(stock.low24h || result.price);
    if (quoteVolume) quoteVolume.textContent = `${formatStockNumber(stock.volume24h || result.volume)}주`;
    if (indexValue) indexValue.textContent = formatStockNumber(marketMeta.index);
    if (indexChange) {
      const value = Number(marketMeta.indexChange24h || 0);
      indexChange.textContent = formatStockChange(value);
      indexChange.classList.toggle("is-down", value < 0);
    }
    if (volume) volume.textContent = `${formatStockNumber(marketMeta.volume24h || result.volume)}주`;
    if (cap) cap.textContent = `${formatStockCompact(marketMeta.marketCap)} 머니`;
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

    renderStockTicker(ticker, stocks, activeCode, selectStock);
    renderStockRows(list, stocks, activeCode, selectStock);
    renderStockTape(tape, market?.recentTrades);
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
    render();
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
  startVisiblePoll(refreshMarket, 20000);
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
