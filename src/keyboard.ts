import { toggleShortcuts, toggleHideOverlay, openFileDialog } from './ui';
import { toggleHistory } from './history';
import { loadVideo, loadVideoFromSource } from './player';
import { clearFileInput, showSpeedOverlay } from './ui';

/**
 * Set up all keyboard event handlers.
 */
export function setupKeyboardHandlers(): void {
  // Keyboard event handlers
  document.addEventListener("keydown", function (e: KeyboardEvent) {
    const key = e.key;
    const target = e.target as HTMLElement;

    // ESC key to close modals (works even when focused on inputs)
    if (key === "Escape") {
      const confirmModal = document.getElementById("confirmModal");
      const historyModal = document.getElementById("historyModal");
      const shortcutModal = document.getElementById("shortcutModal");

      if (confirmModal && confirmModal.style.display === "block") {
        confirmModal.style.display = "none";
        return;
      }

      if (historyModal && historyModal.style.display === "block") {
        toggleHistory();
        return;
      }

      if (shortcutModal && shortcutModal.style.display === "block") {
        toggleShortcuts();
        return;
      }
    }

    // Ctrl+O to open file dialog
    if (e.ctrlKey && key.toLowerCase() === "o") {
      e.preventDefault(); // Prevent browser's default "Open File" dialog
      openFileDialog(loadVideoFromSource);
      return;
    }

    // Ctrl+I to toggle shortcuts menu
    if (e.ctrlKey && key.toLowerCase() === "i") {
      e.preventDefault();
      toggleShortcuts();
      return;
    }

    // Ignore other keyboard shortcuts if typing in an input (but not ESC)
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      return;
    }

    // H key to toggle history (works even without video loaded)
    if (key.toLowerCase() === "h") {
      e.preventDefault(); // Prevent 'h' from being typed into the search box
      console.log("H key pressed - toggling history");
      toggleHistory();
      return;
    }

    // B key to toggle hide overlay
    if (key.toLowerCase() === "b") {
      toggleHideOverlay();
      return;
    }

    // Spacebar handling is natively supported by DPlayer
  });

  // Paste event handler
  document.addEventListener("paste", (event: ClipboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      return;
    }

    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const pastedText = clipboardData.getData("text");
    const videoUrl = document.getElementById("videoUrl") as HTMLInputElement | null;
    if (videoUrl) videoUrl.value = pastedText;
    // Clear file input when URL is pasted
    clearFileInput();
    loadVideo();
    showSpeedOverlay("Playing pasted video");
  });
}
