/* ==========================================================================
   VELYX — small interaction flourishes
   --------------------------------------------------------------------------
   Self-contained, defensive (never throws into the main bundle). Wires:
     1. a gold scroll-progress bar (width driven by the existing --stage-scroll)
     2. a cursor spotlight that follows the pointer across interior cards
     3. a green/red flash on the stock headline price when it ticks
   All are progressive enhancement — the site works identically without them.
   ========================================================================== */

const CARD_SELECTOR = [
  ".detail-grid article", ".dashboard-card", ".plugin-grid article",
  ".feature-grid article", ".economy-grid article", ".market-list article",
  ".rules-tools article", ".join-steps article", ".quick-install-panel",
  ".category-feature", ".category-grid article", ".category-board article",
  ".resource-list a",
].join(",");

function initScrollProgress() {
  try {
    if (document.querySelector(".vlx-scroll-progress")) return;
    const bar = document.createElement("div");
    bar.className = "vlx-scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
  } catch {
    /* non-critical */
  }
}

function initCardSpotlight() {
  try {
    document.addEventListener(
      "pointermove",
      (event) => {
        const card = event.target.closest?.(CARD_SELECTOR);
        if (!card) return;
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        card.style.setProperty("--mx", `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
        card.style.setProperty("--my", `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
      },
      { passive: true },
    );
  } catch {
    /* non-critical */
  }
}

function initPriceTickFlash() {
  try {
    if (!document.body.classList.contains("stock-terminal-body")) return;
    const priceEl = document.querySelector(".stock-market-price");
    if (!priceEl || typeof MutationObserver === "undefined") return;

    // the block also holds the % change, so read only the first ₩ amount
    const readNumber = () => {
      const match = (priceEl.textContent || "").match(/₩\s*([\d,]+(?:\.\d+)?)/);
      return match ? parseFloat(match[1].replace(/,/g, "")) : NaN;
    };
    let previous = readNumber();

    const observer = new MutationObserver(() => {
      const next = readNumber();
      if (Number.isFinite(next) && Number.isFinite(previous) && next !== previous) {
        const cls = next > previous ? "vlx-tick-up" : "vlx-tick-down";
        priceEl.classList.remove("vlx-tick-up", "vlx-tick-down");
        // force a reflow so the animation restarts even on rapid consecutive ticks
        void priceEl.offsetWidth;
        priceEl.classList.add(cls);
      }
      if (Number.isFinite(next)) previous = next;
    });
    observer.observe(priceEl, { childList: true, characterData: true, subtree: true });
  } catch {
    /* non-critical */
  }
}

function initFlourishes() {
  initScrollProgress();
  initCardSpotlight();
  initPriceTickFlash();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFlourishes, { once: true });
} else {
  initFlourishes();
}
