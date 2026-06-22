import './styles.css';
import * as state from './state';
import { setHideOverlay, setTopBar, setSubtitleConverter } from './state';
import { SubtitleConverter } from './subtitle-converter';
import { showSpeedOverlay, updateSpeedFromSlider, toggleShortcuts, clearFileInput } from './ui';
import { loadHistory, toggleHistory, clearHistory, renderHistory } from './history';
import { loadVideo, loadVideoFromSource, proxyAndPlay } from './player';
import { setupKeyboardHandlers } from './keyboard';
import { setupDragAndDrop } from './drag-drop';

// ── Event Listeners (run immediately, elements are in the HTML body before this script) ──

try {
  const infoBtn = document.getElementById("infoBtn");
  if (infoBtn) infoBtn.addEventListener("click", toggleShortcuts);

  const historyBtn = document.getElementById("historyBtn");
  if (historyBtn) historyBtn.addEventListener("click", toggleHistory);

  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  if (clearHistoryBtn) clearHistoryBtn.addEventListener("click", clearHistory);

  const speedSlider = document.getElementById("speedSlider");
  if (speedSlider) speedSlider.addEventListener("input", updateSpeedFromSlider);

  const historySearch = document.getElementById("historySearch") as HTMLInputElement | null;
  if (historySearch) {
    historySearch.addEventListener("input", (e: Event) => {
      const target = e.target as HTMLInputElement;
      renderHistory(target.value);
    });
  }
} catch (error) {
  console.error("Error setting up event listeners:", error);
}

// Local file input change handler
const localFileInput = document.getElementById("localFile") as HTMLInputElement | null;
if (localFileInput) {
  localFileInput.addEventListener("change", function (this: HTMLInputElement) {
    const fileName = this.files && this.files.length > 0 ? this.files[0].name : "Choose File";
    const fileNameEl = document.getElementById("fileName");
    if (fileNameEl) fileNameEl.textContent = fileName;

    // Clear URL input when file is selected
    if (this.files && this.files.length > 0) {
      const videoUrl = document.getElementById("videoUrl") as HTMLInputElement | null;
      if (videoUrl) videoUrl.value = "";
    }
  });
}

// Clear file input when URL is entered
const videoUrlInput = document.getElementById("videoUrl") as HTMLInputElement | null;
if (videoUrlInput) {
  videoUrlInput.addEventListener("input", function (this: HTMLInputElement) {
    if (this.value.trim()) {
      clearFileInput();
    }
  });
}

// Wire up buttons that previously used onclick attributes
const homeBtn = document.getElementById("homeBtn");
if (homeBtn) homeBtn.addEventListener("click", proxyAndPlay);

// The "Load" button (next to the inputs)
const loadBtn = document.getElementById('loadBtn') as HTMLButtonElement | null;
if (loadBtn) {
  loadBtn.addEventListener('click', () => loadVideo());
} else {
  // Fallback: find the button that says "Load"
  document.querySelectorAll<HTMLButtonElement>('#topBar > button').forEach((btn) => {
    if (btn.textContent?.trim() === 'Load') {
      btn.addEventListener('click', () => loadVideo());
    }
  });
}

// Close button inside shortcut modal
const shortcutModalCloseBtn = document.querySelector('#shortcutModal .modal-footer-row button') as HTMLButtonElement | null;
if (shortcutModalCloseBtn) {
  shortcutModalCloseBtn.addEventListener('click', toggleShortcuts);
}

// Close button inside history modal
document.querySelectorAll<HTMLButtonElement>('#historyModal .modal-actions button').forEach((btn) => {
  if (btn.textContent?.trim() === 'Close') {
    btn.addEventListener('click', toggleHistory);
  }
});

// ── Keyboard handlers ──
setupKeyboardHandlers();

// ── Mouse and visibility event handlers ──
// Using state.topBar so we always read the latest value (set in DOMContentLoaded)
document.addEventListener("mousemove", (e: MouseEvent) => {
  if (state.topBar) {
    if (e.clientY < 80) state.topBar.classList.remove("hidden");
    else state.topBar.classList.add("hidden");
  }
});

document.addEventListener("visibilitychange", () => {
  if (state.topBar && document.hidden) state.topBar.classList.add("hidden");
});

window.addEventListener("blur", () => {
  if (state.topBar) state.topBar.classList.add("hidden");
});

// ── DOMContentLoaded ──
document.addEventListener("DOMContentLoaded", () => {
  // Initialize DOM elements
  setHideOverlay(document.getElementById("playerHideOverlay"));
  setTopBar(document.getElementById("topBar"));

  // Initialize subtitle converter
  setSubtitleConverter(new SubtitleConverter());

  // Add subtitle file input handler
  const subtitleFileInput = document.getElementById("subtitleFile") as HTMLInputElement | null;
  if (subtitleFileInput) {
    subtitleFileInput.addEventListener("change", function (this: HTMLInputElement) {
      const fileName =
        this.files && this.files.length > 0 ? this.files[0].name : "Subtitle (Optional)";
      const subtitleFileName = document.getElementById("subtitleFileName");
      if (subtitleFileName) subtitleFileName.textContent = fileName;

      if (this.files && this.files.length > 0) {
        showSpeedOverlay("Subtitle selected: " + fileName);
      }
    });
  }

  // Load history
  loadHistory();

  // Auto-play video from URL parameters
  // Supports: ?v=VIDEO_URL, #VIDEO_URL, or index.html?VIDEO_URL (file:// shorthand)
  (function autoPlayFromURL(): void {
    let videoUrl: string | null = null;

    try {
      // Try standard query parameter ?v=URL first
      const params = new URLSearchParams(window.location.search);
      videoUrl = params.get("v") || params.get("url") || params.get("src");
    } catch (_e) {
      // URLSearchParams may not work well with file:// protocol
    }

    // If no named param found, check for raw query string (file:///path/index.html?VIDEO_URL)
    if (!videoUrl && window.location.search) {
      const raw = window.location.search.substring(1); // Remove leading '?'
      // If the raw query looks like a URL (has :// or starts with //) and doesn't have key=value format
      if ((raw.includes("://") || raw.startsWith("//")) && !raw.startsWith("v=")) {
        videoUrl = decodeURIComponent(raw);
      } else if (!raw.includes("=")) {
        // Plain string without = sign, treat as URL
        videoUrl = decodeURIComponent(raw);
      }
    }

    // Also support hash fragment: index.html#VIDEO_URL
    if (!videoUrl && window.location.hash) {
      const hash = window.location.hash.substring(1); // Remove leading '#'
      if (hash.includes("://") || hash.startsWith("//") || hash.includes(".")) {
        videoUrl = decodeURIComponent(hash);
      }
    }

    if (videoUrl) {
      console.log("Auto-playing video from URL:", videoUrl);
      const videoUrlInput = document.getElementById("videoUrl") as HTMLInputElement | null;
      if (videoUrlInput) videoUrlInput.value = videoUrl;
      loadVideoFromSource(videoUrl);
      showSpeedOverlay("Auto-playing from URL");
    }
  })();

  // Listen for storage changes to sync history across tabs
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key === "dplayer-history") {
      console.log("History updated from another tab");
      loadHistory();
      // If history modal is open, re-render it
      const historyModal = document.getElementById("historyModal");
      if (historyModal && historyModal.style.display === "block") {
        const searchInput = document.getElementById("historySearch") as HTMLInputElement | null;
        renderHistory(searchInput ? searchInput.value : "");
      }
    }
  });
});

// ── Drag and Drop Support ──
window.addEventListener("load", () => {
  setupDragAndDrop();
});

// ── Service Worker Registration ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* ignore */ });
}
