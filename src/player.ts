import DPlayer from 'dplayer-enhanced';
import Hls from 'hls.js';
import type { SubtitleConfig } from './types';
import { dp, videoHistory, subtitleConverter, PROXY_BASE, setDp, setCurrentSubtitle } from './state';
import { showSpeedOverlay, clearFileInput } from './ui';
import { addToHistory, updateVideoPosition } from './history';

/**
 * Load a video from a source URL (or blob URL for local files).
 */
export function loadVideoFromSource(
  source: string,
  localFile: File | null = null,
  subtitleConfig: SubtitleConfig | null = null,
): void {
  if (!source) return;

  // Hide modals when a new video is loaded
  const historyModal = document.getElementById("historyModal");
  const shortcutModal = document.getElementById("shortcutModal");
  if (historyModal) historyModal.style.display = "none";
  if (shortcutModal) shortcutModal.style.display = "none";

  if (dp) dp.destroy();

  // Add to history with local file info if available
  addToHistory(source, localFile);

  // Hide placeholder when loading video
  const placeholder = document.getElementById("placeholder");
  if (placeholder) {
    placeholder.style.display = "none";
  }

  const isM3U8 = source.endsWith(".m3u8");
  const isRemoteVideo = source.startsWith("http") || source.startsWith("//");

  // Detect download/streaming links that need special handling
  const isDownloadLink =
    source.includes("download.aspx") ||
    source.includes("workers.dev") ||
    source.includes("expiry=") ||
    source.includes("mac=");

  // Apply optimizations to strictly download links OR any network stream (http/https)
  const shouldOptimize = isDownloadLink || isRemoteVideo;

  // Show loading indicator with longer timeout for optimized links
  showSpeedOverlay("Loading...");
  const loadingTimeout = shouldOptimize ? 5000 : 2000;

  // Clear loading message when video actually starts loading or playing
  const clearLoadingMessage = (): void => {
    const overlay = document.getElementById("speedOverlay");
    if (overlay && overlay.textContent === "Loading...") {
      overlay.classList.remove("visible");
    }
  };

  setTimeout(clearLoadingMessage, loadingTimeout);

  const newDp = new DPlayer({
    container: document.getElementById("dplayer"),
    video: {
      url: source,
      type: isM3U8 ? "customHls" : "auto",
      customType: isM3U8
        ? {
            customHls: function (video: HTMLVideoElement) {
              if (Hls.isSupported()) {
                const hls = new Hls({
                  // Optimize for faster loading and seeking
                  maxBufferLength: 120,
                  maxMaxBufferLength: 600,
                  maxBufferSize: 500 * 1000 * 1000, // 500MB
                  maxBufferHole: 2.0,
                  lowLatencyMode: false,
                  backBufferLength: 120,
                  // Enable progressive loading
                  progressive: true,
                  // Faster fragment loading
                  fragLoadingTimeOut: 30000,
                  manifestLoadingTimeOut: 20000,
                  // Better error recovery
                  fragLoadingMaxRetry: 10,
                  fragLoadingMaxRetryTimeout: 64000,
                  levelLoadingMaxRetry: 10,
                  levelLoadingMaxRetryTimeout: 64000,
                  enableWorker: true,
                });
                hls.loadSource(video.src);
                hls.attachMedia(video);

                // Add error handling and retry logic
                hls.on(Hls.Events.ERROR, function (_event: string, data: { fatal: boolean; type: string }) {
                  if (data.fatal) {
                    switch (data.type) {
                      case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log("Network error, trying to recover...");
                        hls.startLoad();
                        break;
                      case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log("Media error, trying to recover...");
                        hls.recoverMediaError();
                        break;
                      default:
                        console.log("Fatal error, destroying HLS...");
                        hls.destroy();
                        break;
                    }
                  }
                });
              } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = video.src;
              }
            },
          }
        : {},
    },
    subtitle: subtitleConfig || undefined, // Add subtitle if provided
    screenshot: true,
    // Eager preloading — download as much as possible immediately
    preload: "auto",
    // Better buffering for streaming links
    bufferTime: 10,
  });

  setDp(newDp);

  // Optimize video element for aggressive buffering
  newDp.video.preload = "auto";

  // Enhanced buffering for optimized links
  if (shouldOptimize) {
    newDp.video.setAttribute("x-webkit-airplay", "allow");
    newDp.video.setAttribute("webkit-playsinline", "true");
    newDp.video.setAttribute("playsinline", "true");

    // Better network handling for download links
    newDp.video.addEventListener("progress", () => {
      if (newDp.video.buffered.length > 0) {
        const bufferedEnd = newDp.video.buffered.end(newDp.video.buffered.length - 1);
        const duration = newDp.video.duration;
        if (duration > 0) {
          const bufferedPercent = (bufferedEnd / duration) * 100;
          if (bufferedPercent > 10) {
            console.log(`Buffered: ${bufferedPercent.toFixed(1)}%`);
          }
        }
      }
    });

    // Handle stalled connections — only recover if truly stuck
    let lastStallRecoveryTime = 0;
    newDp.video.addEventListener("stalled", () => {
      console.warn("[Stall] Video download stalled, monitoring...");
      const currentTime = newDp.video.currentTime;

      // Only attempt recovery if we haven't tried recently (at least 10s gap)
      setTimeout(() => {
        if (
          newDp && newDp.video &&
          newDp.video.readyState < 3 &&
          newDp.video.currentTime === currentTime && // Still stuck at same position
          Date.now() - lastStallRecoveryTime > 10000 // Haven't recovered recently
        ) {
          lastStallRecoveryTime = Date.now();
          newDp.video.currentTime = currentTime + 0.01;
          newDp.video.play().catch(() => { /* ignore autoplay restrictions */ });
          console.log("[Stall] Recovery nudge applied after 5s stall");
        }
      }, 5000);
    });
  }

  // Add buffering optimization (silent logging)
  newDp.video.addEventListener("loadstart", () => {
    console.log("Video loading started");
  });

  newDp.video.addEventListener("loadedmetadata", () => {
    console.log("Video metadata loaded");
    // Clear loading message when metadata is loaded
    const overlay = document.getElementById("speedOverlay");
    if (overlay && overlay.textContent === "Loading...") {
      overlay.classList.remove("visible");
    }
    // Enable faster seeking by setting buffer ahead time
    if (newDp.video.buffered && newDp.video.buffered.length > 0) {
      console.log(
        "Buffer range:",
        newDp.video.buffered.start(0),
        newDp.video.buffered.end(0),
      );
    }
  });

  newDp.video.addEventListener("canplay", () => {
    console.log("Video ready to play");
    // Clear loading message when video is ready
    const overlay = document.getElementById("speedOverlay");
    if (overlay && overlay.textContent === "Loading...") {
      overlay.classList.remove("visible");
    }
  });

  newDp.video.addEventListener("waiting", () => {
    console.log("Video buffering");
  });

  newDp.video.addEventListener("canplaythrough", () => {
    console.log("Video fully loaded");
  });

  // Add seeking optimization (silent)
  newDp.video.addEventListener("seeking", () => {
    console.log("Video seeking");
  });

  newDp.video.addEventListener("seeked", () => {
    console.log("Video seek complete");
  });

  // Handle suspend events (when download is paused)
  newDp.video.addEventListener("suspend", () => {
    console.log("Video download suspended");
  });

  // Better load progress tracking for download links
  newDp.video.addEventListener("loadprogress" as keyof HTMLMediaElementEventMap, () => {
    if (shouldOptimize && newDp.video.buffered.length > 0) {
      const loaded = newDp.video.buffered.end(0);
      const total = newDp.video.duration;
      if (total > 0) {
        const percent = ((loaded / total) * 100).toFixed(0);
        console.log(`Download progress: ${percent}%`);
      }
    }
  });

  // Enhanced error handling for all video links
  let errorRetryCount = 0;
  const maxErrorRetries = 3;
  newDp.video.addEventListener("error", (e: Event) => {
    console.error("Video error:", e);

    // Don't show error immediately - wait to see if it recovers
    setTimeout(() => {
      // Only retry if still in error state and haven't exhausted retries
      if (
        newDp && newDp.video &&
        newDp.video.error &&
        newDp.video.readyState === 0 &&
        errorRetryCount < maxErrorRetries
      ) {
        errorRetryCount++;
        console.log(`Retry attempt ${errorRetryCount}/${maxErrorRetries} for video error`);

        // Don't spam the overlay on every retry
        if (errorRetryCount === 1) {
          showSpeedOverlay("Retrying...");
        }

        // Use increasing delay before reload
        setTimeout(() => {
          if (newDp && newDp.video && newDp.video.error) {
            newDp.video.load();
            newDp.video.play().catch(() => { /* ignore autoplay restrictions */ });
          }
        }, 1500 * errorRetryCount);
      } else if (
        newDp && newDp.video &&
        newDp.video.error &&
        errorRetryCount >= maxErrorRetries
      ) {
        showSpeedOverlay("Failed to load - check connection");
      }
    }, 2000); // Wait 2 seconds before considering error
  });

  // Reset retry count when video loads successfully
  newDp.video.addEventListener("loadeddata", () => {
    errorRetryCount = 0;
  });

  newDp.video.playbackRate = 1.0;

  // Track video position for resume functionality
  let positionUpdateInterval: ReturnType<typeof setInterval> | undefined;

  // Determine the identifier to use (fileName for local files, source for URLs)
  const isLocalFile = localFile !== null;
  const videoIdentifier = isLocalFile ? localFile.name : source;

  newDp.video.addEventListener("loadedmetadata", () => {
    // Check if this video has a saved position
    const historyItem = videoHistory.find((item) =>
      isLocalFile
        ? item.fileName === videoIdentifier
        : item.source === videoIdentifier,
    );
    if (
      historyItem &&
      historyItem.lastPosition > 0 &&
      historyItem.duration > 0
    ) {
      // Only resume if not at the very end (within 5 seconds of completion)
      const timeRemaining = historyItem.duration - historyItem.lastPosition;
      if (timeRemaining > 5) {
        newDp.video.currentTime = historyItem.lastPosition;
        const minutes = Math.floor(historyItem.lastPosition / 60);
        const seconds = Math.floor(historyItem.lastPosition % 60);
        showSpeedOverlay(
          `Resumed at ${minutes}:${seconds.toString().padStart(2, "0")}`,
        );
      }
    }
  });

  // Update position every 5 seconds while playing
  newDp.video.addEventListener("play", () => {
    positionUpdateInterval = setInterval(() => {
      if (newDp && newDp.video && !newDp.video.paused) {
        updateVideoPosition(
          videoIdentifier,
          newDp.video.currentTime,
          newDp.video.duration,
          isLocalFile,
        );
      }
    }, 5000);
  });

  newDp.video.addEventListener("pause", () => {
    if (positionUpdateInterval) {
      clearInterval(positionUpdateInterval);
      // Save position immediately on pause
      if (newDp && newDp.video) {
        updateVideoPosition(
          videoIdentifier,
          newDp.video.currentTime,
          newDp.video.duration,
          isLocalFile,
        );
      }
    }
  });

  newDp.video.addEventListener("ended", () => {
    if (positionUpdateInterval) {
      clearInterval(positionUpdateInterval);
      // Reset position when video ends
      updateVideoPosition(videoIdentifier, 0, newDp.video.duration, isLocalFile);
    }
  });

  // Save position before page unload
  window.addEventListener("beforeunload", () => {
    if (newDp && newDp.video && !newDp.video.paused) {
      updateVideoPosition(
        videoIdentifier,
        newDp.video.currentTime,
        newDp.video.duration,
        isLocalFile,
      );
    }
  });

  // Add two-finger swipe seeking (horizontal scrolling)
  const container = document.getElementById("dplayer");
  if (container) {
    container.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        // Check if it's primarily horizontal scrolling
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          e.preventDefault(); // Prevent browser back/forward navigation

          if (newDp && newDp.video) {
            // Sensitivity factor - adjust as needed
            const sensitivity = -0.05;
            const seekAmount = e.deltaX * sensitivity;

            let newTime = newDp.video.currentTime + seekAmount;
            // Clamp time between 0 and duration
            newTime = Math.max(0, Math.min(newTime, newDp.video.duration));

            newDp.video.currentTime = newTime;
          }
        }
      },
      { passive: false },
    );
  }
}

/**
 * Proxy the current URL and play through the CORS proxy.
 */
export function proxyAndPlay(): void {
  // Get the URL from the input field or the currently playing video
  const videoUrlInput = document.getElementById("videoUrl") as HTMLInputElement | null;
  let rawUrl = videoUrlInput?.value.trim() ?? '';

  // If no URL in input, try the currently playing video source
  if (!rawUrl && dp && dp.video && dp.video.src) {
    rawUrl = dp.video.src;
  }

  if (!rawUrl) {
    showSpeedOverlay("No URL to proxy");
    return;
  }

  // Don't double-proxy: if it's already proxied, just play it
  if (rawUrl.startsWith(PROXY_BASE)) {
    showSpeedOverlay("Already proxied");
    return;
  }

  // Build the proxied URL
  const proxiedUrl = PROXY_BASE + encodeURIComponent(rawUrl);

  // Update the input field so the user can see/copy the proxied URL
  if (videoUrlInput) videoUrlInput.value = proxiedUrl;

  // Load the video through the proxy
  loadVideoFromSource(proxiedUrl);
}

/**
 * Go back to the home/initial state.
 */
export function goHome(): void {
  // Destroy current player if active
  if (dp) {
    dp.destroy();
    setDp(null);
  }

  // Clear all inputs
  const videoUrl = document.getElementById("videoUrl") as HTMLInputElement | null;
  if (videoUrl) videoUrl.value = "";
  const fileInput = document.getElementById("localFile") as HTMLInputElement | null;
  if (fileInput) fileInput.value = "";
  const fileName = document.getElementById("fileName");
  if (fileName) fileName.textContent = "Choose File";
  const subtitleFile = document.getElementById("subtitleFile") as HTMLInputElement | null;
  if (subtitleFile) subtitleFile.value = "";
  const subtitleFileName = document.getElementById("subtitleFileName");
  if (subtitleFileName) subtitleFileName.textContent = "Subtitle (Optional)";

  // Reset speed
  const speedSlider = document.getElementById("speedSlider") as HTMLInputElement | null;
  const speedLabel = document.getElementById("speedLabel");
  if (speedSlider) speedSlider.value = '100';
  if (speedLabel) speedLabel.textContent = "1.00x";

  // Show placeholder again
  const placeholder = document.getElementById("placeholder");
  if (placeholder) placeholder.style.display = "flex";

  // Rebuild the dplayer container (destroy may remove inner content)
  const dplayerEl = document.getElementById("dplayer");
  if (dplayerEl && !dplayerEl.querySelector("#placeholder")) {
    dplayerEl.innerHTML = `
      <div id="placeholder" class="placeholder-message">
        <div class="placeholder-content">
          <h2>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="48" height="48" style="vertical-align:middle;margin-right:12px">
              <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1"/>
                  <stop offset="100%" style="stop-color:#2a2a2a;stop-opacity:1"/>
                </linearGradient>
                <linearGradient id="play" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1"/>
                  <stop offset="100%" style="stop-color:#e0e0e0;stop-opacity:0.95"/>
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="28" height="28" rx="7" ry="7" fill="url(#bg)" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>
              <path d="M11.5 8.5 L11.5 23.5 L23 16 Z" fill="url(#play)" stroke="none"/>
            </svg>
            DPlayer
          </h2>
          <p>Paste a video URL, choose a local file, or press Ctrl+V to get started</p>
          <div class="placeholder-tips">
            <span>💡 Supports MP4, M3U8, and most video formats</span>
          </div>
        </div>
      </div>`;
  }

  // Clean URL params without reload
  if (window.location.search || window.location.hash) {
    const cleanUrl = window.location.pathname;
    history.replaceState(null, "", cleanUrl);
  }

  // Close any open modals
  const historyModal = document.getElementById("historyModal");
  const shortcutModal = document.getElementById("shortcutModal");
  if (historyModal) historyModal.style.display = "none";
  if (shortcutModal) shortcutModal.style.display = "none";
}

/**
 * Load a video from the URL input or local file input.
 */
export async function loadVideo(): Promise<void> {
  const videoUrlInput = document.getElementById("videoUrl") as HTMLInputElement | null;
  const localFileInput = document.getElementById("localFile") as HTMLInputElement | null;
  const subtitleFileInput = document.getElementById("subtitleFile") as HTMLInputElement | null;

  const rawUrl = videoUrlInput?.value.trim() ?? '';
  const localFile = localFileInput?.files?.[0] ?? null;
  const subtitleFile = subtitleFileInput?.files?.[0] ?? null;

  let source: string | null = null;
  let subtitleConfig: SubtitleConfig | null = null;

  // Handle subtitle file if provided
  if (subtitleFile && subtitleConverter) {
    try {
      showSpeedOverlay("Processing subtitle...");
      const result = await subtitleConverter.convertToWebVTT(subtitleFile);
      subtitleConfig = {
        url: result.url,
        type: "webvtt",
        fontSize: "20px",
        bottom: "40px",
        color: "#fff",
      };
      setCurrentSubtitle(result);
      console.log(`Subtitle loaded: ${result.originalName} (${result.format})`);
    } catch (error) {
      const err = error as Error;
      showSpeedOverlay("Subtitle error: " + err.message);
      console.error("Subtitle loading error:", error);
      // Continue without subtitle
    }
  }

  // Prioritize local file if selected
  if (localFile) {
    source = URL.createObjectURL(localFile);
    // Clear URL input when using local file
    if (videoUrlInput) videoUrlInput.value = "";
  } else if (rawUrl) {
    source = rawUrl;
    // Clear file input when using URL
    clearFileInput();
  }

  if (source) {
    loadVideoFromSource(source, localFile, subtitleConfig);
  } else {
    showSpeedOverlay("Please select a file or enter a URL");
  }
}
