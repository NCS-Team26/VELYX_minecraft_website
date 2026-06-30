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
const loginDialog = document.querySelector("[data-login-dialog]");
const loginPanel = document.querySelector("[data-login-panel]");
const loginMessage = document.querySelector("[data-login-message]");
const loginButton = document.querySelector("[data-open-login]");
const googleLoginSlot = document.querySelector("[data-google-login]");
const loginProfile = document.querySelector("[data-login-profile]");
const loginAvatar = document.querySelector("[data-login-avatar]");
const loginProfileName = document.querySelector("[data-login-profile-name]");
const loginProfileEmail = document.querySelector("[data-login-profile-email]");
const googleLogoutButton = document.querySelector("[data-google-logout]");
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const AUTH_STORAGE_KEY = "nfoifsb.googleUser";

let googleScriptPromise;

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
  try {
    const response = await fetch(STATUS_API, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const data = await response.json();

    const online = Boolean(data.online);
    const playersOnline = data.players?.online ?? 0;
    const playersMax = data.players?.max ?? 10;
    const meterWidth = Math.min(100, Math.round((playersOnline / Math.max(playersMax, 1)) * 100));

    statusDot?.classList.toggle("is-online", online);
    if (statusLabel) statusLabel.textContent = online ? "온라인" : "오프라인";
    if (playerCount) playerCount.textContent = `${playersOnline} / ${playersMax}`;
    if (playerMeter) playerMeter.style.width = `${meterWidth}%`;
    if (versionLabel) versionLabel.textContent = data.version?.name_clean || "Paper 26.1.2";
  } catch {
    statusDot?.classList.remove("is-online");
    if (statusLabel) statusLabel.textContent = "상태 확인 실패";
    if (playerCount) playerCount.textContent = "-- / 10";
    if (playerMeter) playerMeter.style.width = "0%";
  } finally {
    window.clearTimeout(timer);
  }
}

function setLoginMessage(message, tone = "info") {
  if (!loginMessage) return;
  loginMessage.textContent = message;
  loginMessage.classList.toggle("is-error", tone === "error");
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // The UI still works when storage is unavailable.
  }
}

function clearStoredUser() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem("nfoifsb.nickname");
  } catch {
    // Sign-out still updates this session even if storage is unavailable.
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

function renderAuthState(user) {
  if (user) {
    const displayName = user.name || user.email || "Google 사용자";
    loginButton.textContent = displayName;
    loginButton.classList.add("is-authenticated");
    loginButton.setAttribute("aria-label", `${displayName} 계정 정보 열기`);

    if (loginProfile) loginProfile.hidden = false;
    if (loginProfileName) loginProfileName.textContent = displayName;
    if (loginProfileEmail) loginProfileEmail.textContent = user.email || "";

    if (loginAvatar) {
      loginAvatar.hidden = !user.picture;
      if (user.picture) loginAvatar.setAttribute("src", user.picture);
    }

    if (googleLogoutButton) googleLogoutButton.hidden = false;
    setLoginMessage(`${displayName} 계정으로 로그인되어 있습니다.`);
    return;
  }

  loginButton.textContent = "로그인";
  loginButton.classList.remove("is-authenticated");
  loginButton.setAttribute("aria-label", "로그인");
  if (loginProfile) loginProfile.hidden = true;
  if (loginAvatar) {
    loginAvatar.hidden = true;
    loginAvatar.removeAttribute("src");
  }
  if (loginProfileName) loginProfileName.textContent = "";
  if (loginProfileEmail) loginProfileEmail.textContent = "";
  if (googleLogoutButton) googleLogoutButton.hidden = true;
  setLoginMessage("Google 계정으로 로그인해 주세요.");
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
        writeStoredUser(user);
        renderAuthState(user);
        window.setTimeout(() => loginDialog?.close(), 650);
      } catch {
        setLoginMessage("Google 로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.", "error");
      }
    },
    auto_select: false,
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
  const savedUser = readStoredUser();
  renderAuthState(savedUser);

  if (!googleClientId) {
    renderGoogleFallback("Google 로그인 설정 필요");
    setLoginMessage("VITE_GOOGLE_CLIENT_ID를 설정하면 Google 로그인이 활성화됩니다.", "error");
    return;
  }

  loadGoogleIdentityScript()
    .then(renderGoogleButton)
    .catch(() => {
      renderGoogleFallback("Google 로그인 로드 실패");
      setLoginMessage("Google 로그인 버튼을 불러오지 못했습니다.", "error");
    });
}

function initLogin() {
  if (!loginDialog || !loginPanel || !loginButton) return;

  loginButton.addEventListener("click", () => {
    if (typeof loginDialog.showModal === "function") {
      loginDialog.showModal();
    } else {
      loginDialog.setAttribute("open", "");
    }
  });

  document.querySelector("[data-close-login]")?.addEventListener("click", () => {
    loginDialog.close();
  });

  loginDialog.addEventListener("click", (event) => {
    if (event.target === loginDialog) loginDialog.close();
  });

  googleLogoutButton?.addEventListener("click", () => {
    window.google?.accounts?.id?.disableAutoSelect();
    clearStoredUser();
    renderAuthState(null);
  });

  initGoogleLogin();
}

function initTheme() {
  const toggle = document.querySelector("[data-theme-toggle]");
  if (!toggle) return;

  const root = document.documentElement;
  const icons = toggle.querySelectorAll("[data-theme-icon]");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  const resolved = () =>
    root.getAttribute("data-theme") || (systemDark.matches ? "dark" : "light");

  const sync = () => {
    const theme = resolved();
    icons.forEach((ic) => {
      ic.hidden = ic.dataset.themeIcon !== theme;
    });
    toggle.setAttribute(
      "aria-label",
      theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환",
    );
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      // Drop the media filter so the pinned theme's color always wins.
      m.removeAttribute("media");
      m.setAttribute("content", theme === "dark" ? "#0d1411" : "#f5f5f7");
    });
  };

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
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadScene, { timeout: 2000 });
  } else {
    window.addEventListener("load", loadScene, { once: true });
  }
}

document.querySelectorAll("[data-copy-address]").forEach((button) => {
  button.addEventListener("click", copyAddress);
});

initTheme();
initNav();
initScrollReveal();
initLogin();
deferSceneLoad();
refreshStatus();
setInterval(refreshStatus, 60000);
