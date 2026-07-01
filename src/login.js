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
const allowLocalPlayerPreview =
  !playerApiBase && isLocalHost;
const allowLocalAuthPreview = !authApiBase && isLocalHost;

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
const resetForm = document.querySelector("[data-reset-form]");
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
const inventoryGrid = document.querySelector("[data-inventory-grid]");
const inventoryEmpty = document.querySelector("[data-inventory-empty]");
const inventorySummary = document.querySelector("[data-inventory-summary]");
const characterLevel = document.querySelector("[data-character-level]");
const characterHealth = document.querySelector("[data-character-health]");
const characterLocation = document.querySelector("[data-character-location]");

let googleScriptPromise;
let googleMessage = "Google 로그인 버튼을 준비하고 있습니다.";
let googleMessageTone = "info";

function setMessage(text, tone = "info") {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle("is-error", tone === "error");
  message.classList.toggle("is-success", tone === "success");
}

function setGoogleMessage(text, tone = "info") {
  googleMessage = text;
  googleMessageTone = tone;

  if (loginForm && !loginForm.hidden) {
    setMessage(text, tone);
  }
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

function readAutoLogin() {
  try {
    return localStorage.getItem(AUTH_AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

function setAutoLogin(enabled) {
  try {
    localStorage.setItem(AUTH_AUTO_KEY, enabled ? "1" : "0");
  } catch {
    // The toggle still works visually when storage is unavailable.
  }

  renderAutoLogin();

  const user = readStoredUser();
  if (!user) return;

  if (enabled) {
    persistUser(user);
  } else {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Keep the current visible session even if storage is unavailable.
    }
    publishAuthEvent("login", user);
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
    const sessionUser = sessionStorage.getItem(AUTH_STORAGE_KEY);
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
    const raw = sessionUser || storedUser;
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
  } catch {
    // Parent window messaging below is enough for the current click flow.
  }

  try {
    window.opener?.postMessage(payload, window.location.origin);
  } catch {
    // The login window still works when opened without an opener.
  }
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
  } catch {
    // The UI still reports the signed-in state for this page.
  }

  publishAuthEvent("login", user);
  renderCharacterPanel(user);
}

function clearUser() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem("nfoifsb.nickname");
  } catch {
    // Sign-out still updates the visible page.
  }

  window.google?.accounts?.id?.disableAutoSelect();
  publishAuthEvent("logout");
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
    reset: resetForm,
  };

  Object.entries(views).forEach(([viewMode, form]) => {
    if (form) form.hidden = viewMode !== mode;
  });

  modeButtons.forEach((button) => {
    const buttonMode = button.dataset.modeButton;
    button.hidden =
      (mode === "login" && buttonMode === "login") ||
      (mode !== "login" && buttonMode !== "login");
  });

  const headingByMode = {
    login: ["로그인", "서버 웹사이트에서 사용할 계정으로 로그인하세요."],
    signup: ["회원가입", "새 계정을 만들고 바로 로그인하세요."],
    reset: ["비밀번호 찾기", "가입한 이메일로 재설정 요청을 준비하세요."],
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
    signedInAt: user.signedInAt || new Date().toISOString(),
    sessionToken: payload?.session?.token || "",
    sessionExpiresAt: payload?.session?.expiresAt || "",
  };
}

async function postAuth(path, body) {
  if (!authApiBase) {
    throw new Error("회원가입 API가 아직 연결되지 않았습니다.");
  }

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
  if (!response.ok) {
    throw new Error(payload?.message || "요청을 처리하지 못했습니다.");
  }
  return payload;
}

function clearPasswordFields(form) {
  form
    ?.querySelectorAll('input[type="password"]')
    .forEach((input) => {
      input.value = "";
    });
}

function getUserKey(user) {
  return String(user?.sub || user?.email || user?.name || "local-player").toLowerCase();
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
  } catch {
    // The current page can still render the state without persistence.
  }
}

function readPlayerProfiles() {
  return readJsonStorage(PLAYER_PROFILES_KEY, {});
}

function readPlayerProfile(user = readStoredUser()) {
  const profiles = readPlayerProfiles();
  return profiles[getUserKey(user)] || null;
}

function writePlayerProfile(profile, user = readStoredUser()) {
  const profiles = readPlayerProfiles();
  profiles[getUserKey(user)] = profile;
  writeJsonStorage(PLAYER_PROFILES_KEY, profiles);
}

function readInventoryCache() {
  return readJsonStorage(PLAYER_INVENTORY_CACHE_KEY, {});
}

function writeInventoryCache(profile, payload, user = readStoredUser()) {
  const cache = readInventoryCache();
  cache[getUserKey(user)] = {
    nickname: profile.nickname,
    payload,
    timestamp: Date.now(),
  };
  writeJsonStorage(PLAYER_INVENTORY_CACHE_KEY, cache);
}

function getCachedInventory(user = readStoredUser()) {
  return readInventoryCache()[getUserKey(user)] || null;
}

function generateVerificationCode() {
  const cryptoValues = new Uint32Array(1);
  window.crypto?.getRandomValues?.(cryptoValues);
  const value = cryptoValues[0] || Math.floor(Math.random() * 900000);
  return String((value % 900000) + 100000);
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

function renderWebActions(profile = readPlayerProfile()) {
  const canUseActions = Boolean(profile?.verified && profile?.webToken);
  playerActionButtons.forEach((button) => {
    button.disabled = !canUseActions;
  });
  if (webActionSummary) {
    webActionSummary.textContent = canUseActions
      ? "서버 연결 준비됨"
      : profile?.verified
        ? "토큰 재확인 필요"
        : "인증 후 사용";
  }
  if (!profile?.verified) {
    setWebActionMessage("캐릭터 인증 후 웹사이트 버튼으로 서버에 액션을 보낼 수 있습니다.");
  } else if (!profile?.webToken) {
    setWebActionMessage("인증 확인 버튼을 눌러 웹 액션 토큰을 받아오세요.", "error");
  }
}

function getInventoryItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.inventory)) return payload.inventory;
  return [];
}

function normalizeSlotItem(item, index) {
  return {
    slot: Number.isFinite(item?.slot) ? item.slot : index,
    name: String(item?.name || item?.type || "알 수 없는 아이템"),
    count: Math.max(1, Number(item?.count || item?.amount || 1)),
    color: item?.color || getItemColor(String(item?.name || item?.type || "")),
  };
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

function buildFallbackInventory(profile) {
  const seed = Array.from(profile.nickname || "player").reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  const baseItems = [
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
  ];

  return {
    level: 12 + (seed % 28),
    health: `${16 + (seed % 5)} / 20`,
    location: `${100 + (seed % 420)}, ${62 + (seed % 8)}, ${-180 - (seed % 360)}`,
    items: baseItems,
    updatedAt: new Date().toISOString(),
    source: "local-preview",
  };
}

function renderInventory(payload = null) {
  if (!inventoryGrid) return;

  const profile = readPlayerProfile();
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
  const updatedLabel = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(updatedAt);

  if (inventorySummary) {
    inventorySummary.textContent = profile?.verified
      ? `${items.length}개 슬롯 · ${updatedLabel}`
      : "인증 후 표시";
  }
  if (inventoryEmpty) {
    inventoryEmpty.textContent = profile?.verified
      ? items.length
        ? `${profile.nickname} 인벤토리 동기화 완료`
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
    if (!response.ok) throw new Error(`player api ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function postPlayerAction(action) {
  const user = readStoredUser();
  const profile = readPlayerProfile(user);
  if (!profile?.verified) {
    setWebActionMessage("먼저 캐릭터 인증을 완료해 주세요.", "error");
    return;
  }

  if (!profile.webToken) {
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
      `/players/${encodeURIComponent(profile.nickname)}/actions/${encodeURIComponent(action)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${profile.webToken}`,
        },
        body: JSON.stringify({ webToken: profile.webToken }),
      },
    );
    setWebActionMessage(payload?.message || "서버 액션을 보냈습니다.", "success");
  } catch (error) {
    setWebActionMessage(error?.message || "서버 액션을 보내지 못했습니다.", "error");
  } finally {
    renderWebActions(profile);
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

async function checkPlayerVerification(profile, user) {
  const apiPayload = await fetchPlayerJson("/verification/check", {
    method: "POST",
    body: JSON.stringify({
      nickname: profile.nickname,
      code: profile.code,
      account: {
        email: user?.email || "",
        provider: user?.provider || "site",
        sub: user?.sub || "",
      },
    }),
  }).catch(() => null);

  return {
    ...profile,
    uuid: apiPayload?.uuid || profile.uuid || "",
    webToken: apiPayload?.webToken || profile.webToken || "",
    verified: playerApiBase ? Boolean(apiPayload?.verified) : allowLocalPlayerPreview,
    verifiedAt:
      apiPayload?.verified || allowLocalPlayerPreview ? new Date().toISOString() : profile.verifiedAt,
  };
}

async function loadPlayerInventory(profile, user = readStoredUser()) {
  if (!profile?.verified) {
    renderInventory(null);
    return;
  }

  setInventoryLoading(true);
  try {
    const apiPayload = await fetchPlayerJson(
      `/players/${encodeURIComponent(profile.nickname)}/inventory`,
      { method: "GET" },
    ).catch(() => null);
    const payload = apiPayload || (allowLocalPlayerPreview ? buildFallbackInventory(profile) : null);
    if (!payload) {
      setCharacterStatus("API 연결 필요", "error");
      renderInventory(null);
      return;
    }
    writeInventoryCache(profile, payload, user);
    renderInventory(payload);
  } finally {
    setInventoryLoading(false);
  }
}

function renderVerifyCard(profile) {
  if (!verifyCard) return;

  verifyCard.hidden = !profile;
  if (!profile) return;

  const command = getVerifyCommand(profile.code);
  if (verifyCode) verifyCode.textContent = profile.code;
  if (verifyCommand) verifyCommand.textContent = command;
}

function renderCharacterPanel(user = readStoredUser()) {
  if (!characterPanel) return;

  if (!user) {
    characterPanel.hidden = true;
    renderVerifyCard(null);
    renderInventory(null);
    renderWebActions(null);
    setCharacterStatus("인증 대기");
    return;
  }

  characterPanel.hidden = false;
  const profile = readPlayerProfile(user);
  const nicknameInput = characterForm?.elements?.nickname;

  if (nicknameInput && profile?.nickname) {
    nicknameInput.value = profile.nickname;
  }

  renderVerifyCard(profile);
  setCharacterStatus(profile?.verified ? "인증 완료" : profile ? "인증 확인 필요" : "인증 대기", profile?.verified ? "success" : "idle");
  if (refreshInventoryButton) refreshInventoryButton.disabled = !profile?.verified;
  renderWebActions(profile);

  const cached = getCachedInventory(user);
  if (cached?.payload && cached.nickname === profile?.nickname) {
    renderInventory(cached.payload);
  } else {
    renderInventory(null);
  }

  if (profile?.verified) {
    loadPlayerInventory(profile, user);
  }
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Use the fallback below.
  }

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

function decodeJwtPayload(token) {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Missing Google credential payload.");

  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function getGoogleUserFromCredential(credential) {
  const payload = decodeJwtPayload(credential);
  if (payload.aud !== googleClientId) throw new Error("Google credential audience mismatch.");
  if (Number(payload.exp) * 1000 < Date.now()) throw new Error("Google credential expired.");

  return {
    email: payload.email || "",
    name: payload.name || payload.email || "Google 사용자",
    picture: payload.picture || "",
    provider: "google",
    sub: payload.sub || "",
    signedInAt: new Date().toISOString(),
  };
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
    if (!window.google?.accounts?.id) {
      throw new Error("Google Identity Services is unavailable.");
    }
  });

  return googleScriptPromise;
}

function renderGoogleButton() {
  if (!googleLoginSlot || !window.google?.accounts?.id) return;

  googleLoginSlot.replaceChildren();
  window.google.accounts.id.initialize({
    client_id: googleClientId,
    callback: (response) => {
      try {
        const user = getGoogleUserFromCredential(response.credential);
        persistUser(user);
        renderAuthState(user);
        setMessage(`${user.name || user.email} 계정으로 로그인했습니다.`, "success");
      } catch {
        setMessage("Google 로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.", "error");
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

autoLoginButton?.addEventListener("click", () => {
  const nextEnabled = !readAutoLogin();
  setAutoLogin(nextEnabled);
  setMessage(nextEnabled ? "자동 로그인이 켜졌습니다." : "자동 로그인이 꺼졌습니다.");
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
  const profile = await requestPlayerVerification(nickname, user);
  writePlayerProfile(profile, user);
  renderVerifyCard(profile);
  renderInventory(null);
  renderWebActions(profile);
  setCharacterStatus(profile.verified ? "인증 완료" : "인증 확인 필요", profile.verified ? "success" : "idle");
  if (refreshInventoryButton) refreshInventoryButton.disabled = !profile.verified;
  if (profile.verified) loadPlayerInventory(profile, user);
  setMessage(`${nickname} 캐릭터 인증 코드를 만들었습니다.`, "success");
});

checkCharacterButton?.addEventListener("click", async () => {
  const user = readStoredUser();
  const profile = readPlayerProfile(user);
  if (!user || !profile) {
    setCharacterStatus("인증 대기", "error");
    return;
  }

  setCharacterStatus("인증 확인 중");
  const nextProfile = await checkPlayerVerification(profile, user);
  writePlayerProfile(nextProfile, user);
  renderVerifyCard(nextProfile);
  renderWebActions(nextProfile);
  setCharacterStatus(
    nextProfile.verified ? "인증 완료" : "아직 미인증",
    nextProfile.verified ? "success" : "error",
  );
  if (refreshInventoryButton) refreshInventoryButton.disabled = !nextProfile.verified;

  if (nextProfile.verified) {
    await loadPlayerInventory(nextProfile, user);
    setMessage(`${nextProfile.nickname} 캐릭터가 인증되었습니다.`, "success");
  } else {
    setMessage("서버에서 아직 캐릭터 인증을 확인하지 못했습니다.", "error");
  }
});

copyVerifyCommandButton?.addEventListener("click", async () => {
  const profile = readPlayerProfile();
  if (!profile?.code) return;

  const copied = await copyText(getVerifyCommand(profile.code));
  setMessage(copied ? "인증 명령어를 복사했습니다." : "명령어 복사에 실패했습니다.", copied ? "success" : "error");
});

refreshInventoryButton?.addEventListener("click", () => {
  const user = readStoredUser();
  const profile = readPlayerProfile(user);
  if (profile?.verified) loadPlayerInventory(profile, user);
});

playerActionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.playerAction;
    if (action) postPlayerAction(action);
  });
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
    const user = authApiBase
      ? authUserFromResponse(await postAuth("/auth/signup", { nickname, email, password }))
      : allowLocalAuthPreview
        ? createLocalUser({ email, name: nickname, provider: "site-preview" })
        : null;

    if (!user) {
      setMessage("회원가입 API 설정이 필요합니다. VITE_AUTH_API_BASE를 연결해 주세요.", "error");
      return;
    }

    persistUser(user);
    signupForm.reset();
    setMode("login");
    renderAuthState(user);
    setMessage("회원가입 후 로그인되었습니다.", "success");
  } catch (error) {
    setMessage(error.message || "회원가입하지 못했습니다.", "error");
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
    if (authApiBase) {
      await postAuth("/auth/reset", { email });
    } else if (!allowLocalAuthPreview) {
      setMessage("회원가입 API 설정이 필요합니다. VITE_AUTH_API_BASE를 연결해 주세요.", "error");
      return;
    }
    setMessage(`${email} 주소로 비밀번호 재설정 요청을 준비했습니다.`, "success");
  } catch (error) {
    setMessage(error.message || "비밀번호 재설정 요청을 처리하지 못했습니다.", "error");
  }
});

signoutButton?.addEventListener("click", () => {
  clearUser();
  setMode("login");
  renderAuthState(null);
  setMessage("로그아웃되었습니다.");
});

renderAutoLogin();
setMode("login");
renderAuthState();
initGoogleLogin();
