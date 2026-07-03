const AUTH_STORAGE_KEY = "nfoifsb.googleUser";
const ADMIN_DRAFTS_KEY = "nfoifsb.adminDrafts";

const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const localAuthApiBase = isLocalHost ? "http://127.0.0.1:4174" : "";
const authApiBase = (import.meta.env.VITE_AUTH_API_BASE || localAuthApiBase).replace(/\/$/, "");

const status = document.querySelector("[data-admin-status]");
const identity = document.querySelector("[data-admin-identity]");
const workspace = document.querySelector("[data-admin-workspace]");
const denied = document.querySelector("[data-admin-denied]");
const loginLink = document.querySelector("[data-admin-login]");
const permissions = document.querySelector("[data-admin-permissions]");
const checkedAt = document.querySelector("[data-admin-checked-at]");
const draftForm = document.querySelector("[data-admin-form]");
const draftList = document.querySelector("[data-admin-drafts]");

function readStoredUser() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isAdminUser(user) {
  return Array.isArray(user?.roles) && user.roles.includes("admin");
}

function setStatus(text, tone = "idle") {
  if (!status) return;
  status.textContent = text;
  status.dataset.tone = tone;
}

function setIdentity(user) {
  if (!identity) return;
  identity.textContent = user ? `${user.name || user.email} (${user.email})` : "로그인이 필요합니다.";
}

function readDrafts() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_DRAFTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeDrafts(drafts) {
  localStorage.setItem(ADMIN_DRAFTS_KEY, JSON.stringify(drafts.slice(0, 12)));
}

function renderDrafts() {
  if (!draftList) return;
  const drafts = readDrafts();
  if (!drafts.length) {
    draftList.innerHTML = '<li class="admin-empty">저장된 초안이 없습니다.</li>';
    return;
  }

  draftList.replaceChildren(
    ...drafts.map((draft) => {
      const item = document.createElement("li");
      const category = document.createElement("span");
      const title = document.createElement("strong");
      const body = document.createElement("p");
      const time = document.createElement("em");
      category.textContent = draft.categoryLabel;
      title.textContent = draft.title;
      body.textContent = draft.body;
      time.textContent = new Date(draft.createdAt).toLocaleString("ko-KR");
      item.append(category, title, body, time);
      return item;
    }),
  );
}

function renderPermissions(items = []) {
  if (!permissions) return;
  permissions.replaceChildren(
    ...items.map((value) => {
      const item = document.createElement("li");
      item.textContent = value;
      return item;
    }),
  );
}

async function fetchAdminSummary(user) {
  if (!authApiBase || !user?.sessionToken) return null;
  const response = await fetch(`${authApiBase}/auth/admin/summary`, {
    headers: {
      Authorization: `Bearer ${user.sessionToken}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "관리자 권한을 확인할 수 없습니다.");
  return payload;
}

function showDenied(message, user = null) {
  setIdentity(user);
  setStatus(message, "error");
  if (workspace) workspace.hidden = true;
  if (denied) denied.hidden = false;
  if (loginLink) loginLink.hidden = Boolean(user);
}

function showWorkspace(user, summary = null) {
  setIdentity(user);
  setStatus("관리자 권한 확인 완료", "success");
  if (workspace) workspace.hidden = false;
  if (denied) denied.hidden = true;
  if (loginLink) loginLink.hidden = true;
  renderPermissions(summary?.permissions || user.roles || ["admin"]);
  if (checkedAt) checkedAt.textContent = summary?.checkedAt ? new Date(summary.checkedAt).toLocaleString("ko-KR") : "로컬 세션";
  renderDrafts();
}

draftForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(draftForm);
  const category = String(formData.get("category") || "notice");
  const categoryLabel = draftForm.elements.category?.selectedOptions?.[0]?.textContent || category;
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!title || !body) {
    setStatus("제목과 내용을 입력하세요.", "error");
    return;
  }

  writeDrafts([
    {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      category,
      categoryLabel,
      title,
      body,
      createdAt: new Date().toISOString(),
    },
    ...readDrafts(),
  ]);
  draftForm.reset();
  renderDrafts();
  setStatus("초안을 저장했습니다.", "success");
});

async function initAdmin() {
  const user = readStoredUser();
  if (!user) {
    showDenied("로그인이 필요합니다.");
    return;
  }

  setIdentity(user);
  setStatus("관리자 권한 확인 중");

  try {
    const summary = await fetchAdminSummary(user);
    if (summary?.user) {
      showWorkspace({ ...user, ...summary.user }, summary);
      return;
    }
  } catch (error) {
    if (!isAdminUser(user)) {
      showDenied(error.message || "관리자 권한이 필요합니다.", user);
      return;
    }
  }

  if (isAdminUser(user)) {
    showWorkspace(user);
    return;
  }

  showDenied("관리자 권한이 필요합니다.", user);
}

initAdmin();
