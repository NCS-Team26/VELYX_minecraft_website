import "./login.css";

const AUTH_STORAGE_KEY = "nfoifsb.googleUser";
const AUTH_EVENT_KEY = "nfoifsb.authEvent";
const AUTH_AUTO_KEY = "nfoifsb.autoLogin";
const PLAYER_PROFILES_KEY = "nfoifsb.playerProfiles";
const PLAYER_INVENTORY_CACHE_KEY = "nfoifsb.playerInventoryCache";
const INVENTORY_VIEW_KEY = "nfoifsb.inventoryView";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const publicPlayerApiBase = "/minecraft";
const funnelPlayerApiBase = "https://minecraftserver1.tail16d543.ts.net/minecraft";
const legacyPlayerApiBase = "https://api.nfoifsb.kr/minecraft";
const isHostedSite = ["www.nfoifsb.kr", "nfoifsb.kr"].includes(window.location.hostname);
const productionPlayerApiBase = isHostedSite ? publicPlayerApiBase : funnelPlayerApiBase;
const productionPlayerApiFallbackBase = `${funnelPlayerApiBase},${legacyPlayerApiBase}`;
const localPlayerApiBase = isLocalHost ? "http://127.0.0.1:8787/minecraft" : "";
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

const playerApiBases = apiBaseList(
  import.meta.env.VITE_PLAYER_API_BASE || productionPlayerApiBase,
  import.meta.env.VITE_PLAYER_API_FALLBACK_BASES || productionPlayerApiFallbackBase,
  localPlayerApiBase,
);
const playerApiBase = playerApiBases[0] || "";
const MINECRAFT_ASSET_VERSION = "1.21.8";
const MINECRAFT_TEXTURE_BASE = "https://assets.mcasset.cloud/latest/assets/minecraft/textures";
const MINECRAFT_TEXTURE_FALLBACK_BASE = `https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/${MINECRAFT_ASSET_VERSION}`;
const EQUIPMENT_SLOTS = [
  ["mainHand", "주 손"],
  ["offHand", "보조 손"],
  ["helmet", "투구"],
  ["chestplate", "갑옷"],
  ["leggings", "바지"],
  ["boots", "신발"],
];
const INVENTORY_SLOT_ORDER = [
  ...Array.from({ length: 27 }, (_, index) => index + 9),
  ...Array.from({ length: 9 }, (_, index) => index),
];
const LOGIN_STOCKS = [
  { code: "DMD", name: "다이아 광산", base: 3420, volume: 8420, drift: 0.048, change24h: 2.8 },
  { code: "FARM", name: "농산물 조합", base: 1280, volume: 12650, drift: 0.019, change24h: 1.4 },
  { code: "LOG", name: "건축 목재", base: 890, volume: 9340, drift: -0.012, change24h: -0.7 },
  { code: "RED", name: "레드스톤 공업", base: 2160, volume: 7990, drift: 0.033, change24h: 2.1 },
];
const PORTFOLIO_GRAPH_COLORS = ["#7ee7b4", "#63d4ff", "#ffcf6a", "#ff8c9a", "#b9a7ff", "#7fd7cc"];
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
const inventoryEquipment = document.querySelector("[data-inventory-equipment]");
let inventoryGraph = document.querySelector("[data-inventory-graph]");
let inventoryViewButtons = document.querySelectorAll("[data-inventory-view]");
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
let inventoryView = readInventoryView();
let currentInventoryPayload = null;
let minecraftIconCatalog = null;
let minecraftIconCatalogPromise = null;
let minecraftAtlasContextPromise = null;
const minecraftAtlasIconCache = new Map();
const minecraftAtlasImageCache = new Map();

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
    roles: Array.isArray(user.roles) ? user.roles : [],
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
  const canUseActions = Boolean(playerProfile?.verified && (playerProfile?.webToken || allowLocalPlayerPreview));
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
  } else if (!playerProfile?.webToken && !allowLocalPlayerPreview) {
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

function normalizeMinecraftId(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw
    .replace(/^minecraft:/, "")
    .replace(/[^a-z0-9_./-]+/g, "_")
    .replace(/^\/+/, "");
}

function minecraftIconCatalogKey(item) {
  const raw = String(item?.bukkit || item?.type || item?.key || item?.id || item?.texture || "").trim();
  if (!raw) return "";
  return normalizeMinecraftId(raw).toUpperCase();
}

function loadMinecraftIconCatalog() {
  if (minecraftIconCatalog || minecraftIconCatalogPromise) return minecraftIconCatalogPromise;
  minecraftIconCatalogPromise = import("minecraft-icon-items/data/itemsByBukkit.json")
    .then((module) => {
      minecraftIconCatalog = module.default || module || {};
      if (currentInventoryPayload) renderInventory(currentInventoryPayload);
      return minecraftIconCatalog;
    })
    .catch(() => {
      minecraftIconCatalog = {};
      return minecraftIconCatalog;
    });
  return minecraftIconCatalogPromise;
}

function bundledMinecraftIconSource(item) {
  const key = minecraftIconCatalogKey(item);
  if (!key) return "";
  const entry = minecraftIconCatalog?.[key];
  if (entry?.icon) return `data:image/png;base64,${entry.icon}`;
  loadMinecraftIconCatalog();
  return "";
}

function loadImageElement(src) {
  if (!src) return Promise.reject(new Error("Missing image source."));
  if (minecraftAtlasImageCache.has(src)) return minecraftAtlasImageCache.get(src);

  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Minecraft atlas image failed: ${src}`));
    image.src = src;
  });
  minecraftAtlasImageCache.set(src, promise);
  return promise;
}

function loadMinecraftAtlasContext() {
  if (minecraftAtlasContextPromise) return minecraftAtlasContextPromise;

  minecraftAtlasContextPromise = Promise.all([
    import("mc-assets/dist/itemsRenderer.js"),
    import("mc-assets/dist/atlasParser.js"),
    import("mc-assets/dist/blockStatesModels.json"),
    import("mc-assets/dist/itemDefinitions.json"),
    import("mc-assets/dist/itemsAtlases.json"),
    import("mc-assets/dist/blocksAtlases.json"),
    import("mc-assets/dist/itemsAtlasLatest.png?url"),
    import("mc-assets/dist/itemsAtlasLegacy.png?url"),
    import("mc-assets/dist/blocksAtlasLatest.png?url"),
    import("mc-assets/dist/blocksAtlasLegacy.png?url"),
    import("mc-assets/dist/stores.js"),
    import("mc-assets/dist/itemDefinitions.js"),
  ])
    .then(
      ([
        rendererModule,
        atlasParserModule,
        blockStatesModule,
        itemDefinitionsModule,
        itemsAtlasesModule,
        blocksAtlasesModule,
        itemsAtlasLatestModule,
        itemsAtlasLegacyModule,
        blocksAtlasLatestModule,
        blocksAtlasLegacyModule,
        storesModule,
        itemDefinitionsFns,
      ]) => {
      const blockStatesModels = blockStatesModule.default || blockStatesModule;
      const itemDefinitions = itemDefinitionsModule.default || itemDefinitionsModule;
      const itemsAtlasParser = new atlasParserModule.AtlasParser(
        itemsAtlasesModule.default || itemsAtlasesModule,
        itemsAtlasLatestModule.default || itemsAtlasLatestModule,
        itemsAtlasLegacyModule.default || itemsAtlasLegacyModule,
      );
      const blocksAtlasParser = new atlasParserModule.AtlasParser(
        blocksAtlasesModule.default || blocksAtlasesModule,
        blocksAtlasLatestModule.default || blocksAtlasLatestModule,
        blocksAtlasLegacyModule.default || blocksAtlasLegacyModule,
      );
      const renderer = new rendererModule.ItemsRenderer(
        MINECRAFT_ASSET_VERSION,
        blockStatesModels,
        itemsAtlasParser,
        blocksAtlasParser,
      );
      const itemDefinitionsStore = storesModule.getLoadedItemDefinitionsStore(itemDefinitions);
      return {
        renderer,
        itemDefinitionsStore,
        getItemDefinitionModelResolved: itemDefinitionsFns.getItemDefinitionModelResolved,
        itemsAtlasParser,
        blocksAtlasParser,
      };
    },
    )
    .catch((error) => {
      console.warn("Minecraft atlas icon loading failed.", error);
      return null;
    });

  return minecraftAtlasContextPromise;
}

function minecraftAtlasAliases(id) {
  return [...new Set([id, ...minecraftStateAliases(id), ...itemTextureAliases(id), ...blockTextureAliases(id)])];
}

function minecraftStateAliases(id) {
  const aliases = [];
  const directAliases = {
    bamboo_sapling: "bamboo",
    beetroots: "beetroot_seeds",
    bubble_column: "water_bucket",
    carrots: "carrot",
    cocoa: "cocoa_beans",
    end_gateway: "ender_eye",
    end_portal: "ender_eye",
    fire: "flint_and_steel",
    frosted_ice: "ice",
    lava: "lava_bucket",
    lava_cauldron: "cauldron",
    moving_piston: "piston",
    pitcher_crop: "pitcher_pod",
    piston_head: "piston",
    potatoes: "potato",
    powder_snow_cauldron: "cauldron",
    redstone_wall_torch: "redstone_torch",
    redstone_wire: "redstone",
    soul_fire: "soul_lantern",
    soul_wall_torch: "soul_torch",
    sweet_berry_bush: "sweet_berries",
    tall_seagrass: "seagrass",
    torchflower_crop: "torchflower_seeds",
    wall_torch: "torch",
    water: "water_bucket",
    water_cauldron: "cauldron",
  };

  if (directAliases[id]) aliases.push(directAliases[id]);
  if (id.startsWith("potted_")) aliases.push(id.replace(/^potted_/, ""), "flower_pot");
  if (id.endsWith("_wall_sign")) aliases.push(id.replace(/_wall_sign$/, "_sign"));
  if (id.endsWith("_wall_hanging_sign")) aliases.push(id.replace(/_wall_hanging_sign$/, "_hanging_sign"));
  if (id.endsWith("_wall_banner")) aliases.push(id.replace(/_wall_banner$/, "_banner"));
  if (id.endsWith("_wall_head")) aliases.push(id.replace(/_wall_head$/, "_head"));
  if (id.endsWith("_wall_skull")) aliases.push(id.replace(/_wall_skull$/, "_skull"));
  if (id.endsWith("_wall_fan")) aliases.push(id.replace(/_wall_fan$/, "_fan"));
  if (id === "candle_cake") aliases.push("cake", "candle");
  if (id.endsWith("_candle_cake")) aliases.push("cake", id.replace(/_candle_cake$/, "_candle"));
  return aliases;
}

function resolveMinecraftAtlasIcon(context, id) {
  const properties = { "minecraft:display_context": "gui" };
  for (const alias of minecraftAtlasAliases(id)) {
    const definition = context.getItemDefinitionModelResolved(
      context.itemDefinitionsStore,
      { version: MINECRAFT_ASSET_VERSION, name: alias, properties: { ...properties } },
      context.renderer,
    )?.modelResolved;
    const direct = context.renderer.getItemTexture(alias, properties);
    const resolved = definition || direct;
    if (resolved?.slice || (resolved?.top && resolved?.left && resolved?.right)) return resolved;
  }
  return null;
}

function atlasParserFor(context, type) {
  return type === "blocks" ? context.blocksAtlasParser : context.itemsAtlasParser;
}

async function drawAtlasSliceIcon(context, texture, size = 32) {
  const parser = atlasParserFor(context, texture.type);
  const atlas = parser.atlas.latest;
  const image = await loadImageElement(parser.latestImage);
  const [sourceX, sourceY, sourceWidth, sourceHeight] = texture.slice;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const scale = Math.min(size / sourceWidth, size / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const x = Math.round((size - width) / 2);
  const y = Math.round((size - height) / 2);
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);

  return { src: canvas.toDataURL("image/png"), type: texture.type, atlasWidth: atlas.width, atlasHeight: atlas.height };
}

function drawAtlasFace(ctx, image, slice, points, shade = "") {
  const [sourceX, sourceY, sourceWidth, sourceHeight] = slice;
  const [p0, p1, p2, p3] = points;
  const a = (p1.x - p0.x) / sourceWidth;
  const b = (p1.y - p0.y) / sourceWidth;
  const c = (p3.x - p0.x) / sourceHeight;
  const d = (p3.y - p0.y) / sourceHeight;
  const e = p0.x - a * sourceX - c * sourceY;
  const f = p0.y - b * sourceX - d * sourceY;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, sourceX, sourceY, sourceWidth, sourceHeight);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (shade) {
    ctx.fillStyle = shade;
    ctx.fill();
  }
  ctx.restore();
}

async function drawAtlasBlockIcon(context, block, size = 32) {
  const blocksImage = await loadImageElement(context.blocksAtlasParser.latestImage);
  const itemsImage = await loadImageElement(context.itemsAtlasParser.latestImage);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const imageFor = (texture) => (texture.type === "blocks" ? blocksImage : itemsImage);
  const scale = size / 32;
  const point = (x, y) => ({ x: Math.round(x * scale), y: Math.round(y * scale) });

  drawAtlasFace(
    ctx,
    imageFor(block.left),
    block.left.slice,
    [point(2, 8), point(16, 15), point(16, 31), point(2, 24)],
    "rgba(0, 0, 0, 0.28)",
  );
  drawAtlasFace(
    ctx,
    imageFor(block.right),
    block.right.slice,
    [point(30, 8), point(16, 15), point(16, 31), point(30, 24)],
    "rgba(0, 0, 0, 0.14)",
  );
  drawAtlasFace(
    ctx,
    imageFor(block.top),
    block.top.slice,
    [point(16, 1), point(30, 8), point(16, 15), point(2, 8)],
    "rgba(255, 255, 255, 0.06)",
  );

  return { src: canvas.toDataURL("image/png"), type: "blocks" };
}

async function renderMinecraftAtlasIcon(item) {
  const id = normalizeMinecraftId(item?.id || item?.key || item?.texture || item?.type || item?.name);
  if (!id) return null;
  if (minecraftAtlasIconCache.has(id)) return minecraftAtlasIconCache.get(id);

  const promise = loadMinecraftAtlasContext().then(async (context) => {
    if (!context) return null;
    const resolved = resolveMinecraftAtlasIcon(context, id);
    if (!resolved) return null;
    if (resolved.slice) return drawAtlasSliceIcon(context, resolved);
    if (resolved.top && resolved.left && resolved.right) return drawAtlasBlockIcon(context, resolved);
    return null;
  });

  minecraftAtlasIconCache.set(id, promise);
  return promise;
}

function applyInventoryImage(icon, src, { atlas = false, bundled = false, block = false } = {}) {
  if (!src || !icon?.isConnected) return;
  let image = icon.querySelector(".inventory-item-image");
  if (!image) {
    image = document.createElement("img");
    image.className = "inventory-item-image";
    image.alt = "";
    image.decoding = "async";
    image.draggable = false;
    icon.prepend(image);
  }
  image.src = src;
  image.dataset.inventoryIconMode = atlas ? "atlas" : bundled ? "bundled" : "fallback";
  icon.classList.add("has-image");
  icon.classList.toggle("has-atlas-image", atlas);
  icon.classList.toggle("has-bundled-image", bundled);
  icon.classList.toggle("is-block-texture", block);
}

function hydrateMinecraftAtlasIcon(icon, item) {
  renderMinecraftAtlasIcon(item)
    .then((result) => {
      if (!result) return;
      applyInventoryImage(icon, result.src, { atlas: true, block: result.type === "blocks" });
    })
    .catch(() => {});
}

function itemTextureCandidates(item) {
  const id = normalizeMinecraftId(item?.id || item?.key || item?.texture || item?.type || item?.name);
  const candidates = [];
  const bundledIcon = bundledMinecraftIconSource(item);

  if (bundledIcon) candidates.push(bundledIcon);

  [item?.iconUrl, item?.imageUrl, item?.textureUrl].forEach((url) => {
    if (typeof url === "string" && url.startsWith("https://")) candidates.push(url);
  });

  [item?.itemTexture, item?.blockTexture].forEach((path) => {
    const cleanPath = normalizeMinecraftId(path);
    if (cleanPath) candidates.push(`${MINECRAFT_TEXTURE_BASE}/${cleanPath}`);
  });

  if (id) {
    [...minecraftStateAliases(id), ...itemTextureAliases(id)].forEach((alias) => {
      candidates.push(`${MINECRAFT_TEXTURE_FALLBACK_BASE}/items/${alias}.png`);
      candidates.push(`${MINECRAFT_TEXTURE_BASE}/item/${alias}.png`);
    });
    [...minecraftStateAliases(id), ...blockTextureAliases(id)].forEach((alias) => {
      candidates.push(`${MINECRAFT_TEXTURE_FALLBACK_BASE}/blocks/${alias}.png`);
      candidates.push(`${MINECRAFT_TEXTURE_BASE}/block/${alias}.png`);
    });
  }

  return [...new Set(candidates)];
}

function itemTextureAliases(id) {
  const aliases = [id];
  if (id === "clock") aliases.push("clock_00");
  if (id === "compass") aliases.push("compass_16");
  if (id === "filled_map") aliases.push("filled_map_markings");
  if (id === "knowledge_book") aliases.push("book");
  if (id === "enchanted_book") aliases.push("enchanted_book");
  if (id.endsWith("_banner")) aliases.push("white_banner");
  return aliases;
}

function blockTextureAliases(id) {
  const aliases = [id];
  if (id.endsWith("_log") || id.endsWith("_stem")) {
    aliases.push(`${id}_side`);
  }
  if (id.endsWith("_wood") || id.endsWith("_hyphae")) {
    aliases.push(id.replace(/_(wood|hyphae)$/, "_log"));
  }
  if (id === "grass_block") aliases.push("grass_block_side");
  if (id === "podzol" || id === "mycelium") aliases.push(`${id}_side`);
  if (id === "crafting_table") aliases.push("crafting_table_front");
  if (id === "furnace" || id === "blast_furnace" || id === "smoker") aliases.push(`${id}_front`);
  if (id.endsWith("_ore")) aliases.push(id);
  return aliases;
}

function itemTooltip(item) {
  const lines = [item.name];
  if (item.key) lines.push(item.key);
  if (Number.isFinite(item.durability) && Number.isFinite(item.maxDurability)) {
    lines.push(`내구도 ${item.durability} / ${item.maxDurability}`);
  }
  if (Array.isArray(item.enchantments) && item.enchantments.length) {
    lines.push(...item.enchantments.map((enchant) => `${enchant.key || "enchant"} ${enchant.level || ""}`.trim()));
  }
  if (Array.isArray(item.lore) && item.lore.length) lines.push(...item.lore);
  return lines.filter(Boolean).join("\n");
}

function durabilityColor(percent) {
  if (percent > 60) return "#55ff55";
  if (percent > 30) return "#ffff55";
  return "#ff5555";
}

function createInventoryIcon(item) {
  const icon = document.createElement("span");
  icon.className = "inventory-item-icon";
  icon.style.setProperty("--item-color", item.color);
  icon.title = itemTooltip(item);
  const durabilityPercent = Number(item.durabilityPercent);
  const hasDurability = Number.isFinite(durabilityPercent) && durabilityPercent < 100;
  icon.classList.toggle("is-enchanted", Boolean(item.enchanted));
  icon.classList.toggle("is-damaged", hasDurability);
  if (hasDurability) {
    const clampedPercent = Math.max(0, Math.min(100, durabilityPercent));
    icon.style.setProperty("--durability-percent", `${clampedPercent}%`);
    icon.style.setProperty("--durability-color", durabilityColor(clampedPercent));
  }

  hydrateMinecraftAtlasIcon(icon, item);

  const candidates = itemTextureCandidates(item);
  if (candidates.length) {
    const image = document.createElement("img");
    image.className = "inventory-item-image";
    image.alt = "";
    image.decoding = "async";
    image.draggable = false;
    image.dataset.inventoryIconMode = "fallback";
    let index = 0;

    image.addEventListener("load", () => {
      if (image.dataset.inventoryIconMode === "atlas") return;
      const source = image.currentSrc || image.src;
      icon.classList.add("has-image");
      icon.classList.remove("has-atlas-image");
      icon.classList.toggle("has-bundled-image", source.startsWith("data:image/png;base64,"));
      icon.classList.toggle("is-block-texture", source.includes("/textures/block/") || source.includes("/blocks/"));
    });
    image.addEventListener("error", () => {
      if (image.dataset.inventoryIconMode === "atlas") return;
      index += 1;
      if (index < candidates.length) {
        image.src = candidates[index];
        return;
      }
      image.remove();
      icon.classList.remove("has-image", "has-atlas-image", "has-bundled-image", "is-block-texture");
    });

    image.src = candidates[index];
    icon.append(image);
  }

  if (hasDurability) {
    const durability = document.createElement("span");
    durability.className = "inventory-durability-bar";
    durability.setAttribute("aria-hidden", "true");
    icon.append(durability);
  }

  return icon;
}

function normalizeSlotItem(item, index) {
  const slot = Number(item?.slot);
  const count = Number(item?.count || item?.amount || 1);
  const durabilityPercent = Number(item?.durabilityPercent);
  const durability = Number(item?.durability);
  const maxDurability = Number(item?.maxDurability);
  const name = String(item?.name || item?.type || "알 수 없는 아이템");
  return {
    ...item,
    slot: Number.isFinite(slot) ? slot : index,
    name,
    count: Math.max(1, Number.isFinite(count) ? count : 1),
    id: normalizeMinecraftId(item?.id || item?.key || item?.texture || item?.type || name),
    key: item?.key || (item?.id || item?.type ? `minecraft:${normalizeMinecraftId(item?.id || item?.type)}` : ""),
    durabilityPercent: Number.isFinite(durabilityPercent) ? durabilityPercent : undefined,
    durability: Number.isFinite(durability) ? durability : undefined,
    maxDurability: Number.isFinite(maxDurability) ? maxDurability : undefined,
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
      { slot: 0, name: "다이아몬드 검", type: "DIAMOND_SWORD", id: "diamond_sword", count: 1, color: "#55d9e8" },
      { slot: 1, name: "철 곡괭이", type: "IRON_PICKAXE", id: "iron_pickaxe", count: 1, color: "#c9d0d5" },
      { slot: 2, name: "횃불", type: "TORCH", id: "torch", count: 32 + (seed % 24), color: "#f5c84b" },
      { slot: 3, name: "구운 돼지고기", type: "COOKED_PORKCHOP", id: "cooked_porkchop", count: 12 + (seed % 8), color: "#d68a54" },
      { slot: 4, name: "참나무 원목", type: "OAK_LOG", id: "oak_log", count: 24 + (seed % 32), color: "#9a6439" },
      { slot: 9, name: "방패", type: "SHIELD", id: "shield", count: 1, color: "#8f9693" },
      { slot: 10, name: "물 양동이", type: "WATER_BUCKET", id: "water_bucket", count: 1, color: "#4da3ff" },
      { slot: 11, name: "에메랄드", type: "EMERALD", id: "emerald", count: 3 + (seed % 9), color: "#31c96b" },
      { slot: 18, name: "엔더 진주", type: "ENDER_PEARL", id: "ender_pearl", count: 2 + (seed % 4), color: "#46a082" },
      { slot: 27, name: "황금 사과", type: "GOLDEN_APPLE", id: "golden_apple", count: 1, color: "#f5c84b" },
    ],
    equipment: {
      mainHand: { name: "다이아몬드 검", type: "DIAMOND_SWORD", id: "diamond_sword", count: 1, color: "#55d9e8" },
      offHand: { name: "방패", type: "SHIELD", id: "shield", count: 1, color: "#8f9693" },
    },
    updatedAt: new Date().toISOString(),
    source: "local-preview",
  };
}

function ensureInventoryControls() {
  const toolbar = document.querySelector(".inventory-toolbar");
  let tools = document.querySelector(".inventory-tools");

  if (toolbar && !tools) {
    tools = document.createElement("div");
    tools.className = "inventory-tools";
    if (refreshInventoryButton?.parentElement === toolbar) {
      toolbar.replaceChild(tools, refreshInventoryButton);
    } else {
      toolbar.append(tools);
    }
  }

  if (tools && !tools.querySelector("[data-inventory-view]")) {
    const switcher = document.createElement("div");
    switcher.className = "inventory-view-switch";
    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", "인벤토리와 보유 주식 보기");

    const gridButton = document.createElement("button");
    gridButton.type = "button";
    gridButton.dataset.inventoryView = "grid";
    gridButton.setAttribute("aria-pressed", "true");
    gridButton.textContent = "슬롯";

    const graphButton = document.createElement("button");
    graphButton.type = "button";
    graphButton.dataset.inventoryView = "graph";
    graphButton.setAttribute("aria-pressed", "false");
    graphButton.textContent = "보유주식";

    switcher.append(gridButton, graphButton);
    tools.prepend(switcher);
  }

  if (tools && refreshInventoryButton && refreshInventoryButton.parentElement !== tools) {
    tools.append(refreshInventoryButton);
  }

  if (!inventoryGraph && inventoryGrid?.parentElement) {
    inventoryGraph = document.createElement("div");
    inventoryGraph.className = "inventory-graph";
    inventoryGraph.setAttribute("aria-label", "보유 주식 그래프");
    inventoryGraph.setAttribute("data-inventory-graph", "");
    inventoryGraph.hidden = true;
    inventoryGrid.insertAdjacentElement("afterend", inventoryGraph);
  }

  inventoryGraph = document.querySelector("[data-inventory-graph]");
  inventoryViewButtons = document.querySelectorAll("[data-inventory-view]");
}

function readInventoryView() {
  try {
    return localStorage.getItem(INVENTORY_VIEW_KEY) === "graph" ? "graph" : "grid";
  } catch {
    return "grid";
  }
}

function setInventoryView(view) {
  inventoryView = view === "graph" ? "graph" : "grid";
  try {
    localStorage.setItem(INVENTORY_VIEW_KEY, inventoryView);
  } catch {}
  applyInventoryView(readPlayerProfile());
}

function applyInventoryView(playerProfile = readPlayerProfile()) {
  ensureInventoryControls();
  const graphMode = inventoryView === "graph";
  const toolbarLabel = document.querySelector(".inventory-toolbar span");
  inventoryViewButtons.forEach((button) => {
    const isActive = button.dataset.inventoryView === inventoryView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  if (toolbarLabel) toolbarLabel.textContent = graphMode ? "보유 주식" : "인벤토리";
  if (inventoryGrid) inventoryGrid.hidden = graphMode;
  if (inventoryEquipment) inventoryEquipment.hidden = graphMode || !playerProfile?.verified;
  if (inventoryGraph) inventoryGraph.hidden = !graphMode;
  if (inventoryEmpty) inventoryEmpty.hidden = graphMode;
  if (graphMode) renderPortfolioGraph(playerProfile);
}

function classifyInventoryItem(item) {
  const text = `${item.id || ""} ${item.type || ""} ${item.key || ""} ${item.name || ""}`.toLowerCase();
  if (/(sword|axe|bow|crossbow|trident|shield|helmet|chestplate|leggings|boots|검|도끼|활|방패|투구|갑옷|바지|신발)/.test(text)) {
    return ["전투 장비", "#ff8c9a"];
  }
  if (/(pickaxe|shovel|hoe|shears|fishing_rod|flint_and_steel|곡괭이|삽|괭이|낚싯대|가위)/.test(text)) {
    return ["도구", "#79d8ff"];
  }
  if (/(diamond|emerald|gold|iron|copper|netherite|coal|lapis|redstone|quartz|다이아|에메랄드|금|철|구리|석탄|레드스톤)/.test(text)) {
    return ["광물", "#7ee7b4"];
  }
  if (/(log|plank|stone|dirt|sand|glass|brick|block|wood|stem|원목|나무|돌|흙|모래|유리|블록)/.test(text)) {
    return ["블록", "#d7b77a"];
  }
  if (/(apple|bread|beef|porkchop|chicken|fish|carrot|potato|cookie|food|사과|빵|고기|생선|당근|감자)/.test(text)) {
    return ["식량", "#ffcf6a"];
  }
  if (/(potion|pearl|book|map|totem|elytra|enchanted|ender|포션|진주|책|지도|토템)/.test(text)) {
    return ["특수", "#c996ff"];
  }
  return ["기타", "#a9b7af"];
}

function parseHealthValue(value) {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const current = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return null;
  return Math.max(0, Math.min(100, (current / max) * 100));
}

function inventoryEquipmentItems(payload) {
  const equipment = payload?.equipment || {};
  return EQUIPMENT_SLOTS.map(([key], index) => (equipment[key] ? normalizeSlotItem(equipment[key], index) : null)).filter(
    Boolean,
  );
}

function createGraphMetric(label, value, tone = "neutral") {
  const metric = document.createElement("div");
  metric.className = `inventory-graph-metric is-${tone}`;

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("strong");
  valueElement.textContent = value;

  metric.append(labelElement, valueElement);
  return metric;
}

function stockCode(item) {
  return item?.symbol || item?.code || "";
}

function findStock(code, stocks = stockSymbols()) {
  return stocks.find((stock) => stockCode(stock) === code) || null;
}

function portfolioPositions() {
  const stocks = stockSymbols();
  const positions = Array.isArray(stockPortfolioPayload?.positions) ? stockPortfolioPayload.positions : [];
  return positions
    .map((position, index) => {
      const code = stockCode(position);
      const stock = findStock(code, stocks);
      const shares = Number(position.shares ?? position.quantity ?? position.amount ?? 0);
      const price = Number(stock?.price ?? position.price ?? position.avgPrice ?? 0);
      const value = Number(position.value ?? position.marketValue ?? shares * price);
      return {
        code,
        name: stock?.name || position.name || "보유 종목",
        shares: Number.isFinite(shares) ? shares : 0,
        value: Number.isFinite(value) ? Math.max(0, value) : 0,
        color: PORTFOLIO_GRAPH_COLORS[index % PORTFOLIO_GRAPH_COLORS.length],
      };
    })
    .filter((position) => position.code && (position.shares > 0 || position.value > 0))
    .sort((left, right) => right.value - left.value);
}

function createPortfolioEmpty(title, detail) {
  const empty = document.createElement("div");
  empty.className = "portfolio-graph-empty";

  const strong = document.createElement("strong");
  strong.textContent = title;
  const span = document.createElement("span");
  span.textContent = detail;

  empty.append(strong, span);
  return empty;
}

function portfolioConicGradient(positions, totalValue) {
  if (!positions.length || totalValue <= 0) {
    return "conic-gradient(from 210deg, rgba(126, 231, 180, 0.32), rgba(99, 212, 255, 0.18))";
  }

  let cursor = 0;
  const slices = positions.map((position) => {
    const size = Math.max(0, (position.value / totalValue) * 100);
    const start = cursor;
    const end = cursor + size;
    cursor = end;
    return `${position.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });
  return `conic-gradient(from 210deg, ${slices.join(", ")})`;
}

function renderPortfolioGraph(playerProfile = readPlayerProfile()) {
  ensureInventoryControls();
  if (!inventoryGraph) return;
  inventoryGraph.replaceChildren();
  inventoryGraph.classList.add("is-portfolio");

  const positions = portfolioPositions();
  const totalValue = positions.reduce((sum, position) => sum + position.value, 0);
  const totalShares = positions.reduce((sum, position) => sum + position.shares, 0);
  const maxWeight = totalValue ? Math.max(...positions.map((position) => position.value / totalValue)) * 100 : 0;
  const liveMarket = hasLiveStockMarket();
  const balance =
    stockPortfolioPayload?.balance === undefined ? "--" : `₩${formatStockMoney(stockPortfolioPayload.balance)}`;

  if (!playerProfile?.verified) {
    if (inventorySummary && inventoryView === "graph") inventorySummary.textContent = "인증 후 표시";
    inventoryGraph.append(
      createPortfolioEmpty("캐릭터 인증 필요", "인증이 끝나면 보유 주식 비중과 평가액이 여기에 표시됩니다."),
    );
    return;
  }

  const heading = document.createElement("div");
  heading.className = "inventory-graph-heading";
  const title = document.createElement("strong");
  title.textContent = "보유 주식 그래프";
  const subtitle = document.createElement("span");
  subtitle.textContent = liveMarket ? "실시간 시세 기준" : "연결 대기 중 · 미리보기 시세 기준";
  heading.append(title, subtitle);

  if (inventorySummary && inventoryView === "graph") {
    inventorySummary.textContent = positions.length
      ? `${positions.length}종목 · 평가 ₩${formatStockMoney(totalValue)}`
      : "보유 주식 없음";
  }

  const metrics = document.createElement("div");
  metrics.className = "inventory-graph-metrics";
  metrics.append(
    createGraphMetric("총 평가", `₩${formatStockMoney(totalValue)}`, totalValue > 0 ? "good" : "neutral"),
    createGraphMetric("보유 종목", `${positions.length}종목`, positions.length ? "blue" : "neutral"),
    createGraphMetric("총 주수", `${formatStockMoney(totalShares)}주`, totalShares ? "good" : "neutral"),
    createGraphMetric("현금 잔고", balance, stockPortfolioPayload?.balance ? "warm" : "neutral"),
  );

  if (!positions.length) {
    inventoryGraph.append(
      heading,
      metrics,
      createPortfolioEmpty("보유 주식 없음", "STOCK 화면에서 매수하면 종목별 평가액과 비중 그래프가 표시됩니다."),
    );
    return;
  }

  const body = document.createElement("div");
  body.className = "portfolio-graph-body";

  const donut = document.createElement("div");
  donut.className = "portfolio-graph-donut";
  donut.style.setProperty("--portfolio-slices", portfolioConicGradient(positions, totalValue));
  const donutCenter = document.createElement("div");
  donutCenter.className = "portfolio-graph-center";
  const donutValue = document.createElement("strong");
  donutValue.textContent = `₩${formatStockMoney(totalValue)}`;
  const donutLabel = document.createElement("span");
  donutLabel.textContent = `최대 비중 ${maxWeight.toFixed(0)}%`;
  donutCenter.append(donutValue, donutLabel);
  donut.append(donutCenter);

  const bars = document.createElement("div");
  bars.className = "portfolio-graph-bars";
  positions.forEach((position) => {
    const weight = totalValue ? (position.value / totalValue) * 100 : 0;
    const row = document.createElement("div");
    row.className = "inventory-graph-row portfolio-graph-row";
    row.style.setProperty("--bar-color", position.color);
    row.style.setProperty("--bar-size", `${Math.max(7, weight)}%`);

    const label = document.createElement("span");
    label.textContent = `${position.code} · ${position.name}`;

    const track = document.createElement("div");
    track.className = "inventory-graph-track";
    track.append(document.createElement("i"));

    const value = document.createElement("strong");
    value.textContent = `₩${formatStockMoney(position.value)}`;
    value.title = `${formatStockMoney(position.shares)}주 · ${weight.toFixed(1)}%`;

    const detail = document.createElement("em");
    detail.textContent = `${formatStockMoney(position.shares)}주 · ${weight.toFixed(1)}%`;

    row.append(label, track, value, detail);
    bars.append(row);
  });

  body.append(donut, bars);

  const legend = document.createElement("div");
  legend.className = "portfolio-graph-legend";
  positions.slice(0, 4).forEach((position) => {
    const item = document.createElement("span");
    item.style.setProperty("--legend-color", position.color);
    item.textContent = position.code;
    legend.append(item);
  });

  inventoryGraph.append(heading, metrics, body, legend);
}

function renderEquipment(payload = null, playerProfile = readPlayerProfile()) {
  if (!inventoryEquipment) return;
  const equipment = payload?.equipment || {};
  inventoryEquipment.replaceChildren(
    ...EQUIPMENT_SLOTS.map(([key, label], index) => {
      const item = equipment[key] ? normalizeSlotItem(equipment[key], index) : null;
      const slot = document.createElement("div");
      slot.className = `equipment-slot${item ? "" : " is-empty"}`;
      slot.setAttribute("role", "listitem");
      slot.setAttribute("aria-label", item ? `${label}: ${item.name} ${item.count}개` : `${label}: 비어 있음`);

      const labelElement = document.createElement("span");
      labelElement.className = "equipment-label";
      labelElement.textContent = label;
      slot.append(labelElement);

      if (item) {
        slot.append(createInventoryIcon(item));
        if (item.count > 1) {
          const count = document.createElement("span");
          count.className = "inventory-item-count";
          count.textContent = String(item.count);
          slot.append(count);
        }
      }

      return slot;
    }),
  );
  inventoryEquipment.hidden = !playerProfile?.verified;
}

function renderInventory(payload = null) {
  if (!inventoryGrid) return;
  currentInventoryPayload = payload;
  const playerProfile = readPlayerProfile();
  const items = getInventoryItems(payload).map(normalizeSlotItem);
  const bySlot = new Map(items.map((item) => [item.slot, item]));
  const heldSlot = Number(payload?.heldSlot);
  inventoryGrid.replaceChildren();
  renderEquipment(payload, playerProfile);

  INVENTORY_SLOT_ORDER.forEach((slot, displayIndex) => {
    const item = bySlot.get(slot);
    const cell = document.createElement("div");
    cell.className = `inventory-slot${item ? "" : " is-empty"}`;
    cell.classList.toggle("is-hotbar", slot < 9);
    cell.classList.toggle("is-held-slot", slot < 9 && Number.isFinite(heldSlot) && heldSlot === slot);
    cell.dataset.slot = String(slot);
    cell.setAttribute("role", "listitem");
    cell.setAttribute(
      "aria-label",
      item
        ? `${slot < 9 ? "핫바" : "인벤토리"} ${displayIndex + 1}: ${item.name} ${item.count}개`
        : `${slot < 9 ? "핫바" : "인벤토리"} 빈 슬롯 ${displayIndex + 1}`,
    );

    if (item) {
      cell.append(createInventoryIcon(item));

      if (item.count > 1) {
        const count = document.createElement("span");
        count.className = "inventory-item-count";
        count.textContent = String(item.count);
        cell.append(count);
      }
    }

    inventoryGrid.append(cell);
  });

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
  renderPortfolioGraph(playerProfile);
  applyInventoryView(playerProfile);
}

async function fetchPlayerJson(path, options = {}) {
  if (!playerApiBases.length) return null;

  let lastError = null;
  for (const base of playerApiBases) {
    try {
      return await fetchPlayerJsonFrom(base, path, options);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("서버 플레이어 API에 연결하지 못했습니다.");
}

async function fetchPlayerJsonFrom(base, path, options = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);
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

function formatStockMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(number);
}

function buildLoginFallbackMarket() {
  const tick = Math.floor(Date.now() / 60000);
  const stocks = LOGIN_STOCKS.map((stock, index) => {
    const wave = Math.sin(tick / (18 + index * 3) + index * 1.7) * stock.base * 0.018;
    const drift = stock.base * stock.drift * 0.12;
    const price = Math.max(1, Math.round(stock.base + wave + drift));
    const open24h = Math.max(1, Math.round(price / (1 + stock.change24h / 100)));
    return {
      ...stock,
      symbol: stock.code,
      price,
      open24h,
      updatedAt: new Date().toISOString(),
    };
  });
  return {
    ok: true,
    preview: true,
    stocks,
    market: {
      session: "PREVIEW",
      updatedAt: new Date().toISOString(),
    },
  };
}

function setStockTraderMessage(text, tone = "info") {
  if (!stockTraderMessage) return;
  const incomingText = String(text || "");
  const isLegacyExchangeFailure = /거래소\s*API.*불러오지\s*못/.test(incomingText);
  const safeText = isLegacyExchangeFailure
    ? "실시간 거래소 연결을 확인 중입니다. 보유 주식 그래프는 가능한 데이터로 표시됩니다."
    : incomingText;
  const safeTone = isLegacyExchangeFailure ? "info" : tone;
  stockTraderMessage.textContent = safeText;
  stockTraderMessage.classList.toggle("is-error", safeTone === "error");
  stockTraderMessage.classList.toggle("is-success", safeTone === "success");
}

function hasLiveStockMarket() {
  return Boolean(Array.isArray(stockMarketPayload?.stocks) && stockMarketPayload.stocks.length && !stockMarketPayload.preview);
}

function hasLiveStockPortfolio() {
  return Boolean(stockPortfolioPayload?.ok && !stockPortfolioPayload.preview);
}

function stockSymbols() {
  return Array.isArray(stockMarketPayload?.stocks) && stockMarketPayload.stocks.length
    ? stockMarketPayload.stocks
    : buildLoginFallbackMarket().stocks;
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
  const liveMarket = hasLiveStockMarket();
  const livePortfolio = hasLiveStockPortfolio();
  const canTrade = Boolean(
    playerProfile?.verified && playerProfile?.webToken && playerApiBase && liveMarket && stocks.length && !stockTraderLoading,
  );

  renderStockOptions();
  if (stockSymbolSelect) stockSymbolSelect.disabled = !canTrade;
  if (stockQuantityInput) stockQuantityInput.disabled = !canTrade;
  stockTradeButtons.forEach((button) => {
    button.disabled = !canTrade;
  });

  const stock = selectedStock();
  const positions = portfolioPositions();
  const selectedCode = selectedStockSymbol();
  const position = positions.find((item) => item.code === selectedCode) || selectedPosition();
  const portfolioValue = positions.reduce((sum, item) => sum + item.value, 0);
  const portfolioShares = positions.reduce((sum, item) => sum + item.shares, 0);
  if (stockTraderSummary) {
    stockTraderSummary.textContent = canTrade
      ? "실거래 가능"
      : stockTraderLoading
        ? "거래소 확인 중"
        : playerProfile?.verified
          ? liveMarket || stocks.length
            ? "보유 주식 그래프"
            : "거래소 연결 대기"
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
    if (stockSymbolSelect && position) {
      stockTraderPosition.textContent = `보유 ${formatStockMoney(position.shares)}주 · 평가 ${formatStockMoney(position.value)}`;
    } else {
      stockTraderPosition.textContent = positions.length
        ? `${positions.length}종목 · ${formatStockMoney(portfolioShares)}주 · 평가 ${formatStockMoney(portfolioValue)}`
        : "보유 0주 · 평가 0";
    }
  }

  if (!playerProfile?.verified) {
    setStockTraderMessage("캐릭터 인증 후 서버 머니로 24시간 주식을 거래할 수 있습니다.");
  } else if (!playerProfile.webToken) {
    setStockTraderMessage("인증 확인을 다시 눌러 웹 토큰을 받아오세요.", "error");
  } else if (!playerApiBase) {
    setStockTraderMessage("VITE_PLAYER_API_BASE가 연결되면 실제 거래가 활성화됩니다.", "error");
  } else if (stockTraderLoading) {
    setStockTraderMessage("거래소와 보유 주식을 확인하는 중입니다.");
  } else if (canTrade && livePortfolio) {
    setStockTraderMessage("실시간 시세와 보유 주식이 연결되었습니다.", "success");
  } else if (liveMarket) {
    setStockTraderMessage("거래소 시세가 연결되었습니다. 보유 주식은 STOCK 화면과 동기화됩니다.");
  } else {
    setStockTraderMessage("실시간 거래소 연결을 확인 중입니다. 보유 주식 그래프는 가능한 데이터로 표시됩니다.");
  }

  renderPortfolioGraph(playerProfile);
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
    if (market?.ok && Array.isArray(market?.stocks) && market.stocks.length) {
      stockMarketPayload = market;
    } else {
      stockMarketPayload = buildLoginFallbackMarket();
    }
  } catch {
    stockMarketPayload = buildLoginFallbackMarket();
  }

  try {
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
  } catch {
    stockPortfolioPayload = stockPortfolioPayload?.ok
      ? stockPortfolioPayload
      : { ok: true, preview: true, balance: undefined, positions: [] };
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
  const request = {
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
  };
  const apiPayload = playerApiBase ? await fetchPlayerJson("/verification/start", request) : null;
  const code = String(apiPayload?.code || (allowLocalPlayerPreview ? generateVerificationCode() : ""));
  if (!code) throw new Error("서버 인증 코드 발급 API에 연결하지 못했습니다.");
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
    webToken: apiPayload?.webToken || playerProfile.webToken || (allowLocalPlayerPreview ? "local-preview-token" : ""),
    verified: playerApiBase ? Boolean(apiPayload?.verified) : allowLocalPlayerPreview,
    verifiedAt: apiPayload?.verified || allowLocalPlayerPreview ? new Date().toISOString() : playerProfile.verifiedAt,
  };
}

async function loadPlayerInventory(playerProfile, user = readStoredUser()) {
  if (!playerProfile?.verified) {
    renderInventory(null);
    return;
  }
  if (!playerProfile.webToken) {
    if (!allowLocalPlayerPreview) {
      setCharacterStatus("인증 토큰 필요", "error");
      renderInventory(null);
      return;
    }
  }

  setInventoryLoading(true);
  try {
    const apiPayload = await fetchPlayerJson(`/players/${encodeURIComponent(playerProfile.nickname)}/inventory`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${playerProfile.webToken}`,
      },
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
  try {
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
  } catch (error) {
    setCharacterStatus("코드 생성 실패", "error");
    setMessage(error?.message || "캐릭터 인증 코드를 만들지 못했습니다.", "error");
  }
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

ensureInventoryControls();
inventoryViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setInventoryView(button.dataset.inventoryView || "grid");
  });
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
