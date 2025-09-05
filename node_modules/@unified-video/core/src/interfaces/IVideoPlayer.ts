/**
 * Core video player interface that all platform implementations must follow
 */

export interface VideoSource {
  url: string;
  type?: 'mp4' | 'hls' | 'dash' | 'webm' | 'auto';
  drm?: DRMConfig;
  subtitles?: SubtitleTrack[];
  metadata?: VideoMetadata;
}

export interface DRMConfig {
  licenseUrl: string;
  certificateUrl?: string;
  headers?: Record<string, string>;
  type: 'widevine' | 'playready' | 'fairplay' | 'clearkey';
}

export interface SubtitleTrack {
  url: string;
  language: string;
  label: string;
  kind: 'subtitles' | 'captions' | 'descriptions';
  default?: boolean;
}

export interface VideoMetadata {
  id?: string;
  title?: string;
  description?: string;
  duration?: number;
  thumbnailUrl?: string;
  posterUrl?: string;
}

export interface Quality {
  height: number;
  width: number;
  bitrate: number;
  label: string;
  index: number;
}

export interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  isBuffering: boolean;
  isEnded: boolean;
  isError: boolean;
  currentTime: number;
  duration: number;
  bufferedPercentage: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  currentQuality?: Quality;
  availableQualities: Quality[];
}

export interface PlayerEvents {
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (error: PlayerError) => void;
  onQualityChanged?: (quality: Quality) => void;
  onVolumeChanged?: (volume: number) => void;
  onFullscreenChanged?: (isFullscreen: boolean) => void;
  onProgress?: (buffered: number) => void;
  onSeeking?: () => void;
  onSeeked?: () => void;
  onLoadedMetadata?: (metadata: VideoMetadata) => void;
  // Fired exactly once when free preview duration is reached and playback is blocked
  onFreePreviewEnded?: () => void;
}

export interface PlayerError {
  code: string;
  message: string;
  type: 'network' | 'media' | 'drm' | 'unknown';
  fatal: boolean;
  details?: any;
}

export interface PaywallConfig {
  enabled: boolean;
  apiBase: string;          // e.g., http://localhost:3100
  userId: string;
  videoId: string;
  gateways: Array<'stripe' | 'cashfree'>;
  branding?: { title?: string; description?: string; logoUrl?: string; theme?: any };
  popup?: { width?: number; height?: number };
}

export interface PlayerConfig {
  autoPlay?: boolean;
  muted?: boolean;
  volume?: number;
  controls?: boolean;
  loop?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  crossOrigin?: 'anonymous' | 'use-credentials';
  playsInline?: boolean;
  defaultQuality?: number;
  enableAdaptiveBitrate?: boolean;
  debug?: boolean;

  // Free preview
  freeDuration?: number; // seconds of free playback before paywall

  // Optional paywall for dynamic rental flow
  paywall?: PaywallConfig;
}

/**
 * Main video player interface
 */
export interface IVideoPlayer {
  // Lifecycle methods
  initialize(container: HTMLElement | string, config?: PlayerConfig): Promise<void>;
  destroy(): Promise<void>;

  // Media control
  load(source: VideoSource): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(time: number): void;

  // Volume control
  setVolume(level: number): void;
  mute(): void;
  unmute(): void;
  toggleMute(): void;

  // Quality control
  getQualities(): Quality[];
  getCurrentQuality(): Quality | null;
  setQuality(index: number): void;
  setAutoQuality(enabled: boolean): void;

  // Playback control
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;

  // State queries
  getCurrentTime(): number;
  getDuration(): number;
  getBufferedPercentage(): number;
  getState(): PlayerState;
  isPlaying(): boolean;
  isPaused(): boolean;
  isEnded(): boolean;

  // Display control
  enterFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
  toggleFullscreen(): Promise<void>;
  enterPictureInPicture(): Promise<void>;
  exitPictureInPicture(): Promise<void>;

  // Event handling
  on(event: keyof PlayerEvents, handler: Function): void;
  off(event: keyof PlayerEvents, handler?: Function): void;
  once(event: keyof PlayerEvents, handler: Function): void;

  // Subtitle control
  getSubtitles(): SubtitleTrack[];
  setSubtitleTrack(index: number): void;
  disableSubtitles(): void;

  // Advanced features
  setAudioTrack?(index: number): void;
  getAudioTracks?(): any[];
  getThumbnail?(time: number): string;
  getStats?(): any;

  // Free preview runtime controls (optional)
  setFreeDuration?(seconds: number): void;
  resetFreePreviewGate?(): void;
}
