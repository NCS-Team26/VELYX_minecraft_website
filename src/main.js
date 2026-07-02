import "./styles.css";

const SERVER_ADDRESS = "nfoifsb.kr";
const STATUS_API = `https://api.mcstatus.io/v2/status/java/${SERVER_ADDRESS}`;
const STATUS_TIMEOUT_MS = 8000;

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
    ".detail-grid, .plugin-grid, .feature-grid, .economy-grid, .market-list, .stock-summary, .stock-list, .section-dashboard, .rules-list, .rules-tools, .join-steps, .stats-inner, .gallery-strip",
  );

  animatedGroups.forEach((group) => {
    Array.from(group.children).forEach((child, index) => {
      child.style.setProperty("--item-index", index);
    });
  });
}

function formatStockNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

function formatStockChange(value) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function stockSeries(stock, tick) {
  return Array.from({ length: 32 }, (_, index) => {
    const wave = Math.sin((index + tick * 0.48) * 0.58 + stock.base * 0.001) * 0.027;
    const pulse = Math.cos((index + tick * 0.22) * 0.31 + stock.volume * 0.0008) * 0.016;
    const trend = stock.drift * (index / 31);
    const price = stock.base * (1 + wave + pulse + trend);
    const volume = 24 + Math.abs(Math.sin(index * 0.7 + tick + stock.base)) * 58;
    return { price, volume };
  });
}

function createSvg(tag, attrs = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
}

function renderStockChart(svg, stock, tick) {
  const series = stockSeries(stock, tick);
  const prices = series.map((point) => point.price);
  const min = Math.min(...prices) * 0.985;
  const max = Math.max(...prices) * 1.015;
  const left = 28;
  const right = 612;
  const top = 26;
  const chartBottom = 188;
  const volumeBottom = 250;
  const width = right - left;
  const height = chartBottom - top;
  const xStep = width / (series.length - 1);

  const toX = (index) => left + index * xStep;
  const toY = (price) => top + ((max - price) / (max - min)) * height;
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
    const barHeight = Math.max(6, point.volume * 0.5);
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
    price: last.price,
    change: ((last.price - series[0].price) / series[0].price) * 100,
    volume: series.reduce((sum, point) => sum + point.volume, 0),
  };
}

function renderStockTape(tape, tick) {
  if (!tape) return;
  const rows = Array.from({ length: 4 }, (_, index) => {
    const stock = STOCKS[(tick + index * 2) % STOCKS.length];
    const buy = (tick + index) % 3 !== 1;
    const amount = 8 + ((tick * 11 + index * 17) % 64);
    return { stock, buy, amount };
  });

  tape.replaceChildren(
    ...rows.map((row) => {
      const item = document.createElement("li");
      item.className = row.buy ? "is-buy" : "is-sell";
      const label = document.createElement("span");
      label.textContent = `${row.stock.code} ${row.buy ? "매수" : "매도"}`;
      const amount = document.createElement("strong");
      amount.textContent = `${row.amount}주`;
      item.append(label, amount);
      return item;
    }),
  );
}

function initStockExchange() {
  const root = document.querySelector("[data-stock-exchange]");
  const chart = document.querySelector("[data-stock-chart]");
  const list = document.querySelector("[data-stock-list]");
  if (!root || !chart || !list) return;

  const price = document.querySelector("[data-stock-price]");
  const change = document.querySelector("[data-stock-change]");
  const symbol = document.querySelector("[data-stock-symbol]");
  const indexValue = document.querySelector("[data-stock-index]");
  const indexChange = document.querySelector("[data-stock-index-change]");
  const volume = document.querySelector("[data-stock-volume]");
  const cap = document.querySelector("[data-stock-cap]");
  const session = document.querySelector("[data-stock-session]");
  const tape = document.querySelector("[data-trade-tape]");
  const rows = Array.from(list.querySelectorAll("[data-stock-code]"));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let activeIndex = 0;
  let tick = 0;

  rows.forEach((row, index) => {
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.addEventListener("click", () => {
      activeIndex = index;
      render();
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activeIndex = index;
      render();
    });
  });

  function render() {
    const stock = STOCKS[activeIndex] || STOCKS[0];
    const result = renderStockChart(chart, stock, tick);
    const totalVolume = STOCKS.reduce((sum, item) => sum + item.volume, 0) + Math.round(result.volume * 18);
    const marketCap = STOCKS.reduce((sum, item) => sum + item.base * item.volume, 0) / 1000000;
    const stockIndex = 12480 + Math.round(Math.sin(tick * 0.42) * 82 + STOCKS.reduce((sum, item) => sum + item.drift, 0) * 700);
    const stockIndexChange = 2.1 + Math.sin(tick * 0.36) * 0.8;

    if (symbol) symbol.textContent = stock.code;
    if (price) price.textContent = formatStockNumber(result.price);
    if (change) {
      change.textContent = formatStockChange(result.change);
      change.classList.toggle("is-down", result.change < 0);
    }
    if (indexValue) indexValue.textContent = formatStockNumber(stockIndex);
    if (indexChange) {
      indexChange.textContent = formatStockChange(stockIndexChange);
      indexChange.classList.toggle("is-down", stockIndexChange < 0);
    }
    if (volume) volume.textContent = `${formatStockNumber(totalVolume)}주`;
    if (cap) cap.textContent = `${marketCap.toFixed(1)}M`;
    if (session) session.textContent = new Date().getHours() >= 2 ? "장중" : "야간장";

    rows.forEach((row, index) => {
      const item = STOCKS[index] || STOCKS[0];
      const itemResult = stockSeries(item, tick).at(-1);
      const open = stockSeries(item, tick)[0].price;
      const rowPrice = row.querySelector("em");
      const rowChange = ((itemResult.price - open) / open) * 100;
      row.classList.toggle("is-active", index === activeIndex);
      row.setAttribute("aria-pressed", String(index === activeIndex));
      if (rowPrice) {
        rowPrice.textContent = formatStockNumber(itemResult.price);
        rowPrice.classList.toggle("is-down", rowChange < 0);
      }
    });

    renderStockTape(tape, tick);
  }

  render();
  if (!reduceMotion) {
    window.setInterval(() => {
      tick += 1;
      render();
    }, 3200);
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
  refreshStatus();
  setInterval(refreshStatus, 60000);
}
