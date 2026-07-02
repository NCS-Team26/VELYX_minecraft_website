import "./login.css";

const AUTH_STORAGE_KEY = "nfoifsb.googleUser";
const AUTH_EVENT_KEY = "nfoifsb.authEvent";
const AUTH_AUTO_KEY = "nfoifsb.autoLogin";
const PLAYER_PROFILES_KEY = "nfoifsb.playerProfiles";
const PLAYER_INVENTORY_CACHE_KEY = "nfoifsb.playerInventoryCache";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const playerApiBase = (import.meta.env.VITE_PLAYER_API_BASE || "").replace(/\/$/, "");
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const localAuthApiBase = isLocalHost ? "http://127.0.0.1:4174" : "";
const authApiBase = (import.meta.env.VITE_AUTH_API_BASE || localAuthApiBase).replace(/\/$/, "");
const allowLocalAuthPreview = !authApiBase && isLocalHost;
const allowLocalPlayerPreview = !playerApiBase && isLocalHost;

const title = document.querySelector("[data-auth-title]");
const copy = document.querySelector("[data-auth-copy]");
const message = document.querySelector("[data-auth-message]");
const googleLoginSlot = document.querySelector("[data-google-login]");
const profile = document.querySelector("[data-auth-profile]");
const avatar = document.querySelector("[data-auth-avatar]");
const profileName = document.querySelector("[data-auth-name]");
const profileEmail = document.querySelector("[data-auth-email]");
const signoutButton = document.querySelector("[data-signout]");
const autoLoginButton = document.querySelector("[data-auto-login]");
const loginForm = document.querySelector("[data-login-form]");
const signupForm = document.querySelector("[data-signup-form]");
const verifyForm = document.querySelector("[data-verify-form]");
const resetForm = document.querySelector("[data-reset-form]");
const resetConfirmForm = document.querySelector("[data-reset-confirm-form]");
const resendVerificationButton = document.querySelector("[data-resend-verification]");
const authViews = document.querySelectorAll("[data-auth-view]");
const authSecondaryActions = document.querySelector(".auth-secondary-actions");
const authDivider = document.querySelector(".auth-divider");
const modeButtons = document.querySelectorAll("[data-mode-button]");
const characterPanel = document.querySelector("[data-character-panel]");
const characterForm = document.querySelector("[data-character-form]");
const characterStatus = document.querySelector("[data-character-status]");
const verifyCard = document.querySelector("[data-verify-card]");
const verifyCode = document.querySelector("[data-verify-code]");
const verifyCommand = document.querySelector("[data-verify-command]");
const checkCharacterButton = document.querySelector("[data-check-character]");
const copyVerifyCommandButton = document.querySelector("[data-copy-verify-command]");
const refreshInventoryButton = document.querySelector("[data-refresh-inventory]");
const playerActionButtons = document.querySelectorAll("[data-player-action]");
const webActionSummary = document.querySelector("[data-web-action-summary]");
const webActionMessage = document.querySelector("[data-web-action-message]");
const stockTrader = document.querySelector("[data-stock-trader]");
const stockTraderSummary = document.querySelector("[data-stock-trader-summary]");
const stockTraderBalance = document.querySelector("[data-stock-trader-balance]");
const stockSymbolSelect = document.querySelector("[data-stock-symbol-select]");
const stockQuantityInput = document.querySelector("[data-stock-quantity]");
const stockTraderPrice = document.querySelector("[data-stock-trader-price]");
const stockTraderPosition = document.querySelector("[data-stock-trader-position]");
const stockTradeButtons = document.querySelectorAll("[data-stock-side]");
const stockTraderMessage = document.querySelector("[data-stock-trader-message]");
const inventoryGrid = document.querySelector("[data-inventory-grid]");
const inventoryEmpty = document.querySelector("[data-inventory-empty]");
const inventorySummary = document.querySelector("[data-inventory-summary]");
const characterLevel = document.querySelector("[data-character-level]");
const characterHealth = document.querySelector("[data-character-health]");
const characterLocation = document.querySelector("[data-character-location]");

let googleScriptPromise;
let googleMessage = "Google 로그인 버튼을 준비하고 있습니다.";
let googleMessageTone = "info";
let stockMarketPayload = null;
let stockPortfolioPayload = null;
let stockTraderLoading = false;

function setMessage(text, tone = "info") {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle("is-error", tone === "error");
  message.classList.toggle("is-success", tone === "success");
}

function setGoogleMessage(text, tone = "info") {
  googleMessage = text;
  googleMessageTone = tone;
  if (loginForm && !loginForm.hidden) setMessage(text, tone);
}

function readAutoLogin() {
  try {
    return localStorage.getItem(AUTH_AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

function renderAutoLogin() {
  if (!autoLoginButton) return;
  const enabled = readAutoLogin();
  autoLoginButton.setAttribute("aria-pressed", String(enabled));
  autoLoginButton.setAttribute("aria-label", enabled ? "자동 로그인 끄기" : "자동 로그인 켜기");
}

function readStoredUser() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function publishAuthEvent(type, user = null) {
  const payload = {
    source: "nfoifsb-login",
    type,
    user,
    timestamp: Date.now(),
  };
  try {
    localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify(payload));
  } catch {}
  try {
    window.opener?.postMessage(payload, window.location.origin);
  } catch {}
}

function persistUser(user) {
  try {
    const serialized = JSON.stringify(user);
    if (readAutoLogin()) {
      localStorage.setItem(AUTH_STORAGE_KEY, serialized);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
    }
  } catch {}

  publishAuthEvent("login", user);
  renderCharacterPanel(user);
}

function clearUser() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem("nfoifsb.nickname");
  } catch {}

  window.google?.accounts?.id?.disableAutoSelect();
  publishAuthEvent("logout");
}

function renderSignedInControls(isSignedIn) {
  if (isSignedIn) {
    authViews.forEach((view) => {
      view.hidden = true;
    });
  }
  if (authSecondaryActions) authSecondaryActions.hidden = isSignedIn;
  if (authDivider) authDivider.hidden = isSignedIn;
  if (googleLoginSlot) googleLoginSlot.hidden = isSignedIn;
}

function renderAuthState(user = readStoredUser()) {
  if (!profile) return;

  if (!user) {
    renderSignedInControls(false);
    profile.hidden = true;
    profile.classList.remove("has-avatar");
    if (avatar) {
      avatar.hidden = true;
      avatar.removeAttribute("src");
    }
    if (profileName) profileName.textContent = "";
    if (profileEmail) profileEmail.textContent = "";
    renderCharacterPanel(null);
    return;
  }

  renderSignedInControls(true);
  const displayName = user.name || user.email || "로그인 사용자";
  profile.hidden = false;
  profile.classList.toggle("has-avatar", Boolean(user.picture));
  if (title) title.textContent = "계정 연결됨";
  if (copy) copy.textContent = "인증한 계정으로 캐릭터 정보를 확인할 수 있습니다.";
  if (profileName) profileName.textContent = displayName;
  if (profileEmail) profileEmail.textContent = user.email || user.provider || "";

  if (avatar) {
    avatar.hidden = !user.picture;
    if (user.picture) avatar.setAttribute("src", user.picture);
  }

  renderCharacterPanel(user);
}

function setMode(mode) {
  const views = {
    login: loginForm,
    signup: signupForm,
    verify: verifyForm,
    reset: resetForm,
    resetConfirm: resetConfirmForm,
  };

  Object.entries(views).forEach(([viewMode, form]) => {
    if (form) form.hidden = viewMode !== mode;
  });

  modeButtons.forEach((button) => {
    const target = button.dataset.modeButton;
    button.hidden = mode === "login" ? target === "login" : target !== "login";
  });

  const headingByMode = {
    login: ["로그인", "서버 웹사이트에서 사용할 계정으로 로그인하세요."],
    signup: ["회원가입", "메일 인증까지 완료하면 서버 계정을 사용할 수 있습니다."],
    verify: ["이메일 인증", "메일로 받은 6자리 코드나 인증 링크 토큰을 입력하세요."],
    reset: ["비밀번호 찾기", "가입한 이메일로 재설정 코드를 보내드립니다."],
    resetConfirm: ["새 비밀번호", "메일로 받은 코드와 새 비밀번호를 입력하세요."],
  };
  const [nextTitle, nextCopy] = headingByMode[mode] || headingByMode.login;
  if (title) title.textContent = nextTitle;
  if (copy) copy.textContent = nextCopy;

  if (mode === "login") setMessage(googleMessage, googleMessageTone);
  else setMessage("입력 후 버튼을 눌러 주세요.");
}

function createLocalUser({ email, name, provider }) {
  return {
    email,
    name: name || email,
    picture: "",
    provider,
    emailVerified: true,
    signedInAt: new Date().toISOString(),
  };
}

function authUserFromResponse(payload) {
  const user = payload?.user || {};
  return {
    email: user.email || "",
    name: user.name || user.email || "로그인 사용자",
    picture: user.picture || "",
    provider: user.provider || "site",
    sub: user.sub || "",
    emailVerified: user.emailVerified === true,
    signedInAt: user.signedInAt || new Date().toISOString(),
    sessionToken: payload?.session?.token || "",
    sessionExpiresAt: payload?.session?.expiresAt || "",
  };
}

async function postAuth(path, body) {
  if (!authApiBase) throw new Error("회원가입 API가 아직 연결되지 않았습니다.");

  let response;
  try {
    response = await fetch(`${authApiBase}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (authApiBase === localAuthApiBase) {
      throw new Error("로컬 회원가입 서버가 꺼져 있습니다. npm run dev:local로 다시 실행해 주세요.");
    }
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "요청을 처리하지 못했습니다.");
  return payload;
}

function clearPasswordFields(form) {
  form?.querySelectorAll('input[type="password"]').forEach((input) => {
    input.value = "";
  });
}

function setFormEmail(form, email) {
  const input = form?.elements?.email;
  if (input && email) input.value = email;
}

function setFormCode(form, code) {
  const input = form?.elements?.code;
  if (input && code) input.value = code;
}

function previewMessage(payload, fallback) {
  const preview = payload?.emailPreview;
  if (preview?.code) return `${fallback} 개발용 코드: ${preview.code}`;
  return fallback;
}

function signInFromPayload(payload, successMessage) {
  const user = authUserFromResponse(payload);
  persistUser(user);
  renderAuthState(user);
  setMessage(successMessage, "success");
}

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function getUserKey(user) {
  return String(user?.sub || user?.email || user?.name || "local-player").toLowerCase();
}

function readPlayerProfiles() {
  return readJsonStorage(PLAYER_PROFILES_KEY, {});
}

function readPlayerProfile(user = readStoredUser()) {
  return readPlayerProfiles()[getUserKey(user)] || null;
}

function writePlayerProfile(playerProfile, user = readStoredUser()) {
  const profiles = readPlayerProfiles();
  profiles[getUserKey(user)] = playerProfile;
  writeJsonStorage(PLAYER_PROFILES_KEY, profiles);
}

function readInventoryCache() {
  return readJsonStorage(PLAYER_INVENTORY_CACHE_KEY, {});
}

function writeInventoryCache(playerProfile, payload, user = readStoredUser()) {
  const cache = readInventoryCache();
  cache[getUserKey(user)] = {
    nickname: playerProfile.nickname,
    payload,
    timestamp: Date.now(),
  };
  writeJsonStorage(PLAYER_INVENTORY_CACHE_KEY, cache);
}

function getCachedInventory(user = readStoredUser()) {
  return readInventoryCache()[getUserKey(user)] || null;
}

function generateVerificationCode() {
  const value = new Uint32Array(1);
  window.crypto?.getRandomValues?.(value);
  return String(((value[0] || Math.floor(Math.random() * 900000)) % 900000) + 100000);
}

function getVerifyCommand(code) {
  return `/webauth ${code}`;
}

function setCharacterStatus(text, tone = "idle") {
  if (!characterStatus) return;
  characterStatus.textContent = text;
  characterStatus.classList.toggle("is-verified", tone === "success");
  characterStatus.classList.toggle("is-error", tone === "error");
}

function setInventoryLoading(isLoading) {
  if (!refreshInventoryButton) return;
  refreshInventoryButton.disabled = isLoading || !readPlayerProfile()?.verified;
  refreshInventoryButton.textContent = isLoading ? "불러오는 중" : "새로고침";
}

function setWebActionMessage(text, tone = "info") {
  if (!webActionMessage) return;
  webActionMessage.textContent = text;
  webActionMessage.classList.toggle("is-error", tone === "error");
  webActionMessage.classList.toggle("is-success", tone === "success");
}

function renderWebActions(playerProfile = readPlayerProfile()) {
  const canUseActions = Boolean(playerProfile?.verified && playerProfile?.webToken);
  playerActionButtons.forEach((button) => {
    button.disabled = !canUseActions;
  });
  if (webActionSummary) {
    webActionSummary.textContent = canUseActions
      ? "서버 연결 준비됨"
      : playerProfile?.verified
        ? "토큰 재확인 필요"
        : "인증 후 사용";
  }
  if (!playerProfile?.verified) {
    setWebActionMessage("캐릭터 인증 후 웹사이트 버튼으로 서버에 액션을 보낼 수 있습니다.");
  } else if (!playerProfile?.webToken) {
    setWebActionMessage("인증 확인 버튼을 눌러 웹 액션 토큰을 받아오세요.", "error");
  }
}

function getInventoryItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.inventory)) return payload.inventory;
  return [];
}

function getItemColor(name) {
  const key = name.toLowerCase();
  if (key.includes("diamond") || name.includes("다이아")) return "#55d9e8";
  if (key.includes("emerald") || name.includes("에메랄드")) return "#31c96b";
  if (key.includes("gold") || name.includes("금")) return "#f5c84b";
  if (key.includes("iron") || name.includes("철")) return "#c9d0d5";
  if (key.includes("wood") || name.includes("나무")) return "#9a6439";
  if (key.includes("stone") || name.includes("돌")) return "#8f9693";
  if (key.includes("apple") || name.includes("사과")) return "#d94f45";
  if (key.includes("potion") || name.includes("포션")) return "#b05cff";
  return "#83b36a";
}

function normalizeSlotItem(item, index) {
  return {
    slot: Number.isFinite(item?.slot) ? item.slot : index,
    name: String(item?.name || item?.type || "알 수 없는 아이템"),
    count: Math.max(1, Number(item?.count || item?.amount || 1)),
    color: item?.color || getItemColor(String(item?.name || item?.type || "")),
  };
}

function buildFallbackInventory(playerProfile) {
  const seed = Array.from(playerProfile.nickname || "player").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    level: 12 + (seed % 28),
    health: `${16 + (seed % 5)} / 20`,
    location: `${100 + (seed % 420)}, ${62 + (seed % 8)}, ${-180 - (seed % 360)}`,
    items: [
      { slot: 0, name: "다이아몬드 검", count: 1, color: "#55d9e8" },
      { slot: 1, name: "철 곡괭이", count: 1, color: "#c9d0d5" },
      { slot: 2, name: "횃불", count: 32 + (seed % 24), color: "#f5c84b" },
      { slot: 3, name: "구운 돼지고기", count: 12 + (seed % 8), color: "#d68a54" },
      { slot: 4, name: "참나무 원목", count: 24 + (seed % 32), color: "#9a6439" },
      { slot: 9, name: "방패", count: 1, color: "#8f9693" },
      { slot: 10, name: "물 양동이", count: 1, color: "#4da3ff" },
      { slot: 11, name: "에메랄드", count: 3 + (seed % 9), color: "#31c96b" },
      { slot: 18, name: "엔더 진주", count: 2 + (seed % 4), color: "#46a082" },
      { slot: 27, name: "황금 사과", count: 1, color: "#f5c84b" },
    ],
    updatedAt: new Date().toISOString(),
    source: "local-preview",
  };
}

function renderInventory(payload = null) {
  if (!inventoryGrid) return;
  const playerProfile = readPlayerProfile();
  const items = getInventoryItems(payload).map(normalizeSlotItem);
  const bySlot = new Map(items.map((item) => [item.slot, item]));
  inventoryGrid.replaceChildren();

  for (let slot = 0; slot < 36; slot += 1) {
    const item = bySlot.get(slot);
    const cell = document.createElement("div");
    cell.className = `inventory-slot${item ? "" : " is-empty"}`;
    cell.setAttribute("role", "listitem");
    cell.setAttribute("aria-label", item ? `${item.name} ${item.count}개` : `빈 슬롯 ${slot + 1}`);

    if (item) {
      const icon = document.createElement("span");
      icon.className = "inventory-item-icon";
      icon.style.setProperty("--item-color", item.color);
      icon.title = item.name;
      cell.append(icon);

      if (item.count > 1) {
        const count = document.createElement("span");
        count.className = "inventory-item-count";
        count.textContent = String(item.count);
        cell.append(count);
      }
    }

    inventoryGrid.append(cell);
  }

  const updatedAt = payload?.updatedAt ? new Date(payload.updatedAt) : new Date();
  const updatedLabel = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(updatedAt);

  if (inventorySummary) {
    inventorySummary.textContent = playerProfile?.verified ? `${items.length}개 슬롯 · ${updatedLabel}` : "인증 후 표시";
  }
  if (inventoryEmpty) {
    inventoryEmpty.textContent = playerProfile?.verified
      ? items.length
        ? `${playerProfile.nickname} 인벤토리 동기화 완료`
        : "비어 있는 인벤토리입니다."
      : "캐릭터 인증 후 표시됩니다.";
  }
  if (characterLevel) characterLevel.textContent = payload?.level ?? "--";
  if (characterHealth) characterHealth.textContent = payload?.health ?? "--";
  if (characterLocation) characterLocation.textContent = payload?.location ?? "--";
}

async function fetchPlayerJson(path, options = {}) {
  if (!playerApiBase) return null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${playerApiBase}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || `player api ${response.status}`);
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}

function formatStockMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(number);
}

function setStockTraderMessage(text, tone = "info") {
  if (!stockTraderMessage) return;
  stockTraderMessage.textContent = text;
  stockTraderMessage.classList.toggle("is-error", tone === "error");
  stockTraderMessage.classList.toggle("is-success", tone === "success");
}

function stockSymbols() {
  return Array.isArray(stockMarketPayload?.stocks) ? stockMarketPayload.stocks : [];
}

function selectedStockSymbol() {
  return stockSymbolSelect?.value || stockSymbols()[0]?.symbol || stockSymbols()[0]?.code || "";
}

function selectedStock() {
  const symbol = selectedStockSymbol();
  return stockSymbols().find((stock) => (stock.symbol || stock.code) === symbol) || stockSymbols()[0] || null;
}

function selectedPosition() {
  const symbol = selectedStockSymbol();
  const positions = Array.isArray(stockPortfolioPayload?.positions) ? stockPortfolioPayload.positions : [];
  return positions.find((position) => position.symbol === symbol || position.code === symbol) || null;
}

function renderStockOptions() {
  if (!stockSymbolSelect) return;
  const previous = selectedStockSymbol();
  const stocks = stockSymbols();
  stockSymbolSelect.replaceChildren(
    ...stocks.map((stock) => {
      const option = document.createElement("option");
      option.value = stock.symbol || stock.code;
      option.textContent = `${stock.symbol || stock.code} · ${stock.name || stock.symbol || stock.code}`;
      return option;
    }),
  );
  if (stocks.some((stock) => (stock.symbol || stock.code) === previous)) {
    stockSymbolSelect.value = previous;
  }
}

function renderStockTrader(playerProfile = readPlayerProfile()) {
  if (!stockTrader) return;

  const stocks = stockSymbols();
  const canTrade = Boolean(
    playerProfile?.verified && playerProfile?.webToken && playerApiBase && stocks.length && !stockTraderLoading,
  );

  renderStockOptions();
  if (stockSymbolSelect) stockSymbolSelect.disabled = !canTrade;
  if (stockQuantityInput) stockQuantityInput.disabled = !canTrade;
  stockTradeButtons.forEach((button) => {
    button.disabled = !canTrade;
  });

  const stock = selectedStock();
  const position = selectedPosition();
  if (stockTraderSummary) {
    stockTraderSummary.textContent = canTrade
      ? "실거래 가능"
      : stockTraderLoading
        ? "거래소 확인 중"
        : playerProfile?.verified
          ? "거래소 연결 필요"
          : "인증 후 거래";
  }
  if (stockTraderBalance) {
    stockTraderBalance.textContent =
      stockPortfolioPayload?.balance === undefined ? "--" : `잔고 ${formatStockMoney(stockPortfolioPayload.balance)}`;
  }
  if (stockTraderPrice) {
    stockTraderPrice.textContent = stock
      ? `현재가 ${stock.symbol || stock.code} ${formatStockMoney(stock.price)}`
      : "현재가 --";
  }
  if (stockTraderPosition) {
    stockTraderPosition.textContent = position
      ? `보유 ${formatStockMoney(position.shares)}주 · 평가 ${formatStockMoney(position.value)}`
      : "보유 0주";
  }

  if (!playerProfile?.verified) {
    setStockTraderMessage("캐릭터 인증 후 서버 머니로 24시간 주식을 거래할 수 있습니다.");
  } else if (!playerProfile.webToken) {
    setStockTraderMessage("인증 확인을 다시 눌러 웹 토큰을 받아오세요.", "error");
  } else if (!playerApiBase) {
    setStockTraderMessage("VITE_PLAYER_API_BASE가 연결되면 실제 거래가 활성화됩니다.", "error");
  } else if (!stocks.length && !stockTraderLoading) {
    setStockTraderMessage("거래소 API를 불러오지 못했습니다.", "error");
  }
}

async function loadStockTrader(playerProfile, user = readStoredUser()) {
  if (!stockTrader || !playerProfile?.verified || !playerProfile?.webToken || !playerApiBase) {
    stockMarketPayload = null;
    stockPortfolioPayload = null;
    renderStockTrader(playerProfile);
    return;
  }

  stockTraderLoading = true;
  renderStockTrader(playerProfile);
  try {
    const market = await fetchPlayerJson("/stocks/market", { method: "GET" });
    if (market?.ok) stockMarketPayload = market;

    const portfolio = await fetchPlayerJson("/stocks/portfolio", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${playerProfile.webToken}`,
      },
      body: JSON.stringify({
        nickname: playerProfile.nickname,
        webToken: playerProfile.webToken,
      }),
    });
    if (portfolio?.ok) stockPortfolioPayload = portfolio;
  } catch (error) {
    setStockTraderMessage(error?.message || "거래소 정보를 불러오지 못했습니다.", "error");
  } finally {
    stockTraderLoading = false;
    renderStockTrader(readPlayerProfile(user));
  }
}

async function postStockTrade(side) {
  const user = readStoredUser();
  const playerProfile = readPlayerProfile(user);
  if (!playerProfile?.verified || !playerProfile.webToken) {
    setStockTraderMessage("먼저 캐릭터 인증을 완료해 주세요.", "error");
    return;
  }

  const symbol = selectedStockSymbol();
  const quantity = Math.floor(Number(stockQuantityInput?.value || 0));
  if (!symbol) {
    setStockTraderMessage("거래할 종목을 선택해 주세요.", "error");
    return;
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    setStockTraderMessage("수량은 1주 이상으로 입력해 주세요.", "error");
    return;
  }

  stockTraderLoading = true;
  renderStockTrader(playerProfile);
  setStockTraderMessage(`${symbol} ${side === "buy" ? "매수" : "매도"} 주문 전송 중...`);

  try {
    const payload = await fetchPlayerJson("/stocks/trade", {
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
      }),
    });
    if (payload?.market?.ok) stockMarketPayload = payload.market;
    stockTraderLoading = false;
    await loadStockTrader(playerProfile, user);
    setStockTraderMessage(
      `${symbol} ${side === "buy" ? "매수" : "매도"} ${formatStockMoney(quantity)}주 체결 완료`,
      "success",
    );
  } catch (error) {
    stockTraderLoading = false;
    renderStockTrader(playerProfile);
    setStockTraderMessage(error?.message || "주문을 처리하지 못했습니다.", "error");
  }
}

async function requestPlayerVerification(nickname, user) {
  const apiPayload = await fetchPlayerJson("/verification/start", {
    method: "POST",
    body: JSON.stringify({
      nickname,
      account: {
        email: user?.email || "",
        name: user?.name || "",
        provider: user?.provider || "site",
        sub: user?.sub || "",
      },
    }),
  }).catch(() => null);

  const code = String(apiPayload?.code || generateVerificationCode());
  return {
    nickname,
    code,
    uuid: apiPayload?.uuid || "",
    verified: Boolean(apiPayload?.verified),
    webToken: apiPayload?.webToken || "",
    requestedAt: new Date().toISOString(),
  };
}

async function checkPlayerVerification(playerProfile, user) {
  const apiPayload = await fetchPlayerJson("/verification/check", {
    method: "POST",
    body: JSON.stringify({
      nickname: playerProfile.nickname,
      code: playerProfile.code,
      account: {
        email: user?.email || "",
        provider: user?.provider || "site",
        sub: user?.sub || "",
      },
    }),
  }).catch(() => null);

  return {
    ...playerProfile,
    uuid: apiPayload?.uuid || playerProfile.uuid || "",
    webToken: apiPayload?.webToken || playerProfile.webToken || "",
    verified: playerApiBase ? Boolean(apiPayload?.verified) : allowLocalPlayerPreview,
    verifiedAt: apiPayload?.verified || allowLocalPlayerPreview ? new Date().toISOString() : playerProfile.verifiedAt,
  };
}

async function loadPlayerInventory(playerProfile, user = readStoredUser()) {
  if (!playerProfile?.verified) {
    renderInventory(null);
    return;
  }

  setInventoryLoading(true);
  try {
    const apiPayload = await fetchPlayerJson(`/players/${encodeURIComponent(playerProfile.nickname)}/inventory`, {
      method: "GET",
    }).catch(() => null);
    const payload = apiPayload || (allowLocalPlayerPreview ? buildFallbackInventory(playerProfile) : null);
    if (!payload) {
      setCharacterStatus("API 연결 필요", "error");
      renderInventory(null);
      return;
    }
    writeInventoryCache(playerProfile, payload, user);
    renderInventory(payload);
  } finally {
    setInventoryLoading(false);
  }
}

function renderVerifyCard(playerProfile) {
  if (!verifyCard) return;
  verifyCard.hidden = !playerProfile;
  if (!playerProfile) return;
  const command = getVerifyCommand(playerProfile.code);
  if (verifyCode) verifyCode.textContent = playerProfile.code;
  if (verifyCommand) verifyCommand.textContent = command;
}

function renderCharacterPanel(user = readStoredUser()) {
  if (!characterPanel) return;

  if (!user) {
    characterPanel.hidden = true;
    renderVerifyCard(null);
    renderInventory(null);
    renderWebActions(null);
    renderStockTrader(null);
    setCharacterStatus("인증 대기");
    return;
  }

  characterPanel.hidden = false;
  const playerProfile = readPlayerProfile(user);
  const nicknameInput = characterForm?.elements?.nickname;
  if (nicknameInput && playerProfile?.nickname) nicknameInput.value = playerProfile.nickname;

  renderVerifyCard(playerProfile);
  setCharacterStatus(
    playerProfile?.verified ? "인증 완료" : playerProfile ? "인증 확인 필요" : "인증 대기",
    playerProfile?.verified ? "success" : "idle",
  );
  if (refreshInventoryButton) refreshInventoryButton.disabled = !playerProfile?.verified;
  renderWebActions(playerProfile);
  renderStockTrader(playerProfile);

  const cached = getCachedInventory(user);
  if (cached?.payload && cached.nickname === playerProfile?.nickname) renderInventory(cached.payload);
  else renderInventory(null);

  if (playerProfile?.verified) {
    loadPlayerInventory(playerProfile, user);
    loadStockTrader(playerProfile, user);
  }
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

function renderGoogleFallback(label) {
  if (!googleLoginSlot) return;
  const button = document.createElement("button");
  button.className = "google-login-fallback";
  button.type = "button";
  button.disabled = true;
  button.textContent = label;
  googleLoginSlot.replaceChildren(button);
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Identity Services script failed to load."));
    document.head.appendChild(script);
  }).then(() => {
    if (!window.google?.accounts?.id) throw new Error("Google Identity Services is unavailable.");
  });

  return googleScriptPromise;
}

function renderGoogleButton() {
  if (!googleLoginSlot || !window.google?.accounts?.id) return;

  googleLoginSlot.replaceChildren();
  window.google.accounts.id.initialize({
    client_id: googleClientId,
    callback: async (response) => {
      try {
        if (!authApiBase) throw new Error("Google 인증 API가 연결되지 않았습니다.");
        const payload = await postAuth("/auth/google", { credential: response.credential });
        const user = authUserFromResponse(payload);
        persistUser(user);
        renderAuthState(user);
        setMessage(`${user.name || user.email} 계정으로 로그인했습니다.`, "success");
      } catch (error) {
        setMessage(error.message || "Google 인증을 확인하지 못했습니다.", "error");
      }
    },
    auto_select: readAutoLogin(),
  });

  const slotWidth = Math.round(googleLoginSlot.getBoundingClientRect().width || 320);
  const buttonWidth = Math.min(360, Math.max(260, slotWidth));
  window.google.accounts.id.renderButton(googleLoginSlot, {
    type: "standard",
    theme: "outline",
    size: "large",
    shape: "pill",
    text: "signin_with",
    logo_alignment: "left",
    locale: "ko",
    width: buttonWidth,
  });
}

function initGoogleLogin() {
  if (!googleClientId) {
    renderGoogleFallback("Google 로그인 설정 필요");
    setGoogleMessage("VITE_GOOGLE_CLIENT_ID를 설정하면 Google 로그인이 활성화됩니다.", "error");
    return;
  }

  loadGoogleIdentityScript()
    .then(() => {
      renderGoogleButton();
      setGoogleMessage("Google 계정으로도 로그인할 수 있습니다.");
    })
    .catch(() => {
      renderGoogleFallback("Google 로그인 로드 실패");
      setGoogleMessage("Google 로그인 버튼을 불러오지 못했습니다.", "error");
    });
}

async function postPlayerAction(action) {
  const user = readStoredUser();
  const playerProfile = readPlayerProfile(user);
  if (!playerProfile?.verified) {
    setWebActionMessage("먼저 캐릭터 인증을 완료해 주세요.", "error");
    return;
  }
  if (!playerProfile.webToken) {
    setWebActionMessage("인증 확인을 다시 눌러 웹 액션 토큰을 받아오세요.", "error");
    return;
  }
  if (!playerApiBase) {
    if (allowLocalPlayerPreview) {
      setWebActionMessage("로컬 미리보기에서는 버튼 모양만 확인됩니다. 실제 서버 API를 연결해 주세요.");
      return;
    }
    setWebActionMessage("VITE_PLAYER_API_BASE가 아직 연결되지 않았습니다.", "error");
    return;
  }

  playerActionButtons.forEach((button) => {
    button.disabled = true;
  });
  setWebActionMessage("서버로 액션을 보내는 중...");

  try {
    const payload = await fetchPlayerJson(
      `/players/${encodeURIComponent(playerProfile.nickname)}/actions/${encodeURIComponent(action)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${playerProfile.webToken}`,
        },
        body: JSON.stringify({ webToken: playerProfile.webToken }),
      },
    );
    setWebActionMessage(payload?.message || "서버 액션을 보냈습니다.", "success");
  } catch (error) {
    setWebActionMessage(error?.message || "서버 액션을 보내지 못했습니다.", "error");
  } finally {
    renderWebActions(playerProfile);
  }
}

async function applyUrlAuthMode() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const email = params.get("email") || "";
  const token = params.get("token") || "";
  if (!mode) return;

  if (mode === "verify") {
    setMode("verify");
    setFormEmail(verifyForm, email);
    setFormCode(verifyForm, token);
    if (email && token && authApiBase) {
      setMessage("이메일 인증을 확인하는 중입니다.");
      try {
        const payload = await postAuth("/auth/verify-email", { email, token, code: token });
        signInFromPayload(payload, "이메일 인증이 완료되었습니다.");
        window.history.replaceState({}, "", "/login.html");
      } catch (error) {
        setMessage(error.message || "이메일 인증에 실패했습니다.", "error");
      }
    }
    return;
  }

  if (mode === "reset-confirm") {
    setMode("resetConfirm");
    setFormEmail(resetConfirmForm, email);
    setFormCode(resetConfirmForm, token);
    setMessage("새 비밀번호를 입력해 주세요.");
  }
}

autoLoginButton?.addEventListener("click", () => {
  const nextEnabled = !readAutoLogin();
  try {
    localStorage.setItem(AUTH_AUTO_KEY, nextEnabled ? "1" : "0");
  } catch {}
  renderAutoLogin();
  setMessage(nextEnabled ? "자동 로그인이 켜졌습니다." : "자동 로그인이 꺼졌습니다.");
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setMode(button.dataset.modeButton || "login");
  });
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    setMessage("이메일과 비밀번호를 입력해 주세요.", "error");
    return;
  }

  try {
    const user = authApiBase
      ? authUserFromResponse(await postAuth("/auth/login", { email, password }))
      : allowLocalAuthPreview
        ? createLocalUser({ email, name: email.split("@")[0], provider: "site-preview" })
        : null;

    if (!user) {
      setMessage("회원가입 API 설정이 필요합니다. VITE_AUTH_API_BASE를 연결해 주세요.", "error");
      return;
    }

    persistUser(user);
    renderAuthState(user);
    clearPasswordFields(loginForm);
    setMessage("로그인되었습니다.", "success");
  } catch (error) {
    if (String(error.message || "").includes("이메일 인증")) {
      setMode("verify");
      setFormEmail(verifyForm, email);
    }
    setMessage(error.message || "로그인하지 못했습니다.", "error");
  }
});

signupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);
  const nickname = String(formData.get("nickname") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!nickname || !email || !password) {
    setMessage("닉네임, 이메일, 비밀번호를 모두 입력해 주세요.", "error");
    return;
  }
  if (password.length < 8) {
    setMessage("비밀번호는 8자 이상으로 입력해 주세요.", "error");
    return;
  }

  try {
    if (authApiBase) {
      const payload = await postAuth("/auth/signup", { nickname, email, password });
      signupForm.reset();
      setMode("verify");
      setFormEmail(verifyForm, email);
      setMessage(previewMessage(payload, "인증 메일을 보냈습니다. 메일함에서 코드를 확인해 주세요."), "success");
      return;
    }

    if (allowLocalAuthPreview) {
      const user = createLocalUser({ email, name: nickname, provider: "site-preview" });
      persistUser(user);
      signupForm.reset();
      renderAuthState(user);
      setMessage("로컬 미리보기 계정으로 로그인되었습니다.", "success");
      return;
    }

    setMessage("회원가입 API 설정이 필요합니다. VITE_AUTH_API_BASE를 연결해 주세요.", "error");
  } catch (error) {
    setMessage(error.message || "회원가입하지 못했습니다.", "error");
  }
});

verifyForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(verifyForm);
  const email = String(formData.get("email") || "").trim();
  const code = String(formData.get("code") || "").trim();

  if (!email || !code) {
    setMessage("이메일과 인증 코드를 입력해 주세요.", "error");
    return;
  }

  try {
    const payload = await postAuth("/auth/verify-email", { email, code, token: code });
    signInFromPayload(payload, "이메일 인증이 완료되었습니다.");
    verifyForm.reset();
  } catch (error) {
    setMessage(error.message || "이메일 인증에 실패했습니다.", "error");
  }
});

resendVerificationButton?.addEventListener("click", async () => {
  const email = String(verifyForm?.elements?.email?.value || "").trim();
  if (!email) {
    setMessage("인증 메일을 받을 이메일을 입력해 주세요.", "error");
    return;
  }

  try {
    const payload = await postAuth("/auth/resend-verification", { email });
    setMessage(previewMessage(payload, "인증 메일을 다시 보냈습니다."), "success");
  } catch (error) {
    setMessage(error.message || "인증 메일을 다시 보내지 못했습니다.", "error");
  }
});

resetForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(resetForm);
  const email = String(formData.get("email") || "").trim();

  if (!email) {
    setMessage("이메일을 입력해 주세요.", "error");
    return;
  }

  try {
    const payload = authApiBase ? await postAuth("/auth/reset", { email }) : {};
    if (!authApiBase && !allowLocalAuthPreview) {
      setMessage("회원가입 API 설정이 필요합니다. VITE_AUTH_API_BASE를 연결해 주세요.", "error");
      return;
    }
    setMode("resetConfirm");
    setFormEmail(resetConfirmForm, email);
    setMessage(previewMessage(payload, "재설정 메일을 보냈습니다. 메일함에서 코드를 확인해 주세요."), "success");
  } catch (error) {
    setMessage(error.message || "비밀번호 재설정 요청을 처리하지 못했습니다.", "error");
  }
});

resetConfirmForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(resetConfirmForm);
  const email = String(formData.get("email") || "").trim();
  const code = String(formData.get("code") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !code || !password) {
    setMessage("이메일, 재설정 코드, 새 비밀번호를 모두 입력해 주세요.", "error");
    return;
  }
  if (password.length < 8) {
    setMessage("비밀번호는 8자 이상으로 입력해 주세요.", "error");
    return;
  }

  try {
    const payload = await postAuth("/auth/reset/confirm", { email, code, token: code, password });
    signInFromPayload(payload, "비밀번호가 변경되고 로그인되었습니다.");
    resetConfirmForm.reset();
  } catch (error) {
    setMessage(error.message || "비밀번호를 변경하지 못했습니다.", "error");
  }
});

signoutButton?.addEventListener("click", () => {
  clearUser();
  setMode("login");
  renderAuthState(null);
  setMessage("로그아웃되었습니다.");
});

characterForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = readStoredUser();
  if (!user) {
    setMessage("먼저 로그인해 주세요.", "error");
    return;
  }

  const formData = new FormData(characterForm);
  const nickname = String(formData.get("nickname") || "").trim();
  if (!nickname) {
    setCharacterStatus("닉네임 필요", "error");
    return;
  }

  setCharacterStatus("코드 생성 중");
  const playerProfile = await requestPlayerVerification(nickname, user);
  writePlayerProfile(playerProfile, user);
  renderVerifyCard(playerProfile);
  renderInventory(null);
  renderWebActions(playerProfile);
  renderStockTrader(playerProfile);
  setCharacterStatus(playerProfile.verified ? "인증 완료" : "인증 확인 필요", playerProfile.verified ? "success" : "idle");
  if (refreshInventoryButton) refreshInventoryButton.disabled = !playerProfile.verified;
  if (playerProfile.verified) {
    loadPlayerInventory(playerProfile, user);
    loadStockTrader(playerProfile, user);
  }
  setMessage(`${nickname} 캐릭터 인증 코드를 만들었습니다.`, "success");
});

checkCharacterButton?.addEventListener("click", async () => {
  const user = readStoredUser();
  const playerProfile = readPlayerProfile(user);
  if (!user || !playerProfile) {
    setCharacterStatus("인증 대기", "error");
    return;
  }

  setCharacterStatus("인증 확인 중");
  const nextProfile = await checkPlayerVerification(playerProfile, user);
  writePlayerProfile(nextProfile, user);
  renderVerifyCard(nextProfile);
  renderWebActions(nextProfile);
  renderStockTrader(nextProfile);
  setCharacterStatus(nextProfile.verified ? "인증 완료" : "아직 미인증", nextProfile.verified ? "success" : "error");
  if (refreshInventoryButton) refreshInventoryButton.disabled = !nextProfile.verified;

  if (nextProfile.verified) {
    await loadPlayerInventory(nextProfile, user);
    await loadStockTrader(nextProfile, user);
    setMessage(`${nextProfile.nickname} 캐릭터가 인증되었습니다.`, "success");
  } else {
    setMessage("서버에서 아직 캐릭터 인증을 확인하지 못했습니다.", "error");
  }
});

copyVerifyCommandButton?.addEventListener("click", async () => {
  const playerProfile = readPlayerProfile();
  if (!playerProfile?.code) return;
  const copied = await copyText(getVerifyCommand(playerProfile.code));
  setMessage(copied ? "인증 명령어를 복사했습니다." : "명령어 복사에 실패했습니다.", copied ? "success" : "error");
});

refreshInventoryButton?.addEventListener("click", () => {
  const user = readStoredUser();
  const playerProfile = readPlayerProfile(user);
  if (playerProfile?.verified) loadPlayerInventory(playerProfile, user);
});

playerActionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.playerAction;
    if (action) postPlayerAction(action);
  });
});

stockSymbolSelect?.addEventListener("change", () => {
  renderStockTrader(readPlayerProfile());
});

stockTradeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const side = button.dataset.stockSide;
    if (side) postStockTrade(side);
  });
});

renderAutoLogin();
setMode("login");
renderAuthState();
initGoogleLogin();
applyUrlAuthMode();
