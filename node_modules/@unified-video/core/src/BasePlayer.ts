/**
 * Abstract base player class that provides common functionality
 */

import { 
  IVideoPlayer, 
  VideoSource, 
  PlayerConfig, 
  PlayerState, 
  PlayerEvents, 
  PlayerError,
  Quality,
  SubtitleTrack 
} from './interfaces/IVideoPlayer';
import { EventEmitter } from './utils/EventEmitter';

export abstract class BasePlayer implements IVideoPlayer {
  protected container: HTMLElement | null = null;
  protected config: PlayerConfig;
  protected events: EventEmitter;
  protected state: PlayerState;
  protected source: VideoSource | null = null;
  protected subtitles: SubtitleTrack[] = [];
  protected currentSubtitleIndex: number = -1;

  constructor() {
    this.config = this.getDefaultConfig();
    this.events = new EventEmitter();
    this.state = this.getDefaultState();
  }

  protected getDefaultConfig(): PlayerConfig {
    return {
      autoPlay: false,
      muted: false,
      volume: 1.0,
      controls: true,
      loop: false,
      preload: 'metadata',
      playsInline: true,
      enableAdaptiveBitrate: true,
      debug: false
    };
  }

  protected getDefaultState(): PlayerState {
    return {
      isPlaying: false,
      isPaused: true,
      isBuffering: false,
      isEnded: false,
      isError: false,
      currentTime: 0,
      duration: 0,
      bufferedPercentage: 0,
      volume: 1.0,
      isMuted: false,
      playbackRate: 1.0,
      availableQualities: []
    };
  }

  async initialize(container: HTMLElement | string, config?: PlayerConfig): Promise<void> {
    if (typeof container === 'string') {
      const element = document.querySelector(container) as HTMLElement;
      if (!element) {
        throw new Error(`Container element not found: ${container}`);
      }
      this.container = element;
    } else {
      this.container = container;
    }

    this.config = { ...this.getDefaultConfig(), ...config };
    this.state.volume = this.config.volume || 1.0;
    this.state.isMuted = this.config.muted || false;

    await this.setupPlayer();
  }

  protected abstract setupPlayer(): Promise<void>;

  abstract destroy(): Promise<void>;

  abstract load(source: VideoSource): Promise<void>;

  async play(): Promise<void> {
    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.emit('onPlay');
  }

  pause(): void {
    this.state.isPlaying = false;
    this.state.isPaused = true;
    this.emit('onPause');
  }

  stop(): void {
    this.pause();
    this.seek(0);
    this.state.isEnded = true;
  }

  abstract seek(time: number): void;

  setVolume(level: number): void {
    const volume = Math.max(0, Math.min(1, level));
    this.state.volume = volume;
    this.emit('onVolumeChanged', volume);
  }

  mute(): void {
    this.state.isMuted = true;
    this.emit('onVolumeChanged', 0);
  }

  unmute(): void {
    this.state.isMuted = false;
    this.emit('onVolumeChanged', this.state.volume);
  }

  toggleMute(): void {
    if (this.state.isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
  }

  abstract getQualities(): Quality[];
  abstract getCurrentQuality(): Quality | null;
  abstract setQuality(index: number): void;
  abstract setAutoQuality(enabled: boolean): void;

  setPlaybackRate(rate: number): void {
    this.state.playbackRate = rate;
  }

  getPlaybackRate(): number {
    return this.state.playbackRate;
  }

  getCurrentTime(): number {
    return this.state.currentTime;
  }

  getDuration(): number {
    return this.state.duration;
  }

  getBufferedPercentage(): number {
    return this.state.bufferedPercentage;
  }

  getState(): PlayerState {
    return { ...this.state };
  }

  isPlaying(): boolean {
    return this.state.isPlaying;
  }

  isPaused(): boolean {
    return this.state.isPaused;
  }

  isEnded(): boolean {
    return this.state.isEnded;
  }

  abstract enterFullscreen(): Promise<void>;
  abstract exitFullscreen(): Promise<void>;

  async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await this.exitFullscreen();
    } else {
      await this.enterFullscreen();
    }
  }

  abstract enterPictureInPicture(): Promise<void>;
  abstract exitPictureInPicture(): Promise<void>;

  on(event: keyof PlayerEvents, handler: Function): void {
    this.events.on(event, handler as any);
  }

  off(event: keyof PlayerEvents, handler?: Function): void {
    this.events.off(event, handler as any);
  }

  once(event: keyof PlayerEvents, handler: Function): void {
    this.events.once(event, handler as any);
  }

  protected emit(event: keyof PlayerEvents, ...args: any[]): void {
    this.events.emit(event, ...args);
  }

  getSubtitles(): SubtitleTrack[] {
    return this.subtitles;
  }

  setSubtitleTrack(index: number): void {
    if (index >= 0 && index < this.subtitles.length) {
      this.currentSubtitleIndex = index;
      this.applySubtitleTrack(this.subtitles[index]);
    }
  }

  disableSubtitles(): void {
    this.currentSubtitleIndex = -1;
    this.removeSubtitles();
  }

  protected abstract applySubtitleTrack(track: SubtitleTrack): void;
  protected abstract removeSubtitles(): void;

  protected handleError(error: PlayerError): void {
    this.state.isError = true;
    this.state.isPlaying = false;
    this.emit('onError', error);
    
    if (this.config.debug) {
      console.error('[VideoPlayer Error]', error);
    }
  }

  protected updateTime(time: number): void {
    this.state.currentTime = time;
    this.emit('onTimeUpdate', time);
  }

  protected updateBuffered(percentage: number): void {
    this.state.bufferedPercentage = percentage;
    this.emit('onProgress', percentage);
  }

  protected setBuffering(isBuffering: boolean): void {
    this.state.isBuffering = isBuffering;
    this.emit('onBuffering', isBuffering);
  }
}
