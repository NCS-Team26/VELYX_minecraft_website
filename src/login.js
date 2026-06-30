import "./login.css";

const AUTH_STORAGE_KEY = "nfoifsb.googleUser";
const AUTH_EVENT_KEY = "nfoifsb.authEvent";
const AUTH_AUTO_KEY = "nfoifsb.autoLogin";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

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
const modeButtons = document.querySelectorAll("[data-mode-button]");

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
  autoLoginButton.textContent = enabled ? "자동 로그인 켜짐" : "자동 로그인 꺼짐";
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
    profile.hidden = true;
    if (avatar) {
      avatar.hidden = true;
      avatar.removeAttribute("src");
    }
    if (profileName) profileName.textContent = "";
    if (profileEmail) profileEmail.textContent = "";
    return;
  }

  const displayName = user.name || user.email || "로그인 사용자";
  profile.hidden = false;
  if (profileName) profileName.textContent = displayName;
  if (profileEmail) profileEmail.textContent = user.email || user.provider || "";

  if (avatar) {
    avatar.hidden = !user.picture;
    if (user.picture) avatar.setAttribute("src", user.picture);
  }
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

function clearPasswordFields(form) {
  form
    ?.querySelectorAll('input[type="password"]')
    .forEach((input) => {
      input.value = "";
    });
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

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setMode(button.dataset.modeButton || "login");
  });
});

loginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    setMessage("이메일과 비밀번호를 입력해 주세요.", "error");
    return;
  }

  const user = createLocalUser({ email, name: email.split("@")[0], provider: "site" });
  persistUser(user);
  renderAuthState(user);
  clearPasswordFields(loginForm);
  setMessage("로그인되었습니다.", "success");
});

signupForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);
  const nickname = String(formData.get("nickname") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!nickname || !email || !password) {
    setMessage("닉네임, 이메일, 비밀번호를 모두 입력해 주세요.", "error");
    return;
  }

  const user = createLocalUser({ email, name: nickname, provider: "site" });
  persistUser(user);
  renderAuthState(user);
  signupForm.reset();
  setMode("login");
  setMessage("회원가입 후 로그인되었습니다.", "success");
});

resetForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(resetForm);
  const email = String(formData.get("email") || "").trim();

  if (!email) {
    setMessage("이메일을 입력해 주세요.", "error");
    return;
  }

  setMessage(`${email} 주소로 비밀번호 재설정 요청을 준비했습니다.`, "success");
});

signoutButton?.addEventListener("click", () => {
  clearUser();
  renderAuthState(null);
  setMessage("로그아웃되었습니다.");
});

renderAutoLogin();
renderAuthState();
setMode("login");
initGoogleLogin();
