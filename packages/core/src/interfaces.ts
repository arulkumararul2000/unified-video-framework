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

export enum PlayerState {
  IDLE = 'idle',
  LOADING = 'loading',
  READY = 'ready',
  PLAYING = 'playing',
  PAUSED = 'paused',
  BUFFERING = 'buffering',
  ENDED = 'ended',
  ERROR = 'error'
}

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
  | 'aderror';

export type EventHandler = (data?: any) => void;

export interface EventEmitter {
  on(event: PlayerEvent, handler: EventHandler): void;
  off(event: PlayerEvent, handler: EventHandler): void;
  once(event: PlayerEvent, handler: EventHandler): void;
  emit(event: PlayerEvent, data?: any): void;
  removeAllListeners(event?: PlayerEvent): void;
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
}
