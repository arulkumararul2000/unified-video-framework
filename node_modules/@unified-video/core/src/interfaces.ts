// Core TypeScript interfaces for the unified video framework

export enum PlatformType {
  IOS = 'ios',
  ANDROID = 'android',
  TIZEN = 'tizen',
  WEBOS = 'webos',
  ROKU = 'roku',
  ANDROID_TV = 'androidtv',
  APPLE_TV = 'appletv',
  WEB = 'web',
  WINDOWS = 'windows'
}

export enum PlayerStateEnum {
  IDLE = 'idle',
  LOADING = 'loading',
  READY = 'ready',
  PLAYING = 'playing',
  PAUSED = 'paused',
  BUFFERING = 'buffering',
  ENDED = 'ended',
  ERROR = 'error'
}

// Legacy enum export for compatibility
export { PlayerStateEnum as PlayerState };

export enum DRMType {
  FAIRPLAY = 'fairplay',
  WIDEVINE = 'widevine',
  PLAYREADY = 'playready',
  CLEARKEY = 'clearkey'
}

export interface VideoSource {
  url: string;
  type?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  drm?: DRMConfig;
  subtitles?: SubtitleTrack[];
  metadata?: Record<string, any>;
}

export interface DRMConfig {
  type: DRMType;
  licenseUrl: string;
  certificateUrl?: string;
  headers?: Record<string, string>;
  customData?: string;
  fairplayOptions?: {
    certificateUrl: string;
    licenseUrl: string;
  };
  widevineOptions?: {
    licenseUrl: string;
    serverCertificate?: ArrayBuffer;
  };
  playreadyOptions?: {
    licenseUrl: string;
    customData?: string;
  };
}

export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  url?: string;
  kind?: 'subtitles' | 'captions' | 'descriptions';
  default?: boolean;
}

export interface AudioTrack {
  id: string;
  label: string;
  language: string;
  channels?: number;
  bitrate?: number;
  codec?: string;
}

export interface Quality {
  id: string;
  label: string;
  height: number;
  width: number;
  bitrate: number;
  frameRate?: number;
  codec?: string;
}

export interface AdaptiveBitrateConfig {
  minBitrate?: number;
  maxBitrate?: number;
  startBitrate?: number;
  autoLevelEnabled?: boolean;
  startLevel?: number;
}

export interface VideoPlayerConfig {
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  crossOrigin?: 'anonymous' | 'use-credentials';
  playsInline?: boolean;
  pictureInPicture?: boolean;
  showFrameworkBranding?: boolean; // Show/hide flicknexs framework branding (default: true)
  watermark?: WatermarkConfig; // Watermark configuration
  adaptiveBitrate?: AdaptiveBitrateConfig;
  drm?: DRMConfig;
  analytics?: AnalyticsConfig;
  ads?: AdsConfig;
  cast?: CastConfig;
  offline?: OfflineConfig;
}

export interface AnalyticsConfig {
  enabled: boolean;
  providers: AnalyticsProvider[];
  trackingInterval?: number;
  customDimensions?: Record<string, any>;
}

export interface AnalyticsProvider {
  name: string;
  config: Record<string, any>;
  track: (event: string, data: any) => void;
}

export interface AdsConfig {
  enabled: boolean;
  adTagUrl?: string;
  adsManager?: any;
  midrollPositions?: number[];
  companionAds?: {
    width: number;
    height: number;
    container: HTMLElement;
  };
}

export interface CastConfig {
  enabled: boolean;
  receiverApplicationId?: string;
  autoJoinPolicy?: 'ORIGIN_SCOPED' | 'TAB_AND_ORIGIN_SCOPED' | 'PAGE_SCOPED';
}

export interface OfflineConfig {
  enabled: boolean;
  storageLimit?: number;
  downloadQuality?: 'auto' | 'high' | 'medium' | 'low';
}

// Chapter-related interfaces
export interface Chapter {
  id: string;
  title: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  thumbnail?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface ChapterSegment {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  category?: string;
  action?: 'skip' | 'mute' | 'warn';
  title?: string;
  description?: string;
}

export interface ChapterConfig {
  enabled?: boolean;
  chapters?: Chapter[];
  segments?: ChapterSegment[];  // For sponsor segments, intros, etc.
  dataUrl?: string; // URL to fetch chapter data from
  autoSkip?: boolean; // Auto-skip segments with action: 'skip'
  showSkipButton?: boolean; // Show skip button for segments
  skipButtonText?: string;
  onChapterChange?: (chapter: Chapter | null) => void;
  onSegmentEntered?: (segment: ChapterSegment) => void;
  onSegmentExited?: (segment: ChapterSegment) => void;
  onSegmentSkipped?: (segment: ChapterSegment) => void;
}

export interface WatermarkConfig {
  enabled?: boolean; // Enable/disable watermark (default: true)
  text?: string; // Custom watermark text (default: "PREMIUM")
  showTime?: boolean; // Show current time with watermark (default: true)
  updateInterval?: number; // Update frequency in milliseconds (default: 5000)
  randomPosition?: boolean; // Random position on each update (default: true)
  position?: {
    x?: number | 'left' | 'center' | 'right' | 'random';
    y?: number | 'top' | 'center' | 'bottom' | 'random';
  };
  style?: {
    fontSize?: number; // Font size in pixels (default: 14)
    fontFamily?: string; // Font family (default: "Arial")
    opacity?: number; // Opacity 0-1 (default: 0.3)
    color?: string; // Custom color (overrides gradient)
    gradientColors?: [string, string]; // Custom gradient colors
  };
}

export interface PlayerMetrics {
  sessionId: string;
  playbackStarted?: number;
  totalPlayTime: number;
  bufferingCount: number;
  bufferingDuration: number;
  averageBitrate: number;
  qualityChanges: number;
  errors: PlayerError[];
  bandwidth?: number;
  droppedFrames?: number;
  decodedFrames?: number;
}

export interface PlayerError {
  code: string;
  message: string;
  timestamp: number;
  fatal: boolean;
  data?: any;
}

export interface ProgressEvent {
  currentTime: number;
  duration: number;
  buffered: TimeRanges;
  seekable: TimeRanges;
  played: TimeRanges;
}

export interface TimeRanges {
  length: number;
  start(index: number): number;
  end(index: number): number;
}

export interface PlatformInfo {
  type: PlatformType;
  os: string;
  version: string;
  isTV: boolean;
  isMobile: boolean;
  isDesktop?: boolean;
  hasTouch?: boolean;
  screenSize?: {
    width: number;
    height: number;
  };
}

export type PlayerEvent = 
  | 'ready'
  | 'play'
  | 'pause'
  | 'ended'
  | 'error'
  | 'loadstart'
  | 'loadedmetadata'
  | 'timeupdate'
  | 'progress'
  | 'seeking'
  | 'seeked'
  | 'waiting'
  | 'canplay'
  | 'canplaythrough'
  | 'volumechange'
  | 'ratechange'
  | 'qualitychange'
  | 'subtitlechange'
  | 'audiotrackchange'
  | 'fullscreenchange'
  | 'pictureInPicturechange'
  | 'castStateChanged'
  | 'adstart'
  | 'adend'
  | 'aderror'
  | 'chapterchange'
  | 'segmententered'
  | 'segmentexited'
  | 'segmentskipped'
  | 'chapterSegmentEntered'
  | 'chapterSegmentSkipped'
  | 'chapterSkipButtonShown'
  | 'chapterSkipButtonHidden'
  | 'chaptersLoaded'
  | 'chaptersLoadError';

export type EventHandler = (data?: any) => void;

export interface EventEmitter {
  on(event: PlayerEvent, handler: EventHandler): void;
  off(event: PlayerEvent, handler: EventHandler): void;
  once(event: PlayerEvent, handler: EventHandler): void;
  emit(event: PlayerEvent, data?: any): void;
  removeAllListeners(event?: PlayerEvent): void;
}

// Legacy alias for PlayerEvent - used by some implementations
export type PlayerEvents = {
  [K in PlayerEvent]: K;
};

// Video player interface for backwards compatibility
export interface VideoPlayerInterface {
  load(source: VideoSource): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(position: number): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVolume(): number;
  isMuted(): boolean;
  mute(): void;
  unmute(): void;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  enterFullscreen(): void;
  exitFullscreen(): void;
  enterPictureInPicture(): void;
  exitPictureInPicture(): void;
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  destroy(): void;
  getState(): VideoPlayerState;
}

// Legacy state type
export type VideoPlayerState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';

// Main player interface
export interface IVideoPlayer {
  initialize(container: any, config?: PlayerConfig): Promise<void>;
  destroy(): Promise<void>;
  load(videoSource: VideoSource): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  setVolume(level: number): void;
  mute(): void;
  unmute(): void;
  toggleMute(): void;
  getQualities(): Quality[];
  getCurrentQuality(): Quality | null;
  setQuality(index: number): void;
  setAutoQuality(enabled: boolean): void;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getBufferedPercentage(): number;
  getState(): PlayerStateInterface;
  isPlaying(): boolean;
  isPaused(): boolean;
  isEnded(): boolean;
  enterFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
  toggleFullscreen(): Promise<void>;
  enterPictureInPicture(): Promise<void>;
  exitPictureInPicture(): Promise<void>;
  on(event: PlayerEvent, handler: EventHandler): void;
  off(event: PlayerEvent, handler?: EventHandler): void;
  once(event: PlayerEvent, handler: EventHandler): void;
  getSubtitles(): SubtitleTrack[];
  setSubtitleTrack(index: number): void;
  disableSubtitles(): void;
}

// Player state interface
export interface PlayerStateInterface {
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
  currentQuality: Quality | null;
  availableQualities: Quality[];
}

export interface PaywallConfig {
  enabled?: boolean;
  apiBase?: string;
  userId?: string;
  videoId?: string;
  gateways?: (string | PaywallGateway)[];
  pricing?: {
    amount?: number;
    currency?: string;
    title?: string;
    description?: string;
  };
  branding?: {
    title?: string;
    description?: string;
    brandColor?: string;
    paymentTitle?: string;
  };
  popup?: {
    width?: number;
    height?: number;
  };
  metadata?: {
    slug?: string;
    [key: string]: any;
  };
  // Payment Link Configuration for generic payment gateways
  paymentLink?: {
    endpoint: string;
    method?: 'POST' | 'GET';
    headers?: Record<string, string>;
    mapRequest?: (paymentData: any) => any;
    mapResponse?: (response: any) => { url: string; orderId?: string; };
    popup?: {
      width?: number;
      height?: number;
      features?: string;
    };
  };
  emailAuth?: {
    enabled?: boolean;
    skipIfAuthenticated?: boolean;
    api?: {
      requestOtp?: string;
      verifyOtp?: string;
      refreshToken?: string;
      logout?: string;
    };
    sessionStorage?: {
      tokenKey?: string;
      refreshTokenKey?: string;
      userIdKey?: string;
      emailKey?: string;
    };
    requestPayload?: {
      [key: string]: any;
    };
    ui?: {
      title?: string;
      description?: string;
      emailPlaceholder?: string;
      otpPlaceholder?: string;
      submitButtonText?: string;
      resendButtonText?: string;
      resendCooldown?: number;
      verifyButtonText?: string;
      brandColor?: string;
      allowBackdropClose?: boolean;
      showCancelButton?: boolean;
      placeholderColor?: string;
    };
    validation?: {
      otpLength?: number;
      otpTimeout?: number;
      rateLimiting?: {
        maxAttempts?: number;
        windowMinutes?: number;
      };
    };
  };
}

export interface PaywallGateway {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface PlayerConfig extends VideoPlayerConfig {
  freeDuration?: number;
  paywall?: PaywallConfig;
  volume?: number;
  chapters?: ChapterConfig;
}
