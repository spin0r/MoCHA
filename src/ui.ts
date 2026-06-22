import { dp, overlayVisible, wasPlayingBeforeHide, hideOverlay, setOverlayVisible, setWasPlayingBeforeHide } from './state';

let overlayTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Show a brief overlay notification at the top of the screen.
 */
export function showSpeedOverlay(text: string): void {
  const overlay = document.getElementById("speedOverlay");
  if (!overlay) return;

  // Clear any pending hide timer
  if (overlayTimer) clearTimeout(overlayTimer);

  overlay.textContent = text;
  overlay.classList.add("visible");

  // Shorter duration for less intrusive notifications
  const duration =
    text.includes("Loading") || text.includes("Error") ? 1500 : 800;
  overlayTimer = setTimeout(() => overlay.classList.remove("visible"), duration);
}

/**
 * Convert slider value to speed string.
 */
export function sliderToSpeed(val: string | number): string {
  const numVal = typeof val === 'string' ? parseInt(val) : val;
  return (numVal / 100).toFixed(2);
}

/**
 * Update playback speed from the speed slider.
 */
export function updateSpeedFromSlider(): void {
  const slider = document.getElementById("speedSlider") as HTMLInputElement | null;
  const label = document.getElementById("speedLabel");
  if (!slider || !label) return;
  const speed = sliderToSpeed(slider.value);
  if (dp && dp.video) {
    dp.video.playbackRate = parseFloat(speed);
    showSpeedOverlay(speed + "x");
  }
  label.textContent = speed + "x";
}

/**
 * Toggle the shortcuts modal.
 */
export function toggleShortcuts(): void {
  const modal = document.getElementById("shortcutModal");
  if (!modal) return;
  modal.style.display = modal.style.display === "block" ? "none" : "block";
}

/**
 * Toggle the player hide overlay (boss key).
 */
export function toggleHideOverlay(): void {
  setOverlayVisible(!overlayVisible);
  if (!hideOverlay) return;
  hideOverlay.style.display = overlayVisible ? "block" : "none";
  hideOverlay.style.pointerEvents = overlayVisible ? "auto" : "none";
  if (overlayVisible) {
    setWasPlayingBeforeHide(dp !== null && dp.video !== undefined && !dp.video.paused);
    if (wasPlayingBeforeHide && dp && dp.video) dp.video.pause();
    const resume = (): void => {
      setOverlayVisible(false);
      if (!hideOverlay) return;
      hideOverlay.style.display = "none";
      hideOverlay.style.pointerEvents = "none";
      if (wasPlayingBeforeHide && dp && dp.video) dp.video.play();
      document.removeEventListener("click", resume);
      document.removeEventListener("keydown", resume);
    };
    document.addEventListener("click", resume);
    document.addEventListener("keydown", resume);
  }
}

/**
 * Open a file dialog to select a video file.
 */
export function openFileDialog(loadVideoFromSourceFn: (source: string, localFile?: File | null, subtitleConfig?: null) => void): void {
  // Create a hidden file input element
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "video/*";
  fileInput.style.display = "none";

  fileInput.onchange = function (e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      // Update the visible file input
      const localFileInput = document.getElementById("localFile") as HTMLInputElement | null;
      const fileName = document.getElementById("fileName");

      // Transfer the file to the main file input
      if (localFileInput && target.files) {
        localFileInput.files = target.files;
      }
      if (fileName) fileName.textContent = file.name;

      // Clear URL input when file is selected
      const videoUrl = document.getElementById("videoUrl") as HTMLInputElement | null;
      if (videoUrl) videoUrl.value = "";

      // Automatically load the video
      const source = URL.createObjectURL(file);
      loadVideoFromSourceFn(source, file);

      showSpeedOverlay(`Loading: ${file.name}`);
    }

    // Clean up the temporary input
    document.body.removeChild(fileInput);
  };

  // Add to DOM and trigger click
  document.body.appendChild(fileInput);
  fileInput.click();
}

/**
 * Format seconds into HH-MM-SS format.
 */
export function formatTime(seconds: number): string {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${h}-${m}-${s}`;
}

/**
 * Clear the file input and reset display text.
 */
export function clearFileInput(): void {
  const fileInput = document.getElementById("localFile") as HTMLInputElement | null;
  if (fileInput) fileInput.value = "";
  const fileName = document.getElementById("fileName");
  if (fileName) fileName.textContent = "Choose File";
}

/**
 * Show a confirmation dialog using the confirm modal.
 */
export function showConfirmDialog(message: string, onConfirm: () => void): void {
  const confirmModal = document.getElementById("confirmModal");
  const confirmMessage = document.getElementById("confirmMessage");
  const confirmOk = document.getElementById("confirmOk");
  const confirmCancel = document.getElementById("confirmCancel");

  if (!confirmModal || !confirmMessage || !confirmOk || !confirmCancel) return;

  // Set the message
  confirmMessage.textContent = message;

  // Show the modal
  confirmModal.style.display = "block";

  // Handle OK button
  const handleOk = (): void => {
    confirmModal.style.display = "none";
    confirmOk.removeEventListener("click", handleOk);
    confirmCancel.removeEventListener("click", handleCancel);
    onConfirm();
  };

  // Handle Cancel button
  const handleCancel = (): void => {
    confirmModal.style.display = "none";
    confirmOk.removeEventListener("click", handleOk);
    confirmCancel.removeEventListener("click", handleCancel);
  };

  // Add event listeners
  confirmOk.addEventListener("click", handleOk);
  confirmCancel.addEventListener("click", handleCancel);
}

/**
 * Get safe file name from a URL path.
 */
export function getSafeFileName(path: string): string {
  if (!path) return "Untitled Video";

  let targetStr = path;
  try {
    const url = new URL(path);
    const nestedUrl = url.searchParams.get("url") || url.searchParams.get("src");
    if (nestedUrl) {
      targetStr = nestedUrl;
    }
  } catch (_e) {
    // Ignore invalid URLs
  }

  try {
    const targetUrl = new URL(targetStr);
    let name = targetUrl.pathname.split("/").pop();
    if (!name) {
      name = targetStr.split("/").pop()?.split("?")[0].split("#")[0] ?? '';
    }
    return decodeURIComponent(name) || "Untitled Video";
  } catch (_e) {
    let name = targetStr.split("/").pop()?.split("?")[0].split("#")[0] ?? '';
    try {
      name = decodeURIComponent(name);
    } catch (_err) { /* ignore */ }
    return name || "Untitled Video";
  }
}
