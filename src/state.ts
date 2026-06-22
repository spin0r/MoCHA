import type { VideoHistoryItem, SubtitleResult } from './types';
import type { SubtitleConverter } from './subtitle-converter';
import type DPlayer from 'dplayer-enhanced';

export let dp: DPlayer | null = null;
export let overlayVisible: boolean = false;
export let wasPlayingBeforeHide: boolean = false;
export let videoHistory: VideoHistoryItem[] = [];
export const MAX_HISTORY_ITEMS: number = 500;
export let hideOverlay: HTMLElement | null = null;
export let topBar: HTMLElement | null = null;
export let subtitleConverter: SubtitleConverter | null = null;
export let currentSubtitle: SubtitleResult | null = null;

// Proxy routes through our own server (self-hosted on Render.com)
// Uses relative URL so it works on localhost:3000 during dev AND on *.onrender.com in production
export const PROXY_BASE: string = '/proxy?url=';

// Setter functions for mutable state
export function setDp(value: DPlayer | null): void { dp = value; }
export function setOverlayVisible(value: boolean): void { overlayVisible = value; }
export function setWasPlayingBeforeHide(value: boolean): void { wasPlayingBeforeHide = value; }
export function setVideoHistory(value: VideoHistoryItem[]): void { videoHistory = value; }
export function setHideOverlay(value: HTMLElement | null): void { hideOverlay = value; }
export function setTopBar(value: HTMLElement | null): void { topBar = value; }
export function setSubtitleConverter(value: SubtitleConverter | null): void { subtitleConverter = value; }
export function setCurrentSubtitle(value: SubtitleResult | null): void { currentSubtitle = value; }
