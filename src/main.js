import "./styles.css";

const SERVER_ADDRESS = "nfoifsb.kr";
const STATUS_API = `https://api.mcstatus.io/v2/status/java/${SERVER_ADDRESS}`;

const statusDot = document.querySelector("[data-status-dot]");
const statusLabel = document.querySelector("[data-status-label]");
const playerCount = document.querySelector("[data-player-count]");
const playerMeter = document.querySelector("[data-player-meter]");
const versionLabel = document.querySelector("[data-version]");
const copyFeedback = document.querySelector("[data-copy-feedback]");

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

async function copyAddress() {
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
    if (copyFeedback) copyFeedback.textContent = "복사 완료. 마크 서버 주소에 붙여넣으면 돼.";
  } else if (copyFeedback) {
    copyFeedback.textContent = `복사가 막히면 직접 입력: ${SERVER_ADDRESS}`;
  }
}

async function refreshStatus() {
  try {
    const response = await fetch(STATUS_API, { cache: "no-store" });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const data = await response.json();

    const online = Boolean(data.online);
    const playersOnline = data.players?.online ?? 0;
    const playersMax = data.players?.max ?? 10;
    const meterWidth = Math.min(100, Math.round((playersOnline / Math.max(playersMax, 1)) * 100));

    statusDot?.classList.toggle("is-online", online);
    statusLabel.textContent = online ? "온라인" : "오프라인";
    playerCount.textContent = `${playersOnline} / ${playersMax}`;
    playerMeter.style.width = `${meterWidth}%`;
    versionLabel.textContent = data.version?.name_clean || "Paper 26.1.2";
  } catch {
    statusDot?.classList.remove("is-online");
    statusLabel.textContent = "상태 확인 실패";
    playerCount.textContent = "-- / 10";
    playerMeter.style.width = "0%";
  }
}

document.querySelectorAll("[data-copy-address]").forEach((button) => {
  button.addEventListener("click", copyAddress);
});

refreshStatus();
setInterval(refreshStatus, 60000);
