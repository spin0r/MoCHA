import { loadVideoFromSource } from './player';
import { showSpeedOverlay, clearFileInput } from './ui';

/**
 * Set up drag and drop support for video files and URLs.
 */
export function setupDragAndDrop(): void {
  const dragOverlay = document.getElementById("dragOverlay");
  if (!dragOverlay) return;

  function handleDragEnter(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    dragOverlay!.classList.add("active");
  }

  function handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (!dragOverlay!.classList.contains("active")) {
      dragOverlay!.classList.add("active");
    }
  }

  function handleDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (
      e.relatedTarget === null ||
      e.relatedTarget === document.documentElement
    ) {
      dragOverlay!.classList.remove("active");
    }
  }

  function handleDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    dragOverlay!.classList.remove("active");

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("video/") || file.name.endsWith(".mkv")) {
        // Use existing logic to load file
        const localFileInput = document.getElementById("localFile") as HTMLInputElement | null;

        // Create a DataTransfer to update the file input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        if (localFileInput) localFileInput.files = dataTransfer.files;

        // Update UI and load
        const fileName = document.getElementById("fileName");
        const videoUrl = document.getElementById("videoUrl") as HTMLInputElement | null;
        if (fileName) fileName.textContent = file.name;
        if (videoUrl) videoUrl.value = "";

        const source = URL.createObjectURL(file);
        loadVideoFromSource(source, file);
        showSpeedOverlay(`Loading: ${file.name}`);
      } else {
        showSpeedOverlay("Error: Not a video file");
      }
    } else {
      // Check for dropped URL/Text
      const droppedText =
        e.dataTransfer?.getData("text/uri-list") ||
        e.dataTransfer?.getData("text/plain");
      if (droppedText) {
        const url = droppedText.trim();
        if (url) {
          const videoUrl = document.getElementById("videoUrl") as HTMLInputElement | null;
          if (videoUrl) videoUrl.value = url;
          clearFileInput();
          loadVideoFromSource(url);
          showSpeedOverlay(`Loading URL...`);
        }
      }
    }
  }

  // Add events to document to cover entire window
  document.addEventListener("dragenter", handleDragEnter);
  document.addEventListener("dragover", handleDragOver);
  document.addEventListener("dragleave", handleDragLeave);
  document.addEventListener("drop", handleDrop);
}
