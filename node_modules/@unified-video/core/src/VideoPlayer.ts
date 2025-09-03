import { EventEmitter } from 'events';
import {
  VideoPlayerConfig,
  VideoSource,
  PlayerState,
  PlayerEvent,
  EventHandler,
  Quality,
  SubtitleTrack,
  AudioTrack,
  PlayerMetrics,
  PlayerError,
  DRMConfig
} from './interfaces';

export abstract class VideoPlayer {
  protected config: VideoPlayerConfig;
  protected eventEmitter: EventEmitter;
  protected state: PlayerState;
  protected currentSource?: VideoSource;
  protected metrics: PlayerMetrics;
  protected errors: PlayerError[] = [];

  constructor(config: VideoPlayerConfig = {}) {
    this.config = {
      autoPlay: false,
      muted: false,
      controls: true,
      loop: false,
      preload: 'metadata',
      playsInline: true,
      ...config
    };
    
    this.eventEmitter = new EventEmitter();
    this.state = PlayerState.IDLE;
    this.metrics = this.initializeMetrics();
  }

  // Core playback methods
  abstract load(source: VideoSource): Promise<void>;
  abstract play(): Promise<void>;
  abstract pause(): void;
  abstract stop(): void;
  abstract seek(position: number): void;
  abstract setVolume(volume: number): void;
  abstract setPlaybackRate(rate: number): void;
  abstract getCurrentTime(): number;
  abstract getDuration(): number;
  abstract getVolume(): number;
  abstract getPlaybackRate(): number;
  abstract isMuted(): boolean;
  abstract setMuted(muted: boolean): void;

  // Quality management
  abstract getAvailableQualities(): Quality[];
  abstract getCurrentQuality(): Quality | null;
  abstract setQuality(quality: Quality): void;
  abstract enableAutoQuality(enabled: boolean): void;

  // Subtitle/Audio tracks
  abstract getSubtitleTracks(): SubtitleTrack[];
  abstract getCurrentSubtitleTrack(): SubtitleTrack | null;
  abstract setSubtitleTrack(track: SubtitleTrack | null): void;
  abstract getAudioTracks(): AudioTrack[];
  abstract getCurrentAudioTrack(): AudioTrack | null;
  abstract setAudioTrack(track: AudioTrack): void;

  // Platform-specific features
  abstract enterFullscreen(): void;
  abstract exitFullscreen(): void;
  abstract isFullscreen(): boolean;
  abstract enterPictureInPicture(): void;
  abstract exitPictureInPicture(): void;
  abstract isPictureInPicture(): boolean;

  // Events
  on(event: PlayerEvent, handler: EventHandler): void {
    this.eventEmitter.on(event, handler);
  }

  off(event: PlayerEvent, handler: EventHandler): void {
    this.eventEmitter.off(event, handler);
  }

  once(event: PlayerEvent, handler: EventHandler): void {
    this.eventEmitter.once(event, handler);
  }

  removeAllListeners(event?: PlayerEvent): void {
    if (event) {
      this.eventEmitter.removeAllListeners(event);
    } else {
      this.eventEmitter.removeAllListeners();
    }
  }

  protected emit(event: PlayerEvent, data?: any): void {
    this.eventEmitter.emit(event, data);
    
    // Track analytics events
    if (this.config.analytics?.enabled) {
      this.trackAnalytics(event, data);
    }
  }

  // State management
  getState(): PlayerState {
    return this.state;
  }

  protected setState(newState: PlayerState): void {
    const oldState = this.state;
    this.state = newState;
    
    if (oldState !== newState) {
      this.emit('statechange' as PlayerEvent, { oldState, newState });
    }
  }

  // Configuration
  getConfig(): VideoPlayerConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<VideoPlayerConfig>): void {
    this.config = { ...this.config, ...config };
    this.applyConfig();
  }

  protected abstract applyConfig(): void;

  // Metrics
  getMetrics(): PlayerMetrics {
    return {
      ...this.metrics,
      errors: [...this.errors]
    };
  }

  protected initializeMetrics(): PlayerMetrics {
    return {
      sessionId: this.generateSessionId(),
      totalPlayTime: 0,
      bufferingCount: 0,
      bufferingDuration: 0,
      averageBitrate: 0,
      qualityChanges: 0,
      errors: []
    };
  }

  protected generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Error handling
  protected handleError(error: PlayerError): void {
    this.errors.push(error);
    this.emit('error', error);
    
    if (error.fatal) {
      this.setState(PlayerState.ERROR);
    }
  }

  // Analytics
  protected trackAnalytics(event: string, data?: any): void {
    if (!this.config.analytics?.providers) return;
    
    const analyticsData = {
      event,
      timestamp: Date.now(),
      sessionId: this.metrics.sessionId,
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      state: this.state,
      ...data
    };

    this.config.analytics.providers.forEach(provider => {
      try {
        provider.track(event, analyticsData);
      } catch (error) {
        console.error(`Analytics provider ${provider.name} failed:`, error);
      }
    });
  }

  // DRM
  protected abstract configureDRM(drmConfig: DRMConfig): Promise<void>;

  // Cleanup
  abstract destroy(): void;

  protected cleanup(): void {
    this.removeAllListeners();
    this.state = PlayerState.IDLE;
    this.currentSource = undefined;
  }

  // Utility methods
  protected formatTime(seconds: number): string {
    if (!isFinite(seconds)) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${this.pad(minutes)}:${this.pad(secs)}`;
    }
    return `${minutes}:${this.pad(secs)}`;
  }

  private pad(num: number): string {
    return num.toString().padStart(2, '0');
  }

  // Buffer management
  abstract getBufferedRanges(): TimeRanges;
  abstract getSeekableRanges(): TimeRanges;
  
  protected isBuffering(): boolean {
    return this.state === PlayerState.BUFFERING;
  }

  // Network
  abstract getBandwidth(): number;
  abstract getNetworkState(): number;
  
  // Video properties
  abstract getVideoWidth(): number;
  abstract getVideoHeight(): number;
  abstract getDroppedFrames(): number;
  abstract getDecodedFrames(): number;
}
