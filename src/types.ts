export interface VideoHistoryItem {
  source: string;
  fileName: string;
  filePath: string;
  isLocal: boolean;
  timestamp: number;
  lastPosition: number;
  duration: number;
  playCount: number;
}

export interface SubtitleConfig {
  url: string;
  type: string;
  fontSize: string;
  bottom: string;
  color: string;
}

export interface SubtitleResult {
  url: string;
  format: SubtitleFormat;
  originalName: string;
}

export type SubtitleFormat = 'vtt' | 'srt' | 'ass';
