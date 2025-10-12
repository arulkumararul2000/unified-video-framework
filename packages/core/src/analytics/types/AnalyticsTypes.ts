/**
 * Analytics Types and Interfaces
 * Core type definitions for the analytics system
 */

// Base Analytics Configuration
export interface AnalyticsConfig {
  enabled: boolean;
  providers: AnalyticsProviderConfig[];
  globalSettings?: GlobalAnalyticsSettings;
}

export interface DynamicAnalyticsConfig extends AnalyticsConfig {
  providers: DynamicProviderConfig[];
}

export interface GlobalAnalyticsSettings {
  enableConsoleLogging?: boolean;
  enableErrorReporting?: boolean;
  sessionTimeout?: number; // in minutes
  defaultBatchSize?: number;
  defaultFlushInterval?: number; // in seconds
  retryAttempts?: number;
  retryDelay?: number; // in milliseconds
}

// Provider Configuration
export interface AnalyticsProviderConfig {
  name: string;
  enabled: boolean;
  config: any;
}

export interface DynamicProviderConfig extends AnalyticsProviderConfig {
  type: AnalyticsProviderType;
  priority?: number;
}

export enum AnalyticsProviderType {
  PLAYER_ANALYTICS = 'player-analytics',
  GOOGLE_ANALYTICS = 'google-analytics',
  ADOBE_ANALYTICS = 'adobe-analytics',
  CUSTOM = 'custom'
}

// Player Analytics Specific Configuration
export interface PlayerAnalyticsConfig {
  baseUrl: string;
  apiKey: string;
  playerId: string;
  tenantId?: string;
  heartbeatInterval?: number; // in seconds
  batchSize?: number;
  flushInterval?: number; // in seconds
  enableOfflineStorage?: boolean;
  maxRetries?: number;
  retryDelay?: number; // in milliseconds
}

// Event Data Structures
export interface AnalyticsEventData {
  eventType: string;
  timestamp: number;
  currentTime?: number;
  video?: VideoInfo;
  device?: DeviceInfo;
  player?: PlayerState;
  network?: NetworkInfo;
  engagement?: EngagementData;
  custom?: Record<string, any>;
  metadata?: EventMetadata;
}

export interface EventMetadata {
  sessionId: string;
  playerId: string;
  userId?: string;
  customData?: Record<string, any>;
}

// Video Information
export interface VideoInfo {
  id: string;
  title?: string;
  type: 'video' | 'audio' | 'livestream';
  duration?: number; // in seconds
  url?: string;
  quality?: string;
  bitrate?: number;
  codec?: string;
  format?: string;
  thumbnail?: string;
  description?: string;
  tags?: string[];
  chapter?: ChapterInfo;
}

export interface ChapterInfo {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  thumbnail?: string;
}

// Device Information
export interface DeviceInfo {
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'smart_tv' | 'tv';
  os: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
  screen: {
    width: number;
    height: number;
    orientation?: 'portrait' | 'landscape';
  };
  userAgent?: string;
  language?: string;
  timezone?: string;
}

// Player State
export interface PlayerState {
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  buffered?: TimeRanges | null;
  quality?: string;
  isFullscreen?: boolean;
  isPip?: boolean; // Picture-in-Picture
  isLive?: boolean;
  seekableRange?: {
    start: number;
    end: number;
  };
}

// Network Information
export interface NetworkInfo {
  connectionType?: string;
  effectiveType?: string;
  downlink?: number; // Mbps
  rtt?: number; // milliseconds
  online: boolean;
}

// Engagement Metrics
export interface EngagementData {
  watchTime: number; // Total watch time in seconds
  uniqueWatchTime: number; // Unique content watched (no replays)
  completionPercentage: number; // 0-100
  seekCount: number;
  qualityChangeCount: number;
  fullscreenCount: number;
  bufferingTime: number; // Total buffering time in seconds
  bufferingEvents: number; // Number of buffering events
  averageBitrate?: number;
  startupTime?: number; // Time to first frame
  rebufferCount: number;
  errorCount: number;
  interactionCount: number; // User interactions (play/pause/seek)
  socialShares?: number;
  likes?: number;
  comments?: number;
}

// Session Information
export interface PlayerSessionInfo {
  sessionId: string;
  playerId: string;
  startTime: number;
  endTime?: number;
  userId?: string;
  userType?: string;
  customData?: Record<string, any>;
  initialVideo?: VideoInfo;
  totalVideos?: number;
  totalWatchTime?: number;
}

// Event Types
export type AnalyticsEventType =
  | 'session_start'
  | 'session_end'
  | 'video_load'
  | 'video_start'
  | 'play'
  | 'pause'
  | 'resume'
  | 'ended'
  | 'seeking'
  | 'seeked'
  | 'waiting'
  | 'stalled'
  | 'canplay'
  | 'timeupdate'
  | 'heartbeat'
  | 'qualitychange'
  | 'volumechange'
  | 'fullscreenchange'
  | 'ratechange'
  | 'resize'
  | 'enterpictureinpicture'
  | 'leavepictureinpicture'
  | 'error'
  | 'custom';

// Error Information
export interface AnalyticsError {
  code: string | number;
  message: string;
  stack?: string;
  fatal?: boolean;
  context?: Record<string, any>;
  timestamp: number;
}

// Batch Configuration
export interface BatchConfig {
  maxSize: number;
  flushInterval: number; // in milliseconds
  maxWaitTime: number; // in milliseconds
  retryAttempts: number;
  retryDelay: number; // in milliseconds
}

// API Request/Response Types
export interface AnalyticsRequest {
  session: PlayerSessionInfo;
  events: AnalyticsEventData[];
  timestamp: number;
  batchId?: string;
}

export interface AnalyticsResponse {
  success: boolean;
  message?: string;
  errors?: string[];
  batchId?: string;
  processedCount?: number;
}

// Provider Factory Types
export interface ProviderFactory<T = any> {
  (config: T): BaseAnalyticsProvider;
}

export interface CustomProviderConfig {
  factory: ProviderFactory;
  [key: string]: any;
}

// Base Provider Interface
export interface BaseAnalyticsProvider {
  name: string;
  enabled: boolean;
  initialize(): Promise<void>;
  trackEvent(event: AnalyticsEventData): Promise<void>;
  startSession(sessionInfo: PlayerSessionInfo): Promise<string>;
  endSession(): Promise<void>;
  flush(): Promise<void>;
  destroy(): Promise<void>;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type EventHandler = (event: AnalyticsEventData) => void;
export type ErrorHandler = (error: AnalyticsError) => void;
export type SessionHandler = (sessionInfo: PlayerSessionInfo) => void;

// Storage Types
export interface StorageItem {
  id: string;
  data: AnalyticsEventData;
  timestamp: number;
  attempts: number;
}

export interface StorageConfig {
  maxItems: number;
  maxAge: number; // in milliseconds
  storageKey: string;
}

// Device Detection Types
export interface DeviceDetectionResult {
  deviceType: DeviceInfo['deviceType'];
  os: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
  screen: DeviceInfo['screen'];
  userAgent: string;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSmartTV: boolean;
  isTizen: boolean;
  isWebOS: boolean;
  isRoku: boolean;
}

export interface NetworkDetectionResult {
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  online: boolean;
}