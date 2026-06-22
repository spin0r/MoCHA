declare module 'dplayer-enhanced' {
  interface DPlayerVideoOptions {
    url: string;
    type?: string;
    customType?: Record<string, (video: HTMLVideoElement, player: DPlayer) => void>;
  }

  interface DPlayerSubtitleOptions {
    url: string;
    type?: string;
    fontSize?: string;
    bottom?: string;
    color?: string;
  }

  interface DPlayerOptions {
    container: HTMLElement | null;
    video: DPlayerVideoOptions;
    subtitle?: DPlayerSubtitleOptions;
    screenshot?: boolean;
    preload?: string;
    bufferTime?: number;
  }

  class DPlayer {
    video: HTMLVideoElement;
    constructor(options: DPlayerOptions);
    destroy(): void;
  }

  export default DPlayer;
}
