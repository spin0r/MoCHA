import type { VideoHistoryItem } from './types';
import { videoHistory, MAX_HISTORY_ITEMS, setVideoHistory } from './state';
import { showSpeedOverlay, getSafeFileName, showConfirmDialog } from './ui';
import { loadVideoFromSource } from './player';

/**
 * Add a video to the history.
 */
export function addToHistory(source: string, localFile: File | null = null): void {
  console.log("addToHistory called with:", {
    source,
    localFile: localFile?.name,
  });

  const now = Date.now();
  let fileName: string;
  let filePath: string;
  let isLocal = false;

  if (localFile) {
    // For local files, store the file name and path
    fileName = localFile.name;
    filePath = (localFile as File & { webkitRelativePath?: string }).webkitRelativePath || localFile.name;
    isLocal = true;
  } else {
    fileName = getSafeFileName(source);
    filePath = source;
  }

  // Find existing entry to preserve lastPosition
  const existingEntry = videoHistory.find((item: VideoHistoryItem) =>
    isLocal ? item.fileName === fileName : item.source === source,
  );

  // Remove existing entry if it exists
  let updatedHistory = videoHistory.filter((item: VideoHistoryItem) =>
    isLocal ? item.fileName !== fileName : item.source !== source,
  );

  // Add new entry at the beginning
  // For local files, don't store the blob URL (it's temporary anyway)
  updatedHistory.unshift({
    source: isLocal ? "" : source, // Empty string for local files to save space
    fileName: fileName,
    filePath: filePath,
    isLocal: isLocal,
    timestamp: now,
    lastPosition: existingEntry?.lastPosition || 0,
    duration: existingEntry?.duration || 0,
    playCount: (existingEntry?.playCount || 0) + 1,
  });

  console.log("History after adding:", updatedHistory.length, "items");

  // Show confirmation that video was added to history
  setTimeout(() => {
    showSpeedOverlay(`Added to history (${updatedHistory.length} total)`);
  }, 1000);

  // Limit history size to prevent localStorage overflow
  if (updatedHistory.length > MAX_HISTORY_ITEMS) {
    updatedHistory = updatedHistory.slice(0, MAX_HISTORY_ITEMS);
    console.log(`History trimmed to ${MAX_HISTORY_ITEMS} items`);
  }

  setVideoHistory(updatedHistory);

  // Save to localStorage
  saveHistory();
}

/**
 * Update a video's playback position in history.
 */
export function updateVideoPosition(
  identifier: string,
  position: number,
  duration: number,
  isLocal: boolean = false,
): void {
  // Find the video in history and update its position
  const item = videoHistory.find((item: VideoHistoryItem) =>
    isLocal ? item.fileName === identifier : item.source === identifier,
  );
  if (item) {
    item.lastPosition = position;
    item.duration = duration;
    saveHistory();
  }
}

/**
 * Save history to localStorage.
 */
export function saveHistory(): void {
  try {
    localStorage.setItem("dplayer-history", JSON.stringify(videoHistory));
  } catch (e) {
    const error = e as DOMException;
    console.error("Error saving history to localStorage:", e);
    if (error.name === "QuotaExceededError") {
      console.warn(
        "LocalStorage quota exceeded. History might not be fully saved.",
      );
    } else if (error.name === "SecurityError") {
      console.warn(
        "LocalStorage access denied. History cannot be saved (e.g., third-party iframes, file:// protocol).",
      );
    }
  }
}

/**
 * Load history from localStorage.
 */
export function loadHistory(): void {
  try {
    const saved = localStorage.getItem("dplayer-history");
    console.log(
      "Loading history from localStorage:",
      saved ? "found" : "not found",
    );
    if (saved) {
      setVideoHistory(JSON.parse(saved) as VideoHistoryItem[]);
      console.log("Loaded", videoHistory.length, "history items");
    } else {
      console.log("No history in localStorage, starting fresh");
    }
  } catch (e) {
    const error = e as Error;
    console.error("Error loading history from localStorage:", e);
    if (error instanceof SyntaxError) {
      console.warn(
        "History data in localStorage is corrupted. Clearing history.",
      );
      setVideoHistory([]); // Clear corrupted history
      saveHistory(); // Attempt to save empty history
    } else if ((error as DOMException).name === "SecurityError") {
      console.warn(
        "LocalStorage access denied. History cannot be loaded (e.g., third-party iframes, file:// protocol).",
      );
      setVideoHistory([]);
    }
  }
}

/**
 * Toggle the history modal visibility.
 */
export function toggleHistory(): void {
  try {
    const historyModal = document.getElementById("historyModal");
    const shortcutModal = document.getElementById("shortcutModal");

    if (!historyModal) {
      console.error("History modal not found");
      return;
    }

    // Close shortcuts modal if it's open
    if (shortcutModal && shortcutModal.style.display === "block") {
      shortcutModal.style.display = "none";
    }

    // Toggle history modal
    historyModal.style.display =
      historyModal.style.display === "block" ? "none" : "block";
    if (historyModal.style.display === "block") {
      const historySearch = document.getElementById("historySearch") as HTMLInputElement | null;
      if (historySearch) {
        historySearch.value = "";
        renderHistory();
        historySearch.focus(); // Set focus to the search input
      }
    }
  } catch (error) {
    console.error("Error in toggleHistory:", error);
  }
}

/**
 * Get the storage size of history data.
 */
export function getStorageSize(): string {
  try {
    const historyData = localStorage.getItem("dplayer-history");
    if (!historyData) return "0 KB";

    const bytes = new Blob([historyData]).size;
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } catch (_e) {
    return "unknown";
  }
}

/**
 * Clear all history with confirmation.
 */
export function clearHistory(): void {
  const storageSize = getStorageSize();
  // Ask for confirmation before clearing
  showConfirmDialog(
    `Clear all ${videoHistory.length} videos from history? (${storageSize})\n\nThis action cannot be undone.`,
    () => {
      setVideoHistory([]);
      saveHistory();
      renderHistory();
      showSpeedOverlay("History cleared");

      // Close the history modal after clearing
      toggleHistory();
    },
  );
}

/**
 * Format a timestamp as a relative time string.
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "Just now";
}

/**
 * Get the video type label from a history item.
 */
export function getVideoType(item: VideoHistoryItem | string): string {
  // Handle both old format (just source string) and new format (item object)
  if (typeof item === "string") {
    const source = item;
    if (source.startsWith("blob:")) return "Local File";
    if (source.includes(".m3u8")) return "HLS Stream";
    if (source.includes("youtube.com") || source.includes("youtu.be"))
      return "YouTube";
    if (source.includes(".mp4")) return "MP4 Video";
    if (source.includes(".webm")) return "WebM Video";
    if (source.includes(".mkv")) return "MKV Video";
    return "Video";
  }

  // New format with item object
  if (item.isLocal) return "Local File";
  const source = item.source;
  if (source.includes(".m3u8")) return "HLS Stream";
  if (source.includes("youtube.com") || source.includes("youtu.be"))
    return "YouTube";
  if (source.includes(".mp4")) return "MP4 Video";
  if (source.includes(".webm")) return "WebM Video";
  if (source.includes(".mkv")) return "MKV Video";
  return "Video";
}

/**
 * Render the history list into the modal.
 */
export function renderHistory(searchQuery: string = ""): void {
  console.log(
    "renderHistory called, videoHistory has",
    videoHistory.length,
    "items",
  );
  const historyList = document.getElementById("historyList");
  if (!historyList) return;

  let filteredHistory = videoHistory;
  if (searchQuery) {
    const lowerCaseQuery = searchQuery.toLowerCase().replace(/[._]/g, " ");
    filteredHistory = videoHistory.filter((item: VideoHistoryItem) => {
      const lowerCaseFileName = item.fileName
        .toLowerCase()
        .replace(/[._]/g, " ");
      const lowerCaseSource = item.source.toLowerCase();
      return (
        lowerCaseFileName.includes(lowerCaseQuery) ||
        lowerCaseSource.includes(lowerCaseQuery)
      );
    });
  }

  if (filteredHistory.length === 0) {
    historyList.innerHTML = `<div class="history-empty">${
      searchQuery ? `No results for "${searchQuery}"` : "No videos played yet"
    }</div>`;
    return;
  }

  const historyHTML = filteredHistory
    .map((item: VideoHistoryItem) => {
      const timeAgo = formatTimeAgo(item.timestamp);
      const videoType = getVideoType(item);
      const isLocal = item.isLocal;
      const originalIndex = videoHistory.findIndex(
        (originalItem: VideoHistoryItem) => originalItem.source === item.source && originalItem.fileName === item.fileName,
      );

      // Calculate progress percentage
      const progress =
        item.duration > 0 ? (item.lastPosition / item.duration) * 100 : 0;
      const hasProgress = progress > 1 && progress < 99; // Show progress bar if between 1% and 99%

      // Format time remaining
      let progressText = "";
      if (hasProgress) {
        const minutes = Math.floor(item.lastPosition / 60);
        const seconds = Math.floor(item.lastPosition % 60);
        const totalMinutes = Math.floor(item.duration / 60);
        const totalSeconds = Math.floor(item.duration % 60);
        progressText = `${minutes}:${seconds
          .toString()
          .padStart(2, "0")} / ${totalMinutes}:${totalSeconds
          .toString()
          .padStart(2, "0")}`;
      }

      return `
      <div class="history-item" data-history-index="${originalIndex}" ${
        isLocal ? 'title="Click to select this file from your computer"' : ""
      }>
        <div class="history-main">
          <div class="history-title">${item.fileName || "Untitled Video"} ${
            isLocal ? "📁" : ""
          }</div>
          <div class="history-meta">
            <span class="history-type">${videoType}</span>
            <span class="history-time">${timeAgo}</span>
            ${
              item.playCount > 1
                ? `<span class="history-count">Played ${item.playCount}x</span>`
                : ""
            }
            ${
              hasProgress
                ? `<span class="history-progress-text">⏱️ ${progressText}</span>`
                : ""
            }
          </div>
          ${
            hasProgress
              ? `
            <div class="history-progress-bar">
              <div class="history-progress-fill" style="width: ${progress}%"></div>
            </div>
          `
              : ""
          }
          ${
            !isLocal
              ? `<div class="history-url">${item.source}</div>`
              : `<div class="history-url">Local: ${item.filePath}</div>`
          }
        </div>
        <div class="history-actions">
          <button data-remove-index="${originalIndex}" class="remove-btn" title="Remove from history">×</button>
        </div>
      </div>
    `;
    })
    .join("");

  historyList.innerHTML = historyHTML;

  // Attach click event listeners (replacing onclick attributes)
  historyList.querySelectorAll<HTMLElement>('.history-item').forEach((el) => {
    el.addEventListener('click', () => {
      const index = parseInt(el.dataset.historyIndex ?? '-1', 10);
      if (index >= 0) playFromHistory(index);
    });
  });

  historyList.querySelectorAll<HTMLButtonElement>('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.removeIndex ?? '-1', 10);
      if (index >= 0) removeFromHistory(index);
    });
  });
}

/**
 * Play a video from history by index.
 */
export function playFromHistory(index: number): void {
  const item = videoHistory[index];
  if (!item) return;

  if (item.isLocal) {
    // Close history modal first for better UX
    toggleHistory();

    // For local files, we need to prompt user to select the file again
    showSpeedOverlay(`Select: ${item.fileName}`);

    // Create a file input to let user select the same file
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "video/*";
    fileInput.style.display = "none";

    fileInput.onchange = function (e: Event) {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        // Load the file regardless of name match
        const source = URL.createObjectURL(file);
        loadVideoFromSource(source, file);

        if (file.name === item.fileName) {
          showSpeedOverlay(`✓ Playing: ${item.fileName}`);
        } else {
          showSpeedOverlay(
            `Playing: ${file.name} (expected: ${item.fileName})`,
          );
        }

        // Update the file input display
        const fileNameEl = document.getElementById("fileName");
        const localFileEl = document.getElementById("localFile") as HTMLInputElement | null;
        if (fileNameEl) fileNameEl.textContent = file.name;
        if (localFileEl && target.files) localFileEl.files = target.files;
      } else {
        showSpeedOverlay("No file selected");
      }

      // Clean up
      document.body.removeChild(fileInput);
    };

    // Handle cancel
    fileInput.oncancel = function () {
      showSpeedOverlay("File selection cancelled");
      document.body.removeChild(fileInput);
    };

    document.body.appendChild(fileInput);

    // Small delay to ensure modal closes first
    setTimeout(() => {
      fileInput.click();
    }, 100);

    return;
  }

  // For web URLs, proceed as normal
  const videoUrl = document.getElementById("videoUrl") as HTMLInputElement | null;
  if (videoUrl) videoUrl.value = item.source;
  loadVideoFromSource(item.source);
  showSpeedOverlay(`Playing: ${item.fileName}`);
}

/**
 * Remove an item from history by index.
 */
export function removeFromHistory(index: number): void {
  const updated = [...videoHistory];
  updated.splice(index, 1);
  setVideoHistory(updated);
  saveHistory();
  renderHistory();
}
