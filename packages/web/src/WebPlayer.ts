/**
 * Web implementation of the video player with HLS and DASH support
 */

import { BasePlayer } from '../../core/dist/BasePlayer';
import { 
  VideoSource, 
  PlayerConfig, 
  Quality, 
  SubtitleTrack,
  PlayerError,
  ChapterManager as CoreChapterManager,
  Chapter,
  ChapterSegment
} from '../../core/dist/index';
import { ChapterManager } from './chapters/ChapterManager';
import { 
  ChapterConfig, 
  VideoChapters,
  VideoSegment,
  ChapterEvents 
} from './chapters/types/ChapterTypes';

// Dynamic imports for streaming libraries
declare global {
  interface Window {
    Hls: any;
    dashjs: any;
    cast?: any;
    chrome?: any;
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
  }
}

export class WebPlayer extends BasePlayer {
  protected video: HTMLVideoElement | null = null;
  private hls: any = null;
  private dash: any = null;
  private qualities: Quality[] = [];
  private currentQualityIndex: number = -1;
  private autoQuality: boolean = true;
  private useCustomControls: boolean = true;
  private controlsContainer: HTMLElement | null = null;
  private volumeHideTimeout: NodeJS.Timeout | null = null;
  private hideControlsTimeout: NodeJS.Timeout | null = null;
  private isVolumeSliding: boolean = false;
  private availableQualities: Array<{value: string, label: string}> = [];
  private availableSubtitles: Array<{value: string, label: string}> = [];
  private currentQuality = 'auto';
  private currentSubtitle = 'off';
  private currentPlaybackRate = 1;
  private isDragging: boolean = false;
  
  // Settings configuration
  private settingsConfig = {
    enabled: true,        // Show settings button
    speed: true,         // Show playback speed options
    quality: true,       // Show quality options
    subtitles: true      // Show subtitle options
  };
  private watermarkCanvas: HTMLCanvasElement | null = null;
  private playerWrapper: HTMLElement | null = null;
  // Free preview gate state
  private previewGateHit: boolean = false;
  private paymentSuccessTime: number = 0;
  private paymentSuccessful: boolean = false;
  
  // Security state to prevent paywall bypass
  private isPaywallActive: boolean = false;
  private authValidationInterval: any = null;
  private overlayRemovalAttempts: number = 0;
  private maxOverlayRemovalAttempts: number = 3;
  private lastSecurityCheck: number = 0;
  
  // Cast state
  private castContext: any = null;
  private remotePlayer: any = null;
  private remoteController: any = null;
  private isCasting: boolean = false;
  private _castTrackIdByKey: Record<string, number> = {};
  private selectedSubtitleKey: string = 'off';
  private _kiTo: any = null;

  // Paywall
  private paywallController: any = null;

  // Play/pause coordination to prevent race conditions
  private _playPromise: Promise<void> | null = null;
  private _deferredPause = false;
  private _lastToggleAt = 0;
  private _TOGGLE_DEBOUNCE_MS = 120;
  
  // Fullscreen fallback tracking
  private hasTriedButtonFallback: boolean = false;
  private lastUserInteraction: number = 0;
  
  // Progress bar tooltip state
  private showTimeTooltip: boolean = false;
  
  // Advanced tap handling state
  private tapStartTime: number = 0;
  private tapStartX: number = 0;
  private tapStartY: number = 0;
  private lastTapTime: number = 0;
  private lastTapX: number = 0;
  private tapCount: number = 0;
  private longPressTimer: NodeJS.Timeout | null = null;
  private isLongPressing: boolean = false;
  private longPressPlaybackRate: number = 1;
  private tapResetTimer: NodeJS.Timeout | null = null;
  private fastBackwardInterval: NodeJS.Timeout | null = null;
  private handleSingleTap: () => void = () => {};
  private handleDoubleTap: (tapX: number) => void = () => {};
  private handleLongPress: (tapX: number) => void = () => {};
  private handleLongPressEnd: () => void = () => {};

  // Autoplay enhancement state
  private autoplayCapabilities: {
    canAutoplay: boolean;
    canAutoplayMuted: boolean;
    canAutoplayUnmuted: boolean;
    lastCheck: number;
  } = {
    canAutoplay: false,
    canAutoplayMuted: false,
    canAutoplayUnmuted: false,
    lastCheck: 0
  };
  private autoplayRetryPending: boolean = false;
  private autoplayRetryAttempts: number = 0;
  private maxAutoplayRetries: number = 3;

  // Chapter management
  private chapterManager: ChapterManager | null = null;
  private coreChapterManager: CoreChapterManager | null = null;
  private chapterConfig: ChapterConfig = { enabled: false };

  // Debug logging helper
  private debugLog(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.log(`[WebPlayer] ${message}`, ...args);
    }
  }

  private debugError(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.error(`[WebPlayer] ${message}`, ...args);
    }
  }

  private debugWarn(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.warn(`[WebPlayer] ${message}`, ...args);
    }
  }


  async initialize(container: HTMLElement | string, config?: any): Promise<void> {
    // Debug log the config being passed
    console.log('WebPlayer.initialize called with config:', config);
    
    // Set useCustomControls based on config before calling parent initialize
    if (config && config.customControls !== undefined) {
      this.useCustomControls = config.customControls;
      console.log('Custom controls set to:', this.useCustomControls);
    }
    
    // Configure settings menu options
    if (config && config.settings) {
      console.log('Settings config found:', config.settings);
      this.settingsConfig = {
        enabled: config.settings.enabled !== undefined ? config.settings.enabled : true,
        speed: config.settings.speed !== undefined ? config.settings.speed : true,
        quality: config.settings.quality !== undefined ? config.settings.quality : true,
        subtitles: config.settings.subtitles !== undefined ? config.settings.subtitles : true
      };
      console.log('Settings config applied:', this.settingsConfig);
    } else {
      console.log('No settings config found, using defaults:', this.settingsConfig);
    }
    
    // Configure chapters if provided
    if (config && config.chapters) {
      console.log('Chapter config found:', config.chapters);
      this.chapterConfig = {
        enabled: config.chapters.enabled || false,
        data: config.chapters.data,
        dataUrl: config.chapters.dataUrl,
        autoHide: config.chapters.autoHide !== undefined ? config.chapters.autoHide : true,
        autoHideDelay: config.chapters.autoHideDelay || 5000,
        showChapterMarkers: config.chapters.showChapterMarkers !== undefined ? config.chapters.showChapterMarkers : true,
        skipButtonPosition: config.chapters.skipButtonPosition || 'bottom-right',
        customStyles: config.chapters.customStyles || {},
        userPreferences: config.chapters.userPreferences || {
          autoSkipIntro: false,
          autoSkipRecap: false,
          autoSkipCredits: false,
          showSkipButtons: true,
          skipButtonTimeout: 5000,
          rememberChoices: true
        }
      };
      console.log('Chapter config applied:', this.chapterConfig);
    } else {
      console.log('No chapter config found, chapters disabled');
    }
    
    // Call parent initialize
    await super.initialize(container, config);
  }

  protected async setupPlayer(): Promise<void> {
    if (!this.container) {
      throw new Error('Container element is required');
    }

    // Inject styles
    this.injectStyles();

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'uvf-player-wrapper';
    this.playerWrapper = wrapper;
    
    // Create video container
    const videoContainer = document.createElement('div');
    videoContainer.className = 'uvf-video-container';

    // Create video element
    this.video = document.createElement('video');
    this.video.className = 'uvf-video';
    this.video.controls = false; // We'll use custom controls
    // Don't set autoplay attribute - we'll handle it programmatically with intelligent detection
    this.video.autoplay = false;
    // Respect user's muted preference, intelligent autoplay will handle browser policies
    this.video.muted = this.config.muted ?? false;
    this.video.loop = this.config.loop ?? false;
    this.video.playsInline = this.config.playsInline ?? true;
    this.video.preload = this.config.preload ?? 'metadata';
    
    // Enable AirPlay for iOS devices
    (this.video as any).webkitAllowsAirPlay = true;
    this.video.setAttribute('x-webkit-airplay', 'allow');
    
    if (this.config.crossOrigin) {
      this.video.crossOrigin = this.config.crossOrigin;
    }

    // Add watermark canvas
    this.watermarkCanvas = document.createElement('canvas');
    this.watermarkCanvas.className = 'uvf-watermark-layer';

    // Add video to container
    videoContainer.appendChild(this.video);
    videoContainer.appendChild(this.watermarkCanvas);

    // Create custom controls if enabled
    if (this.useCustomControls) {
      this.createCustomControls(videoContainer);
    }


    // Assemble the player
    wrapper.appendChild(videoContainer);
    
    // Add to container
    this.container.innerHTML = '';
    this.container.appendChild(wrapper);

    // Apply scrollbar preferences from data attributes, if any
    this.applyScrollbarPreferencesFromDataset();

    // Setup event listeners
    this.setupVideoEventListeners();
    this.setupControlsEventListeners();
    this.setupKeyboardShortcuts();
    this.setupWatermark();
    this.setupFullscreenListeners();
    this.setupUserInteractionTracking();
    
    // Initialize chapter manager if enabled
    if (this.chapterConfig.enabled && this.video) {
      this.setupChapterManager();
    }

    // Initialize paywall controller if provided
    try {
      const pw: any = (this.config as any).paywall || null;
      if (pw && pw.enabled) {
        const { PaywallController } = await import('./paywall/PaywallController');
        this.paywallController = new (PaywallController as any)(pw, {
          getOverlayContainer: () => this.playerWrapper,
          onResume: () => { 
            try { 
              this.debugLog('onResume callback triggered - payment/auth successful');
              
              // Reset all security state after successful payment/auth
              this.previewGateHit = false;
              this.paymentSuccessTime = Date.now();
              this.paymentSuccessful = true;
              this.isPaywallActive = false;
              this.overlayRemovalAttempts = 0;
              
              // Clear security monitoring immediately
              if (this.authValidationInterval) {
                this.debugLog('Clearing security monitoring interval');
                clearInterval(this.authValidationInterval);
                this.authValidationInterval = null;
              }
              
              // Force cleanup of any remaining overlays
              this.forceCleanupOverlays();
              
              this.debugLog('Payment successful - all security restrictions lifted, resuming playback');
              
              // Give a small delay to ensure overlay is properly closed before resuming
              setTimeout(() => {
                this.play(); 
              }, 150); // Slightly longer delay for complete cleanup
            } catch(error) {
              this.debugError('Error in onResume callback:', error);
            } 
          },
          onShow: () => { 
            // Activate security monitoring when paywall is shown
            this.isPaywallActive = true;
            this.startOverlayMonitoring();
            
            // Use safe pause method to avoid race conditions
            try { this.requestPause(); } catch(_) {} 
          },
          onClose: () => {
            this.debugLog('onClose callback triggered - paywall closing');
            
            // Deactivate security monitoring when paywall is closed
            this.isPaywallActive = false;
            
            // Clear monitoring interval
            if (this.authValidationInterval) {
              this.debugLog('Clearing security monitoring interval on close');
              clearInterval(this.authValidationInterval);
              this.authValidationInterval = null;
            }
            
            // Reset overlay removal attempts counter
            this.overlayRemovalAttempts = 0;
          }
        });
        // When free preview ends, open overlay
        this.on('onFreePreviewEnded' as any, () => {
          this.debugLog('onFreePreviewEnded event triggered, calling paywallController.openOverlay()');
          try { 
            this.paywallController?.openOverlay(); 
          } catch(error) {
            this.debugError('Error calling paywallController.openOverlay():', error);
          }
        });
      }
    } catch (_) {}

    // Attempt to bind Cast context if available
    this.setupCastContextSafe();

    // Initialize metadata UI to hidden/empty by default
    this.updateMetadataUI();
  }

  private autoplayAttempted: boolean = false;

  private setupVideoEventListeners(): void {
    if (!this.video) return;

    this.video.addEventListener('play', () => {
      // Don't enforce preview if payment was successful
      if (!this.paymentSuccessful && this.config.freeDuration && this.config.freeDuration > 0) {
        const lim = Number(this.config.freeDuration);
        const cur = (this.video?.currentTime || 0);
        if (!this.previewGateHit && cur >= lim) {
          try { this.video?.pause(); } catch (_) {}
          this.showNotification('Free preview ended. Please rent to continue.');
          return;
        }
      }
      this.state.isPlaying = true;
      this.state.isPaused = false;
      this.emit('onPlay');
    });

    this.video.addEventListener('playing', () => {
      // Handle deferred pause requests
      if (this._deferredPause) {
        this._deferredPause = false;
        try { this.video?.pause(); } catch (_) {}
      }

      // Stop buffering state
      this.setBuffering(false);
    });

    this.video.addEventListener('pause', () => {
      this.state.isPlaying = false;
      this.state.isPaused = true;
      this.emit('onPause');
    });

    this.video.addEventListener('ended', () => {
      this.state.isEnded = true;
      this.state.isPlaying = false;
      this.emit('onEnded');
    });

    this.video.addEventListener('timeupdate', () => {
      if (!this.video) return;
      const t = this.video.currentTime || 0;
      this.updateTime(t);
      // Enforce free preview gate on local playback
      this.enforceFreePreviewGate(t);
      // Process chapter time updates
      if (this.coreChapterManager) {
        this.coreChapterManager.processTimeUpdate(t);
      }
    });

    this.video.addEventListener('progress', () => {
      this.updateBufferProgress();
    });

    this.video.addEventListener('waiting', () => {
      this.setBuffering(true);
    });

    this.video.addEventListener('canplay', () => {
      this.debugLog('📡 canplay event fired');
      this.setBuffering(false);
      this.emit('onReady');
      
      // Update time display when video is ready to play
      this.updateTimeDisplay();
      
      // Handle deferred pause requests
      if (this._deferredPause) {
        this._deferredPause = false;
        try { this.video?.pause(); } catch (_) {}
      }

      // Attempt autoplay once when video is ready to play
      this.debugLog(`🎬 Autoplay check: config.autoPlay=${this.config.autoPlay}, autoplayAttempted=${this.autoplayAttempted}`);
      if (this.config.autoPlay && !this.autoplayAttempted) {
        this.debugLog('🎬 Starting intelligent autoplay attempt');
        this.autoplayAttempted = true;
        this.attemptIntelligentAutoplay().then(success => {
          if (!success) {
            this.debugWarn('❌ Intelligent autoplay failed - will retry on user interaction');
            this.setupAutoplayRetry();
          } else {
            this.debugLog('✅ Intelligent autoplay succeeded');
          }
        }).catch(error => {
          this.debugError('Autoplay failed:', error);
          this.setupAutoplayRetry();
        });
      } else {
        this.debugLog(`⛔ Skipping autoplay: autoPlay=${this.config.autoPlay}, attempted=${this.autoplayAttempted}`);
      }
    });

    this.video.addEventListener('loadedmetadata', () => {
      if (!this.video) return;
      this.state.duration = this.video.duration || 0;
      this.debugLog('Metadata loaded - duration:', this.video.duration);
      
      // Update time display immediately when metadata loads
      this.updateTimeDisplay();
      
      this.emit('onLoadedMetadata', {
        duration: this.video.duration || 0,
        width: this.video.videoWidth || 0,
        height: this.video.videoHeight || 0
      });
    });

    this.video.addEventListener('volumechange', () => {
      if (!this.video) return;
      this.state.volume = this.video.volume;
      this.state.isMuted = this.video.muted;
      this.emit('onVolumeChanged', this.video.volume);
    });

    this.video.addEventListener('error', (e) => {
      if (!this.video) return;
      const error = this.video.error;
      if (error) {
        this.handleError({
          code: `MEDIA_ERR_${error.code}`,
          message: error.message || this.getMediaErrorMessage(error.code),
          type: 'media',
          fatal: true,
          details: error
        });
      }
    });

    this.video.addEventListener('seeking', () => {
      this.emit('onSeeking');
    });

    this.video.addEventListener('seeked', () => {
      // Apply gate if user seeks beyond free preview
      if (!this.video) return;
      const t = this.video.currentTime || 0;
      this.enforceFreePreviewGate(t, true);
      this.emit('onSeeked');
    });
  }

  private getMediaErrorMessage(code: number): string {
    switch (code) {
      case 1: return 'Media loading aborted';
      case 2: return 'Network error';
      case 3: return 'Media decoding failed';
      case 4: return 'Media format not supported';
      default: return 'Unknown media error';
    }
  }

  private updateBufferProgress(): void {
    if (!this.video) return;
    
    const buffered = this.video.buffered;
    if (buffered.length > 0) {
      const bufferedEnd = buffered.end(buffered.length - 1);
      const duration = this.video.duration;
      const percentage = duration > 0 ? (bufferedEnd / duration) * 100 : 0;
      this.updateBuffered(percentage);
    }
  }

  async load(source: any): Promise<void> {
    this.source = source as any;
    this.subtitles = (source.subtitles || []) as any;

    // Reset autoplay flag for new source
    this.autoplayAttempted = false;

    // Clean up previous instances
    await this.cleanup();

    if (!this.video) {
      throw new Error('Video element not initialized');
    }


    // Detect source type
    const sourceType = this.detectSourceType(source);

    try {
      switch (sourceType) {
        case 'hls':
          await this.loadHLS(source.url);
          break;
        case 'dash':
          await this.loadDASH(source.url);
          break;
        default:
          await this.loadNative(source.url);
      }

      // Load subtitles if provided
      if (source.subtitles && source.subtitles.length > 0) {
        this.loadSubtitles(source.subtitles);
      }

      // Apply metadata
      if (source.metadata) {
        if (source.metadata.posterUrl && this.video) {
          this.video.poster = source.metadata.posterUrl;
        }
        // Update player UI with metadata (title, description, thumbnail)
        this.updateMetadataUI();
      } else {
        // Clear to defaults if no metadata
        this.updateMetadataUI();
      }

    } catch (error) {
      this.handleError({
        code: 'LOAD_ERROR',
        message: `Failed to load video: ${error}`,
        type: 'network',
        fatal: true,
        details: error
      });
      throw error;
    }
  }

  private detectSourceType(source: VideoSource): string {
    if (source.type && source.type !== 'auto') {
      return source.type;
    }

    const url = source.url.toLowerCase();
    if (url.includes('.m3u8')) return 'hls';
    if (url.includes('.mpd')) return 'dash';
    if (url.includes('.mp4')) return 'mp4';
    if (url.includes('.webm')) return 'webm';
    
    return 'mp4'; // default
  }

  private async loadHLS(url: string): Promise<void> {
    // Check if HLS.js is available
    if (!window.Hls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/hls.js@latest');
    }

    if (window.Hls.isSupported()) {
      this.hls = new window.Hls({
        debug: this.config.debug,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90
      });

      this.hls.loadSource(url);
      this.hls.attachMedia(this.video);

      this.hls.on(window.Hls.Events.MANIFEST_PARSED, (event: any, data: any) => {
        // Extract quality levels
        this.qualities = data.levels.map((level: any, index: number) => ({
          height: level.height,
          width: level.width || 0,
          bitrate: level.bitrate,
          label: `${level.height}p`,
          index: index
        }));

        // Update settings menu with detected qualities
        this.updateSettingsMenu();
        
        // Note: Autoplay is now handled in the 'canplay' event when video is ready
      });

      this.hls.on(window.Hls.Events.LEVEL_SWITCHED, (event: any, data: any) => {
        if (this.qualities[data.level]) {
          this.currentQualityIndex = data.level;
          this.state.currentQuality = this.qualities[data.level] as any;
          this.emit('onQualityChanged', this.qualities[data.level]);
        }
      });

      this.hls.on(window.Hls.Events.ERROR, (event: any, data: any) => {
        if (data.fatal) {
          this.handleHLSError(data);
        }
      });
    } else if (this.video!.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      this.video!.src = url;
    } else {
      throw new Error('HLS is not supported in this browser');
    }
  }

  private handleHLSError(data: any): void {
    const Hls = window.Hls;
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        console.error('Fatal network error, trying to recover');
        this.hls.startLoad();
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        console.error('Fatal media error, trying to recover');
        this.hls.recoverMediaError();
        break;
      default:
        console.error('Fatal error, cannot recover');
        this.handleError({
          code: 'HLS_ERROR',
          message: data.details,
          type: 'media',
          fatal: true,
          details: data
        });
        this.hls.destroy();
        break;
    }
  }

  private async loadDASH(url: string): Promise<void> {
    // Check if dash.js is available
    if (!window.dashjs) {
      await this.loadScript('https://cdn.dashjs.org/latest/dash.all.min.js');
    }

    this.dash = window.dashjs.MediaPlayer().create();
    this.dash.initialize(this.video, url, this.config.autoPlay);

    // Configure DASH settings
    this.dash.updateSettings({
      streaming: {
        abr: {
          autoSwitchBitrate: {
            video: this.config.enableAdaptiveBitrate ?? true,
            audio: true
          }
        },
        buffer: {
          fastSwitchEnabled: true
        }
      }
    });

    // Listen for quality changes
    this.dash.on(window.dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e: any) => {
      if (e.mediaType === 'video') {
        this.updateDASHQuality(e.newQuality);
      }
    });

    // Extract available qualities
    this.dash.on(window.dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
      const bitrateList = this.dash.getBitrateInfoListFor('video');
      if (bitrateList && bitrateList.length > 0) {
        this.qualities = bitrateList.map((info: any, index: number) => ({
          height: info.height || 0,
          width: info.width || 0,
          bitrate: info.bitrate,
          label: `${info.height}p`,
          index: index
        }));
        
        // Update settings menu with detected qualities
        this.updateSettingsMenu();
      }
    });

    // Handle errors
    this.dash.on(window.dashjs.MediaPlayer.events.ERROR, (e: any) => {
      this.handleError({
        code: 'DASH_ERROR',
        message: e.error.message,
        type: 'media',
        fatal: true,
        details: e
      });
    });
  }

  private updateDASHQuality(qualityIndex: number): void {
    if (this.qualities[qualityIndex]) {
      this.currentQualityIndex = qualityIndex;
      this.state.currentQuality = this.qualities[qualityIndex] as any;
      this.emit('onQualityChanged', this.qualities[qualityIndex]);
    }
  }

  private async loadNative(url: string): Promise<void> {
    if (!this.video) return;
    this.video.src = url;
    this.video.load();
  }

  protected loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  private loadSubtitles(subtitles: SubtitleTrack[]): void {
    if (!this.video) return;

    // Remove existing tracks
    const existingTracks = this.video.querySelectorAll('track');
    existingTracks.forEach(track => track.remove());

    // Add new subtitle tracks
    subtitles.forEach((subtitle, index) => {
      const track = document.createElement('track');
      track.kind = subtitle.kind || 'subtitles';
      track.label = subtitle.label;
      track.src = subtitle.url || '';
      
      if (subtitle.default || index === 0) {
        track.default = true;
      }

      this.video!.appendChild(track);
    });
  }

  private isAbortPlayError(err: any): boolean {
    return !!err && (
      (err.name === 'AbortError') ||
      (typeof err.message === 'string' && /interrupted by a call to pause\(\)/i.test(err.message))
    );
  }

  private isAutoplayRestrictionError(err: any): boolean {
    if (!err) return false;

    const message = (err.message || '').toLowerCase();
    const name = (err.name || '').toLowerCase();

    // Common autoplay restriction error patterns
    return (
      name === 'notallowederror' ||
      message.includes('user didn\'t interact') ||
      message.includes('autoplay') ||
      message.includes('gesture') ||
      message.includes('user activation') ||
      message.includes('play() failed') ||
      message.includes('user interaction')
    );
  }

  /**
   * Detect browser autoplay capabilities
   * Tests both muted and unmuted autoplay support
   */
  private async detectAutoplayCapabilities(): Promise<void> {
    // Cache for 5 minutes to avoid repeated checks
    const now = Date.now();
    if (this.autoplayCapabilities.lastCheck && (now - this.autoplayCapabilities.lastCheck) < 300000) {
      return;
    }

    try {
      // Create a temporary video element for testing
      const testVideo = document.createElement('video');
      testVideo.muted = true;
      testVideo.playsInline = true;
      testVideo.style.position = 'absolute';
      testVideo.style.opacity = '0';
      testVideo.style.pointerEvents = 'none';
      testVideo.style.width = '1px';
      testVideo.style.height = '1px';

      // Use a minimal data URL video
      testVideo.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMQAAAAhmcmVlAAAA70D=';

      document.body.appendChild(testVideo);

      try {
        // Test muted autoplay
        await testVideo.play();
        this.autoplayCapabilities.canAutoplayMuted = true;
        this.autoplayCapabilities.canAutoplay = true;
        this.debugLog('✅ Muted autoplay is supported');

        // Test unmuted autoplay
        testVideo.pause();
        testVideo.currentTime = 0;
        testVideo.muted = false;
        testVideo.volume = 0.5;

        try {
          await testVideo.play();
          this.autoplayCapabilities.canAutoplayUnmuted = true;
          this.debugLog('✅ Unmuted autoplay is supported');
        } catch (unmutedError) {
          this.autoplayCapabilities.canAutoplayUnmuted = false;
          this.debugLog('⚠️ Unmuted autoplay is blocked');
        }

        testVideo.pause();
      } catch (error) {
        this.autoplayCapabilities.canAutoplay = false;
        this.autoplayCapabilities.canAutoplayMuted = false;
        this.autoplayCapabilities.canAutoplayUnmuted = false;
        this.debugLog('❌ All autoplay is blocked');
      } finally {
        document.body.removeChild(testVideo);
      }

      this.autoplayCapabilities.lastCheck = now;
    } catch (error) {
      this.debugError('Failed to detect autoplay capabilities:', error);
      // Assume muted autoplay works as fallback
      this.autoplayCapabilities.canAutoplayMuted = true;
      this.autoplayCapabilities.canAutoplay = true;
    }
  }

  /**
   * Check if page has user activation (from navigation or interaction)
   */
  private hasUserActivation(): boolean {
    // Check if browser supports userActivation API
    if (typeof navigator !== 'undefined' && (navigator as any).userActivation) {
      const hasActivation = (navigator as any).userActivation.hasBeenActive;
      this.debugLog(`🎯 User activation detected: ${hasActivation}`);
      return hasActivation;
    }

    // Fallback: Check if user has interacted with the page
    const hasInteracted = this.lastUserInteraction > 0 &&
                         (Date.now() - this.lastUserInteraction) < 5000;

    this.debugLog(`🎯 Recent user interaction: ${hasInteracted}`);
    return hasInteracted;
  }

  /**
   * Attempt intelligent autoplay based on detected capabilities
   */
  private async attemptIntelligentAutoplay(): Promise<boolean> {
    this.debugLog('🎬 attemptIntelligentAutoplay called');
    if (!this.config.autoPlay || !this.video) {
      this.debugLog(`⛔ Early return: autoPlay=${this.config.autoPlay}, video=${!!this.video}`);
      return false;
    }

    // Detect capabilities first
    this.debugLog('🔍 Detecting autoplay capabilities...');
    await this.detectAutoplayCapabilities();
    this.debugLog(`📦 Capabilities detected: canAutoplayMuted=${this.autoplayCapabilities.canAutoplayMuted}, canAutoplayUnmuted=${this.autoplayCapabilities.canAutoplayUnmuted}`);

    // Check if user has activated the page (navigation counts as activation)
    const hasActivation = this.hasUserActivation();
    this.debugLog(`👤 User activation: ${hasActivation}`);

    // Try unmuted autoplay if:
    // 1. Browser supports unmuted autoplay OR user has activated the page
    // 2. User hasn't explicitly set muted=true
    const shouldTryUnmuted = (this.autoplayCapabilities.canAutoplayUnmuted || hasActivation)
                           && this.config.muted !== true;

    if (shouldTryUnmuted) {
      this.video.muted = false;
      this.video.volume = this.config.volume ?? 1.0;
      this.debugLog(`🔊 Attempting unmuted autoplay (activation: ${hasActivation})`);

      try {
        this.debugLog('▶️ Calling play() for unmuted autoplay...');
        await this.play();
        // Verify video is actually playing
        this.debugLog(`📊 Play returned, video.paused=${this.video.paused}`);
        if (!this.video.paused) {
          this.debugLog('✅ Unmuted autoplay successful');
          return true;
        } else {
          this.debugLog('⚠️ Unmuted play() succeeded but video is paused, trying muted');
        }
      } catch (error) {
        this.debugLog('⚠️ Unmuted autoplay failed:', error);
      }
    }

    // Always try muted autoplay as fallback (browsers allow this)
    // Ignore capability detection - it can give false negatives
    this.video.muted = true;
    this.debugLog('🔇 Attempting muted autoplay (always try this)');

    try {
      this.debugLog('▶️ Calling play() for muted autoplay...');
      await this.play();
      // Verify video is actually playing
      this.debugLog(`📊 Play returned, video.paused=${this.video.paused}`);
      if (!this.video.paused) {
        this.debugLog('✅ Muted autoplay successful');
        // Show YouTube-style unmute button instead of blocking overlay
        this.showUnmuteButton();
        return true;
      } else {
        this.debugLog('❌ Muted play() succeeded but video is paused');
      }
    } catch (error) {
      this.debugLog('❌ Muted autoplay failed:', error);
    }

    return false;
  }

  /**
   * Set up intelligent autoplay retry on user interaction
   */
  private setupAutoplayRetry(): void {
    if (!this.config.autoPlay || this.autoplayRetryAttempts >= this.maxAutoplayRetries) {
      return;
    }

    const interactionEvents = ['click', 'mousedown', 'keydown', 'touchstart'];

    const retryAutoplay = async () => {
      if (this.autoplayRetryPending || this.state.isPlaying) {
        return;
      }

      this.autoplayRetryPending = true;
      this.autoplayRetryAttempts++;
      this.debugLog(`🔄 Attempting autoplay retry #${this.autoplayRetryAttempts}`);

      try {
        const success = await this.attemptIntelligentAutoplay();
        if (success) {
          this.debugLog('✅ Autoplay retry successful');
          this.autoplayRetryPending = false;
          // Remove event listeners after success
          interactionEvents.forEach(eventType => {
            document.removeEventListener(eventType, retryAutoplay);
          });
        } else {
          this.autoplayRetryPending = false;
        }
      } catch (error) {
        this.autoplayRetryPending = false;
        this.debugError('Autoplay retry failed:', error);
      }
    };

    interactionEvents.forEach(eventType => {
      document.addEventListener(eventType, retryAutoplay, { once: true, passive: true });
    });

    this.debugLog('🎯 Autoplay retry armed - waiting for user interaction');
  }

  
  /**
   * Show YouTube-style unmute button when video autoplays muted
   */
  private showUnmuteButton(): void {
    // Remove existing unmute button
    this.hideUnmuteButton();
    
    this.debugLog('🔇 Showing unmute button - video autoplaying muted');
    
    const unmuteBtn = document.createElement('button');
    unmuteBtn.id = 'uvf-unmute-btn';
    unmuteBtn.className = 'uvf-unmute-btn';
    unmuteBtn.setAttribute('aria-label', 'Tap to unmute');
    unmuteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" class="uvf-unmute-icon">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
      </svg>
      <span class="uvf-unmute-text">Tap to unmute</span>
    `;
    
    // Click handler to unmute
    unmuteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.video) {
        this.video.muted = false;
        this.debugLog('🔊 Video unmuted by user');
        this.hideUnmuteButton();
      }
    });
    
    // Add enhanced styles
    const style = document.createElement('style');
    style.textContent = `
      .uvf-unmute-btn {
        position: absolute !important;
        bottom: 80px !important;
        left: 20px !important;
        z-index: 1000 !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 12px 16px !important;
        background: rgba(0, 0, 0, 0.8) !important;
        border: none !important;
        border-radius: 4px !important;
        color: white !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
        animation: uvf-unmute-pulse 2s ease-in-out infinite !important;
      }
      
      .uvf-unmute-btn:hover {
        background: rgba(0, 0, 0, 0.9) !important;
        transform: scale(1.05) !important;
      }
      
      .uvf-unmute-btn:active {
        transform: scale(0.95) !important;
      }
      
      .uvf-unmute-icon {
        width: 20px !important;
        height: 20px !important;
        fill: white !important;
      }
      
      .uvf-unmute-text {
        white-space: nowrap !important;
      }
      
      @keyframes uvf-unmute-pulse {
        0%, 100% {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
        }
        50% {
          box-shadow: 0 2px 16px rgba(255, 255, 255, 0.2) !important;
        }
      }
      
      /* Mobile responsive */
      @media (max-width: 767px) {
        .uvf-unmute-btn {
          bottom: 70px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          padding: 10px 14px !important;
          font-size: 13px !important;
        }
        
        .uvf-unmute-btn:hover {
          transform: translateX(-50%) scale(1.05) !important;
        }
      }
    `;
    
    // Add to page if not already added
    if (!document.getElementById('uvf-unmute-styles')) {
      style.id = 'uvf-unmute-styles';
      document.head.appendChild(style);
    }
    
    // Add to player
    if (this.playerWrapper) {
      this.playerWrapper.appendChild(unmuteBtn);
      this.debugLog('✅ Unmute button added to player');
      
      // Enable clicking anywhere on video to unmute
      this.setupClickToUnmute();
    }
  }
  
  /**
   * Set up click anywhere on video to unmute when unmute button is visible
   */
  private setupClickToUnmute(): void {
    // Remove any existing listener first
    if (this.clickToUnmuteHandler) {
      this.playerWrapper?.removeEventListener('click', this.clickToUnmuteHandler, true);
    }
    
    this.clickToUnmuteHandler = (e: MouseEvent) => {
      const unmuteBtn = document.getElementById('uvf-unmute-btn');
      
      // Only handle if unmute button is visible (video is muted)
      if (!unmuteBtn || !this.video) return;
      
      // Don't unmute if clicking on controls or buttons
      const target = e.target as HTMLElement;
      if (target.closest('.uvf-controls-container') || 
          target.closest('button') ||
          target.closest('.uvf-settings-menu')) {
        return;
      }
      
      // Stop the event from triggering play/pause
      e.stopPropagation();
      e.preventDefault();
      
      // Unmute the video
      this.video.muted = false;
      this.debugLog('🔊 Video unmuted by clicking on player');
      this.hideUnmuteButton();
      
      // Clean up the handler
      if (this.clickToUnmuteHandler) {
        this.playerWrapper?.removeEventListener('click', this.clickToUnmuteHandler, true);
        this.clickToUnmuteHandler = null;
      }
    };
    
    // Use capture phase to intercept clicks before they reach the video element
    this.playerWrapper?.addEventListener('click', this.clickToUnmuteHandler, true);
    this.debugLog('👆 Click anywhere to unmute enabled');
  }
  
  /**
   * Hide unmute button
   */
  private clickToUnmuteHandler: ((e: MouseEvent) => void) | null = null;
  
  private hideUnmuteButton(): void {
    const unmuteBtn = document.getElementById('uvf-unmute-btn');
    if (unmuteBtn) {
      unmuteBtn.remove();
      this.debugLog('Unmute button removed');
    }
    
    // Remove click to unmute handler when button is hidden
    if (this.clickToUnmuteHandler) {
      this.playerWrapper?.removeEventListener('click', this.clickToUnmuteHandler, true);
      this.clickToUnmuteHandler = null;
    }
  }
  
  private updateTimeTooltip(e: MouseEvent): void {
    const progressBar = document.getElementById('uvf-progress-bar');
    const tooltip = document.getElementById('uvf-time-tooltip');
    if (!progressBar || !tooltip || !this.video) return;
    
    const rect = progressBar.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = (x / rect.width);
    const time = percent * this.video.duration;
    
    // Update tooltip content and position
    tooltip.textContent = this.formatTime(time);
    tooltip.style.left = `${x}px`;
    tooltip.classList.add('visible');
  }
  
  private hideTimeTooltip(): void {
    const tooltip = document.getElementById('uvf-time-tooltip');
    if (tooltip) {
      tooltip.classList.remove('visible');
    }
  }

  private setupUserInteractionTracking(): void {
    // Track various user interactions to enable autoplay
    const interactionEvents = ['click', 'mousedown', 'keydown', 'touchstart'];
    
    const updateLastInteraction = () => {
      this.lastUserInteraction = Date.now();
      this.debugLog('User interaction detected at:', this.lastUserInteraction);
    };
    
    // Listen on document for global interactions
    interactionEvents.forEach(eventType => {
      document.addEventListener(eventType, updateLastInteraction, { passive: true });
    });
    
    // Also listen on player wrapper for more specific interactions
    if (this.playerWrapper) {
      interactionEvents.forEach(eventType => {
        this.playerWrapper!.addEventListener(eventType, updateLastInteraction, { passive: true });
      });
    }
  }

  async play(): Promise<void> {
    if (!this.video) throw new Error('Video element not initialized');

    // Security check: Prevent play if paywall is active and user not authenticated
    if (!this.canPlayVideo()) {
      this.debugWarn('Playbook blocked by security check');
      this.enforcePaywallSecurity();
      return;
    }

    const now = Date.now();
    if (now - this._lastToggleAt < this._TOGGLE_DEBOUNCE_MS) return;
    this._lastToggleAt = now;

    // If already playing or a play is in-flight, no-op
    if (!this.video.paused || this._playPromise) return;

    try {
      this._deferredPause = false; // a new play cancels any prior deferred pause
      this._playPromise = this.video.play();
      await this._playPromise; // await to sequence future actions
      this._playPromise = null;

      // If someone asked to pause while we were starting playbook, do it now
      if (this._deferredPause) {
        this._deferredPause = false;
        this.video.pause();
      }

      // Hide unmute button when video starts playing with sound
      if (!this.video.muted) {
        this.hideUnmuteButton();
      }
      await super.play();
    } catch (err) {
      this._playPromise = null;
      if (this.isAbortPlayError(err)) {
        // Benign: pause() raced play(); ignore the error.
        return;
      }
      
      // Check if this is an autoplay restriction error
      if (this.isAutoplayRestrictionError(err)) {
        this.debugWarn('Autoplay blocked by browser policy');
        // Throw error so intelligent autoplay can handle fallback
        throw err;
      }
      
      this.handleError({
        code: 'PLAY_ERROR',
        message: `Failed to start playbook: ${err}`,
        type: 'media',
        fatal: false,
        details: err
      });
      throw err;
    }
  }

  pause(): void {
    if (!this.video) return;

    const now = Date.now();
    if (now - this._lastToggleAt < this._TOGGLE_DEBOUNCE_MS) return;
    this._lastToggleAt = now;

    // If a play is still pending, defer the pause to avoid interrupt error
    if (this._playPromise || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this._deferredPause = true;
      return;
    }

    this.video.pause();
    super.pause();
  }

  // Safe method for external components like PaywallController to request pause
  public requestPause(): void {
    this._deferredPause = true;
    if (!this._playPromise && this.video && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try { this.video.pause(); } catch (_) {}
    }
  }

  seek(time: number): void {
    if (!this.video) return;
    
    // Security check: Prevent seeking beyond free preview limit
    const freeDuration = Number(this.config.freeDuration || 0);
    if (freeDuration > 0 && !this.paymentSuccessful) {
      const requestedTime = Math.max(0, Math.min(time, this.video.duration || time));
      if (requestedTime >= freeDuration) {
        this.debugWarn('Seek blocked - beyond free preview limit');
        this.enforcePaywallSecurity();
        // Reset to safe position
        this.video.currentTime = Math.max(0, freeDuration - 1);
        return;
      }
    }
    
    const d = this.video.duration;
    if (typeof d === 'number' && isFinite(d) && d > 0) {
      this.video.currentTime = Math.max(0, Math.min(time, d));
    } else {
      this.video.currentTime = Math.max(0, time);
    }
  }

  setVolume(level: number): void {
    if (!this.video) return;
    this.video.volume = Math.max(0, Math.min(1, level));
    super.setVolume(level);
  }

  mute(): void {
    if (!this.video) return;
    this.video.muted = true;
    super.mute();
  }

  unmute(): void {
    if (!this.video) return;
    this.video.muted = false;
    super.unmute();
  }


  getCurrentTime(): number {
    if (this.video && typeof this.video.currentTime === 'number') {
      return this.video.currentTime;
    }
    return super.getCurrentTime();
  }

  getQualities(): any[] {
    return this.qualities as any;
  }

  getCurrentQuality(): any {
    return this.currentQualityIndex >= 0 ? (this.qualities[this.currentQualityIndex] as any) : null;
  }

  setQuality(index: number): void {
    if (this.hls) {
      this.hls.currentLevel = index;
    } else if (this.dash) {
      this.dash.setQualityFor('video', index);
    }
    
    this.currentQualityIndex = index;
    this.autoQuality = false;
  }

  setPlaybackRate(rate: number): void {
    if (!this.video) return;
    this.video.playbackRate = rate;
    super.setPlaybackRate(rate);
  }


  setAutoQuality(enabled: boolean): void {
    this.autoQuality = enabled;
    
    if (this.hls) {
      this.hls.currentLevel = enabled ? -1 : this.currentQualityIndex;
    } else if (this.dash) {
      this.dash.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: {
              video: enabled
            }
          }
        }
      });
    }
  }

  async enterFullscreen(): Promise<void> {
    if (!this.playerWrapper) return;

    try {
      // iOS Safari special handling - use video element fullscreen
      if (this.isIOSDevice() && this.video) {
        this.debugLog('iOS device detected - using video element fullscreen');
        
        try {
          // iOS Safari supports video fullscreen but not element fullscreen
          if ((this.video as any).webkitEnterFullscreen) {
            await (this.video as any).webkitEnterFullscreen();
            this.playerWrapper.classList.add('uvf-fullscreen');
            this.emit('onFullscreenChanged', true);
            // Lock to landscape orientation
            await this.lockOrientationLandscape();
            return;
          } else if ((this.video as any).webkitRequestFullscreen) {
            await (this.video as any).webkitRequestFullscreen();
            this.playerWrapper.classList.add('uvf-fullscreen');
            this.emit('onFullscreenChanged', true);
            // Lock to landscape orientation
            await this.lockOrientationLandscape();
            return;
          }
        } catch (iosError) {
          this.debugWarn('iOS video fullscreen failed:', (iosError as Error).message);
          // Fall through to try standard fullscreen
        }
      }
      
      // Check if fullscreen is supported for non-iOS devices
      if (!this.isFullscreenSupported()) {
        this.debugWarn('Fullscreen not supported by browser');
        // On mobile devices that don't support fullscreen, show a helpful message
        if (this.isMobileDevice()) {
          this.showShortcutIndicator('Rotate device for fullscreen experience');
        }
        return;
      }
      
      // Check if already in fullscreen
      if (this.isFullscreen()) {
        this.debugLog('Already in fullscreen mode');
        return;
      }
      
      // Target the player wrapper to maintain custom controls
      const element = this.playerWrapper;
      
      // Try different fullscreen APIs with better error handling
      let fullscreenSuccess = false;
      
      if (element.requestFullscreen) {
        try {
          await element.requestFullscreen();
          fullscreenSuccess = true;
        } catch (err) {
          this.debugWarn('Standard fullscreen request failed:', (err as Error).message);
        }
      } else if ((element as any).webkitRequestFullscreen) {
        try {
          await (element as any).webkitRequestFullscreen();
          fullscreenSuccess = true;
        } catch (err) {
          this.debugWarn('WebKit fullscreen request failed:', (err as Error).message);
        }
      } else if ((element as any).mozRequestFullScreen) {
        try {
          await (element as any).mozRequestFullScreen();
          fullscreenSuccess = true;
        } catch (err) {
          this.debugWarn('Mozilla fullscreen request failed:', (err as Error).message);
        }
      } else if ((element as any).msRequestFullscreen) {
        try {
          await (element as any).msRequestFullscreen();
          fullscreenSuccess = true;
        } catch (err) {
          this.debugWarn('MS fullscreen request failed:', (err as Error).message);
        }
      }
      
      if (fullscreenSuccess) {
        // Add fullscreen class for styling
        this.playerWrapper.classList.add('uvf-fullscreen');
        this.emit('onFullscreenChanged', true);
        
        // Lock to landscape orientation on mobile devices
        await this.lockOrientationLandscape();
      } else {
        this.debugWarn('All fullscreen methods failed');
        
        // Provide helpful feedback based on device
        if (this.isIOSDevice()) {
          this.showShortcutIndicator('Fullscreen not available - use device controls');
        } else if (this.isAndroidDevice()) {
          this.showShortcutIndicator('Try rotating device to landscape');
        } else {
          this.showShortcutIndicator('Fullscreen not supported in this browser');
        }
      }
      
    } catch (error) {
      this.debugWarn('Failed to enter fullscreen:', (error as Error).message);
      // Don't re-throw the error to prevent breaking the user experience
    }
  }

  async exitFullscreen(): Promise<void> {
    try {
      // iOS Safari special handling
      if (this.isIOSDevice() && this.video) {
        try {
          if ((this.video as any).webkitExitFullscreen) {
            await (this.video as any).webkitExitFullscreen();
            if (this.playerWrapper) {
              this.playerWrapper.classList.remove('uvf-fullscreen');
            }
            this.emit('onFullscreenChanged', false);
            // Unlock orientation
            await this.unlockOrientation();
            return;
          }
        } catch (iosError) {
          this.debugWarn('iOS video exit fullscreen failed:', (iosError as Error).message);
          // Fall through to try standard methods
        }
      }
      
      // Check if we're actually in fullscreen
      if (!this.isFullscreen()) {
        this.debugLog('Not in fullscreen mode');
        return;
      }
      
      // Try different exit fullscreen methods
      let exitSuccess = false;
      
      if (document.exitFullscreen) {
        try {
          await document.exitFullscreen();
          exitSuccess = true;
        } catch (err) {
          this.debugWarn('Standard exit fullscreen failed:', (err as Error).message);
        }
      } else if ((document as any).webkitExitFullscreen) {
        try {
          await (document as any).webkitExitFullscreen();
          exitSuccess = true;
        } catch (err) {
          this.debugWarn('WebKit exit fullscreen failed:', (err as Error).message);
        }
      } else if ((document as any).mozCancelFullScreen) {
        try {
          await (document as any).mozCancelFullScreen();
          exitSuccess = true;
        } catch (err) {
          this.debugWarn('Mozilla exit fullscreen failed:', (err as Error).message);
        }
      } else if ((document as any).msExitFullscreen) {
        try {
          await (document as any).msExitFullscreen();
          exitSuccess = true;
        } catch (err) {
          this.debugWarn('MS exit fullscreen failed:', (err as Error).message);
        }
      }
      
      if (exitSuccess || !this.isFullscreen()) {
        // Remove fullscreen class
        if (this.playerWrapper) {
          this.playerWrapper.classList.remove('uvf-fullscreen');
        }
        this.emit('onFullscreenChanged', false);
        // Unlock orientation
        await this.unlockOrientation();
      } else {
        this.debugWarn('All exit fullscreen methods failed');
        // Still remove the class to keep UI consistent
        if (this.playerWrapper) {
          this.playerWrapper.classList.remove('uvf-fullscreen');
        }
      }
      
    } catch (error) {
      this.debugWarn('Failed to exit fullscreen:', (error as Error).message);
      // Don't re-throw the error to prevent breaking the user experience
    }
  }

  async enterPictureInPicture(): Promise<void> {
    if (!this.video) return;

    try {
      if ((this.video as any).requestPictureInPicture) {
        await (this.video as any).requestPictureInPicture();
      } else {
        throw new Error('Picture-in-Picture not supported');
      }
    } catch (error) {
      console.error('Failed to enter PiP:', error);
      throw error;
    }
  }

  async exitPictureInPicture(): Promise<void> {
    try {
      if ((document as any).exitPictureInPicture) {
        await (document as any).exitPictureInPicture();
      }
    } catch (error) {
      this.debugWarn('Failed to exit PiP:', (error as Error).message);
      // Don't re-throw the error to prevent breaking the user experience
    }
  }

  /**
   * Focuses the player wrapper to enable keyboard shortcuts
   */
  focusPlayer(): void {
    if (this.playerWrapper) {
      this.playerWrapper.focus();
      this.debugLog('Player focused programmatically');
    }
  }

  /**
   * Shows a helpful tip to the user about fullscreen options
   */
  showFullscreenTip(): void {
    this.showShortcutIndicator('💡 Double-click or use ⌨️ F key for fullscreen');
    
    // Also show in debug log
    this.debugLog('Tip: Double-click the video area or press F key for fullscreen, or use the fullscreen button in controls');
  }

  /**
   * Detects if we're running in Brave browser
   */
  private isBraveBrowser(): boolean {
    // Multiple ways to detect Brave browser
    const userAgent = navigator.userAgent.toLowerCase();
    const isBrave = (
      // Check for Brave-specific user agent
      userAgent.includes('brave') ||
      // Check for Brave's navigator.brave object
      !!(navigator as any).brave ||
      // Check for Brave's specific properties
      (window as any).chrome && (window as any).chrome.app && (window as any).chrome.app.isInstalled === false
    );
    
    this.debugLog('Browser detection - Is Brave:', isBrave, 'User Agent:', userAgent);
    return isBrave;
  }

  /**
   * Checks fullscreen permissions and site settings
   */
  private async checkFullscreenPermissions(): Promise<void> {
    try {
      // Check if fullscreen is enabled
      const fullscreenEnabled = document.fullscreenEnabled ||
                                 (document as any).webkitFullscreenEnabled ||
                                 (document as any).mozFullScreenEnabled ||
                                 (document as any).msFullscreenEnabled;
      
      this.debugLog('Fullscreen permissions check:', {
        fullscreenEnabled,
        documentFullscreenEnabled: document.fullscreenEnabled,
        webkitEnabled: (document as any).webkitFullscreenEnabled,
        mozEnabled: (document as any).mozFullScreenEnabled,
        msEnabled: (document as any).msFullscreenEnabled,
        currentOrigin: window.location.origin,
        currentHref: window.location.href,
        isSecureContext: window.isSecureContext,
        protocol: window.location.protocol,
        isBrave: this.isBraveBrowser(),
        isPrivate: this.isPrivateWindow()
      });
      
      // Check permissions API if available
      if ('permissions' in navigator) {
        try {
          const permission = await (navigator as any).permissions.query({ name: 'fullscreen' });
          this.debugLog('Fullscreen permission state:', permission.state);
        } catch (err) {
          this.debugLog('Permissions API check failed:', (err as Error).message);
        }
      }
      
    } catch (error) {
      this.debugWarn('Permission check failed:', (error as Error).message);
    }
  }

  /**
   * Detects if running in private/incognito mode
   */
  private isPrivateWindow(): boolean {
    try {
      // Different methods for different browsers
      if ('webkitRequestFileSystem' in window) {
        // Chrome/Edge detection
        return new Promise<boolean>((resolve) => {
          (window as any).webkitRequestFileSystem(
            (window as any).TEMPORARY,
            1,
            () => resolve(false), // Not private
            () => resolve(true)   // Private
          );
        }) as any;
      }
      
      // Firefox detection
      if ('MozAppearance' in document.documentElement.style) {
        if (window.indexedDB === null) return true;
        if (window.indexedDB === undefined) return true;
      }
      
      // Safari detection
      try {
        window.localStorage.setItem('test', '1');
        window.localStorage.removeItem('test');
        return false;
      } catch {
        return true;
      }
      
    } catch {
      return false;
    }
    
    return false;
  }

  /**
   * Triggers the fullscreen button reliably with Brave-specific enhancements
   */
  triggerFullscreenButton(): void {
    const fullscreenBtn = document.getElementById('uvf-fullscreen-btn');
    
    // Enhanced debugging for Brave browser
    const isBrave = this.isBraveBrowser();
    const isPrivate = this.isPrivateWindow();
    
    this.debugLog('Fullscreen trigger attempt:', {
      buttonExists: !!fullscreenBtn,
      isBrave,
      isPrivate,
      currentFullscreenElement: document.fullscreenElement,
      timestamp: Date.now(),
      lastUserInteraction: this.lastUserInteraction,
      timeSinceInteraction: Date.now() - this.lastUserInteraction
    });
    
    // Run permissions check
    this.checkFullscreenPermissions();
    
    if (fullscreenBtn) {
      this.debugLog('Triggering fullscreen button click');
      
      // Special handling for Brave browser
      if (isBrave) {
        this.debugLog('Applying Brave browser specific fullscreen handling');
        
        // For Brave, we need to ensure the gesture is absolutely fresh
        if (Date.now() - this.lastUserInteraction > 1000) {
          this.debugWarn('User gesture may be stale for Brave browser');
          this.showTemporaryMessage('Click the fullscreen button directly in Brave browser');
          return;
        }
        
        // Request permissions first in Brave if needed
        this.requestFullscreenPermissionBrave().then(() => {
          this.performFullscreenButtonClick(fullscreenBtn);
        }).catch(() => {
          this.performFullscreenButtonClick(fullscreenBtn);
        });
      } else {
        this.performFullscreenButtonClick(fullscreenBtn);
      }
      
    } else {
      this.debugWarn('Fullscreen button not found');
      this.showShortcutIndicator('Fullscreen Button Missing');
      
      // Enhanced guidance for Brave
      if (isBrave) {
        this.showTemporaryMessage('Brave: Please use fullscreen button in controls');
      } else {
        this.showTemporaryMessage('Press F key when player controls are visible');
      }
    }
  }

  /**
   * Performs the actual fullscreen button click with multiple event types
   */
  private performFullscreenButtonClick(fullscreenBtn: HTMLElement): void {
    // Create multiple types of events to ensure maximum compatibility
    const events = [
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: 1,
        button: 0,
        buttons: 1,
        isTrusted: true
      } as any),
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: 1,
        button: 0,
        buttons: 0,
        isTrusted: true
      } as any),
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: 1,
        button: 0,
        buttons: 0,
        isTrusted: true
      } as any)
    ];
    
    // Log each event dispatch
    this.debugLog('Dispatching mouse events:', events.length);
    
    // Dispatch all events in sequence
    events.forEach((event, index) => {
      try {
        fullscreenBtn.dispatchEvent(event);
        this.debugLog(`Event ${index + 1} dispatched:`, event.type);
      } catch (error) {
        this.debugWarn(`Event ${index + 1} dispatch failed:`, (error as Error).message);
      }
    });
    
    // Also try direct click method with enhanced error handling
    try {
      fullscreenBtn.click();
      this.debugLog('Direct button click executed');
    } catch (error) {
      this.debugWarn('Direct button click failed:', (error as Error).message);
    }
    
    // Focus the button to ensure gesture context
    try {
      fullscreenBtn.focus();
      setTimeout(() => fullscreenBtn.blur(), 100);
    } catch (error) {
      this.debugLog('Button focus failed:', (error as Error).message);
    }
    
    // Show that we're attempting fullscreen via button
    this.showShortcutIndicator('Fullscreen');
  }

  /**
   * Requests fullscreen permission specifically for Brave browser
   */
  private async requestFullscreenPermissionBrave(): Promise<void> {
    try {
      // Check if we can request permission
      if ('permissions' in navigator && 'request' in (navigator as any).permissions) {
        await (navigator as any).permissions.request({ name: 'fullscreen' });
        this.debugLog('Brave fullscreen permission requested');
      }
    } catch (error) {
      this.debugLog('Brave permission request failed:', (error as Error).message);
      // Don't throw, continue with normal flow
    }
  }

  /**
   * Enhanced fullscreen method with specific Brave browser support
   */
  async enterFullscreenWithBraveSupport(): Promise<void> {
    if (!this.playerWrapper) {
      throw new Error('Player wrapper not available');
    }

    this.debugLog('Attempting Brave-specific fullscreen entry');
    
    // First, check if we can request permissions
    await this.requestFullscreenPermissionBrave();
    
    // Check current fullscreen state
    if (document.fullscreenElement || 
        (document as any).webkitFullscreenElement || 
        (document as any).mozFullScreenElement || 
        (document as any).msFullscreenElement) {
      this.debugLog('Already in fullscreen mode');
      return;
    }
    
    // Enhanced permission and capability checking for Brave
    const fullscreenEnabled = document.fullscreenEnabled ||
                               (document as any).webkitFullscreenEnabled ||
                               (document as any).mozFullScreenEnabled ||
                               (document as any).msFullscreenEnabled;
    
    if (!fullscreenEnabled) {
      throw new Error('Fullscreen not supported or disabled in Brave settings');
    }
    
    // Check if the site has fullscreen blocked
    if ('permissions' in navigator) {
      try {
        const permission = await (navigator as any).permissions.query({ name: 'fullscreen' });
        this.debugLog('Brave fullscreen permission state:', permission.state);
        
        if (permission.state === 'denied') {
          throw new Error('Fullscreen permission denied in Brave site settings');
        }
      } catch (permError) {
        this.debugLog('Permission check failed:', (permError as Error).message);
      }
    }
    
    // Try multiple fullscreen methods with proper error handling
    let fullscreenError: Error | null = null;
    
    try {
      // Try standard fullscreen API first
      if (this.playerWrapper.requestFullscreen) {
        this.debugLog('Attempting standard requestFullscreen()');
        await this.playerWrapper.requestFullscreen({
          navigationUI: 'hide'
        } as any);
      }
      // Webkit (Safari/Chrome-based)
      else if ((this.playerWrapper as any).webkitRequestFullscreen) {
        this.debugLog('Attempting webkitRequestFullscreen()');
        await (this.playerWrapper as any).webkitRequestFullscreen();
      }
      // Firefox
      else if ((this.playerWrapper as any).mozRequestFullScreen) {
        this.debugLog('Attempting mozRequestFullScreen()');
        await (this.playerWrapper as any).mozRequestFullScreen();
      }
      // IE/Edge
      else if ((this.playerWrapper as any).msRequestFullscreen) {
        this.debugLog('Attempting msRequestFullscreen()');
        await (this.playerWrapper as any).msRequestFullscreen();
      }
      else {
        throw new Error('No fullscreen API available');
      }
      
      // If we get here, fullscreen was successful
      this.playerWrapper.classList.add('uvf-fullscreen');
      this.emit('onFullscreenChanged', true);
      this.debugLog('Brave fullscreen entry successful');
      
    } catch (error) {
      fullscreenError = error as Error;
      this.debugWarn('Brave fullscreen attempt failed:', fullscreenError.message);
      
      // Provide specific guidance for common Brave issues
      if (fullscreenError.message.includes('denied') || 
          fullscreenError.message.includes('not allowed')) {
        throw new Error('Brave Browser: Fullscreen blocked. Check site permissions in Settings > Site and Shields Settings');
      } else if (fullscreenError.message.includes('gesture') || 
                 fullscreenError.message.includes('user activation')) {
        throw new Error('Brave Browser: User interaction required. Click the fullscreen button directly');
      } else {
        throw new Error(`Brave Browser: ${fullscreenError.message}`);
      }
    }
  }

  /**
   * Shows a temporary message to the user
   */
  showTemporaryMessage(message: string): void {
    const existingMsg = document.getElementById('uvf-temp-message');
    if (existingMsg) {
      existingMsg.remove();
    }
    
    const msgDiv = document.createElement('div');
    msgDiv.id = 'uvf-temp-message';
    msgDiv.textContent = message;
    msgDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 10001;
      pointer-events: none;
    `;
    
    document.body.appendChild(msgDiv);
    
    setTimeout(() => {
      if (msgDiv.parentElement) {
        msgDiv.remove();
      }
    }, 3000);
  }

  /**
   * Enters fullscreen synchronously to preserve user gesture context
   */
  enterFullscreenSynchronously(): void {
    if (!this.playerWrapper) {
      throw new Error('Player wrapper not available');
    }

    // Check if fullscreen is supported
    if (!document.fullscreenEnabled && 
        !(document as any).webkitFullscreenEnabled && 
        !(document as any).mozFullScreenEnabled && 
        !(document as any).msFullscreenEnabled) {
      throw new Error('Fullscreen not supported by browser');
    }
    
    // Check if already in fullscreen
    if (document.fullscreenElement || 
        (document as any).webkitFullscreenElement || 
        (document as any).mozFullScreenElement || 
        (document as any).msFullscreenElement) {
      this.debugLog('Already in fullscreen mode');
      return;
    }
    
    this.debugLog('Attempting synchronous fullscreen');
    
    // Target the player wrapper to maintain custom controls
    const element = this.playerWrapper;
    
    // Call fullscreen API synchronously (no await) to preserve user gesture
    if (element.requestFullscreen) {
      element.requestFullscreen().then(() => {
        this.debugLog('Successfully entered fullscreen via requestFullscreen');
        this.playerWrapper?.classList.add('uvf-fullscreen');
        this.emit('onFullscreenChanged', true);
      }).catch((error) => {
        this.debugWarn('requestFullscreen failed:', error.message);
        throw error;
      });
    } else if ((element as any).webkitRequestFullscreen) {
      (element as any).webkitRequestFullscreen();
      this.debugLog('Successfully requested fullscreen via webkitRequestFullscreen');
      this.playerWrapper?.classList.add('uvf-fullscreen');
      this.emit('onFullscreenChanged', true);
    } else if ((element as any).mozRequestFullScreen) {
      (element as any).mozRequestFullScreen();
      this.debugLog('Successfully requested fullscreen via mozRequestFullScreen');
      this.playerWrapper?.classList.add('uvf-fullscreen');
      this.emit('onFullscreenChanged', true);
    } else if ((element as any).msRequestFullscreen) {
      (element as any).msRequestFullscreen();
      this.debugLog('Successfully requested fullscreen via msRequestFullscreen');
      this.playerWrapper?.classList.add('uvf-fullscreen');
      this.emit('onFullscreenChanged', true);
    } else {
      throw new Error('Fullscreen API not supported by this browser');
    }
  }

  /**
   * Requests fullscreen with proper user gesture context
   */
  async requestFullscreenWithUserGesture(event: Event): Promise<boolean> {
    if (!this.playerWrapper) return false;

    try {
      // Check if fullscreen is supported
      if (!document.fullscreenEnabled && 
          !(document as any).webkitFullscreenEnabled && 
          !(document as any).mozFullScreenEnabled && 
          !(document as any).msFullscreenEnabled) {
        this.debugWarn('Fullscreen not supported by browser');
        return false;
      }
      
      // Check if already in fullscreen
      if (document.fullscreenElement || 
          (document as any).webkitFullscreenElement || 
          (document as any).mozFullScreenElement || 
          (document as any).msFullscreenElement) {
        this.debugLog('Already in fullscreen mode');
        return false;
      }
      
      // Check if this is within a reasonable time of user interaction
      const timeSinceInteraction = Date.now() - this.lastUserInteraction;
      this.debugLog('Attempting fullscreen within user gesture context', {
        eventType: event.type,
        timeSinceInteraction,
        isTrusted: event.isTrusted
      });
      
      // Target the player wrapper to maintain custom controls
      const element = this.playerWrapper;
      
      // Try fullscreen immediately while in the event context
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
      } else {
        this.debugWarn('Fullscreen API not supported by this browser');
        return false;
      }
      
      // Add fullscreen class for styling
      this.playerWrapper.classList.add('uvf-fullscreen');
      this.emit('onFullscreenChanged', true);
      this.debugLog('Successfully entered fullscreen');
      return true;
      
    } catch (error) {
      this.debugWarn('Failed to enter fullscreen:', (error as Error).message);
      return false;
    }
  }

  /**
   * Shows clear fullscreen instructions overlay
   */
  showFullscreenInstructions(): void {
    // Remove any existing instruction overlay
    const existingOverlay = document.getElementById('uvf-fullscreen-instructions');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // Create instruction overlay
    const overlay = document.createElement('div');
    overlay.id = 'uvf-fullscreen-instructions';
    overlay.innerHTML = `
      <div class="uvf-fullscreen-instruction-content">
        <div class="uvf-fullscreen-icon">⛶</div>
        <h3>Enter Fullscreen</h3>
        <p>Click the fullscreen button in the player controls</p>
        <div class="uvf-fullscreen-pointer">👆 Look for this icon in the bottom right</div>
        <button class="uvf-instruction-close" onclick="this.parentElement.parentElement.remove()">Got it</button>
      </div>
    `;
    
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
      text-align: center;
    `;
    
    const content = overlay.querySelector('.uvf-fullscreen-instruction-content') as HTMLElement;
    if (content) {
      content.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        padding: 40px;
        border-radius: 12px;
        border: 2px solid var(--uvf-accent-1, #ff0000);
        backdrop-filter: blur(10px);
        max-width: 400px;
        animation: fadeIn 0.3s ease-out;
      `;
    }
    
    const icon = overlay.querySelector('.uvf-fullscreen-icon') as HTMLElement;
    if (icon) {
      icon.style.cssText = `
        font-size: 48px;
        margin-bottom: 16px;
      `;
    }
    
    const title = overlay.querySelector('h3') as HTMLElement;
    if (title) {
      title.style.cssText = `
        margin: 0 0 16px 0;
        font-size: 24px;
        font-weight: 600;
      `;
    }
    
    const text = overlay.querySelector('p') as HTMLElement;
    if (text) {
      text.style.cssText = `
        margin: 0 0 16px 0;
        font-size: 16px;
        opacity: 0.9;
      `;
    }
    
    const pointer = overlay.querySelector('.uvf-fullscreen-pointer') as HTMLElement;
    if (pointer) {
      pointer.style.cssText = `
        font-size: 14px;
        opacity: 0.8;
        margin-bottom: 24px;
      `;
    }
    
    const button = overlay.querySelector('.uvf-instruction-close') as HTMLElement;
    if (button) {
      button.style.cssText = `
        background: var(--uvf-accent-1, #ff0000);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      `;
      
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.05)';
        button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = 'none';
      });
    }
    
    // Add CSS animation
    if (!document.getElementById('uvf-fullscreen-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'uvf-fullscreen-animation-styles';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Add to player wrapper
    if (this.playerWrapper) {
      this.playerWrapper.appendChild(overlay);
    }
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (overlay.parentElement) {
        overlay.remove();
      }
    }, 5000);
    
    // Also highlight the fullscreen button if it exists
    const fullscreenBtn = document.getElementById('uvf-fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.style.animation = 'pulse 2s infinite';
      
      // Add pulse animation if not already added
      if (!document.getElementById('uvf-pulse-animation-styles')) {
        const style = document.createElement('style');
        style.id = 'uvf-pulse-animation-styles';
        style.textContent = `
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 var(--uvf-accent-1, #ff0000); }
            70% { box-shadow: 0 0 0 10px rgba(255, 0, 0, 0); }
            100% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); }
          }
        `;
        document.head.appendChild(style);
      }
      
      // Remove pulse after 3 seconds
      setTimeout(() => {
        fullscreenBtn.style.animation = '';
      }, 3000);
    }
    
    this.debugLog('Showing fullscreen instructions overlay');
  }

  /**
   * Attempts fullscreen with better user guidance
   */
  async attemptFullscreen(): Promise<boolean> {
    try {
      await this.enterFullscreen();
      return true;
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      if (errorMessage.includes('user gesture') || 
          errorMessage.includes('user activation') || 
          errorMessage.includes('Permissions check failed')) {
        
        // Try using the fullscreen button as a last resort
        const fullscreenBtn = document.getElementById('uvf-fullscreen-btn');
        if (fullscreenBtn && !this.hasTriedButtonFallback) {
          this.hasTriedButtonFallback = true;
          this.debugLog('Attempting fullscreen via button as fallback');
          
          // Reset flag after a short delay
          setTimeout(() => {
            this.hasTriedButtonFallback = false;
          }, 1000);
          
          // Try clicking the button programmatically
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            detail: 1
          });
          fullscreenBtn.dispatchEvent(clickEvent);
          return false; // We don't know if it succeeded immediately
        } else {
          // Show user-friendly guidance
          this.showShortcutIndicator('Click Fullscreen Button');
          this.debugWarn('Fullscreen requires direct user interaction. Please click the fullscreen button in the player controls.');
          return false;
        }
      } else {
        this.debugWarn('Fullscreen failed:', errorMessage);
        return false;
      }
    }
  }

  protected applySubtitleTrack(track: any): void {
    if (!this.video) return;
    
    const tracks = this.video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      const textTrack = tracks[i];
      if (textTrack.label === track.label) {
        textTrack.mode = 'showing';
      } else {
        textTrack.mode = 'hidden';
      }
    }
  }

  protected removeSubtitles(): void {
    if (!this.video) return;
    
    const tracks = this.video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = 'hidden';
    }
  }

  private injectStyles(): void {
    if (document.getElementById('uvf-player-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'uvf-player-styles';
    style.textContent = this.getPlayerStyles();
    document.head.appendChild(style);
  }

  private getPlayerStyles(): string {
    return `
      .uvf-player-wrapper {
        position: relative;
        width: 100%;
        background: #000;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        /* Theme variables (can be overridden at runtime) */
        --uvf-accent-1: #ff0000;
        --uvf-accent-2: #ff4d4f;
        --uvf-accent-1-20: rgba(255,0,0,0.2);
        --uvf-icon-color: #ffffff;
        --uvf-text-primary: #ffffff;
        --uvf-text-secondary: rgba(255,255,255,0.75);
        /* Button theme variables */
        --uvf-button-bg: rgba(255,255,255,0.12);
        --uvf-button-border: rgba(255,255,255,0.15);
        --uvf-button-shadow: rgba(255,255,255,0.15);
        --uvf-button-shadow-hover: rgba(255,255,255,0.25);
        /* Overlay variables (can be overridden by theme) */
        --uvf-overlay-strong: rgba(0,0,0,0.95);
        --uvf-overlay-medium: rgba(0,0,0,0.7);
        --uvf-overlay-transparent: rgba(0,0,0,0);
        /* Scrollbar design variables */
        --uvf-scrollbar-width: 8px;
        --uvf-scrollbar-thumb-start: rgba(255,0,0,0.35);
        --uvf-scrollbar-thumb-end: rgba(255,0,0,0.45);
        --uvf-scrollbar-thumb-hover-start: rgba(255,0,0,0.5);
        --uvf-scrollbar-thumb-hover-end: rgba(255,0,0,0.6);
        --uvf-firefox-scrollbar-color: rgba(255,255,255,0.25);
      }
      
      /* Responsive Container Styles */
      .uvf-responsive-container {
        width: 100%;
        margin: 0 auto;
        box-sizing: border-box;
        display: block;
        position: relative;
      }
      
      .uvf-responsive-container .uvf-player-wrapper {
        width: 100%;
        height: 100%;
        max-width: inherit;
        max-height: inherit;
        box-sizing: border-box;
      }
      
      .uvf-responsive-container .uvf-video-container {
        width: 100%;
        height: 100%;
        position: relative;
        background: radial-gradient(ellipse at center, #1a1a2e 0%, #000 100%);
        overflow: hidden;
        box-sizing: border-box;
      }
      
      /* Gradient border effect */
      .uvf-player-wrapper::before {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        background: linear-gradient(45deg, var(--uvf-accent-1), var(--uvf-accent-2), var(--uvf-accent-1));
        background-size: 400% 400%;
        animation: uvf-gradientBorder 10s ease infinite;
        z-index: -1;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .uvf-player-wrapper:hover::before {
        opacity: 0.3;
      }
      @keyframes uvf-gradientBorder {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      
      .uvf-video-container {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        background: radial-gradient(ellipse at center, #1a1a2e 0%, #000 100%);
        overflow: hidden;
      }
      
      .uvf-video {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000;
        object-fit: contain;
      }
      
      .uvf-watermark-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
        mix-blend-mode: screen;
      }
      
      /* Gradients */
      .uvf-top-gradient, .uvf-controls-gradient {
        position: absolute;
        left: 0;
        right: 0;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .uvf-top-gradient {
        top: 0;
        height: 120px;
        background: linear-gradient(to bottom, var(--uvf-overlay-medium), var(--uvf-overlay-transparent));
        z-index: 6;
      }
      
      .uvf-controls-gradient {
        bottom: 0;
        height: 150px;
        background: linear-gradient(to top, var(--uvf-overlay-strong), var(--uvf-overlay-transparent));
        z-index: 9;
      }
      
      .uvf-player-wrapper:hover .uvf-top-gradient,
      .uvf-player-wrapper:hover .uvf-controls-gradient,
      .uvf-player-wrapper.controls-visible .uvf-top-gradient,
      .uvf-player-wrapper.controls-visible .uvf-controls-gradient {
        opacity: 1;
      }
      
      /* Loading Spinner */
      .uvf-loading-container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10;
        display: none;
      }
      
      .uvf-loading-container.active {
        display: block;
      }
      
      .uvf-loading-spinner {
        width: 60px;
        height: 60px;
        border: 3px solid rgba(255,255,255,0.2);
        border-top-color: var(--uvf-accent-1);
        border-radius: 50%;
        animation: uvf-spin 1s linear infinite;
      }
      
      @keyframes uvf-spin {
        to { transform: rotate(360deg); }
      }
      
      /* Center Play Button Container */
      .uvf-center-play-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 8;
      }
      
      /* Center Play Button */
      .uvf-center-play-btn {
        width: clamp(40px, 8vw, 60px);
        height: clamp(40px, 8vw, 60px);
        background: linear-gradient(135deg, var(--uvf-accent-1), var(--uvf-accent-2));
        border: 0;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        pointer-events: auto;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 1;
        visibility: visible;
        box-shadow: 0 4px 16px var(--uvf-accent-1-20);
      }
      
      .uvf-center-play-btn:hover {
        transform: scale(1.08);
        filter: saturate(1.08) brightness(1.05);
        box-shadow: 0 6px 20px var(--uvf-accent-1-20);
      }
      
      .uvf-center-play-btn.hidden {
        opacity: 0 !important;
        visibility: hidden !important;
        transform: scale(0.8) !important;
        pointer-events: none !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .uvf-center-play-btn svg {
        width: clamp(18px, 3vw, 24px);
        height: clamp(18px, 3vw, 24px);
        fill: #fff;
        margin-left: 2px;
        filter: drop-shadow(0 1px 3px rgba(0,0,0,0.35));
      }
      
      /* Pulse animation for center play button when paused */
      .uvf-center-play-btn:not(.hidden) {
        animation: uvf-centerPlayPulse 3s ease-in-out infinite;
      }
      
      @keyframes uvf-centerPlayPulse {
        0% { 
          box-shadow: 0 4px 16px var(--uvf-accent-1-20);
          filter: saturate(1) brightness(1);
        }
        50% { 
          box-shadow: 0 6px 20px var(--uvf-accent-1-20), 0 0 20px rgba(255,0,0,0.1);
          filter: saturate(1.05) brightness(1.02);
        }
        100% { 
          box-shadow: 0 4px 16px var(--uvf-accent-1-20);
          filter: saturate(1) brightness(1);
        }
      }
      
      /* Controls Bar */
      .uvf-controls-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 20px;
        z-index: 10;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s ease;
      }
      
      .uvf-player-wrapper:hover .uvf-controls-bar,
      .uvf-player-wrapper.controls-visible .uvf-controls-bar {
        opacity: 1;
        transform: translateY(0);
      }
      
      .uvf-player-wrapper.no-cursor {
        cursor: none;
      }
      
      .uvf-player-wrapper.no-cursor .uvf-controls-bar,
      .uvf-player-wrapper.no-cursor .uvf-top-gradient,
      .uvf-player-wrapper.no-cursor .uvf-controls-gradient {
        opacity: 0 !important;
        transform: translateY(10px) !important;
        pointer-events: none;
      }
      
      /* Progress Bar */
      .uvf-progress-section {
        width: 100%;
        margin-bottom: 15px;
      }
      
      .uvf-progress-bar-wrapper {
        width: 100%;
        position: relative;
        cursor: pointer;
        padding: 6px 0;
        overflow: visible;
      }
      
      /* Extended touch area for better mobile UX without affecting visual spacing */
      .uvf-progress-bar-wrapper::before {
        content: '';
        position: absolute;
        top: -8px;
        bottom: -8px;
        left: 0;
        right: 0;
        cursor: pointer;
        z-index: 10;
      }
      
      .uvf-progress-bar {
        width: 100%;
        height: 2px;
        position: relative;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        backdrop-filter: blur(4px);
      }
      
      .uvf-progress-bar-wrapper:hover .uvf-progress-bar {
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        transform: scaleY(1.1);
      }
      
      .uvf-progress-buffered {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: linear-gradient(90deg, 
          rgba(255, 255, 255, 0.25) 0%,
          rgba(255, 255, 255, 0.35) 30%,
          rgba(255, 255, 255, 0.4) 50%,
          rgba(255, 255, 255, 0.35) 70%,
          rgba(255, 255, 255, 0.3) 100%
        );
        border-radius: 4px;
        pointer-events: none;
        transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
        z-index: 1;
        overflow: hidden;
      }
      
      /* Buffered progress loading shimmer effect */
      .uvf-progress-buffered::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, 
          transparent 0%,
          rgba(255, 255, 255, 0.15) 50%,
          transparent 100%
        );
        animation: bufferShimmer 2s infinite;
        border-radius: 6px;
      }
      
      @keyframes bufferShimmer {
        0% { left: -100%; }
        100% { left: 100%; }
      }
      
      .uvf-progress-bar-wrapper:hover .uvf-progress-buffered {
        border-radius: 6px;
        background: linear-gradient(90deg, 
          rgba(255, 255, 255, 0.3) 0%,
          rgba(255, 255, 255, 0.4) 30%,
          rgba(255, 255, 255, 0.5) 50%,
          rgba(255, 255, 255, 0.4) 70%,
          rgba(255, 255, 255, 0.35) 100%
        );
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
      }
      
      .uvf-progress-bar-wrapper:hover .uvf-progress-buffered::before {
        border-radius: 6px;
      }
      
      .uvf-progress-filled {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: linear-gradient(90deg, 
          var(--uvf-accent-1, #ff4500) 0%,
          var(--uvf-accent-1, #ff5722) 25%,
          var(--uvf-accent-2, #ff6b35) 50%,
          var(--uvf-accent-2, #ff7043) 75%,
          var(--uvf-accent-2, #ff8c69) 100%
        );
        border-radius: 4px;
        pointer-events: none;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        z-index: 2;
        box-shadow: 0 0 12px var(--uvf-accent-1-20, rgba(255, 87, 34, 0.3));
      }
      
      .uvf-progress-bar-wrapper:hover .uvf-progress-filled {
        border-radius: 6px;
        background: linear-gradient(90deg, 
          var(--uvf-accent-1, #ff4500) 0%,
          var(--uvf-accent-1, #ff5722) 20%,
          var(--uvf-accent-2, #ff6b35) 40%,
          var(--uvf-accent-2, #ff7043) 60%,
          var(--uvf-accent-2, #ff8c69) 80%,
          var(--uvf-accent-2, #ffa500) 100%
        );
        box-shadow: 0 0 20px var(--uvf-accent-1-20, rgba(255, 87, 34, 0.5));
      }
      
      /* Progress Bar Handle/Thumb */
      .uvf-progress-handle {
        position: absolute;
        top: 1px; /* Center on the 2px progress bar (1px from top) */
        left: 0;
        width: 14px;
        height: 14px;
        background: #fff;
        border: 2px solid var(--uvf-accent-1, #ff5722);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        cursor: grab;
        opacity: 0;
        transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        z-index: 3;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
      
      .uvf-progress-bar-wrapper:hover .uvf-progress-handle {
        opacity: 1;
        top: 2px; /* Center on the 4px hover progress bar (2px from top) */
        transform: translate(-50%, -50%) scale(1);
      }
      
      .uvf-progress-handle:hover {
        transform: translate(-50%, -50%) scale(1.2);
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.4);
      }
      
      .uvf-progress-handle:active,
      .uvf-progress-handle.dragging {
        cursor: grabbing;
        transform: translate(-50%, -50%) scale(1.3);
        box-shadow: 0 4px 16px rgba(255, 87, 34, 0.4);
      }
      
      /* Time Tooltip */
      .uvf-time-tooltip {
        position: absolute;
        bottom: 100%;
        left: 0;
        margin-bottom: 8px;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
        font-size: 12px;
        font-weight: 500;
        border-radius: 4px;
        white-space: nowrap;
        opacity: 0;
        transform: translateX(-50%) translateY(4px);
        transition: all 0.2s ease;
        pointer-events: none;
        z-index: 20;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .uvf-time-tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 4px solid transparent;
        border-top-color: rgba(0, 0, 0, 0.8);
      }
      
      .uvf-time-tooltip.visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      
      /* Show tooltip when dragging */
      .uvf-progress-handle.dragging + .uvf-time-tooltip {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      
      /* Chapter Markers */
      .uvf-chapter-marker {
        position: absolute;
        top: 0;
        width: 2px;
        height: 100%;
        background: rgba(255, 255, 255, 0.6);
        z-index: 4;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .uvf-chapter-marker:hover {
        width: 3px;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
      }
      
      .uvf-chapter-marker-intro {
        background: var(--uvf-accent-1, #ff5722);
      }
      
      .uvf-chapter-marker-recap {
        background: #ffc107;
      }
      
      .uvf-chapter-marker-credits {
        background: #9c27b0;
      }
      
      .uvf-chapter-marker-ad {
        background: #f44336;
      }
      
      /* Skip Button Styles */
      .uvf-skip-button {
        position: absolute;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        padding: 12px 24px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        backdrop-filter: blur(10px);
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        z-index: 1000;
        user-select: none;
        
        /* Default hidden state */
        opacity: 0;
        transform: translateX(100px) scale(0.9);
        pointer-events: none;
      }
      
      .uvf-skip-button.visible {
        opacity: 1;
        transform: translateX(0) scale(1);
        pointer-events: auto;
      }
      
      .uvf-skip-button:hover {
        background: var(--uvf-accent-1, #ff5722);
        border-color: var(--uvf-accent-1, #ff5722);
        transform: translateX(0) scale(1.05);
        box-shadow: 0 4px 20px rgba(255, 87, 34, 0.4);
      }
      
      .uvf-skip-button:active {
        transform: translateX(0) scale(0.95);
        transition: all 0.1s ease;
      }
      
      /* Skip button positioning */
      .uvf-skip-button-bottom-right {
        bottom: 100px;
        right: 30px;
      }
      
      .uvf-skip-button-bottom-left {
        bottom: 100px;
        left: 30px;
        transform: translateX(-100px) scale(0.9);
      }
      
      .uvf-skip-button-bottom-left.visible {
        transform: translateX(0) scale(1);
      }
      
      .uvf-skip-button-bottom-left:hover {
        transform: translateX(0) scale(1.05);
      }
      
      .uvf-skip-button-bottom-left:active {
        transform: translateX(0) scale(0.95);
      }
      
      .uvf-skip-button-top-right {
        top: 30px;
        right: 30px;
      }
      
      .uvf-skip-button-top-left {
        top: 30px;
        left: 30px;
        transform: translateX(-100px) scale(0.9);
      }
      
      .uvf-skip-button-top-left.visible {
        transform: translateX(0) scale(1);
      }
      
      .uvf-skip-button-top-left:hover {
        transform: translateX(0) scale(1.05);
      }
      
      .uvf-skip-button-top-left:active {
        transform: translateX(0) scale(0.95);
      }
      
      /* Skip button segment type styling */
      .uvf-skip-intro {
        border-color: var(--uvf-accent-1, #ff5722);
      }
      
      .uvf-skip-intro:hover {
        background: var(--uvf-accent-1, #ff5722);
        border-color: var(--uvf-accent-1, #ff5722);
      }
      
      .uvf-skip-recap {
        border-color: #ffc107;
      }
      
      .uvf-skip-recap:hover {
        background: #ffc107;
        border-color: #ffc107;
        color: #000;
      }
      
      .uvf-skip-credits {
        border-color: #9c27b0;
      }
      
      .uvf-skip-credits:hover {
        background: #9c27b0;
        border-color: #9c27b0;
      }
      
      .uvf-skip-ad {
        border-color: #f44336;
      }
      
      .uvf-skip-ad:hover {
        background: #f44336;
        border-color: #f44336;
      }
      
      /* Auto-skip countdown styling */
      .uvf-skip-button.auto-skip {
        position: relative;
        overflow: hidden;
        border-color: var(--uvf-accent-1, #ff5722);
        animation: uvf-skip-pulse 2s infinite;
      }
      
      .uvf-skip-button.auto-skip::before {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: var(--uvf-accent-1, #ff5722);
        width: 0%;
        transition: none;
        z-index: -1;
      }
      
      .uvf-skip-button.auto-skip.countdown::before {
        width: 100%;
        transition: width linear;
      }
      
      @keyframes uvf-skip-pulse {
        0% { 
          box-shadow: 0 0 0 0 rgba(255, 87, 34, 0.4);
        }
        50% { 
          box-shadow: 0 0 0 8px rgba(255, 87, 34, 0.1);
        }
        100% { 
          box-shadow: 0 0 0 0 rgba(255, 87, 34, 0);
        }
      }
      
      
      
      /* Mobile responsive design with enhanced touch targets */
      @media (max-width: 768px) {
        .uvf-progress-bar-wrapper {
          padding: 8px 0; /* Optimized touch area */
        }
        
        .uvf-progress-bar {
          height: 3px; /* Slightly thicker on mobile */
        }
        
        .uvf-progress-bar-wrapper:hover .uvf-progress-bar {
          height: 5px;
        }
        
        .uvf-progress-handle {
          top: 1.5px; /* Center on the 3px mobile progress bar */
        }
        
        .uvf-progress-bar-wrapper:hover .uvf-progress-handle {
          top: 2.5px; /* Center on the 5px mobile hover progress bar */
        }
        
        /* Mobile skip button adjustments */
        .uvf-skip-button {
          padding: 10px 20px;
          font-size: 14px;
          border-radius: 6px;
        }
        
        .uvf-skip-button-bottom-right {
          bottom: 80px;
          right: 20px;
        }
        
        .uvf-skip-button-bottom-left {
          bottom: 80px;
          left: 20px;
        }
        
        .uvf-skip-button-top-right {
          top: 20px;
          right: 20px;
        }
        
        .uvf-skip-button-top-left {
          top: 20px;
          left: 20px;
        }
        
        /* Mobile chapter markers */
        .uvf-chapter-marker {
          width: 3px; /* Thicker on mobile for better touch */
        }
        
        .uvf-chapter-marker:hover {
          width: 4px;
        }
        
      }
      
      /* Controls Row */
      .uvf-controls-row {
        display: flex;
        align-items: center;
        gap: 15px;
      }
      
      /* Control Buttons */
      .uvf-control-btn {
        background: rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      }
      
      .uvf-control-btn:hover {
        background: rgba(255,255,255,0.2);
        transform: scale(1.1);
      }
      
      .uvf-control-btn:active {
        transform: scale(0.95);
      }
      
      .uvf-control-btn svg {
        width: 20px;
        height: 20px;
        fill: var(--uvf-icon-color);
        pointer-events: none;
      }
      
      /* Settings Button Specific Styling */
      #uvf-settings-btn {
        background: var(--uvf-button-bg);
        border: 1px solid var(--uvf-button-border);
        position: relative;
        z-index: 10;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      #uvf-settings-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 4px 12px var(--uvf-button-shadow);
      }
      
      #uvf-settings-btn:active {
        transform: scale(0.95);
        transition: all 0.1s ease;
      }
      
      #uvf-settings-btn svg {
        opacity: 0.9;
        transition: all 0.3s ease;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
      }
      
      #uvf-settings-btn:hover svg {
        opacity: 1;
        transform: scale(1.05);
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
      }
      
      /* PiP Button Specific Styling */
      #uvf-pip-btn {
        background: var(--uvf-button-bg);
        border: 1px solid var(--uvf-button-border);
        position: relative;
        z-index: 10;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      #uvf-pip-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 4px 12px var(--uvf-button-shadow);
      }
      
      #uvf-pip-btn:active {
        transform: scale(0.95);
        transition: all 0.1s ease;
      }
      
      #uvf-pip-btn svg {
        opacity: 0.9;
        transition: all 0.3s ease;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
      }
      
      #uvf-pip-btn:hover svg {
        opacity: 1;
        transform: scale(1.05);
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
      }
      
      /* Fullscreen Button Specific Styling */
      #uvf-fullscreen-btn {
        background: var(--uvf-button-bg);
        border: 1px solid var(--uvf-button-border);
        position: relative;
        z-index: 10;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      #uvf-fullscreen-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 4px 12px var(--uvf-button-shadow);
      }
      
      #uvf-fullscreen-btn:active {
        transform: scale(0.95);
        transition: all 0.1s ease;
      }
      
      #uvf-fullscreen-btn svg {
        opacity: 0.9;
        transition: all 0.3s ease;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
      }
      
      #uvf-fullscreen-btn:hover svg {
        opacity: 1;
        transform: scale(1.05);
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
      }
      
      /* Fullscreen button state changes */
      #uvf-fullscreen-btn.fullscreen-active {
        background: linear-gradient(135deg, var(--uvf-accent-1), var(--uvf-accent-2));
        border: 1px solid var(--uvf-accent-1);
        box-shadow: 0 0 20px rgba(var(--uvf-accent-1), 0.3);
      }
      
      #uvf-fullscreen-btn.fullscreen-active:hover {
        background: linear-gradient(135deg, var(--uvf-accent-2), var(--uvf-accent-1));
        transform: scale(1.1);
        box-shadow: 0 0 25px rgba(var(--uvf-accent-1), 0.5);
      }
      
      #uvf-fullscreen-btn.fullscreen-active svg {
        opacity: 1;
        color: white;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5));
      }
      
      /* Settings Container */
      .uvf-settings-container {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 40px;
        min-height: 40px;
      }
      
      /* Skip Buttons Specific Styling */
      #uvf-skip-back,
      #uvf-skip-forward {
        background: var(--uvf-button-bg);
        border: 1px solid var(--uvf-button-border);
        position: relative;
        z-index: 10;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      #uvf-skip-back:hover,
      #uvf-skip-forward:hover {
        transform: scale(1.08);
        box-shadow: 0 4px 12px var(--uvf-button-shadow);
      }
      
      #uvf-skip-back:active,
      #uvf-skip-forward:active {
        transform: scale(0.95);
        transition: all 0.1s ease;
      }
      
      #uvf-skip-back svg,
      #uvf-skip-forward svg {
        width: 22px;
        height: 22px;
        stroke-width: 0;
        transform: scale(1);
        opacity: 0.9;
        transition: all 0.3s ease;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
      }
      
      #uvf-skip-back:hover svg,
      #uvf-skip-forward:hover svg {
        opacity: 1;
        transform: scale(1.05);
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
      }
      
      #uvf-skip-forward svg {
        transform: scale(1) scaleX(-1); /* Mirror the icon for forward */
      }
      
      #uvf-skip-forward:hover svg {
        transform: scale(1.05) scaleX(-1); /* Keep mirror on hover */
      }
      
      /* Volume Button Specific Styling */
      #uvf-volume-btn {
        background: var(--uvf-button-bg);
        border: 1px solid var(--uvf-button-border);
        position: relative;
        z-index: 10;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      #uvf-volume-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 4px 12px var(--uvf-button-shadow);
      }
      
      #uvf-volume-btn:active {
        transform: scale(0.95);
        transition: all 0.1s ease;
      }
      
      #uvf-volume-btn svg {
        opacity: 0.9;
        transition: all 0.3s ease;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
      }
      
      #uvf-volume-btn:hover svg {
        opacity: 1;
        transform: scale(1.05);
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
      }
      
      .uvf-control-btn.play-pause {
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, var(--uvf-accent-1), var(--uvf-accent-2));
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .uvf-control-btn.play-pause:hover {
        transform: scale(1.08);
        box-shadow: 0 4px 12px var(--uvf-accent-1-20);
        filter: saturate(1.1) brightness(1.05);
      }
      .uvf-control-btn.play-pause:active {
        transform: scale(0.95);
        transition: all 0.1s ease;
      }
      
      .uvf-control-btn.play-pause svg {
        width: 24px;
        height: 24px;
        opacity: 0.95;
        transition: all 0.3s ease;
        filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4));
      }
      
      .uvf-control-btn.play-pause:hover svg {
        opacity: 1;
        transform: scale(1.02);
        filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));
      }
      
      /* Time Display */
      .uvf-time-display {
        color: var(--uvf-text-primary);
        font-size: 14px;
        font-weight: 500;
        padding: 0 10px;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      }
      
      /* Volume Control */
      .uvf-volume-control {
        display: flex;
        align-items: center;
        position: relative;
      }
      
      .uvf-volume-panel {
        position: absolute;
        left: 40px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        background: rgba(0,0,0,0.95);
        backdrop-filter: blur(15px);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 20px;
        padding: 10px 15px;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.2s ease, visibility 0.2s ease, left 0.3s ease;
        z-index: 100;
      }
      
      .uvf-volume-control:hover .uvf-volume-panel,
      .uvf-volume-panel:hover,
      .uvf-volume-panel.active {
        opacity: 1;
        visibility: visible;
        pointer-events: all;
        left: 50px;
      }
      
      .uvf-volume-slider {
        width: 120px;
        height: 8px;
        background: rgba(255,255,255,0.2);
        border-radius: 4px;
        cursor: pointer;
        position: relative;
        margin: 0 10px;
      }
      
      .uvf-volume-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--uvf-accent-1), var(--uvf-accent-2));
        border-radius: 4px;
        pointer-events: none;
        transition: width 0.1s ease;
        position: absolute;
        top: 0;
        left: 0;
      }
      
      .uvf-volume-value {
        color: var(--uvf-text-primary);
        font-size: 12px;
        min-width: 30px;
        text-align: center;
      }
      
      /* Right Controls */
      .uvf-right-controls {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      /* Settings Menu */
      .uvf-settings-menu {
        position: absolute;
        bottom: 50px;
        right: 0;
        background: rgba(0,0,0,0.92);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 12px;
        padding: 8px 0;
        min-width: 220px;
        max-width: 280px;
        max-height: 60vh;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        z-index: 9999;
        box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 8px 25px rgba(0,0,0,0.3);
        /* Firefox */
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.3) transparent;
        /* Avoid layout shift when scrollbar appears */
        scrollbar-gutter: stable both-edges;
        /* Space on the right so content doesn't hug the scrollbar */
        padding-right: 8px;
        /* Initial hidden state */
        opacity: 0;
        visibility: hidden;
        transform: translateY(15px) scale(0.95);
        pointer-events: none;
        transition: opacity 0.25s ease, visibility 0.25s ease, transform 0.25s cubic-bezier(0.4, 0.0, 0.2, 1);
      }
      
      /* WebKit-based browsers (Chrome, Edge, Safari) */
      .uvf-settings-menu::-webkit-scrollbar {
        width: var(--uvf-scrollbar-width);
      }
      .uvf-settings-menu::-webkit-scrollbar-track {
        background: transparent;
      }
      .uvf-settings-menu::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, var(--uvf-scrollbar-thumb-start), var(--uvf-scrollbar-thumb-end));
        border-radius: 8px;
      }
      .uvf-settings-menu::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, var(--uvf-scrollbar-thumb-hover-start), var(--uvf-scrollbar-thumb-hover-end));
      }
      .uvf-settings-menu::-webkit-scrollbar-corner {
        background: transparent;
      }

      /* Scrollbar mode variants */
      .uvf-player-wrapper.uvf-scrollbar-compact {
        --uvf-scrollbar-width: 6px;
        --uvf-scrollbar-thumb-start: rgba(255,0,0,0.30);
        --uvf-scrollbar-thumb-end: rgba(255,0,0,0.38);
        --uvf-scrollbar-thumb-hover-start: rgba(255,0,0,0.42);
        --uvf-scrollbar-thumb-hover-end: rgba(255,0,0,0.52);
        --uvf-firefox-scrollbar-color: rgba(255,255,255,0.20);
      }
      .uvf-player-wrapper.uvf-scrollbar-overlay {
        --uvf-scrollbar-width: 6px;
      }
      .uvf-player-wrapper.uvf-scrollbar-overlay .uvf-settings-menu {
        scrollbar-gutter: auto;
        padding-right: 0;
      }

      .uvf-settings-menu.active {
        opacity: 1;
        visibility: visible;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }
      
      /* Improved Accordion Styles */
      .uvf-settings-accordion {
        padding: 8px 0;
      }
      
      .uvf-accordion-item {
        margin-bottom: 2px;
        border-radius: 8px;
        overflow: hidden;
        background: rgba(255,255,255,0.03);
      }
      
      .uvf-accordion-item:last-child {
        margin-bottom: 0;
      }
      
      .uvf-accordion-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        background: rgba(255,255,255,0.05);
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      
      .uvf-accordion-header:hover {
        background: rgba(255,255,255,0.1);
      }
      
      .uvf-accordion-item.expanded .uvf-accordion-header {
        background: rgba(255,255,255,0.08);
        border-bottom-color: rgba(255,255,255,0.12);
      }
      
      .uvf-accordion-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 500;
        color: #fff;
        flex: 1;
      }
      
      .uvf-accordion-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.9;
        width: 16px;
        height: 16px;
      }
      
      .uvf-accordion-icon svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
      
      .uvf-accordion-current {
        font-size: 11px;
        color: var(--uvf-accent-1);
        background: rgba(255,255,255,0.08);
        padding: 2px 8px;
        border-radius: 8px;
        font-weight: 600;
        margin-right: 8px;
      }
      
      .uvf-accordion-arrow {
        font-size: 10px;
        color: rgba(255,255,255,0.7);
        transition: transform 0.25s ease;
        width: 16px;
        text-align: center;
      }
      
      .uvf-accordion-item.expanded .uvf-accordion-arrow {
        transform: rotate(180deg);
      }
      
      .uvf-accordion-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        background: rgba(0,0,0,0.2);
      }
      
      .uvf-accordion-item.expanded .uvf-accordion-content {
        max-height: 250px;
      }
      
      /* Settings options within accordion */
      .uvf-accordion-content .uvf-settings-option {
        color: #fff;
        font-size: 13px;
        padding: 10px 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .uvf-accordion-content .uvf-settings-option:last-child {
        border-bottom: none;
      }
      
      .uvf-accordion-content .uvf-settings-option:hover {
        background: rgba(255,255,255,0.06);
        padding-left: 20px;
      }
      
      .uvf-accordion-content .uvf-settings-option.active {
        color: var(--uvf-accent-1);
        background: rgba(255,255,255,0.08);
        font-weight: 600;
      }
      
      .uvf-accordion-content .uvf-settings-option.active::after {
        content: '✓';
        font-size: 12px;
        opacity: 0.8;
      }
      
      .uvf-settings-empty {
        padding: 20px;
        text-align: center;
        color: rgba(255,255,255,0.6);
        font-size: 14px;
      }
      
      .uvf-settings-group {
        padding: 10px 0;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }
      
      .uvf-settings-group:last-child {
        border-bottom: none;
      }
      
      .uvf-settings-label {
        color: rgba(255,255,255,0.5);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding: 0 15px 5px;
      }
      
      .uvf-settings-option {
        color: #fff;
        font-size: 14px;
        padding: 8px 15px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .uvf-settings-option:hover {
        background: rgba(255,255,255,0.1);
        padding-left: 20px;
      }
      
      .uvf-settings-option.active {
        color: var(--uvf-accent-2);
      }
      
      .uvf-settings-option.active::after {
        content: '✓';
        margin-left: 10px;
      }
      
      /* Top Bar Container - Contains Navigation + Title (left) and Controls (right) */
      .uvf-top-bar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        padding: 20px;
        z-index: 7;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease;
      }
      
      /* Left side container for navigation + title */
      .uvf-left-side {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        max-width: 70%;
      }
      
      /* Navigation controls container */
      .uvf-navigation-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      
      /* Navigation button styles */
      .uvf-nav-btn {
        width: 40px;
        height: 40px;
        min-width: 40px;
        min-height: 40px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(8px);
        position: relative;
        overflow: hidden;
      }
      
      .uvf-nav-btn:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.4);
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
      
      .uvf-nav-btn:active {
        transform: scale(0.95);
      }
      
      .uvf-nav-btn svg {
        width: 20px;
        height: 20px;
        fill: currentColor;
        transition: all 0.2s ease;
      }
      
      .uvf-nav-btn:hover svg {
        transform: scale(1.1);
      }
      
      /* Back button specific styles */
      #uvf-back-btn {
        background: rgba(0, 0, 0, 0.7);
      }
      
      #uvf-back-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: var(--uvf-accent-1, #ff0000);
      }
      
      /* Close button specific styles */
      #uvf-close-btn {
        background: rgba(220, 53, 69, 0.8);
        border-color: rgba(220, 53, 69, 0.6);
      }
      
      #uvf-close-btn:hover {
        background: rgba(220, 53, 69, 1);
        border-color: rgba(220, 53, 69, 1);
        box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
      }
      
      .uvf-player-wrapper:hover .uvf-top-bar,
      .uvf-player-wrapper.controls-visible .uvf-top-bar {
        opacity: 1;
        transform: translateY(0);
      }
      
      /* Title Bar - After navigation buttons */
      .uvf-title-bar {
        flex: 1;
        min-width: 0; /* Allow shrinking */
      }

      /* Top Controls - Right side of top bar */
      .uvf-top-controls {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        flex-shrink: 0;
      }
      
      .uvf-title-content {
        display: flex;
        align-items: center;
        width: 100%;
        min-width: 0; /* Allow shrinking */
      }
      
      .uvf-title-text { 
        display: flex; 
        flex-direction: column;
        min-width: 0; /* Allow shrinking */
        flex: 1;
      }
      
      .uvf-video-title {
        color: var(--uvf-text-primary);
        font-size: clamp(14px, 2.5vw, 18px); /* Responsive font size */
        font-weight: 600;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
        cursor: pointer;
        transition: color 0.3s ease;
        position: relative;
      }
      
      .uvf-video-title:hover {
        color: var(--uvf-accent-1, #ff0000);
      }
      
      .uvf-video-subtitle {
        color: var(--uvf-text-secondary);
        font-size: clamp(11px, 1.8vw, 13px); /* Responsive font size */
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
        opacity: 0.9;
        line-height: 1.4;
        cursor: pointer;
        transition: opacity 0.3s ease;
        position: relative;
      }
      
      .uvf-video-subtitle:hover {
        opacity: 1;
      }
      
      /* Tooltip for long text */
      .uvf-text-tooltip {
        position: absolute;
        bottom: 100%;
        left: 0;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.4;
        max-width: 400px;
        word-wrap: break-word;
        white-space: normal;
        z-index: 1000;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-5px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }
      
      .uvf-text-tooltip::before {
        content: '';
        position: absolute;
        top: 100%;
        left: 12px;
        border: 5px solid transparent;
        border-top-color: rgba(0, 0, 0, 0.9);
      }
      
      .uvf-text-tooltip.show {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
      
      /* Multi-line title option for desktop */
      .uvf-video-title.multiline {
        white-space: normal;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        line-height: 1.2;
        max-height: 2.4em;
      }
      
      .uvf-video-subtitle.multiline {
        white-space: normal;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        line-height: 1.3;
        max-height: 3.9em;
      }
      
                /* Above seekbar section with time and branding */
                .uvf-above-seekbar-section {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    opacity: 0;
                    transform: translateY(10px);
                    transition: all 0.3s ease;
                }
                
                .uvf-player-wrapper:hover .uvf-above-seekbar-section,
                .uvf-player-wrapper.controls-visible .uvf-above-seekbar-section {
                    opacity: 1;
                    transform: translateY(0);
                }
                
                .uvf-time-display.uvf-above-seekbar {
                    position: static;
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--uvf-text-primary);
                    text-shadow: 0 1px 3px rgba(0,0,0,0.7);
                    background: rgba(0,0,0,0.3);
                    padding: 4px 8px;
                    border-radius: 12px;
                    backdrop-filter: blur(4px);
                    border: 1px solid rgba(255,255,255,0.1);
                    width: auto;
                    white-space: nowrap;
                }
                
                .uvf-framework-branding {
                    position: static;
                    bottom: unset;
                    right: unset;
                    opacity: 1;
                    transform: none;
                    margin: 0;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .uvf-logo-svg {
                    height: 18px;
                    width: auto;
                    opacity: 0.85;
                    filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4));
                    transition: all 0.2s ease;
                }
                
                .uvf-framework-branding:hover .uvf-logo-svg {
                    opacity: 1;
                    transform: scale(1.05);
                }
                
                .uvf-framework-branding:active .uvf-logo-svg {
                    transform: scale(0.95);
                }
                
                /* Show on mobile - positioned above seekbar */
                @media (max-width: 768px) {
                    .uvf-above-seekbar-section {
                        margin-bottom: 6px;
                    }
                    
                    .uvf-time-display.uvf-above-seekbar {
                        font-size: 12px;
                        padding: 3px 6px;
                    }
                    
                    .uvf-logo-svg {
                        height: 16px;
                    }
                }
                
                /* Ultra small screens */
                @media (max-width: 480px) {
                    .uvf-video-title {
                        font-size: clamp(11px, 3.5vw, 14px) !important;
                    }
                    
                    .uvf-video-subtitle {
                        font-size: clamp(9px, 2.5vw, 11px) !important;
                        -webkit-line-clamp: 1; /* Single line on very small screens */
                    }
                    
                    .uvf-left-side {
                        max-width: 80%;
                    }
                    
                    .uvf-above-seekbar-section {
                        margin-bottom: 5px;
                    }
                    
                    .uvf-time-display.uvf-above-seekbar {
                        font-size: 11px;
                        padding: 2px 5px;
                    }
                    
                    .uvf-logo-svg {
                        height: 14px;
                    }
                }
                
                @media (max-height: 400px) {
                    .uvf-above-seekbar-section {
                        margin-bottom: 4px;
                    }
                    
                    .uvf-time-display.uvf-above-seekbar {
                        font-size: 11px;
                        padding: 2px 4px;
                    }
                    
                    .uvf-logo-svg {
                        height: 12px;
                    }
                }
          height: 16px;
        }
      }


      /* Cast button grey state when casting */
      .uvf-control-btn.cast-grey {
        opacity: 0.6;
        filter: grayscale(0.6);
      }
      
      .uvf-control-btn.cast-grey:hover {
        transform: none;
        opacity: 0.7;
      }
      
      /* Pill-style button for prominent actions */
      .uvf-pill-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 40px;
        padding: 0 14px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.25);
        background: rgba(255,255,255,0.08);
        color: #fff;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      }
      .uvf-pill-btn:hover {
        transform: translateY(-1px);
        background: rgba(255,255,255,0.15);
        box-shadow: 0 6px 18px rgba(0,0,0,0.5);
      }
      .uvf-pill-btn:active {
        transform: translateY(0);
      }
      .uvf-pill-btn svg {
        width: 18px;
        height: 18px;
        fill: currentColor;
      }
      .uvf-stop-cast-btn {
        background: linear-gradient(135deg, #ff4d4f, #d9363e);
        border: 1px solid rgba(255, 77, 79, 0.6);
        box-shadow: 0 0 20px rgba(255, 77, 79, 0.35);
      }
      .uvf-stop-cast-btn:hover {
        background: linear-gradient(135deg, #ff6b6d, #f0444b);
        box-shadow: 0 0 26px rgba(255, 77, 79, 0.5);
      }
      
      /* Quality Badge */
      .uvf-quality-badge {
        background: var(--uvf-accent-1-20);
        border: 1px solid var(--uvf-accent-1);
        color: var(--uvf-accent-1);
        font-size: 11px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        display: none; /* Hidden by default, only shown when quality info is available */
      }
      
      .uvf-quality-badge.active {
        display: inline-block;
      }
      
      /* Time Tooltip */
      .uvf-time-tooltip {
        position: absolute;
        bottom: 20px;
        background: rgba(0,0,0,0.9);
        color: #fff;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        pointer-events: none;
        opacity: 0;
        transform: translateX(-50%);
        transition: opacity 0.2s ease;
      }
      
      .uvf-progress-bar-wrapper:hover .uvf-time-tooltip {
        opacity: 1;
      }
      
      /* Shortcut Indicator */
      .uvf-shortcut-indicator {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        color: #fff;
        padding: 20px 30px;
        border-radius: 8px;
        font-size: 24px;
        font-weight: 600;
        opacity: 0;
        pointer-events: none;
        z-index: 20;
        transition: opacity 0.3s ease;
        white-space: nowrap;
        text-align: center;
        min-width: auto;
        max-width: 200px;
      }
      
      /* Time-specific indicator styling */
      .uvf-shortcut-indicator.uvf-time-indicator {
        padding: 12px 18px;
        font-size: 18px;
        font-weight: 500;
        font-family: 'Courier New', monospace;
        letter-spacing: 0.5px;
        border-radius: 6px;
        background: rgba(0,0,0,0.85);
        backdrop-filter: blur(4px);
      }
      
      .uvf-shortcut-indicator.active {
        animation: uvf-fadeInOut 1s ease;
      }
      
      /* Key action overlay styles (YouTube-like) */
      .uvf-shortcut-indicator.uvf-ki-icon {
        background: transparent;
        padding: 0;
        border-radius: 50%;
      }
      .uvf-shortcut-indicator .uvf-ki {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        color: var(--uvf-icon-color);
      }
      .uvf-shortcut-indicator .uvf-ki svg {
        width: 72px;
        height: 72px;
        fill: var(--uvf-icon-color);
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.45));
      }
      .uvf-shortcut-indicator .uvf-ki-skip {
        position: relative;
        width: 110px;
        height: 110px;
      }
      .uvf-shortcut-indicator .uvf-ki-skip svg {
        width: 110px;
        height: 110px;
        position: relative;
        z-index: 1;
      }
      .uvf-shortcut-indicator .uvf-ki-skip .uvf-ki-skip-num {
        position: absolute;
        top: 52%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: var(--uvf-text-primary);
        font-weight: 800;
        font-size: 22px;
        text-shadow: 0 2px 6px rgba(0,0,0,0.5);
        pointer-events: none;
        z-index: 2;
      }
      .uvf-shortcut-indicator .uvf-ki-volume { align-items: center; }
      .uvf-shortcut-indicator .uvf-ki-vol-icon svg { width: 36px; height: 36px; }
      .uvf-shortcut-indicator .uvf-ki-vol-bar {
        width: 180px;
        height: 8px;
        background: rgba(255,255,255,0.25);
        border-radius: 4px;
        overflow: hidden;
      }
      .uvf-shortcut-indicator .uvf-ki-vol-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--uvf-accent-1), var(--uvf-accent-2));
      }
      .uvf-shortcut-indicator .uvf-ki-vol-text {
        font-size: 16px;
        font-weight: 600;
        color: var(--uvf-text-primary);
        min-width: 42px;
        text-align: right;
      }
      .uvf-shortcut-indicator .uvf-ki-text {
        font-size: 18px;
        color: var(--uvf-text-primary);
      }
      
      @keyframes uvf-fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      }
      
      /* Hide top bar when no cursor */
      .uvf-player-wrapper.no-cursor .uvf-top-bar {
        opacity: 0 !important;
        transform: translateY(-10px) !important;
        pointer-events: none;
      }
      
      /* Fullscreen specific styles - DESKTOP AND LANDSCAPE ONLY */
      /* Mobile portrait uses Material You layout in fullscreen */
      @media not all and (max-width: 767px) and (orientation: portrait) {
        .uvf-player-wrapper.uvf-fullscreen {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 2147483647;
          background: #000;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-video-container {
          width: 100vw !important;
          height: 100vh !important;
          max-width: none !important;
          max-height: none !important;
          aspect-ratio: unset !important;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-video {
          width: 100vw !important;
          height: 100vh !important;
        }
        
        /* Maintain consistent control sizing in fullscreen - DESKTOP/LANDSCAPE ONLY */
        .uvf-player-wrapper.uvf-fullscreen .uvf-control-btn {
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-control-btn.play-pause {
          width: 50px;
          height: 50px;
          min-width: 50px;
          min-height: 50px;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-control-btn svg {
          width: 20px;
          height: 20px;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-control-btn.play-pause svg {
          width: 24px;
          height: 24px;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-time-display {
          font-size: 14px;
          padding: 0 10px;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-center-play-btn {
          width: 64px;
          height: 64px;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-center-play-btn svg {
          width: 28px;
          height: 28px;
        }
        
        /* Ensure overlays remain visible in fullscreen with consistent spacing */
        .uvf-player-wrapper.uvf-fullscreen .uvf-top-bar,
        .uvf-player-wrapper.uvf-fullscreen .uvf-controls-bar,
        .uvf-player-wrapper.uvf-fullscreen .uvf-top-gradient,
        .uvf-player-wrapper.uvf-fullscreen .uvf-controls-gradient {
          z-index: 2147483647; /* Maximum z-index value */
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-controls-bar {
          padding: 20px 30px; /* More generous padding in fullscreen */
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-controls-row {
          gap: 15px; /* Consistent gap in fullscreen */
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-top-bar {
          padding: 20px 30px;
        }
        
        /* Fullscreen hover and visibility states */
        .uvf-player-wrapper.uvf-fullscreen:hover .uvf-top-bar,
        .uvf-player-wrapper.uvf-fullscreen.controls-visible .uvf-top-bar {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      /* Safe Area Variables - Support for modern mobile devices */
      :root {
        /* iOS Safe Area Fallbacks */
        --uvf-safe-area-top: env(safe-area-inset-top, 0px);
        --uvf-safe-area-right: env(safe-area-inset-right, 0px);
        --uvf-safe-area-bottom: env(safe-area-inset-bottom, 0px);
        --uvf-safe-area-left: env(safe-area-inset-left, 0px);
        
        /* Dynamic Viewport Support */
        --uvf-dvh: 1dvh;
        --uvf-svh: 1svh;
        --uvf-lvh: 1lvh;
      }
      
      /* Cross-Browser Mobile Viewport Fixes */
      
      /* Modern browsers with dynamic viewport support */
      @supports (height: 100dvh) {
        /* Mobile devices - use dvh for dynamic viewport */
        @media screen and (max-width: 767px) {
          .uvf-player-wrapper,
          .uvf-video-container,
          .uvf-responsive-container {
            height: 100dvh !important;
            min-height: 100dvh !important;
          }
          
          /* Ensure controls stay visible with dvh */
          .uvf-controls-bar {
            bottom: env(safe-area-inset-bottom, 0px);
          }
        }
        
        /* Desktop - standard height */
        @media screen and (min-width: 768px) {
          .uvf-player-wrapper,
          .uvf-video-container {
            height: 100dvh;
          }
          
          .uvf-responsive-container {
            height: 100dvh;
          }
        }
      }
      
      /* iOS Safari specific fixes - fullscreen only */
      @supports (-webkit-appearance: none) {
        .uvf-player-wrapper.uvf-fullscreen,
        .uvf-video-container.uvf-fullscreen {
          height: -webkit-fill-available;
          min-height: -webkit-fill-available;
        }
      }
      
      
      /* Mobile responsive styles for navigation buttons */
      @media screen and (max-width: 767px) {
        .uvf-nav-btn {
          width: 36px;
          height: 36px;
          min-width: 36px;
          min-height: 36px;
        }
        
        .uvf-nav-btn svg {
          width: 18px;
          height: 18px;
        }
        
        .uvf-navigation-controls {
          gap: 6px;
        }
        
        .uvf-left-side {
          gap: 8px;
          max-width: 75%;
        }
        
        /* Mobile title adjustments */
        .uvf-video-title {
          font-size: clamp(12px, 3vw, 16px) !important;
          line-height: 1.2;
        }
        
        .uvf-video-subtitle {
          font-size: clamp(10px, 2.2vw, 12px) !important;
          margin-top: 1px;
          /* Allow wrapping on mobile if needed */
          white-space: normal;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      }
      
      /* Mobile portrait - hide skip buttons, ensure top bar visible */
      @media screen and (max-width: 767px) and (orientation: portrait) {
        #uvf-skip-back,
        #uvf-skip-forward {
          display: none !important;
        }
        
        /* Ensure top bar and controls are visible */
        .uvf-top-bar {
          display: flex !important;
          z-index: 10 !important;
        }
        
        .uvf-top-controls {
          display: flex !important;
        }
        
        /* Show top bar when controls are visible or on hover */
        .uvf-player-wrapper:hover .uvf-top-bar,
        .uvf-player-wrapper.controls-visible .uvf-top-bar {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
      }
      
      /* Mobile devices (landscape) - Optimized for fullscreen viewing with safe areas */
      @media screen and (max-width: 767px) and (orientation: landscape) {
        .uvf-responsive-container {
          width: 100vw !important;
          height: calc(100vh - var(--uvf-safe-area-top) - var(--uvf-safe-area-bottom));
          margin: 0;
          padding: 0;
          position: relative;
          overflow: hidden;
        }
        
        @supports (height: 100dvh) {
          .uvf-responsive-container {
            height: calc(100dvh - var(--uvf-safe-area-top) - var(--uvf-safe-area-bottom));
          }
        }
        
        .uvf-responsive-container .uvf-player-wrapper {
          width: 100vw !important;
          height: 100% !important;
          min-height: calc(100vh - var(--uvf-safe-area-top) - var(--uvf-safe-area-bottom));
        }
        
        @supports (height: 100dvh) {
          .uvf-responsive-container .uvf-player-wrapper {
            min-height: calc(100dvh - var(--uvf-safe-area-top) - var(--uvf-safe-area-bottom));
          }
        }
        
        .uvf-responsive-container .uvf-video-container {
          width: 100vw !important;
          height: 100% !important;
          aspect-ratio: unset !important;
          min-height: inherit;
        }
        
        /* Compact controls for landscape with safe area padding */
        .uvf-controls-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 10px 12px;
          padding-bottom: calc(10px + var(--uvf-safe-area-bottom));
          padding-left: calc(12px + var(--uvf-safe-area-left));
          padding-right: calc(12px + var(--uvf-safe-area-right));
          background: linear-gradient(to top, var(--uvf-overlay-strong) 0%, var(--uvf-overlay-medium) 80%, var(--uvf-overlay-transparent) 100%);
          box-sizing: border-box;
          z-index: 1000;
        }
        
        .uvf-progress-section {
          margin-bottom: 10px;
        }
        
        .uvf-controls-row {
          gap: 10px;
        }
        
        /* Touch-friendly but compact controls for landscape */
        .uvf-control-btn {
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
        }
        
        .uvf-control-btn.play-pause {
          width: 48px;
          height: 48px;
          min-width: 48px;
          min-height: 48px;
        }
        
        .uvf-control-btn svg {
          width: 18px;
          height: 18px;
        }
        
        .uvf-control-btn.play-pause svg {
          width: 22px;
          height: 22px;
        }
        
        /* Top bar for landscape - compact padding */
        .uvf-top-bar,
        .uvf-video-container .uvf-top-bar,
        .uvf-responsive-container .uvf-video-container .uvf-top-bar {
          padding: 8px 12px !important;
          padding-top: calc(8px + var(--uvf-safe-area-top)) !important;
          padding-left: calc(12px + var(--uvf-safe-area-left)) !important;
          padding-right: calc(12px + var(--uvf-safe-area-right)) !important;
          gap: 6px !important;
        }
        
        /* Title bar within top bar - landscape */
        .uvf-top-bar .uvf-title-bar {
          padding: 0;
        }
        
        .uvf-video-title {
          font-size: 14px;
        }
        
        .uvf-video-subtitle {
          font-size: 11px;
        }
        
        .uvf-time-display {
          font-size: 11px;
          padding: 0 6px;
        }
        
        /* Hide volume panel in landscape too */
        .uvf-volume-panel {
          display: none;
        }
        
        /* Compact progress bar for landscape */
        .uvf-progress-bar {
          height: 3px;
          margin-bottom: 8px;
        }
        
        .uvf-progress-handle {
          width: 16px;
          height: 16px;
        }
        
        /* Top bar in fullscreen landscape */
        .uvf-player-wrapper.uvf-fullscreen .uvf-top-bar,
        .uvf-player-wrapper.uvf-fullscreen .uvf-video-container .uvf-top-bar,
        .uvf-responsive-container .uvf-player-wrapper.uvf-fullscreen .uvf-top-bar,
        .uvf-responsive-container .uvf-player-wrapper.uvf-fullscreen .uvf-video-container .uvf-top-bar {
          display: flex !important;
        }
      }
      }

      
      /* Tablet devices - Enhanced UX with desktop features */
      @media screen and (min-width: 768px) and (max-width: 1023px) {
        /* Tablet navigation and title adjustments */
        .uvf-nav-btn {
          width: 38px;
          height: 38px;
          min-width: 38px;
          min-height: 38px;
        }
        
        .uvf-nav-btn svg {
          width: 19px;
          height: 19px;
        }
        
        .uvf-left-side {
          max-width: 70%;
        }
        
        .uvf-video-title {
          font-size: clamp(15px, 2.2vw, 17px) !important;
        }
        
        .uvf-video-subtitle {
          font-size: clamp(12px, 1.8vw, 13px) !important;
        }
        
        .uvf-controls-bar {
          padding: 18px 16px;
          background: linear-gradient(to top, var(--uvf-overlay-strong) 0%, var(--uvf-overlay-medium) 70%, var(--uvf-overlay-transparent) 100%);
        }
        
        .uvf-progress-section {
          margin-bottom: 14px;
        }
        
        .uvf-controls-row {
          gap: 12px;
        }
        
        /* Touch-optimized tablet controls */
        .uvf-control-btn {
          width: 42px;
          height: 42px;
          min-width: 42px;
          min-height: 42px;
        }
        
        .uvf-control-btn.play-pause {
          width: 50px;
          height: 50px;
          min-width: 50px;
          min-height: 50px;
        }
        
        .uvf-control-btn svg {
          width: 19px;
          height: 19px;
        }
        
        .uvf-control-btn.play-pause svg {
          width: 23px;
          height: 23px;
        }
        
        /* Top bar for tablet */
        .uvf-top-bar {
          padding: 16px;
          gap: 12px;
        }
        
        .uvf-video-title {
          font-size: 17px;
          font-weight: 600;
        }
        
        .uvf-video-subtitle {
          font-size: 12px;
        }
        
        .uvf-time-display {
          font-size: 13px;
          font-weight: 500;
          padding: 0 8px;
        }
        
        /* Tablet center play button - consistent theming */
        .uvf-center-play-btn {
          width: clamp(48px, 10vw, 64px);
          height: clamp(48px, 10vw, 64px);
          background: linear-gradient(135deg, var(--uvf-accent-1), var(--uvf-accent-2));
          border: 0;
          box-shadow: 0 4px 16px var(--uvf-accent-1-20);
        }
        
        .uvf-center-play-btn:hover {
          transform: scale(1.08);
          filter: saturate(1.08) brightness(1.05);
          box-shadow: 0 6px 20px var(--uvf-accent-1-20);
        }
        
        .uvf-center-play-btn svg {
          width: clamp(20px, 3.5vw, 26px);
          height: clamp(20px, 3.5vw, 26px);
        }
        
        /* Tablet volume control - keep desktop functionality */
        .uvf-volume-panel {
          display: flex;
        }
        
        .uvf-volume-slider {
          width: 100px;
        }
        
        /* Show quality badge on tablets */
        .uvf-quality-badge {
          font-size: 10px;
          padding: 3px 6px;
        }
        
        /* Tablet progress bar */
        .uvf-progress-bar {
          height: 3px;
        }
        
        .uvf-progress-handle {
          width: 16px;
          height: 16px;
        }
        
        /* Settings menu for tablets */
        .uvf-settings-menu {
          min-width: 180px;
          font-size: 13px;
        }
        
        .uvf-settings-option {
          padding: 10px 14px;
          font-size: 13px;
        }
      }
      
      /* Large screens - Enhanced desktop experience */
      @media screen and (min-width: 1024px) {
        .uvf-responsive-container {
          padding: 10px;
        }
        
        .uvf-controls-bar {
          padding: 20px;
          background: linear-gradient(to top, var(--uvf-overlay-strong) 0%, var(--uvf-overlay-medium) 60%, var(--uvf-overlay-transparent) 100%);
        }
        
        .uvf-progress-section {
          margin-bottom: 16px;
        }
        
        .uvf-controls-row {
          gap: 14px;
        }
        
        /* Desktop controls with enhanced hover */
        .uvf-control-btn {
          width: 40px;
          height: 40px;
          transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
        }
        
        .uvf-control-btn:hover {
          transform: scale(1.1);
          background: var(--uvf-overlay-medium);
        }
        
        .uvf-control-btn:active {
          transform: scale(0.95);
        }
        
        .uvf-control-btn svg {
          width: 20px;
          height: 20px;
          transition: all 0.2s ease;
        }
        
        .uvf-control-btn:hover svg {
          opacity: 1;
        }
        
        .uvf-control-btn.play-pause {
          width: 50px;
          height: 50px;
        }
        
        .uvf-control-btn.play-pause:hover {
          transform: scale(1.08);
          background: var(--uvf-primary-color);
        }
        
        .uvf-control-btn.play-pause svg {
          width: 24px;
          height: 24px;
        }
        
        /* Top bar for desktop 1024px+ */
        .uvf-top-bar {
          padding: 20px;
          gap: 20px;
        }
        
        .uvf-video-title {
          font-size: 18px;
          font-weight: 600;
        }
        
        .uvf-video-subtitle {
          font-size: 13px;
          opacity: 0.9;
        }
        
        .uvf-time-display {
          font-size: 14px;
          font-weight: 500;
          padding: 0 10px;
        }
        
        /* Enhanced center play button with smooth transitions */
        .uvf-center-play-btn {
          width: clamp(56px, 10vw, 72px);
          height: clamp(56px, 10vw, 72px);
          background: linear-gradient(135deg, var(--uvf-accent-1), var(--uvf-accent-2));
          border: 0;
          border-radius: 50%;
          opacity: 1;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 16px var(--uvf-accent-1-20);
        }
        
        .uvf-center-play-btn:hover {
          transform: scale(1.08);
          filter: saturate(1.08) brightness(1.05);
          box-shadow: 0 6px 20px var(--uvf-accent-1-20);
        }
        
        .uvf-center-play-btn:active {
          transform: scale(0.95);
          transition: all 0.1s ease;
        }
        
        .uvf-center-play-btn svg {
          width: clamp(24px, 4vw, 30px);
          height: clamp(24px, 4vw, 30px);
          fill: #fff;
          margin-left: 3px;
          filter: drop-shadow(0 1px 3px rgba(0,0,0,0.35));
        }
        
        /* Optional: Add subtle pulse animation on idle */
        @keyframes uvf-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        
        .uvf-center-play-btn.uvf-pulse {
          animation: uvf-pulse 2s ease-in-out infinite;
        }
        
        .uvf-progress-bar-wrapper:hover .uvf-progress-bar {
          height: 6px;
        }
        
        /* Volume slider enhancements */
        .uvf-volume-panel:hover .uvf-volume-slider {
          width: 120px;
        }
        
        .uvf-volume-slider {
          transition: width 0.2s ease;
        }
        
        /* Settings menu enhancement */
        .uvf-settings-menu {
          backdrop-filter: blur(10px);
          background: rgba(0, 0, 0, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .uvf-settings-option:hover {
          background: var(--uvf-overlay-medium);
          transform: translateX(4px);
        }
      }
      
      /* Ultra-wide screens (1440px and above) */
      @media screen and (min-width: 1440px) {
        .uvf-controls-bar {
          padding: 24px;
        }
        
        .uvf-control-btn {
          width: 44px;
          height: 44px;
        }
        
        .uvf-control-btn svg {
          width: 22px;
          height: 22px;
        }
        
        .uvf-control-btn.play-pause {
          width: 56px;
          height: 56px;
        }
        
        .uvf-control-btn.play-pause svg {
          width: 28px;
          height: 28px;
        }
        
        .uvf-center-play-btn {
          width: clamp(64px, 10vw, 76px);
          height: clamp(64px, 10vw, 76px);
          background: linear-gradient(135deg, var(--uvf-accent-1), var(--uvf-accent-2));
          border: 0;
          box-shadow: 0 4px 16px var(--uvf-accent-1-20);
        }
        
        .uvf-center-play-btn:hover {
          transform: scale(1.08);
          filter: saturate(1.08) brightness(1.05);
          box-shadow: 0 6px 20px var(--uvf-accent-1-20);
        }
        
        .uvf-center-play-btn svg {
          width: clamp(28px, 4.5vw, 32px);
          height: clamp(28px, 4.5vw, 32px);
          margin-left: 3px;
        }
        
        .uvf-video-title {
          font-size: 20px;
        }
        
        .uvf-time-display {
          font-size: 15px;
        }
        
        .uvf-volume-slider {
          width: 130px;
        }
        
        .uvf-volume-panel:hover .uvf-volume-slider {
          width: 150px;
        }
      }
      
      /* High-DPI display optimizations */
      @media screen and (-webkit-min-device-pixel-ratio: 2), 
             screen and (min-resolution: 192dpi) {
        .uvf-control-btn {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }
        
        .uvf-progress-handle {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        
        .uvf-settings-menu {
          border-width: 0.5px;
        }
      }
      
      /* Reduced motion accessibility */
      @media (prefers-reduced-motion: reduce) {
        .uvf-control-btn,
        .uvf-center-play-btn,
        .uvf-progress-handle,
        .uvf-volume-slider,
        .uvf-settings-option {
          transition: none !important;
        }
        
        .uvf-control-btn:hover,
        .uvf-center-play-btn:hover {
          transform: none !important;
        }
      }
      
      /* Global control visibility rules */
      .uvf-quality-badge {
        display: none !important; /* Remove quality badge from all devices */
      }
      
      /* Define overlay variables late to allow theme overrides elsewhere if needed */
      .uvf-player-wrapper {
        --uvf-overlay-strong: var(--uvf-overlay-strong, rgba(0,0,0,0.95));
        --uvf-overlay-medium: var(--uvf-overlay-medium, rgba(0,0,0,0.7));
        --uvf-overlay-transparent: var(--uvf-overlay-transparent, rgba(0,0,0,0));
      }
      
      /* Touch device optimizations */
      @media (hover: none) and (pointer: coarse) {
        .uvf-control-btn {
          min-width: 44px;
          min-height: 44px;
          border-radius: 50%
        }
        
        .uvf-progress-bar {
          height: 3px;
        }
        
        .uvf-progress-handle {
          width: 20px;
          height: 20px;
        }
        
        .uvf-volume-slider {
          height: 10px;
        }
        
        /* Touch-specific hover replacements */
        .uvf-control-btn:active {
          background: var(--uvf-overlay-medium);
          transform: scale(0.95);
        }
      }
      
      /* Keyboard navigation and accessibility */
      .uvf-control-btn:focus-visible,
      .uvf-center-play-btn:focus-visible {
        outline: 2px solid var(--uvf-primary-color, #007bff);
        outline-offset: 2px;
        background: var(--uvf-overlay-medium);
      }
      
      .uvf-progress-bar-wrapper:focus-visible {
        outline: 2px solid var(--uvf-primary-color, #007bff);
        outline-offset: 2px;
      }
      
      .uvf-volume-slider:focus-visible {
        outline: 2px solid var(--uvf-primary-color, #007bff);
        outline-offset: 1px;
      }
      
      .uvf-settings-option:focus-visible {
        background: var(--uvf-overlay-medium);
        outline: 2px solid var(--uvf-primary-color, #007bff);
        outline-offset: -2px;
      }
      
      /* Screen reader and accessibility improvements */
      .uvf-sr-only {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
      
      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .uvf-control-btn {
          border: 1px solid;
        }
        
        .uvf-progress-bar {
          border: 1px solid;
        }
        
        .uvf-progress-handle {
          border: 2px solid;
        }
        
        .uvf-settings-menu {
          border: 2px solid;
        }
      }
      
      /* Paywall Responsive Styles */
      .uvf-paywall-overlay {
        position: absolute !important;
        inset: 0 !important;
        background: rgba(0,0,0,0.9) !important;
        z-index: 2147483000 !important;
        display: none !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 10px !important;
        box-sizing: border-box !important;
      }
      
      .uvf-paywall-modal {
        width: 90vw !important;
        height: auto !important;
        max-width: 500px !important;
        max-height: 90vh !important;
        background: #0f0f10 !important;
        border: 1px solid rgba(255,255,255,0.15) !important;
        border-radius: 12px !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: auto !important;
        box-shadow: 0 20px 60px rgba(0,0,0,0.7) !important;
      }
      
      /* Paywall Mobile Portrait */
      @media screen and (max-width: 767px) and (orientation: portrait) {
        .uvf-paywall-modal {
          width: 95vw !important;
          max-width: none !important;
          max-height: 85vh !important;
          margin: 0 !important;
        }
        
        .uvf-paywall-modal > div:first-child {
          padding: 12px 16px !important;
          font-size: 16px !important;
        }
        
        .uvf-paywall-modal > div:last-child {
          padding: 16px !important;
        }
      }
      
      /* Paywall Mobile Landscape */
      @media screen and (max-width: 767px) and (orientation: landscape) {
        .uvf-paywall-modal {
          width: 85vw !important;
          max-height: 80vh !important;
        }
        
        .uvf-paywall-modal > div:first-child {
          padding: 10px 16px !important;
        }
        
        .uvf-paywall-modal > div:last-child {
          padding: 14px !important;
        }
      }
      
      /* Paywall Tablet */
      @media screen and (min-width: 768px) and (max-width: 1023px) {
        .uvf-paywall-modal {
          width: 80vw !important;
          max-width: 600px !important;
          max-height: 80vh !important;
        }
      }
      
      /* Desktop styles for title and navigation */
      @media screen and (min-width: 1024px) {
        .uvf-left-side {
          max-width: 65%; /* More space for title on desktop */
        }
        
        .uvf-video-title {
          font-size: clamp(16px, 1.8vw, 20px) !important;
          font-weight: 700; /* Bolder on desktop */
        }
        
        .uvf-video-subtitle {
          font-size: clamp(13px, 1.4vw, 15px) !important;
          margin-top: 3px;
        }
        
        /* Allow hover effects on desktop */
        .uvf-title-bar:hover .uvf-video-title {
          color: var(--uvf-accent-1, #ff0000);
          transition: color 0.3s ease;
        }
      }
      
      /* Ultra-wide screens */
      @media screen and (min-width: 1440px) {
        .uvf-video-title {
          font-size: clamp(18px, 1.6vw, 22px) !important;
        }
        
        .uvf-video-subtitle {
          font-size: clamp(14px, 1.2vw, 16px) !important;
        }
      }
      
      /* Paywall Desktop */
      @media screen and (min-width: 1024px) {
        .uvf-paywall-modal {
          width: 70vw !important;
          max-width: 800px !important;
          max-height: 70vh !important;
        }
      }
    `;
  }

  /**
   * Creates framework branding logo
   * Only creates branding if showFrameworkBranding is not explicitly set to false
   */
    private createFrameworkBranding(container: HTMLElement): void {
        // Double-check configuration (defensive programming)
        if ((this.config as any).showFrameworkBranding === false) {
            this.debugLog('Framework branding disabled by configuration');
            return;
        }
        const brandingContainer = document.createElement('div');
        brandingContainer.className = 'uvf-framework-branding';
        brandingContainer.setAttribute('title', 'Powered by flicknexs');
        
        const logoSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" data-name="Layer 1" id="Layer_1" viewBox="0 0 180 29" class="uvf-logo-svg">
                <defs>
                    <style>.cls-1{fill:#0d5ef8;}.cls-2{fill:#ff0366;opacity:0.94;}.cls-3{fill:#fff;}</style>
                </defs>
                <title>flicknexs</title>
                <path class="cls-1" d="M45.93,1.53q-.87.15-3.18.48l-3.59.51c-1.26.16-2.42.3-3.51.42s-2.17.19-3.26.25q.7,4,1.17,10.68T34,25.67a22.58,22.58,0,0,0,2.73-.14,19.27,19.27,0,0,0,2.47-.45c.09-1.29.16-2.69.22-4.22s.1-3.16.14-4.9c.75-.09,1.54-.16,2.37-.2s1.76,0,2.77,0c0-1,0-1.89-.1-2.57a12,12,0,0,0-.35-2,20.14,20.14,0,0,0-2.34.13,18.77,18.77,0,0,0-2.38.4c0-.78,0-1.57,0-2.37s-.06-1.59-.1-2.37c.51,0,1.3-.11,2.39-.23l4.1-.42A10.41,10.41,0,0,0,46.13,5,8.75,8.75,0,0,0,46.21,4a10.85,10.85,0,0,0-.08-1.34,6.31,6.31,0,0,0-.2-1.08Z"/>
                <path class="cls-1" d="M61.11,21a20.41,20.41,0,0,0-3.07.25,26,26,0,0,0-3.25.7c-.14-.88-.25-1.94-.32-3.17s-.1-3.13-.1-5.67c0-1.76.05-3.42.14-5s.22-2.81.37-3.74a6.81,6.81,0,0,0-.74-.07l-.72,0a19.18,19.18,0,0,0-2.49.17A20.39,20.39,0,0,0,48.39,5c0,2.84.18,6.4.52,10.68s.75,7.81,1.2,10.6q3.78-.54,6.33-.73c1.69-.14,3.46-.2,5.32-.2a14.9,14.9,0,0,0-.21-2.26A15.21,15.21,0,0,0,61.11,21Z"/>
                <path class="cls-1" d="M69.2,4.25A10.1,10.1,0,0,0,67.86,4a11.09,11.09,0,0,0-1.36-.07,7.12,7.12,0,0,0-1.92.25,5.51,5.51,0,0,0-1.59.7q.51,3.83.76,8.62T64,24.16A20.88,20.88,0,0,0,66.51,24a14.38,14.38,0,0,0,2.15-.39q.28-3,.45-7.12t.17-8q0-1.2,0-2.28c0-.72,0-1.37,0-2Z"/>
                <path class="cls-1" d="M80.84,7.18a1.42,1.42,0,0,1,1.31,1,6.72,6.72,0,0,1,.46,2.8,15.48,15.48,0,0,0,2.7-.19,12.09,12.09,0,0,0,2.55-.84A7,7,0,0,0,86,5.42,5.65,5.65,0,0,0,81.8,3.81a8.68,8.68,0,0,0-7.07,3.51,13.28,13.28,0,0,0-2.81,8.61,8.82,8.82,0,0,0,2,6.15,7,7,0,0,0,5.45,2.16,8.74,8.74,0,0,0,5.8-1.78,6.86,6.86,0,0,0,2.34-5,4.63,4.63,0,0,0-1.84-.66,8.79,8.79,0,0,0-2.43-.13,4.83,4.83,0,0,1-.39,3,2.1,2.1,0,0,1-2,1.06,2.23,2.23,0,0,1-2-1.58,11.41,11.41,0,0,1-.72-4.56,15.42,15.42,0,0,1,.79-5.22c.52-1.44,1.18-2.16,2-2.16Z"/>
                <path class="cls-1" d="M99.82,14.22a24.24,24.24,0,0,0,3-3.4,36.6,36.6,0,0,0,2.75-4.29a11.67,11.67,0,0,0-2.17-2,8.72,8.72,0,0,0-2.35-1.16a51.71,51.71,0,0,1-2.76,5.54,24.14,24.14,0,0,1-2.79,3.84c.07-1.54.19-3.05.36-4.54s.38-2.93.65-4.34a11.73,11.73,0,0,0-1.29-.25,12.48,12.48,0,0,0-1.44-.08a8.38,8.38,0,0,0-2.07.25,5.37,5.37,0,0,0-1.69.7c-.07,1.12-.13,2.22-.17,3.29s0,2.1,0,3.11q0,3.89.32,7.57a67.32,67.32,0,0,0,1,7,22.86,22.86,0,0,0,2.71-.17,13.09,13.09,0,0,0,2.23-.39q-.25-1.84-.39-3.66c-.1-1.21-.15-2.39-.17-3.55a.77.77,0,0,0,.15-.1l.16-.1a35.18,35.18,0,0,1,3.53,4.28a39,39,0,0,1,2.9,5A11.7,11.7,0,0,0,105,25.1a9.65,9.65,0,0,0,2.08-2.23A47.65,47.65,0,0,0,103.63,18a33.51,33.51,0,0,0-3.81-3.82Z"/>
                <path class="cls-1" d="M124.86,1.87a17.07,17.07,0,0,0-2.83.24,22.53,22.53,0,0,0-2.9.69c.17,1.1.3,2.53.4,4.28s.14,3.74.14,6a50.57,50.57,0,0,0-2.37-5,55,55,0,0,0-3-4.79,14.37,14.37,0,0,0-3,.41,11.7,11.7,0,0,0-2.53.91l-.22.11a3,3,0,0,0-.31.2q0,3.48.27,8.49t.8,11.13a19.17,19.17,0,0,0,2.49-.17A12.81,12.81,0,0,0,114,24V14.4c0-.92,0-1.77,0-2.54a49.47,49.47,0,0,1,2.4,4.34q1.16,2.37,3,6.72c.71,0,1.44-.1,2.2-.18s1.72-.22,2.88-.41c.17-2.32.3-4.74.41-7.25s.15-4.93.15-7.23c0-.94,0-1.9,0-2.89s0-2-.11-3.09Z"/>
                <path class="cls-1" d="M142.27,19.19c-.89.17-2.19.36-3.93.57s-2.89.33-3.43.33c-.07-.73-.13-1.5-.17-2.3s-.06-1.63-.08-2.47q1.49-.18,3.06-.27c1.05-.07,2.1-.1,3.17-.1,0-.93,0-1.75-.11-2.44a18.5,18.5,0,0,0-.34-2,21.7,21.7,0,0,0-2.92.19,19.5,19.5,0,0,0-2.86.62c0-1.07,0-1.87.05-2.4s0-1,.09-1.42c1.21-.07,2.39-.13,3.51-.16s2.2-.06,3.25-.06A20.56,20.56,0,0,0,142,4.83a19.15,19.15,0,0,0,.13-2.2,55.58,55.58,0,0,0-6.25.35c-2.12.23-4.63.62-7.51,1.16q.06,4,.63,9.91c.39,4,.81,7.44,1.28,10.42,2,0,4.41-.12,7.34-.34a37,37,0,0,0,5.21-.59,19.88,19.88,0,0,0-.16-2.43,8.59,8.59,0,0,0-.37-1.92Z"/>
                <path class="cls-1" d="M157,11.89q1.72-2.16,2.95-3.82c.83-1.1,1.56-2.16,2.22-3.17A9.76,9.76,0,0,0,160.4,3a9.62,9.62,0,0,0-2.13-1.4c-.53,1-1.09,1.95-1.69,2.94s-1.27,2-2,3.15c-.71-1.14-1.44-2.28-2.19-3.4S150.85,2.08,150,1a15.86,15.86,0,0,0-2.71,1.35,19.56,19.56,0,0,0-2.57,1.88Q146.37,6,147.85,8c1,1.32,2,2.73,3,4.25-.58.79-1.19,1.58-1.83,2.39s-2.26,2.78-4.88,5.95a10.68,10.68,0,0,0,1.35,1.5A10.94,10.94,0,0,0,147,23.32q1.74-1.77,3.21-3.42c1-1.09,2-2.28,3.05-3.57.56,1,1.16,2.12,1.8,3.35s1.49,2.94,2.58,5.15A25.27,25.27,0,0,0,160,23.46a8.81,8.81,0,0,0,1.61-1.32c-.69-1.82-1.42-3.57-2.18-5.27s-1.6-3.35-2.48-5Z"/>
                <path class="cls-1" d="M175.73,13.66a8.41,8.41,0,0,0-1.1-1.26,20.35,20.35,0,0,0-2-1.66,11.73,11.73,0,0,1-2.47-2.27,3.19,3.19,0,0,1-.56-1.77,1.53,1.53,0,0,1,.38-1.08,1.33,1.33,0,0,1,1-.41,1.93,1.93,0,0,1,1.63.76,5.25,5.25,0,0,1,.84,2.5a14.43,14.43,0,0,0,2.73-.41A6.64,6.64,0,0,0,178,7.23a6.74,6.74,0,0,0-2.32-4.11A7.23,7.23,0,0,0,171,1.73a7.69,7.69,0,0,0-5.27,1.77,5.83,5.83,0,0,0-2,4.57a6.91,6.91,0,0,0,.34,2.21a7.42,7.42,0,0,0,1,2,10.78,10.78,0,0,0,1.15,1.26a26.14,26.14,0,0,0,2.07,1.71a12.65,12.65,0,0,1,2.43,2.2,2.71,2.71,0,0,1,.55,1.59,2.06,2.06,0,0,1-.53,1.5,2,2,0,0,1-1.52.55,2.42,2.42,0,0,1-2.17-1.31,6.43,6.43,0,0,1-.81-3.43a8.78,8.78,0,0,0-2.12.32,10.48,10.48,0,0,0-2.17.77a6.45,6.45,0,0,0,2.23,4.9,7.93,7.93,0,0,0,5.57,2.06,7.31,7.31,0,0,0,5.11-1.89A6.18,6.18,0,0,0,177,17.7a7.12,7.12,0,0,0-.31-2.15,6.71,6.71,0,0,0-1-1.89Z"/>
                <path class="cls-2" d="M24.28,12a1.43,1.43,0,0,1,.44,2.44l-8.11,6.84-8.1,6.85a1.43,1.43,0,0,1-2.33-.85L4.3,16.84,2.43,6.4A1.43,1.43,0,0,1,4.32,4.8l10,3.59Z"/>
                <path class="cls-1" d="M29.4,13.7a1.62,1.62,0,0,1,0,2.81L19,22.5l-10.39,6a1.62,1.62,0,0,1-2.43-1.4v-24a1.62,1.62,0,0,1,2.43-1.4L19,7.7Z"/>
                <path class="cls-3" d="M17.5,8.84l-2.33.74c-1.12.36-2,.63-2.63.82-.92.28-1.78.52-2.58.74s-1.61.41-2.41.59C8.22,13.68,9,16.3,9.72,19.6s1.37,6.23,1.79,8.8a18.88,18.88,0,0,0,2-.44,14.36,14.36,0,0,0,1.8-.64c-.08-1-.2-2-.34-3.2s-.31-2.38-.5-3.69c.55-.16,1.14-.3,1.76-.43s1.31-.26,2.07-.38q-.2-1.15-.39-1.92a8.8,8.8,0,0,0-.5-1.42,16.83,16.83,0,0,0-1.74.38,14.8,14.8,0,0,0-1.73.6c-.1-.59-.2-1.18-.32-1.78s-.24-1.18-.37-1.76L15,13.26l3-.82a8.59,8.59,0,0,0,0-1,6.88,6.88,0,0,0-.08-.83q-.09-.54-.21-1a6.18,6.18,0,0,0-.29-.78Z"/>
            </svg>
        `;
        
        brandingContainer.innerHTML = logoSvg;
        
        // Add click handler to redirect to flicknexs.com
        brandingContainer.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            // Open flicknexs.com in a new tab/window
            const link = document.createElement('a');
            link.href = 'https://flicknexs.com/';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Emit analytics event
            this.emit('frameworkBrandingClick', {
                timestamp: Date.now(),
                url: 'https://flicknexs.com/',
                userAgent: navigator.userAgent
            });
        });
        
        container.appendChild(brandingContainer);
        
        this.debugLog('Framework branding added');
    }

  /**
   * Create navigation buttons (back/close) based on configuration
   */
  private createNavigationButtons(container: HTMLElement): void {
    const navigationConfig = (this.config as any).navigation;
    if (!navigationConfig) return;

    const { backButton, closeButton } = navigationConfig;

    // Back button
    if (backButton?.enabled) {
      const backBtn = document.createElement('button');
      backBtn.className = 'uvf-control-btn uvf-nav-btn';
      backBtn.id = 'uvf-back-btn';
      backBtn.title = backButton.title || 'Back';
      backBtn.setAttribute('aria-label', backButton.ariaLabel || 'Go back');
      
      // Get icon based on config
      const backIcon = this.getNavigationIcon(backButton.icon || 'arrow', backButton.customIcon);
      backBtn.innerHTML = backIcon;
      
      // Add click handler
      backBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (backButton.onClick) {
          await backButton.onClick();
        } else if (backButton.href) {
          if (backButton.replace) {
            window.history.replaceState(null, '', backButton.href);
          } else {
            window.location.href = backButton.href;
          }
        } else {
          // Default: go back in history
          window.history.back();
        }
        
        this.emit('navigationBackClicked');
      });
      
      container.appendChild(backBtn);
    }

    // Close button
    if (closeButton?.enabled) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'uvf-control-btn uvf-nav-btn';
      closeBtn.id = 'uvf-close-btn';
      closeBtn.title = closeButton.title || 'Close';
      closeBtn.setAttribute('aria-label', closeButton.ariaLabel || 'Close player');
      
      // Get icon based on config
      const closeIcon = this.getNavigationIcon(closeButton.icon || 'x', closeButton.customIcon);
      closeBtn.innerHTML = closeIcon;
      
      // Add click handler
      closeBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (closeButton.onClick) {
          await closeButton.onClick();
        } else {
          // Default behaviors
          if (closeButton.exitFullscreen && this.isFullscreen()) {
            await this.exitFullscreen();
          }
          
          if (closeButton.closeModal) {
            // Hide player or remove from DOM
            const playerWrapper = this.container?.querySelector('.uvf-player-wrapper') as HTMLElement;
            if (playerWrapper) {
              playerWrapper.style.display = 'none';
            }
          }
        }
        
        this.emit('navigationCloseClicked');
      });
      
      container.appendChild(closeBtn);
    }
  }

  /**
   * Get navigation icon SVG based on type
   */
  private getNavigationIcon(iconType: string, customIcon?: string): string {
    if (customIcon) {
      // If it's a URL, create img tag, otherwise assume it's SVG
      if (customIcon.startsWith('http') || customIcon.includes('.')) {
        return `<img src="${customIcon}" alt="" style="width: 20px; height: 20px;" />`;
      }
      return customIcon;
    }

    switch (iconType) {
      case 'arrow':
        return `<svg viewBox="0 0 24 24">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z" fill="currentColor"/>
        </svg>`;
      
      case 'chevron':
        return `<svg viewBox="0 0 24 24">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor"/>
        </svg>`;
      
      case 'x':
        return `<svg viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
        </svg>`;
      
      case 'close':
        return `<svg viewBox="0 0 24 24">
          <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" fill="currentColor"/>
        </svg>`;
      
      default:
        return `<svg viewBox="0 0 24 24">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z" fill="currentColor"/>
        </svg>`;
    }
  }

  private createCustomControls(container: HTMLElement): void {
    // Add gradients
    const topGradient = document.createElement('div');
    topGradient.className = 'uvf-top-gradient';
    container.appendChild(topGradient);

    const controlsGradient = document.createElement('div');
    controlsGradient.className = 'uvf-controls-gradient';
    container.appendChild(controlsGradient);
    
    // Combined top bar: navigation buttons → title → controls
    const topBar = document.createElement('div');
    topBar.className = 'uvf-top-bar';
    
    // Left side container for navigation + title
    const leftSide = document.createElement('div');
    leftSide.className = 'uvf-left-side';
    
    // Navigation buttons (back/close)
    const navigationControls = document.createElement('div');
    navigationControls.className = 'uvf-navigation-controls';
    this.createNavigationButtons(navigationControls);
    leftSide.appendChild(navigationControls);
    
    // Title bar (after navigation buttons)
    const titleBar = document.createElement('div');
    titleBar.className = 'uvf-title-bar';
    titleBar.innerHTML = `
      <div class="uvf-title-content">
        <div class="uvf-title-text">
          <div class=\"uvf-video-title\" id=\"uvf-video-title\" style=\"display:none;\"></div>
          <div class=\"uvf-video-subtitle\" id=\"uvf-video-description\" style=\"display:none;\"></div>
        </div>
      </div>
    `;
    leftSide.appendChild(titleBar);
    
    topBar.appendChild(leftSide);
    
    // Top controls (right side - Cast and Share buttons)
    const topControls = document.createElement('div');
    topControls.className = 'uvf-top-controls';
    topControls.innerHTML = `
      <button class="uvf-control-btn" id="uvf-cast-btn" title="Cast" aria-label="Cast">
        <svg viewBox="0 0 24 24">
          <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
        </svg>
      </button>
      <button class="uvf-pill-btn uvf-stop-cast-btn" id="uvf-stop-cast-btn" title="Stop Casting" aria-label="Stop Casting" style="display: none;">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6h12v12H6z"/>
        </svg>
        <span>Stop Casting</span>
      </button>
      <button class="uvf-control-btn" id="uvf-share-btn" title="Share" aria-label="Share">
        <svg viewBox="0 0 24 24">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
        </svg>
      </button>
    `;
    topBar.appendChild(topControls);
    
    container.appendChild(topBar);

    // Add loading spinner
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'uvf-loading-container';
    loadingContainer.id = 'uvf-loading';
    loadingContainer.innerHTML = '<div class="uvf-loading-spinner"></div>';
    container.appendChild(loadingContainer);

    // Add center play button container for proper responsive centering
    const centerPlayContainer = document.createElement('div');
    centerPlayContainer.className = 'uvf-center-play-container';
    
    const centerPlayBtn = document.createElement('div');
    centerPlayBtn.className = 'uvf-center-play-btn uvf-pulse';
    centerPlayBtn.id = 'uvf-center-play';
    centerPlayBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" stroke="currentColor" stroke-width="0.5" fill="currentColor"/></svg>';
    
    centerPlayContainer.appendChild(centerPlayBtn);
    container.appendChild(centerPlayContainer);
    
    // Add shortcut indicator
    const shortcutIndicator = document.createElement('div');
    shortcutIndicator.className = 'uvf-shortcut-indicator';
    shortcutIndicator.id = 'uvf-shortcut-indicator';
    container.appendChild(shortcutIndicator);

    // Create controls bar
    const controlsBar = document.createElement('div');
    controlsBar.className = 'uvf-controls-bar';
    controlsBar.id = 'uvf-controls';
    
    // Time and branding section above seekbar
    const aboveSeekbarSection = document.createElement('div');
    aboveSeekbarSection.className = 'uvf-above-seekbar-section';
    
    // Time display (moved to above seekbar)
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'uvf-time-display uvf-above-seekbar';
    timeDisplay.id = 'uvf-time-display';
    timeDisplay.textContent = '00:00 / 00:00';
    aboveSeekbarSection.appendChild(timeDisplay);

    // Add framework branding next to time display if enabled
    if ((this.config as any).showFrameworkBranding !== false) {
      this.createFrameworkBranding(aboveSeekbarSection);
    }
    
    // Progress section
    const progressSection = document.createElement('div');
    progressSection.className = 'uvf-progress-section';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'uvf-progress-bar-wrapper';
    progressBar.id = 'uvf-progress-bar';
    progressBar.innerHTML = `
      <div class="uvf-progress-bar">
        <div class="uvf-progress-buffered" id="uvf-progress-buffered"></div>
        <div class="uvf-progress-filled" id="uvf-progress-filled"></div>
        <div class="uvf-progress-handle" id="uvf-progress-handle"></div>
      </div>
      <div class="uvf-time-tooltip" id="uvf-time-tooltip">00:00</div>
    `;
    progressSection.appendChild(progressBar);
    
    // Controls row
    const controlsRow = document.createElement('div');
    controlsRow.className = 'uvf-controls-row';
    
    // Play/Pause button
    const playPauseBtn = document.createElement('button');
    playPauseBtn.className = 'uvf-control-btn play-pause';
    playPauseBtn.id = 'uvf-play-pause';
    playPauseBtn.innerHTML = `
      <svg viewBox="0 0 24 24" id="uvf-play-icon">
        <path d="M8 5v14l11-7z" stroke="currentColor" stroke-width="0.5" fill="currentColor"/>
      </svg>
      <svg viewBox="0 0 24 24" id="uvf-pause-icon" style="display: none;">
        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" stroke="currentColor" stroke-width="0.5" fill="currentColor"/>
      </svg>
    `;
    controlsRow.appendChild(playPauseBtn);
    
    // Skip buttons with consistent icons
    const skipBackBtn = document.createElement('button');
    skipBackBtn.className = 'uvf-control-btn';
    skipBackBtn.id = 'uvf-skip-back';
    skipBackBtn.setAttribute('title', 'Skip backward 10s');
    skipBackBtn.setAttribute('aria-label', 'Skip backward 10 seconds');
    skipBackBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" stroke="currentColor" stroke-width="0.5" fill="currentColor"/></svg>';
    controlsRow.appendChild(skipBackBtn);
    
    const skipForwardBtn = document.createElement('button');
    skipForwardBtn.className = 'uvf-control-btn';
    skipForwardBtn.id = 'uvf-skip-forward';
    skipForwardBtn.setAttribute('title', 'Skip forward 10s');
    skipForwardBtn.setAttribute('aria-label', 'Skip forward 10 seconds');
    skipForwardBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" stroke="currentColor" stroke-width="0.5" fill="currentColor"/></svg>';
    controlsRow.appendChild(skipForwardBtn);
    
    // Volume control
    const volumeControl = document.createElement('div');
    volumeControl.className = 'uvf-volume-control';
    volumeControl.innerHTML = `
      <button class="uvf-control-btn" id="uvf-volume-btn">
        <svg viewBox="0 0 24 24" id="uvf-volume-icon">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" stroke="currentColor" stroke-width="0.5" fill="currentColor"/>
        </svg>
        <svg viewBox="0 0 24 24" id="uvf-mute-icon" style="display: none;">
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" stroke="currentColor" stroke-width="0.5" fill="currentColor"/>
        </svg>
      </button>
      <div class="uvf-volume-panel" id="uvf-volume-panel">
        <div class="uvf-volume-slider" id="uvf-volume-slider">
          <div class="uvf-volume-fill" id="uvf-volume-fill" style="width: 100%;"></div>
        </div>
        <div class="uvf-volume-value" id="uvf-volume-value">100</div>
      </div>
    `;
    controlsRow.appendChild(volumeControl);
    
    // Right controls
    const rightControls = document.createElement('div');
    rightControls.className = 'uvf-right-controls';
    
    // Quality badge
    const qualityBadge = document.createElement('div');
    qualityBadge.className = 'uvf-quality-badge';
    qualityBadge.id = 'uvf-quality-badge';
    qualityBadge.textContent = 'HD';
    rightControls.appendChild(qualityBadge);
    
    // Settings button with menu (show only if enabled)
    this.debugLog('Settings config check:', this.settingsConfig);
    this.debugLog('Settings enabled:', this.settingsConfig.enabled);
    this.debugLog('Custom controls enabled:', this.useCustomControls);
    
    if (this.settingsConfig.enabled) {
      this.debugLog('Creating settings button...');
      const settingsContainer = document.createElement('div');
      settingsContainer.className = 'uvf-settings-container';
      settingsContainer.style.position = 'relative';
      settingsContainer.style.display = 'flex';
      settingsContainer.style.alignItems = 'center';
      settingsContainer.style.justifyContent = 'center';
      
      const settingsBtn = document.createElement('button');
      settingsBtn.className = 'uvf-control-btn';
      settingsBtn.id = 'uvf-settings-btn';
      settingsBtn.setAttribute('title', 'Settings');
      settingsBtn.setAttribute('aria-label', 'Settings');
      settingsBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>';
      settingsContainer.appendChild(settingsBtn);
      
      // Settings menu - will be populated dynamically based on video capabilities and configuration
      const settingsMenu = document.createElement('div');
      settingsMenu.className = 'uvf-settings-menu';
      settingsMenu.id = 'uvf-settings-menu';
      // Initially empty - will be populated by updateSettingsMenu method
      settingsMenu.innerHTML = '';
      // CSS handles initial hidden state
      settingsContainer.appendChild(settingsMenu);
      rightControls.appendChild(settingsContainer);
      
      this.debugLog('Settings button created and added to controls');
      
      // Add debugging for settings button visibility
      setTimeout(() => {
        const createdBtn = document.getElementById('uvf-settings-btn');
        if (createdBtn) {
          const computedStyle = window.getComputedStyle(createdBtn);
          this.debugLog('Settings button found after creation:');
          this.debugLog('- Display:', computedStyle.display);
          this.debugLog('- Visibility:', computedStyle.visibility);
          this.debugLog('- Opacity:', computedStyle.opacity);
          this.debugLog('- Width:', computedStyle.width);
          this.debugLog('- Height:', computedStyle.height);
          this.debugLog('- Position:', computedStyle.position);
          this.debugLog('- Z-index:', computedStyle.zIndex);
          
          const rect = createdBtn.getBoundingClientRect();
          this.debugLog('- Bounding rect:', { width: rect.width, height: rect.height, top: rect.top, left: rect.left });
          
          // Check parent containers
          const settingsContainer = createdBtn.closest('.uvf-settings-container');
          if (settingsContainer) {
            const containerStyle = window.getComputedStyle(settingsContainer);
            const containerRect = settingsContainer.getBoundingClientRect();
            this.debugLog('Settings container display:', containerStyle.display);
            this.debugLog('Settings container visibility:', containerStyle.visibility);
            this.debugLog('Settings container rect:', { width: containerRect.width, height: containerRect.height, top: containerRect.top, left: containerRect.left });
          }
          
          const rightControls = createdBtn.closest('.uvf-right-controls');
          if (rightControls) {
            const parentStyle = window.getComputedStyle(rightControls);
            const parentRect = rightControls.getBoundingClientRect();
            this.debugLog('Parent .uvf-right-controls display:', parentStyle.display);
            this.debugLog('Parent .uvf-right-controls visibility:', parentStyle.visibility);
            this.debugLog('Parent .uvf-right-controls rect:', { width: parentRect.width, height: parentRect.height, top: parentRect.top, left: parentRect.left });
          }
        } else {
          this.debugError('Settings button NOT found after creation!');
        }
        
        // Fallback: Force settings button visibility if it's not rendering properly
        setTimeout(() => {
          const btn = document.getElementById('uvf-settings-btn');
          if (btn) {
            const rect = btn.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
              this.debugLog('Settings button has zero dimensions, applying fallback styles...');
              btn.style.display = 'flex';
              btn.style.width = '44px';
              btn.style.height = '44px';
              btn.style.minWidth = '44px';
              btn.style.minHeight = '44px';
              btn.style.backgroundColor = 'rgba(255,255,255,0.15)';
              btn.style.borderRadius = '50%';
              btn.style.alignItems = 'center';
              btn.style.justifyContent = 'center';
              btn.style.border = '1px solid rgba(255,255,255,0.1)';
              btn.style.position = 'relative';
              btn.style.zIndex = '10';
              
              // Also fix the container
              const container = btn.parentElement;
              if (container) {
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'center';
                container.style.minWidth = '44px';
                container.style.minHeight = '44px';
              }
              
              this.debugLog('Fallback styles applied to settings button');
            }
          }
        }, 500);
      }, 100);
    } else {
      this.debugLog('Settings button NOT created - settings disabled');
    }
    
    // EPG button (Electronic Program Guide)
    const epgBtn = document.createElement('button');
    epgBtn.className = 'uvf-control-btn';
    epgBtn.id = 'uvf-epg-btn';
    epgBtn.title = 'Electronic Program Guide (Ctrl+G)';
    epgBtn.innerHTML = `<svg viewBox="0 0 24 24">
      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
      <rect x="17" y="3" width="2" height="2"/>
      <rect x="19" y="3" width="2" height="2"/>
      <path d="M17 1v2h2V1h2v2h1c.55 0 1 .45 1 1v16c0 .55-.45 1-1 1H2c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1h1V1h2v2h12z" fill="none" stroke="currentColor" stroke-width="0.5"/>
    </svg>`;
    epgBtn.style.display = 'none'; // Initially hidden, will be shown when EPG data is available
    rightControls.appendChild(epgBtn);
    
    // PiP button - only show on desktop/supported browsers
    const pipBtn = document.createElement('button');
    pipBtn.className = 'uvf-control-btn';
    pipBtn.id = 'uvf-pip-btn';
    pipBtn.title = 'Picture-in-Picture';
    pipBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z" stroke="currentColor" stroke-width="0.5" fill="currentColor"/></svg>';
    
    // Hide PiP button on mobile devices and browsers that don't support it
    if (this.isMobileDevice() || !this.isPipSupported()) {
      pipBtn.style.display = 'none';
    }
    
    rightControls.appendChild(pipBtn);
    
    // Fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'uvf-control-btn';
    fullscreenBtn.id = 'uvf-fullscreen-btn';
    fullscreenBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" stroke="currentColor" stroke-width="0.5" fill="currentColor"/></svg>';
    rightControls.appendChild(fullscreenBtn);
    
    controlsRow.appendChild(rightControls);
    
    // Assemble controls bar
    controlsBar.appendChild(aboveSeekbarSection);
    controlsBar.appendChild(progressSection);
    controlsBar.appendChild(controlsRow);
    container.appendChild(controlsBar);
    
    this.controlsContainer = controlsBar;
  }

  private setupControlsEventListeners(): void {
    if (!this.useCustomControls || !this.video) return;
    
    const wrapper = this.container?.querySelector('.uvf-player-wrapper') as HTMLElement;
    const centerPlay = document.getElementById('uvf-center-play');
    const playPauseBtn = document.getElementById('uvf-play-pause');
    const skipBackBtn = document.getElementById('uvf-skip-back');
    const skipForwardBtn = document.getElementById('uvf-skip-forward');
    const volumeBtn = document.getElementById('uvf-volume-btn');
    const volumePanel = document.getElementById('uvf-volume-panel');
    const volumeSlider = document.getElementById('uvf-volume-slider');
    const progressBar = document.getElementById('uvf-progress-bar');
    const fullscreenBtn = document.getElementById('uvf-fullscreen-btn');
    const settingsBtn = document.getElementById('uvf-settings-btn');
    
    // Disable right-click context menu
    this.video.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });
    
    wrapper?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });
    
    // Play/Pause
    centerPlay?.addEventListener('click', () => this.togglePlayPause());
    playPauseBtn?.addEventListener('click', () => this.togglePlayPause());
    
    // Video click behavior will be handled by the comprehensive tap system below
    // Desktop click for play/pause
    if (!this.isMobileDevice()) {
      this.video.addEventListener('click', (e) => {
        this.togglePlayPause();
      });
    }
    
    // Update play/pause icons
    this.video.addEventListener('play', () => {
      const playIcon = document.getElementById('uvf-play-icon');
      const pauseIcon = document.getElementById('uvf-pause-icon');
      if (playIcon) playIcon.style.display = 'none';
      if (pauseIcon) pauseIcon.style.display = 'block';
      
      // Hide center play button when playing
      if (centerPlay) {
        centerPlay.classList.add('hidden');
        this.debugLog('Center play button hidden - video playing');
      }
      
      // Schedule hide controls
      setTimeout(() => {
        if (this.state.isPlaying) {
          this.scheduleHideControls();
        }
      }, 1000);
    });
    
    this.video.addEventListener('pause', () => {
      const playIcon = document.getElementById('uvf-play-icon');
      const pauseIcon = document.getElementById('uvf-pause-icon');
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
      
      // Show center play button when paused
      if (centerPlay) {
        centerPlay.classList.remove('hidden');
        this.debugLog('Center play button shown - video paused');
      }
      this.showControls();
    });
    
    // Ensure center play button is visible initially when video is paused/stopped
    this.video.addEventListener('loadeddata', () => {
      if (centerPlay && (this.video?.paused || this.video?.ended)) {
        centerPlay.classList.remove('hidden');
        this.debugLog('Center play button shown - video loaded and paused');
      }
    });
    
    this.video.addEventListener('ended', () => {
      if (centerPlay) {
        centerPlay.classList.remove('hidden');
        this.debugLog('Center play button shown - video ended');
      }
    });
    
    // Skip buttons
    skipBackBtn?.addEventListener('click', () => this.seek(this.video!.currentTime - 10));
    skipForwardBtn?.addEventListener('click', () => this.seek(this.video!.currentTime + 10));
    
    // Volume control
    volumeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMuteAction();
    });
    
    // Volume panel interactions
    volumeBtn?.addEventListener('mouseenter', () => {
      if (this.volumeHideTimeout) clearTimeout(this.volumeHideTimeout);
      volumePanel?.classList.add('active');
    });
    
    volumeBtn?.addEventListener('mouseleave', () => {
      this.volumeHideTimeout = setTimeout(() => {
        if (!volumePanel?.matches(':hover')) {
          volumePanel?.classList.remove('active');
        }
      }, 800);
    });
    
    volumePanel?.addEventListener('mouseenter', () => {
      if (this.volumeHideTimeout) clearTimeout(this.volumeHideTimeout);
      volumePanel.classList.add('active');
    });
    
    volumePanel?.addEventListener('mouseleave', () => {
      if (!this.isVolumeSliding) {
        setTimeout(() => {
          if (!volumePanel.matches(':hover') && !volumeBtn?.matches(':hover')) {
            volumePanel.classList.remove('active');
          }
        }, 1500);
      }
    });
    
    // Volume slider
    volumeSlider?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.isVolumeSliding = true;
      volumePanel?.classList.add('active');
      this.handleVolumeChange(e as MouseEvent);
    });
    
    volumeSlider?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleVolumeChange(e as MouseEvent);
    });
    
    
    // Progress bar interactions
    progressBar?.addEventListener('click', (e) => {
      this.handleProgressChange(e as MouseEvent);
    });
    
    progressBar?.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.showTimeTooltip = true;
      this.handleProgressChange(e as MouseEvent);
      this.updateTimeTooltip(e as MouseEvent);
    });
    
    // Hover tooltip functionality
    progressBar?.addEventListener('mouseenter', () => {
      this.showTimeTooltip = true;
    });
    
    progressBar?.addEventListener('mouseleave', () => {
      if (!this.isDragging) {
        this.showTimeTooltip = false;
        this.hideTimeTooltip();
      }
    });
    
    progressBar?.addEventListener('mousemove', (e) => {
      if (this.showTimeTooltip) {
        this.updateTimeTooltip(e as MouseEvent);
      }
    });
    
    // Touch support for mobile devices
    progressBar?.addEventListener('touchstart', (e) => {
      e.preventDefault(); // Prevent scrolling
      this.isDragging = true;
      const touch = e.touches[0];
      this.handleProgressChange(touch);
    }, { passive: false });
    
    // Global mouse and touch events for enhanced dragging
    document.addEventListener('mousemove', (e) => {
      if (this.isVolumeSliding) {
        this.handleVolumeChange(e);
      }
      if (this.isDragging && progressBar) {
        this.handleProgressChange(e);
        // Update tooltip position during dragging
        this.updateTimeTooltip(e);
      }
    });
    
    document.addEventListener('touchmove', (e) => {
      if (this.isDragging && progressBar) {
        e.preventDefault(); // Prevent scrolling
        const touch = e.touches[0];
        this.handleProgressChange(touch);
      }
    }, { passive: false });
    
    document.addEventListener('mouseup', () => {
      if (this.isVolumeSliding) {
        this.isVolumeSliding = false;
        setTimeout(() => {
          if (!volumePanel?.matches(':hover') && !volumeBtn?.matches(':hover')) {
            volumePanel?.classList.remove('active');
          }
        }, 2000);
      }
      
      if (this.isDragging) {
        this.isDragging = false;
        // Remove dragging class from handle
        const handle = document.getElementById('uvf-progress-handle');
        handle?.classList.remove('dragging');
        // Hide tooltip if mouse is not over progress bar
        if (progressBar && !progressBar.matches(':hover')) {
          this.showTimeTooltip = false;
          this.hideTimeTooltip();
        }
      }
    });
    
    document.addEventListener('touchend', () => {
      if (this.isDragging) {
        this.isDragging = false;
        // Remove dragging class from handle
        const handle = document.getElementById('uvf-progress-handle');
        handle?.classList.remove('dragging');
        // Hide tooltip on touch end
        this.showTimeTooltip = false;
        this.hideTimeTooltip();
      }
    });
    
    // Update progress bar
    this.video.addEventListener('timeupdate', () => {
      const progressFilled = document.getElementById('uvf-progress-filled') as HTMLElement;
      const progressHandle = document.getElementById('uvf-progress-handle') as HTMLElement;
      
      if (this.video && progressFilled) {
        const percent = (this.video.currentTime / this.video.duration) * 100;
        progressFilled.style.width = percent + '%';
        
        // Update handle position (only when not dragging)
        if (progressHandle && !this.isDragging) {
          progressHandle.style.left = percent + '%';
        }
      }
      
      // Update time display using the dedicated method
      this.updateTimeDisplay();
    });
    
    // Update buffered progress
    this.video.addEventListener('progress', () => {
      const progressBuffered = document.getElementById('uvf-progress-buffered') as HTMLElement;
      if (this.video && progressBuffered && this.video.buffered.length > 0) {
        const buffered = (this.video.buffered.end(0) / this.video.duration) * 100;
        progressBuffered.style.width = buffered + '%';
      }
    });
    
    // Update volume display
    this.video.addEventListener('volumechange', () => {
      const volumeFill = document.getElementById('uvf-volume-fill') as HTMLElement;
      const volumeValue = document.getElementById('uvf-volume-value');
      const volumeIcon = document.getElementById('uvf-volume-icon');
      const muteIcon = document.getElementById('uvf-mute-icon');
      
      if (this.video && volumeFill && volumeValue) {
        const percent = Math.round(this.video.volume * 100);
        volumeFill.style.width = percent + '%';
        volumeValue.textContent = String(percent);
      }
      
      if (this.video && volumeIcon && muteIcon) {
        if (this.video.muted || this.video.volume === 0) {
          volumeIcon.style.display = 'none';
          muteIcon.style.display = 'block';
        } else {
          volumeIcon.style.display = 'block';
          muteIcon.style.display = 'none';
          // Hide unmute button when video is unmuted
          this.hideUnmuteButton();
        }
      }
    });
    
    // Fullscreen button with enhanced cross-platform support
    fullscreenBtn?.addEventListener('click', (event) => {
      // Enhanced debugging for all platforms
      const isBrave = this.isBraveBrowser();
      const isPrivate = this.isPrivateWindow();
      const isIOS = this.isIOSDevice();
      const isAndroid = this.isAndroidDevice();
      const isMobile = this.isMobileDevice();
      
      this.debugLog('Fullscreen button clicked:', {
        isBrave,
        isPrivate,
        isIOS,
        isAndroid,
        isMobile,
        isFullscreen: this.isFullscreen(),
        eventTrusted: event.isTrusted,
        eventType: event.type,
        timestamp: Date.now(),
        fullscreenSupported: this.isFullscreenSupported()
      });
      
      // Update user interaction timestamp
      this.lastUserInteraction = Date.now();
      
      // Run permissions check before attempting fullscreen
      this.checkFullscreenPermissions();
      
      if (this.isFullscreen()) {
        this.debugLog('Exiting fullscreen via button');
        this.exitFullscreen().catch(err => {
          this.debugWarn('Exit fullscreen button failed:', err.message);
        });
      } else {
        this.debugLog('Entering fullscreen via button');
        
        // iOS Safari special message
        if (isIOS) {
          this.showShortcutIndicator('Using iOS video fullscreen');
        } else if (isAndroid) {
          this.showShortcutIndicator('Entering fullscreen - rotate to landscape');
        }
        
        // Use enhanced cross-platform fullscreen method
        this.enterFullscreen().catch(err => {
          this.debugWarn('Fullscreen button failed:', err.message);
          
          // Platform-specific error messages
          if (isIOS) {
            this.showTemporaryMessage('iOS: Use device rotation or video controls for fullscreen');
          } else if (isAndroid) {
            this.showTemporaryMessage('Android: Try rotating device to landscape mode');
          } else if (isBrave) {
            this.showTemporaryMessage('Brave Browser: Please allow fullscreen in site settings');
          } else {
            this.showTemporaryMessage('Fullscreen not supported in this browser');
          }
        });
      }
    });
    
    // Update fullscreen button icon based on state
    const updateFullscreenIcon = () => {
      const fullscreenBtn = document.getElementById('uvf-fullscreen-btn');
      if (fullscreenBtn) {
        fullscreenBtn.innerHTML = this.isFullscreen() 
          ? '<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>'
          : '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
      }
    };
    
    // Listen for fullscreen state changes to update icon
    this.on('onFullscreenChanged', updateFullscreenIcon);
    
    // Loading states
    this.video.addEventListener('waiting', () => {
      const loading = document.getElementById('uvf-loading');
      if (loading) loading.classList.add('active');
    });
    
    this.video.addEventListener('canplay', () => {
      const loading = document.getElementById('uvf-loading');
      if (loading) loading.classList.remove('active');
      // Update settings menu when video is ready
      this.updateSettingsMenu();
    });

    this.video.addEventListener('loadedmetadata', () => {
      // Update settings menu when metadata is loaded
      this.updateSettingsMenu();
    });
    
    // Note: Enhanced mouse movement and control visibility handled in setupFullscreenListeners()
    
    this.controlsContainer?.addEventListener('mouseenter', () => {
      if (this.hideControlsTimeout) clearTimeout(this.hideControlsTimeout);
    });
    
    this.controlsContainer?.addEventListener('mouseleave', () => {
      if (this.state.isPlaying) {
        this.scheduleHideControls();
      }
    });
    
    
    // Settings menu - dynamically populated
    const settingsMenu = document.getElementById('uvf-settings-menu');
    this.debugLog('Settings menu element found:', !!settingsMenu);
    this.debugLog('Settings button found:', !!settingsBtn);
    
    settingsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.debugLog('Settings button clicked!');
      this.debugLog('Settings menu before update:', settingsMenu?.innerHTML?.length || 0, 'characters');
      
      // Update the menu content before showing it
      this.updateSettingsMenu();
      
      this.debugLog('Settings menu after update:', settingsMenu?.innerHTML?.length || 0, 'characters');
      this.debugLog('Settings menu classes before toggle:', Array.from(settingsMenu?.classList || []).join(' '));
      
      settingsMenu?.classList.toggle('active');
      
      // Force visibility if menu is active, hide if not active
      if (settingsMenu) {
        if (settingsMenu.classList.contains('active')) {
          settingsMenu.style.display = 'block';
          settingsMenu.style.visibility = 'visible';
          settingsMenu.style.opacity = '1';
          settingsMenu.style.transform = 'translateY(0)';
          settingsMenu.style.zIndex = '9999';
          settingsMenu.style.position = 'absolute';
          settingsMenu.style.bottom = '50px';
          settingsMenu.style.right = '0';
          settingsMenu.style.background = 'rgba(0,0,0,0.9)';
          settingsMenu.style.border = '1px solid rgba(255,255,255,0.2)';
          settingsMenu.style.borderRadius = '8px';
          settingsMenu.style.minWidth = '200px';
          settingsMenu.style.padding = '10px 0';
          this.debugLog('Applied fallback styles to show menu');
        } else {
          settingsMenu.style.display = 'none';
          settingsMenu.style.visibility = 'hidden';
          settingsMenu.style.opacity = '0';
          this.debugLog('Applied fallback styles to hide menu');
        }
      }
      
      this.debugLog('Settings menu classes after toggle:', Array.from(settingsMenu?.classList || []).join(' '));
      this.debugLog('Settings menu computed display:', window.getComputedStyle(settingsMenu || document.body).display);
      this.debugLog('Settings menu computed visibility:', window.getComputedStyle(settingsMenu || document.body).visibility);
      this.debugLog('Settings menu computed opacity:', window.getComputedStyle(settingsMenu || document.body).opacity);
    });
    
    // EPG button
    const epgBtn = document.getElementById('uvf-epg-btn');
    epgBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.debugLog('EPG button clicked');
      // Trigger custom event for EPG toggle
      this.emit('epgToggle', {});
    });
    
    // PiP button
    const pipBtn = document.getElementById('uvf-pip-btn');
    pipBtn?.addEventListener('click', () => this.togglePiP());
    
    // Top control buttons
    const castBtn = document.getElementById('uvf-cast-btn');
    const stopCastBtn = document.getElementById('uvf-stop-cast-btn');
    const shareBtn = document.getElementById('uvf-share-btn');
    
    // Update cast button icon and functionality for iOS (AirPlay)
    if (this.isIOSDevice() && castBtn) {
      castBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M1 18h6v-2H1v2zm0-4h12v-2H1v2zm16.5 4.5c-1.25 0-2.45-.5-3.35-1.41L12 18.5l2.09 2.09c1.8 1.8 4.72 1.8 6.52 0 1.8-1.8 1.8-4.72 0-6.52L12 5.5 3.39 14.11c-1.8 1.8-1.8 4.72 0 6.52.9.9 2.1 1.41 3.35 1.41l6.76-6.76M12 7.91l6.89 6.89c.78.78.78 2.05 0 2.83-.78.78-2.05.78-2.83 0L12 13.57 7.94 17.63c-.78.78-2.05.78-2.83 0-.78-.78-.78-2.05 0-2.83L12 7.91z"/>
        </svg>
      `;
      castBtn.setAttribute('title', 'AirPlay');
      castBtn.setAttribute('aria-label', 'AirPlay');
    }
    
    castBtn?.addEventListener('click', () => this.onCastButtonClick());
    stopCastBtn?.addEventListener('click', () => this.stopCasting());
    shareBtn?.addEventListener('click', () => this.shareVideo());
    
    // Hide settings menu when clicking outside or pressing Escape
    document.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('#uvf-settings-btn') && 
          !(e.target as HTMLElement).closest('#uvf-settings-menu')) {
        this.hideSettingsMenu();
      }
    });
    
    // Add Escape key handler for settings menu
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && settingsMenu?.classList.contains('active')) {
        this.hideSettingsMenu();
      }
    });
  }
  
  protected setupKeyboardShortcuts(): void {
    // Add keyboard event listener to both document and player wrapper for better coverage
    const handleKeydown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      // Debug logging
      this.debugLog('Keyboard event:', e.key, 'target:', target.tagName);
      
      let shortcutText = '';
      
      // Update interaction timestamp
      this.lastUserInteraction = Date.now();
      
      switch(e.key) {
        case ' ':
        case 'Spacebar': // For older browsers
        case 'k':
          e.preventDefault();
          e.stopPropagation();
          this.debugLog('Space/K pressed, current state:', {
            isPlaying: this.state.isPlaying,
            videoPaused: this.video?.paused,
            videoExists: !!this.video
          });
          
          // Determine what action we're about to take based on current video state
          const willPlay = this.video?.paused || false;
          this.debugLog('Will perform action:', willPlay ? 'PLAY' : 'PAUSE');
          
          this.togglePlayPause();
          
          // Show the action we're taking, not the current state
          shortcutText = willPlay ? 'Play' : 'Pause';
          this.debugLog('Showing icon:', shortcutText);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          e.stopImmediatePropagation(); // Prevent duplicate handler triggers
          this.seek(Math.max(0, this.video!.currentTime - 10));
          shortcutText = '-10s';
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.stopImmediatePropagation(); // Prevent duplicate handler triggers
          this.seek(Math.min(this.video!.duration, this.video!.currentTime + 10));
          shortcutText = '+10s';
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.changeVolume(0.1);
          if (this.isCasting && this.remotePlayer) {
            shortcutText = `Volume ${Math.round(((this.remotePlayer.volumeLevel || 0) * 100))}%`;
          } else {
            shortcutText = `Volume ${Math.round((this.video?.volume || 0) * 100)}%`;
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.changeVolume(-0.1);
          if (this.isCasting && this.remotePlayer) {
            shortcutText = `Volume ${Math.round(((this.remotePlayer.volumeLevel || 0) * 100))}%`;
          } else {
            shortcutText = `Volume ${Math.round((this.video?.volume || 0) * 100)}%`;
          }
          break;
        case 'm':
          e.preventDefault();
          this.toggleMuteAction();
          if (this.isCasting && this.remotePlayer) {
            shortcutText = this.remotePlayer.isMuted ? 'Muted' : 'Unmuted';
          } else {
            shortcutText = this.video?.muted ? 'Muted' : 'Unmuted';
          }
          break;
        case 'f':
          e.preventDefault();
          
          if (!document.fullscreenElement) {
            // Always use the fullscreen button for maximum reliability
            this.triggerFullscreenButton();
          } else {
            // Exit fullscreen - this usually works fine
            this.exitFullscreen().catch(err => {
              this.debugWarn('Exit fullscreen shortcut failed:', err.message);
            });
            this.showShortcutIndicator('Exit Fullscreen');
          }
          break;
        case 'p':
          e.preventDefault();
          this.togglePiP();
          shortcutText = 'Picture-in-Picture';
          break;
        case 'g':
          e.preventDefault();
          this.debugLog('G key pressed - toggling EPG');
          this.emit('epgToggle', {});
          shortcutText = 'Toggle EPG';
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          const percent = parseInt(e.key) * 10;
          if (this.video) {
            this.video.currentTime = (this.video.duration * percent) / 100;
            shortcutText = `${percent}%`;
          }
          break;
      }
      
      if (shortcutText) {
        this.debugLog('Showing shortcut indicator:', shortcutText);
        this.showShortcutIndicator(shortcutText);
      }
    };
    
    // Add event listeners to multiple targets for better coverage
    document.addEventListener('keydown', handleKeydown, { capture: true });
    
    // Also add to the player wrapper if it exists
    if (this.playerWrapper) {
      this.playerWrapper.addEventListener('keydown', handleKeydown);
      this.playerWrapper.setAttribute('tabindex', '0'); // Make it focusable
      
      // Add visual feedback when player is focused for better UX
      this.playerWrapper.addEventListener('focus', () => {
        this.debugLog('Player focused - keyboard shortcuts available');
      });
      
      // Auto-focus the player when clicked to enable keyboard shortcuts
      this.playerWrapper.addEventListener('click', (e) => {
        // Don't focus if clicking on a control button
        const target = e.target as HTMLElement;
        if (!target.closest('.uvf-controls')) {
          this.playerWrapper?.focus();
          // Also store the click event for potential fullscreen use
          this.lastUserInteraction = Date.now();
        }
      });
      
      // Also focus on any interaction with the video area
      this.playerWrapper.addEventListener('mousedown', () => {
        this.playerWrapper?.focus();
        this.lastUserInteraction = Date.now();
      });
      
      // Advanced tap handling system for mobile
      this.setupAdvancedTapHandling();
    }
    
    // Add to the video element
    if (this.video) {
      this.video.addEventListener('keydown', handleKeydown);
    }
  }

  protected setupWatermark(): void {
    if (!this.watermarkCanvas) return;
    
    // Get watermark configuration
    const watermarkConfig = (this.config as any).watermark;
    
    // Check if watermark is disabled or not configured
    if (!watermarkConfig || watermarkConfig.enabled === false) {
      this.debugLog('Watermark disabled or not configured');
      return;
    }
    
    // If watermark config exists but enabled is not explicitly set, default to disabled
    if (watermarkConfig.enabled !== true) {
      this.debugLog('Watermark not explicitly enabled');
      return;
    }
    
    const ctx = this.watermarkCanvas.getContext('2d');
    if (!ctx) return;
    
    // Default configuration values
    const config = {
      text: watermarkConfig.text || 'PREMIUM',
      showTime: watermarkConfig.showTime !== false, // default true
      updateInterval: watermarkConfig.updateInterval || 5000,
      randomPosition: watermarkConfig.randomPosition !== false, // default true
      position: watermarkConfig.position || {},
      style: {
        fontSize: watermarkConfig.style?.fontSize || 14,
        fontFamily: watermarkConfig.style?.fontFamily || 'Arial',
        opacity: watermarkConfig.style?.opacity ?? 0.3,
        color: watermarkConfig.style?.color,
        gradientColors: watermarkConfig.style?.gradientColors || ['#ff0000', '#ff4d4f']
      }
    };
    
    this.debugLog('Watermark configuration:', config);
    
    const renderWatermark = () => {
      const container = this.watermarkCanvas!.parentElement;
      if (!container) return;
      
      this.watermarkCanvas!.width = container.offsetWidth;
      this.watermarkCanvas!.height = container.offsetHeight;
      
      ctx.clearRect(0, 0, this.watermarkCanvas!.width, this.watermarkCanvas!.height);
      
      // Build watermark text
      let text = config.text;
      if (config.showTime) {
        const timeStr = new Date().toLocaleTimeString();
        text += ` • ${timeStr}`;
      }
      
      // Set up styling
      ctx.save();
      ctx.globalAlpha = config.style.opacity;
      ctx.font = `${config.style.fontSize}px ${config.style.fontFamily}`;
      ctx.textAlign = 'left';
      
      // Set fill style
      if (config.style.color) {
        // Use solid color
        ctx.fillStyle = config.style.color;
      } else {
        // Use gradient (default or custom)
        const wrapper = this.playerWrapper as HTMLElement | null;
        let c1 = config.style.gradientColors[0];
        let c2 = config.style.gradientColors[1];
        
        // Try to get theme colors if using defaults
        if (!watermarkConfig.style?.gradientColors) {
          try {
            if (wrapper) {
              const styles = getComputedStyle(wrapper);
              const v1 = styles.getPropertyValue('--uvf-accent-1').trim();
              const v2 = styles.getPropertyValue('--uvf-accent-2').trim();
              if (v1) c1 = v1;
              if (v2) c2 = v2;
            }
          } catch (_) {}
        }
        
        const gradient = ctx.createLinearGradient(0, 0, 200, 0);
        gradient.addColorStop(0, c1);
        gradient.addColorStop(1, c2);
        ctx.fillStyle = gradient;
      }
      
      // Calculate position
      let x: number, y: number;
      
      if (config.randomPosition) {
        // Random position (default behavior)
        x = 20 + Math.random() * Math.max(0, this.watermarkCanvas!.width - 200);
        y = 40 + Math.random() * Math.max(0, this.watermarkCanvas!.height - 80);
      } else {
        // Fixed or calculated position
        const posX = config.position.x;
        const posY = config.position.y;
        
        // Calculate X position
        if (typeof posX === 'number') {
          x = posX;
        } else {
          switch (posX) {
            case 'left':
              x = 20;
              break;
            case 'center':
              x = this.watermarkCanvas!.width / 2;
              ctx.textAlign = 'center';
              break;
            case 'right':
              x = this.watermarkCanvas!.width - 20;
              ctx.textAlign = 'right';
              break;
            case 'random':
              x = 20 + Math.random() * Math.max(0, this.watermarkCanvas!.width - 200);
              break;
            default:
              x = 20; // default left
          }
        }
        
        // Calculate Y position
        if (typeof posY === 'number') {
          y = posY;
        } else {
          switch (posY) {
            case 'top':
              y = 40;
              break;
            case 'center':
              y = this.watermarkCanvas!.height / 2;
              break;
            case 'bottom':
              y = this.watermarkCanvas!.height - 20;
              break;
            case 'random':
              y = 40 + Math.random() * Math.max(0, this.watermarkCanvas!.height - 80);
              break;
            default:
              y = 40; // default top
          }
        }
      }
      
      // Render the watermark
      ctx.fillText(text, x, y);
      ctx.restore();
      
      this.debugLog('Watermark rendered:', { text, x, y });
    };
    
    // Set up interval with configured frequency
    setInterval(renderWatermark, config.updateInterval);
    renderWatermark(); // Render immediately
    
    this.debugLog('Watermark setup complete with update interval:', config.updateInterval + 'ms');
  }

  public setPaywallConfig(config: any) {
    try {
      if (!config) return;
      if (this.paywallController && typeof this.paywallController.updateConfig === 'function') {
        this.paywallController.updateConfig(config);
      } else {
        // lazy-init if not created yet
        if (config.enabled) {
          import('./paywall/PaywallController').then((m: any) => {
            this.paywallController = new m.PaywallController(config, {
              getOverlayContainer: () => this.playerWrapper,
              onResume: (accessInfo?: any) => { 
                try { 
                  // Reset preview gate after successful auth/payment
                  this.previewGateHit = false;
                  this.paymentSuccessTime = Date.now();
                  
                  // Check if access was granted via email auth
                  if (accessInfo && (accessInfo.accessGranted || accessInfo.paymentSuccessful)) {
                    this.paymentSuccessful = true;
                    this.debugLog('Access granted via email auth - preview gate permanently disabled, resuming playback');
                  } else {
                    this.paymentSuccessful = true;
                    this.debugLog('Payment successful (via setPaywallConfig) - preview gate permanently disabled, resuming playback');
                  }
                  
                  this.play(); 
                } catch(_) {} 
              },
              onShow: () => {
                // Use safe pause method to avoid race conditions
                try { this.requestPause(); } catch(_) {}
              },
              onClose: () => {
                // Resume video if auth was successful
              }
            });
          }).catch(() => {});
        }
      }
    } catch (_) {}
  }

  private togglePlayPause(): void {
    this.debugLog('togglePlayPause called, video state:', {
      videoExists: !!this.video,
      videoPaused: this.video?.paused,
      playerState: this.state
    });
    
    if (!this.video) {
      this.debugError('No video element available for toggle');
      return;
    }
    
    if (this.video.paused) {
      this.debugLog('Video is paused, calling play()');
      this.play();
    } else {
      this.debugLog('Video is playing, calling pause()');
      this.pause();
    }
  }

  // Enforce free preview gate for local or casting playback
  private enforceFreePreviewGate(current: number, fromSeek: boolean = false): void {
    try {
      const lim = Number(this.config.freeDuration || 0);
      if (!(lim > 0)) return;
      if (this.previewGateHit && !fromSeek) return;
      
      // Don't trigger gate if payment was successful for this session
      if (this.paymentSuccessful) {
        this.debugLog('Skipping preview gate - payment was successful, access granted permanently for this session');
        return;
      }
      
      // Don't trigger gate if payment was successful recently (within 5 seconds)
      const timeSincePayment = Date.now() - this.paymentSuccessTime;
      if (this.paymentSuccessTime > 0 && timeSincePayment < 5000) {
        this.debugLog('Skipping preview gate - recent payment success:', timeSincePayment + 'ms ago');
        return;
      }
      
      if (current >= lim - 0.01 && !this.previewGateHit) {
        this.previewGateHit = true;
        this.showNotification('Free preview ended.');
        this.emit('onFreePreviewEnded');
        
        // Trigger paywall controller which will handle auth/payment flow
        this.debugLog('Free preview gate hit, paywallController exists:', !!this.paywallController);
        if (this.paywallController) {
          this.debugLog('Calling paywallController.openOverlay() directly');
          this.paywallController.openOverlay();
        } else {
          this.debugLog('No paywallController available');
        }
      }
      if (current >= lim - 0.01) {
        if (this.isCasting && this.remoteController) {
          try {
            if (this.remotePlayer && this.remotePlayer.isPaused === false) {
              this.remoteController.playOrPause();
            }
          } catch (_) {}
        } else if (this.video) {
          try { 
            // Use deferred pause to avoid race conditions
            this.requestPause(); 
            if (fromSeek || ((this.video.currentTime || 0) > lim)) {
              this.video.currentTime = Math.max(0, lim - 0.1);
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // Public runtime controls for free preview
  public setFreeDuration(seconds: number): void {
    try {
      const s = Math.max(0, Number(seconds) || 0);
      (this.config as any).freeDuration = s;
      // Reset gate if we extended duration below current gate (but don't reset if payment was successful)
      if (!this.paymentSuccessful && (s === 0 || (this.video && (this.video.currentTime || 0) < s))) {
        this.previewGateHit = false;
      }
      // If already past new limit, enforce immediately (but not if payment was successful)
      if (!this.paymentSuccessful) {
        const cur = this.video ? (this.video.currentTime || 0) : 0;
        this.enforceFreePreviewGate(cur, true);
      }
    } catch (_) {}
  }
  public resetFreePreviewGate(): void {
    // Only reset if payment hasn't been successful
    if (!this.paymentSuccessful) {
      this.previewGateHit = false;
    }
  }
  
  public resetPaymentStatus(): void {
    this.paymentSuccessful = false;
    this.paymentSuccessTime = 0;
    this.previewGateHit = false;
    this.debugLog('Payment status reset - preview gate re-enabled');
  }

  private toggleMuteAction(): void {
    if (this.isCasting && this.remoteController) {
      try { this.remoteController.muteOrUnmute(); } catch (_) {}
      return;
    }
    if (this.video?.muted) {
      this.unmute();
    } else {
      this.mute();
    }
  }

  /**
   * Detect if user is on a mobile device
   */
  private isMobileDevice(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone', 'mobile'];
    const isMobileUserAgent = mobileKeywords.some(keyword => userAgent.includes(keyword));
    const isSmallScreen = window.innerWidth <= 768;
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    return isMobileUserAgent || (isSmallScreen && hasTouchScreen);
  }

  /**
   * Check if Picture-in-Picture is supported by the browser
   */
  private isPipSupported(): boolean {
    return !!(
      document.pictureInPictureEnabled &&
      HTMLVideoElement.prototype.requestPictureInPicture &&
      typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function'
    );
  }

  /**
   * Detect if user is on iOS device
   */
  private isIOSDevice(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  }

  /**
   * Detect if user is on Android device
   */
  private isAndroidDevice(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    return /android/.test(userAgent);
  }

  /**
   * Check if fullscreen is supported on current platform
   */
  private isFullscreenSupported(): boolean {
    return !!(
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled
    );
  }

  /**
   * Lock screen orientation to landscape when entering fullscreen
   */
  private async lockOrientationLandscape(): Promise<void> {
    try {
      // Only attempt orientation lock on mobile devices
      if (!this.isMobileDevice()) {
        this.debugLog('Skipping orientation lock - not a mobile device');
        return;
      }

      // Check if Screen Orientation API is supported
      const screenOrientation = screen.orientation as any;
      if (screenOrientation && typeof screenOrientation.lock === 'function') {
        try {
          // Try to lock to landscape orientation
          await screenOrientation.lock('landscape');
          this.debugLog('Screen orientation locked to landscape');
        } catch (error) {
          this.debugWarn('Failed to lock orientation to landscape:', (error as Error).message);
          // Some browsers require fullscreen to be active before locking orientation
          // If it fails, we'll just show a message
          if (this.isAndroidDevice()) {
            this.showShortcutIndicator('Please rotate device to landscape');
          }
        }
      } else {
        // Fallback for older browsers or iOS (which doesn't support orientation lock)
        this.debugLog('Screen Orientation API not supported');
        if (this.isMobileDevice()) {
          // Show a subtle hint for devices that don't support orientation lock
          this.showShortcutIndicator('Rotate device to landscape for best experience');
        }
      }
    } catch (error) {
      this.debugWarn('Orientation lock error:', (error as Error).message);
    }
  }

  /**
   * Unlock screen orientation when exiting fullscreen
   */
  private async unlockOrientation(): Promise<void> {
    try {
      // Check if Screen Orientation API is supported
      const screenOrientation = screen.orientation as any;
      if (screenOrientation && typeof screenOrientation.unlock === 'function') {
        try {
          screenOrientation.unlock();
          this.debugLog('Screen orientation unlocked');
        } catch (error) {
          this.debugWarn('Failed to unlock orientation:', (error as Error).message);
        }
      } else {
        this.debugLog('Screen Orientation API not supported for unlock');
      }
    } catch (error) {
      this.debugWarn('Orientation unlock error:', (error as Error).message);
    }
  }

  private handleVolumeChange(e: MouseEvent): void {
    const slider = document.getElementById('uvf-volume-slider');
    if (!slider) return;
    
    const rect = slider.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percent = Math.max(0, Math.min(1, x / width));
    
    if (this.isCasting && this.remoteController && this.remotePlayer) {
      try {
        if (this.remotePlayer.isMuted) {
          try { this.remoteController.muteOrUnmute(); } catch (_) {}
          this.remotePlayer.isMuted = false;
        }
        this.remotePlayer.volumeLevel = percent;
        this.remoteController.setVolumeLevel();
      } catch (_) {}
      this.updateVolumeUIFromRemote();
    } else if (this.video) {
      this.setVolume(percent);
      this.video.muted = false;
    }
  }

  private handleProgressChange(e: MouseEvent | Touch): void {
    const progressBar = document.getElementById('uvf-progress-bar');
    const progressFilled = document.getElementById('uvf-progress-filled') as HTMLElement;
    const progressHandle = document.getElementById('uvf-progress-handle') as HTMLElement;
    if (!progressBar || !this.video) return;
    
    const rect = progressBar.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    const time = (percent / 100) * this.video.duration;
    
    // Update UI immediately for responsive feedback
    if (progressFilled) {
      progressFilled.style.width = percent + '%';
    }
    if (progressHandle) {
      progressHandle.style.left = percent + '%';
      // Add dragging class for visual feedback
      if (this.isDragging) {
        progressHandle.classList.add('dragging');
      } else {
        progressHandle.classList.remove('dragging');
      }
    }
    
    this.seek(time);
  }

  private formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  private updateTimeDisplay(): void {
    const timeDisplay = document.getElementById('uvf-time-display');
    if (timeDisplay && this.video) {
      const current = this.formatTime(this.video.currentTime || 0);
      const duration = this.formatTime(this.video.duration || 0);
      timeDisplay.textContent = `${current} / ${duration}`;
      this.debugLog('Time display updated:', `${current} / ${duration}`);
    }
  }

  private showControls(): void {
    if (this.hideControlsTimeout) clearTimeout(this.hideControlsTimeout);
    const wrapper = this.container?.querySelector('.uvf-player-wrapper');
    if (wrapper) {
      wrapper.classList.add('controls-visible');
      wrapper.classList.remove('no-cursor');
    }
  }

  private hideControls(): void {
    if (!this.state.isPlaying) return;
    
    const wrapper = this.container?.querySelector('.uvf-player-wrapper');
    if (wrapper) {
      wrapper.classList.remove('controls-visible');
      wrapper.classList.add('no-cursor');
    }
  }

  private scheduleHideControls(): void {
    if (!this.state.isPlaying) return;
    
    if (this.hideControlsTimeout) clearTimeout(this.hideControlsTimeout);
    // Use longer timeout in fullscreen for better UX
    const timeout = this.isFullscreen() ? 4000 : 3000;
    this.hideControlsTimeout = setTimeout(() => {
      if (this.state.isPlaying && !this.controlsContainer?.matches(':hover')) {
        this.hideControls();
      }
    }, timeout);
  }

  /**
   * Setup advanced tap handling for mobile with:
   * - Single tap: toggle controls (immediate response)
   * - Double tap left: skip backward 10s
   * - Double tap right: skip forward 10s
   * - Long press left: 2x speed backward
   * - Long press right: 2x speed forward
   */
  private setupAdvancedTapHandling(): void {
    if (!this.video || !this.playerWrapper) return;

    const DOUBLE_TAP_DELAY = 300; // ms
    const LONG_PRESS_DELAY = 500; // ms
    const TAP_MOVEMENT_THRESHOLD = 10; // pixels
    const SKIP_SECONDS = 10;
    const FAST_PLAYBACK_RATE = 2;
    
    // Track if we're currently in a double-tap window
    let inDoubleTapWindow = false;

    const videoElement = this.video;
    const wrapper = this.playerWrapper;

    // Touch start handler
    const handleTouchStart = (e: TouchEvent) => {
      // Ignore if touching controls
      const target = e.target as HTMLElement;
      if (target.closest('.uvf-controls')) {
        return;
      }

      const touch = e.touches[0];
      this.tapStartTime = Date.now();
      this.tapStartX = touch.clientX;
      this.tapStartY = touch.clientY;

      // Start long press timer
      this.longPressTimer = setTimeout(() => {
        this.isLongPressing = true;
        this.handleLongPress(this.tapStartX);
      }, LONG_PRESS_DELAY);
    };

    // Touch move handler
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - this.tapStartX);
      const deltaY = Math.abs(touch.clientY - this.tapStartY);

      // Cancel long press if moved too much
      if (deltaX > TAP_MOVEMENT_THRESHOLD || deltaY > TAP_MOVEMENT_THRESHOLD) {
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      }
    };

    // Touch end handler
    const handleTouchEnd = (e: TouchEvent) => {
      // Clear long press timer
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      // Handle long press end
      if (this.isLongPressing) {
        this.handleLongPressEnd();
        this.isLongPressing = false;
        return;
      }

      // Ignore if touching controls
      const target = e.target as HTMLElement;
      if (target.closest('.uvf-controls')) {
        return;
      }

      const touch = e.changedTouches[0];
      const touchEndX = touch.clientX;
      const touchEndY = touch.clientY;
      const tapDuration = Date.now() - this.tapStartTime;

      // Check if it was a tap (not a drag)
      const deltaX = Math.abs(touchEndX - this.tapStartX);
      const deltaY = Math.abs(touchEndY - this.tapStartY);

      if (deltaX > TAP_MOVEMENT_THRESHOLD || deltaY > TAP_MOVEMENT_THRESHOLD) {
        // It was a drag, not a tap
        return;
      }

      // Check if it was a quick tap (not a long press)
      if (tapDuration > LONG_PRESS_DELAY) {
        return;
      }

      // Determine if this is a double tap
      const now = Date.now();
      const timeSinceLastTap = now - this.lastTapTime;

      if (timeSinceLastTap < DOUBLE_TAP_DELAY && Math.abs(touchEndX - this.lastTapX) < 100) {
        // Double tap detected
        this.tapCount = 2;
        if (this.tapResetTimer) {
          clearTimeout(this.tapResetTimer);
          this.tapResetTimer = null;
        }
        inDoubleTapWindow = false;
        this.handleDoubleTap(touchEndX);
      } else {
        // First tap - execute immediately for responsive feel
        this.tapCount = 1;
        this.lastTapTime = now;
        this.lastTapX = touchEndX;
        inDoubleTapWindow = true;

        // Execute single tap immediately
        this.handleSingleTap();

        // Wait to see if there's a second tap
        if (this.tapResetTimer) {
          clearTimeout(this.tapResetTimer);
        }
        this.tapResetTimer = setTimeout(() => {
          this.tapCount = 0;
          inDoubleTapWindow = false;
        }, DOUBLE_TAP_DELAY);
      }
    };

    // Single tap: toggle controls
    const handleSingleTap = () => {
      this.debugLog('Single tap detected - toggling controls');
      const wrapper = this.container?.querySelector('.uvf-player-wrapper');
      const areControlsVisible = wrapper?.classList.contains('controls-visible');
      
      if (areControlsVisible) {
        // Hide controls and top UI elements
        this.hideControls();
        this.debugLog('Single tap: hiding controls');
      } else {
        // Show controls and top UI elements
        this.showControls();
        this.debugLog('Single tap: showing controls');
        
        // Schedule auto-hide if video is playing
        if (this.state.isPlaying) {
          this.scheduleHideControls();
          this.debugLog('Single tap: scheduled auto-hide');
        }
      }
    };

    // Double tap: skip backward/forward based on screen side
    const handleDoubleTap = (tapX: number) => {
      if (!this.video || !wrapper) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      const tapPosition = tapX - wrapperRect.left;
      const wrapperWidth = wrapperRect.width;
      const isLeftSide = tapPosition < wrapperWidth / 2;

      if (isLeftSide) {
        // Skip backward
        const newTime = Math.max(0, this.video.currentTime - SKIP_SECONDS);
        this.seek(newTime);
        this.showShortcutIndicator(`-${SKIP_SECONDS}s`);
        this.debugLog('Double tap left - skip backward');
      } else {
        // Skip forward
        const newTime = Math.min(this.video.duration, this.video.currentTime + SKIP_SECONDS);
        this.seek(newTime);
        this.showShortcutIndicator(`+${SKIP_SECONDS}s`);
        this.debugLog('Double tap right - skip forward');
      }
    };

    // Long press: fast forward/rewind based on screen side
    const handleLongPress = (tapX: number) => {
      if (!this.video || !wrapper) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      const tapPosition = tapX - wrapperRect.left;
      const wrapperWidth = wrapperRect.width;
      const isLeftSide = tapPosition < wrapperWidth / 2;

      // Save original playback rate
      this.longPressPlaybackRate = this.video.playbackRate;

      if (isLeftSide) {
        // Fast backward by setting negative time interval
        const skipIcon = `<svg viewBox="0 0 24 24" style="width:32px;height:32px;display:inline-block;vertical-align:middle;margin-right:8px"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" stroke="currentColor" stroke-width="0.5" fill="currentColor"/></svg>`;
        this.showShortcutIndicator(skipIcon + ' 2x');
        this.debugLog('Long press left - fast backward');
        this.startFastBackward();
      } else {
        // Fast forward
        this.video.playbackRate = FAST_PLAYBACK_RATE;
        const skipIcon = `<svg viewBox="0 0 24 24" style="width:32px;height:32px;display:inline-block;vertical-align:middle;margin-right:8px;transform:scaleX(-1)"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" stroke="currentColor" stroke-width="0.5" fill="currentColor"/></svg>`;
        this.showShortcutIndicator(skipIcon + ' 2x');
        this.debugLog('Long press right - fast forward');
      }
    };

    // Long press end: restore normal playback
    const handleLongPressEnd = () => {
      if (!this.video) return;

      // Stop fast backward if active
      this.stopFastBackward();

      // Restore original playback rate
      this.video.playbackRate = this.longPressPlaybackRate || 1;
      this.debugLog('Long press ended - restored playback rate');
    };

    // Bind handlers
    this.handleSingleTap = handleSingleTap.bind(this);
    this.handleDoubleTap = handleDoubleTap.bind(this);
    this.handleLongPress = handleLongPress.bind(this);
    this.handleLongPressEnd = handleLongPressEnd.bind(this);

    // Attach event listeners
    videoElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    videoElement.addEventListener('touchmove', handleTouchMove, { passive: true });
    videoElement.addEventListener('touchend', handleTouchEnd, { passive: true });

    this.debugLog('Advanced tap handling initialized');
  }

  // Fast backward using interval-based seeking
  private startFastBackward(): void {
    if (!this.video || this.fastBackwardInterval) return;

    this.fastBackwardInterval = setInterval(() => {
      if (this.video) {
        const newTime = Math.max(0, this.video.currentTime - 0.1); // Go back 0.1s every frame
        this.video.currentTime = newTime;
      }
    }, 50); // Update every 50ms for smooth backward motion
  }

  private stopFastBackward(): void {
    if (this.fastBackwardInterval) {
      clearInterval(this.fastBackwardInterval);
      this.fastBackwardInterval = null;
    }
  }
  
  private isFullscreen(): boolean {
    return !!(document.fullscreenElement ||
              (document as any).webkitFullscreenElement ||
              (document as any).mozFullScreenElement ||
              (document as any).msFullscreenElement);
  }
  
  private setupFullscreenListeners(): void {
    // Handle fullscreen changes from browser/keyboard shortcuts
    const handleFullscreenChange = () => {
      const isFullscreen = this.isFullscreen();
      
      if (this.playerWrapper) {
        if (isFullscreen) {
          this.playerWrapper.classList.add('uvf-fullscreen');
        } else {
          this.playerWrapper.classList.remove('uvf-fullscreen');
        }
      }
      
      // Show controls when entering/exiting fullscreen
      this.showControls();
      if (isFullscreen && this.state.isPlaying) {
        this.scheduleHideControls();
      }
      
      this.emit('onFullscreenChanged', isFullscreen);
    };
    
    // Listen for fullscreen change events (all browser prefixes)
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    // Enhanced mouse/touch movement detection for control visibility
    let lastMouseMoveTime = 0;
    let mouseInactivityTimeout: any = null;
    
    const handleMouseMovement = () => {
      const now = Date.now();
      lastMouseMoveTime = now;
      
      // Show controls immediately on mouse movement
      this.showControls();
      
      // Clear existing inactivity timeout
      clearTimeout(mouseInactivityTimeout);
      
      // Set new inactivity timeout
      if (this.state.isPlaying) {
        const timeout = this.isFullscreen() ? 4000 : 3000;
        mouseInactivityTimeout = setTimeout(() => {
          const timeSinceLastMove = Date.now() - lastMouseMoveTime;
          if (timeSinceLastMove >= timeout && this.state.isPlaying) {
            this.hideControls();
          }
        }, timeout);
      }
    };
    
    // Touch movement detection for mobile - only for actual dragging/scrolling
    // Note: Don't handle touchstart here as it conflicts with advanced tap handling
    const handleTouchMovement = () => {
      // Only show controls on actual touch movement, not touchstart
      this.showControls();
      if (this.state.isPlaying) {
        this.scheduleHideControls();
      }
    };
    
    // Add event listeners to the player wrapper
    if (this.playerWrapper) {
      this.playerWrapper.addEventListener('mousemove', handleMouseMovement, { passive: true });
      this.playerWrapper.addEventListener('mouseenter', () => this.showControls());
      // Only listen to touchmove (actual dragging), not touchstart
      // touchstart is handled by advanced tap handling system on video element
      this.playerWrapper.addEventListener('touchmove', handleTouchMovement, { passive: true });
    }
  }
  

  
  private showShortcutIndicator(text: string): void {
    const el = document.getElementById('uvf-shortcut-indicator');
    this.debugLog('showShortcutIndicator called with:', text, 'element found:', !!el);
    if (!el) {
      this.debugError('uvf-shortcut-indicator element not found!');
      return;
    }
    try {
      const resetAnim = () => {
        el.classList.remove('active');
        // force reflow to restart animation
        void (el as HTMLElement).offsetWidth;
        el.classList.add('active');
      };
      const setIcon = (svg: string) => {
        el.classList.add('uvf-ki-icon');
        el.innerHTML = `<div class="uvf-ki uvf-ki-icon">${svg}</div>`;
        resetAnim();
      };
      const setSkip = (dir: 'fwd'|'back', num: number) => {
        el.classList.add('uvf-ki-icon');
        const svg = dir === 'fwd'
          ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.01 19c-3.31 0-6-2.69-6-6s2.69-6 6-6V5l5 5-5 5V9c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4h2c0 3.31-2.69 6-6 6z"/></svg>`
          : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`;
        el.innerHTML = `<div class="uvf-ki uvf-ki-skip"><div class="uvf-ki-skip-num">${num}</div>${svg}</div>`;
        resetAnim();
      };
      const setVolume = (percent: number, muted: boolean = false) => {
        el.classList.remove('uvf-ki-icon');
        const p = Math.max(0, Math.min(100, Math.round(percent)));
        const icon = muted ? `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
          </svg>` : `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>`;
        el.innerHTML = `
          <div class="uvf-ki uvf-ki-volume" role="status" aria-live="polite">
            <div class="uvf-ki-vol-icon">${icon}</div>
            <div class="uvf-ki-vol-bar"><div class="uvf-ki-vol-fill" style="width:${p}%"></div></div>
            <div class="uvf-ki-vol-text">${p}%</div>
          </div>`;
        resetAnim();
      };
      const setText = (t: string) => {
        el.classList.remove('uvf-ki-icon');
        el.innerHTML = `<div class="uvf-ki uvf-ki-text">${t}</div>`;
        resetAnim();
      };

      // Map text cues to icon overlays (YouTube-like)
      if (text === 'Play') {
        setIcon(`<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`);
      } else if (text === 'Pause') {
        setIcon(`<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`);
      } else if (text === '+10s') {
        setSkip('fwd', 10);
      } else if (text === '-10s') {
        setSkip('back', 10);
      } else if (/^Volume\s+(\d+)%$/.test(text)) {
        const m = text.match(/^Volume\s+(\d+)%$/);
        const val = m ? parseInt(m[1], 10) : 0;
        setVolume(val);
      } else if (text === 'Muted' || text === 'Unmuted') {
        const muted = text === 'Muted';
        const level = (this.isCasting && this.remotePlayer) ? Math.round(((this.remotePlayer.volumeLevel || 0) * 100)) : Math.round((this.video?.volume || 0) * 100);
        setVolume(level, muted);
      } else if (text === 'Fullscreen') {
        setIcon(`<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`);
      } else if (text === 'Exit Fullscreen') {
        setIcon(`<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`);
      } else if (text === 'Picture-in-Picture') {
        setIcon(`<svg viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>`);
      } else if (/^\d+%$/.test(text)) {
        setText(text);
      } else {
        setText(text);
      }

      // auto-hide after animation
      clearTimeout(this._kiTo);
      this._kiTo = setTimeout(() => {
        try { el.classList.remove('active'); } catch (_) {}
      }, 1000);
    } catch (err) {
      try {
        (el as HTMLElement).textContent = String(text || '');
        el.classList.add('active');
        setTimeout(() => el.classList.remove('active'), 1000);
      } catch(_) {}
    }
  }

  public setSettingsScrollbarStyle(mode: 'default' | 'compact' | 'overlay'): void {
    const wrapper = this.playerWrapper;
    if (!wrapper) return;
    wrapper.classList.remove('uvf-scrollbar-compact', 'uvf-scrollbar-overlay');
    switch (mode) {
      case 'compact':
        wrapper.classList.add('uvf-scrollbar-compact');
        break;
      case 'overlay':
        wrapper.classList.add('uvf-scrollbar-overlay');
        break;
      default:
        // default
        break;
    }
  }

  public setSettingsScrollbarConfig(options: { widthPx?: number; intensity?: number }): void {
    const wrapper = this.playerWrapper;
    if (!wrapper) return;
    const { widthPx, intensity } = options || {};

    if (typeof widthPx === 'number' && isFinite(widthPx)) {
      const w = Math.max(4, Math.min(16, Math.round(widthPx)));
      wrapper.style.setProperty('--uvf-scrollbar-width', `${w}px`);
    }

    if (typeof intensity === 'number' && isFinite(intensity)) {
      const i = Math.max(0, Math.min(1, intensity));
      const s1 = 0.35 * i;
      const e1 = 0.45 * i;
      const s2 = 0.50 * i;
      const e2 = 0.60 * i;
      wrapper.style.setProperty('--uvf-scrollbar-thumb-start', `rgba(255,0,0,${s1.toFixed(3)})`);
      wrapper.style.setProperty('--uvf-scrollbar-thumb-end', `rgba(255,0,0,${e1.toFixed(3)})`);
      wrapper.style.setProperty('--uvf-scrollbar-thumb-hover-start', `rgba(255,0,0,${s2.toFixed(3)})`);
      wrapper.style.setProperty('--uvf-scrollbar-thumb-hover-end', `rgba(255,0,0,${e2.toFixed(3)})`);
      wrapper.style.setProperty('--uvf-firefox-scrollbar-color', `rgba(255,255,255,${(0.25 * i).toFixed(3)})`);
    }
  }

  private applyScrollbarPreferencesFromDataset(): void {
    const container = this.container as HTMLElement | null;
    if (!container) return;
    const ds = container.dataset || {};

    const stylePref = (ds.scrollbarStyle || '').toLowerCase();
    if (stylePref === 'compact' || stylePref === 'overlay' || stylePref === 'default') {
      this.setSettingsScrollbarStyle(stylePref as 'default' | 'compact' | 'overlay');
    }

    const width = Number(ds.scrollbarWidth);
    const intensity = Number(ds.scrollbarIntensity);
    const options: { widthPx?: number; intensity?: number } = {};
    if (Number.isFinite(width)) options.widthPx = width;
    if (Number.isFinite(intensity)) options.intensity = intensity;
    if (options.widthPx !== undefined || options.intensity !== undefined) {
      this.setSettingsScrollbarConfig(options);
    }
  }

  /**
   * Setup chapter manager for skip functionality
   */
  private setupChapterManager(): void {
    if (!this.video || !this.playerWrapper) {
      this.debugWarn('Cannot setup chapter manager: video or wrapper not available');
      return;
    }

    try {
      // Initialize the web-specific chapter manager (for UI controls)
      this.chapterManager = new ChapterManager(
        this.playerWrapper,
        this.video,
        this.chapterConfig
      );

      // Initialize the core chapter manager (for basic chapter functionality)
      const coreChapterConfig = {
        enabled: this.chapterConfig.enabled,
        chapters: this.convertToChapters(this.chapterConfig.data),
        segments: this.convertToChapterSegments(this.chapterConfig.data),
        dataUrl: this.chapterConfig.dataUrl,
        autoSkip: this.chapterConfig.userPreferences?.autoSkipIntro || false,
        onChapterChange: (chapter: Chapter | null) => {
          this.debugLog('Core chapter changed:', chapter?.title || 'none');
          this.emit('onChapterchange', chapter);
        },
        onSegmentEntered: (segment: ChapterSegment) => {
          this.debugLog('Core segment entered:', segment.title);
          this.emit('segmententered', segment);
        },
        onSegmentExited: (segment: ChapterSegment) => {
          this.debugLog('Core segment exited:', segment.title);
          this.emit('segmentexited', segment);
        },
        onSegmentSkipped: (segment: ChapterSegment) => {
          this.debugLog('Core segment skipped:', segment.title);
          this.emit('segmentskipped', segment);
        }
      };

      this.coreChapterManager = new CoreChapterManager(coreChapterConfig);
      
      // Initialize the core chapter manager
      this.coreChapterManager.initialize();

      // Set up event listeners for web chapter events
      this.chapterManager.on('segmentEntered', (data) => {
        this.debugLog('Entered segment:', data.segment.type, data.segment.title);
        this.emit('chapterSegmentEntered', data);
      });

      this.chapterManager.on('segmentSkipped', (data) => {
        this.debugLog('Skipped segment:', data.fromSegment.type, 'to', data.toSegment?.type || 'end');
        this.emit('chapterSegmentSkipped', data);
      });

      this.chapterManager.on('skipButtonShown', (data) => {
        this.debugLog('Skip button shown for:', data.segment.type);
        this.emit('chapterSkipButtonShown', data);
      });

      this.chapterManager.on('skipButtonHidden', (data) => {
        this.debugLog('Skip button hidden for:', data.segment.type, 'reason:', data.reason);
        this.emit('chapterSkipButtonHidden', data);
      });

      this.chapterManager.on('chaptersLoaded', (data) => {
        this.debugLog('Chapters loaded:', data.segmentCount, 'segments');
        this.emit('chaptersLoaded', data);
      });

      this.chapterManager.on('chaptersLoadError', (data) => {
        this.debugError('Failed to load chapters:', data.error.message);
        this.emit('chaptersLoadError', data);
      });

      this.debugLog('Chapter managers initialized successfully');
    } catch (error) {
      this.debugError('Failed to initialize chapter managers:', error);
    }
  }

  /**
   * Convert web chapter data to core Chapter format
   */
  private convertToChapters(webChapterData: any): Chapter[] {
    if (!webChapterData || !webChapterData.segments) {
      return [];
    }

    return webChapterData.segments
      .filter((segment: any) => segment.type === 'content')
      .map((segment: any, index: number) => ({
        id: segment.id || `chapter-${index}`,
        title: segment.title || `Chapter ${index + 1}`,
        startTime: segment.startTime,
        endTime: segment.endTime,
        thumbnail: segment.thumbnail,
        description: segment.description,
        metadata: segment.metadata || {}
      }));
  }

  /**
   * Convert web chapter data to core ChapterSegment format
   */
  private convertToChapterSegments(webChapterData: any): ChapterSegment[] {
    if (!webChapterData || !webChapterData.segments) {
      return [];
    }

    return webChapterData.segments
      .filter((segment: any) => segment.type !== 'content')
      .map((segment: any) => ({
        id: segment.id,
        startTime: segment.startTime,
        endTime: segment.endTime,
        category: segment.type,
        action: this.mapSegmentAction(segment.type),
        title: segment.title,
        description: segment.description
      }));
  }

  /**
   * Map web segment types to core segment actions
   */
  private mapSegmentAction(segmentType: string): 'skip' | 'mute' | 'warn' {
    switch (segmentType) {
      case 'intro':
      case 'recap':
      case 'credits':
      case 'sponsor':
        return 'skip';
      case 'offensive':
        return 'mute';
      default:
        return 'warn';
    }
  }

  /**
   * Load chapters data
   */
  public async loadChapters(chapters: VideoChapters): Promise<void> {
    if (!this.chapterManager) {
      throw new Error('Chapter manager not initialized. Enable chapters in config first.');
    }
    
    try {
      await this.chapterManager.loadChapters(chapters);
      this.debugLog('Chapters loaded successfully');
    } catch (error) {
      this.debugError('Failed to load chapters:', error);
      throw error;
    }
  }

  /**
   * Load chapters from URL
   */
  public async loadChaptersFromUrl(url: string): Promise<void> {
    if (!this.chapterManager) {
      throw new Error('Chapter manager not initialized. Enable chapters in config first.');
    }
    
    try {
      await this.chapterManager.loadChaptersFromUrl(url);
      this.debugLog('Chapters loaded from URL successfully');
    } catch (error) {
      this.debugError('Failed to load chapters from URL:', error);
      throw error;
    }
  }

  /**
   * Get current video segment
   */
  public getCurrentSegment(): VideoSegment | null {
    if (!this.chapterManager || !this.video) {
      return null;
    }
    
    return this.chapterManager.getCurrentSegment(this.video.currentTime);
  }

  /**
   * Skip to specific segment by ID
   */
  public skipToSegment(segmentId: string): void {
    if (!this.chapterManager) {
      this.debugWarn('Cannot skip segment: chapter manager not initialized');
      return;
    }
    
    this.chapterManager.skipToSegment(segmentId);
  }

  /**
   * Get all video segments
   */
  public getSegments(): VideoSegment[] {
    if (!this.chapterManager) {
      return [];
    }
    
    return this.chapterManager.getSegments();
  }

  /**
   * Update chapter configuration
   */
  public updateChapterConfig(newConfig: Partial<ChapterConfig>): void {
    this.chapterConfig = { ...this.chapterConfig, ...newConfig };
    
    if (this.chapterManager) {
      this.chapterManager.updateConfig(this.chapterConfig);
    }
  }

  /**
   * Check if chapters are loaded
   */
  public hasChapters(): boolean {
    return this.chapterManager?.hasChapters() || false;
  }

  /**
   * Get chapter data
   */
  public getChapters(): VideoChapters | null {
    return this.chapterManager?.getChapters() || null;
  }

  /**
   * Get core chapters (Chapter format)
   */
  public getCoreChapters(): Chapter[] {
    return this.coreChapterManager?.getChapters() || [];
  }

  /**
   * Get core chapter segments (ChapterSegment format)
   */
  public getCoreSegments(): ChapterSegment[] {
    return this.coreChapterManager?.getSegments() || [];
  }

  /**
   * Get current chapter info from core manager
   */
  public getCurrentChapterInfo(): Chapter | null {
    return this.coreChapterManager?.getCurrentChapterInfo() || null;
  }

  /**
   * Seek to chapter by ID (core chapter functionality)
   */
  public seekToChapter(chapterId: string): void {
    if (!this.coreChapterManager || !this.video) {
      this.debugWarn('Cannot seek to chapter: core chapter manager or video not available');
      return;
    }

    const chapter = this.coreChapterManager.seekToChapter(chapterId);
    if (chapter) {
      this.video.currentTime = chapter.startTime;
      this.debugLog('Seeked to chapter:', chapter.title);
    }
  }

  /**
   * Get next chapter from current time
   */
  public getNextChapter(): Chapter | null {
    if (!this.coreChapterManager || !this.video) {
      return null;
    }
    return this.coreChapterManager.getNextChapter(this.video.currentTime);
  }

  /**
   * Get previous chapter from current time
   */
  public getPreviousChapter(): Chapter | null {
    if (!this.coreChapterManager || !this.video) {
      return null;
    }
    return this.coreChapterManager.getPreviousChapter(this.video.currentTime);
  }

  // Theme API: set CSS variables on the wrapper to apply dynamic colors
  public setTheme(theme: any): void {
    const wrapper = this.playerWrapper;
    if (!wrapper) return;
    try {
      let accent1: string | null = null;
      let accent2: string | null = null;
      let iconColor: string | null = null;
      let textPrimary: string | null = null;
      let textSecondary: string | null = null;
      let overlayStrong: string | null = null;
      let overlayMedium: string | null = null;
      let overlayTransparent: string | null = null;

      if (typeof theme === 'string') {
        accent1 = theme;
      } else if (theme && typeof theme === 'object') {
        accent1 = theme.accent || null;
        accent2 = theme.accent2 || null;
        iconColor = theme.iconColor || null;
        textPrimary = theme.textPrimary || null;
        textSecondary = theme.textSecondary || null;
        overlayStrong = theme.overlayStrong || null;
        overlayMedium = theme.overlayMedium || null;
        overlayTransparent = theme.overlayTransparent || null;
      }

      if (accent1) wrapper.style.setProperty('--uvf-accent-1', accent1);
      // Derive accent2 if missing
      if (!accent2 && accent1) {
        const rgb = this._parseRgb(accent1);
        if (rgb) {
          const lighter = this._lightenRgb(rgb, 0.35);
          accent2 = this._rgbToString(lighter);
        } else {
          // Fallback: use the same accent for both ends of the gradient
          accent2 = accent1;
        }
      }
      if (accent2) wrapper.style.setProperty('--uvf-accent-2', accent2);

      // Provide a translucent version of accent1 for badges
      if (accent1) {
        const a20 = this._toRgba(accent1, 0.2);
        if (a20) wrapper.style.setProperty('--uvf-accent-1-20', a20);
      }

      if (iconColor) wrapper.style.setProperty('--uvf-icon-color', iconColor);
      if (textPrimary) wrapper.style.setProperty('--uvf-text-primary', textPrimary);
      if (textSecondary) wrapper.style.setProperty('--uvf-text-secondary', textSecondary);
      
      // Set overlay colors for gradient backgrounds
      if (overlayStrong) wrapper.style.setProperty('--uvf-overlay-strong', overlayStrong);
      if (overlayMedium) wrapper.style.setProperty('--uvf-overlay-medium', overlayMedium);
      if (overlayTransparent) wrapper.style.setProperty('--uvf-overlay-transparent', overlayTransparent);
    } catch (_) {
      // ignore
    }
  }

  private _parseRgb(input: string): { r: number; g: number; b: number } | null {
    try {
      const s = (input || '').trim().toLowerCase();
      // #rrggbb or #rgb
      if (s.startsWith('#')) {
        const hex = s.substring(1);
        if (hex.length === 3) {
          const r = parseInt(hex[0] + hex[0], 16);
          const g = parseInt(hex[1] + hex[1], 16);
          const b = parseInt(hex[2] + hex[2], 16);
          return { r, g, b };
        }
        if (hex.length === 6) {
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          return { r, g, b };
        }
      }
      // rgb(a)
      if (s.startsWith('rgb(') || s.startsWith('rgba(')) {
        const nums = s.replace(/rgba?\(/, '').replace(/\)/, '').split(',').map(x => parseFloat(x.trim()));
        if (nums.length >= 3) {
          return { r: Math.round(nums[0]), g: Math.round(nums[1]), b: Math.round(nums[2]) };
        }
      }
    } catch (_) {}
    return null;
  }

  private _rgbToString(rgb: { r: number; g: number; b: number }): string {
    const c = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
    return `rgb(${c(rgb.r)}, ${c(rgb.g)}, ${c(rgb.b)})`;
  }

  private _lightenRgb(rgb: { r: number; g: number; b: number }, amount: number): { r: number; g: number; b: number } {
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
    const amt = Math.max(0, Math.min(1, amount));
    return {
      r: clamp(rgb.r + (255 - rgb.r) * amt),
      g: clamp(rgb.g + (255 - rgb.g) * amt),
      b: clamp(rgb.b + (255 - rgb.b) * amt),
    };
  }

  private _toRgba(input: string, alpha: number): string | null {
    const rgb = this._parseRgb(input);
    if (!rgb) return null;
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
  }
  
  private changeVolume(delta: number): void {
    if (this.isCasting && this.remoteController && this.remotePlayer) {
      const cur = this.remotePlayer.volumeLevel || 0;
      const next = Math.max(0, Math.min(1, cur + delta));
      try {
        if (this.remotePlayer.isMuted) {
          try { this.remoteController.muteOrUnmute(); } catch (_) {}
          this.remotePlayer.isMuted = false;
        }
        this.remotePlayer.volumeLevel = next;
        this.remoteController.setVolumeLevel();
      } catch (_) {}
      this.updateVolumeUIFromRemote();
      return;
    }
    if (!this.video) return;
    this.video.volume = Math.max(0, Math.min(1, this.video.volume + delta));
  }
  
  private setSpeed(speed: number): void {
    if (!this.video) return;
    this.video.playbackRate = speed;
    
    // Update UI
    document.querySelectorAll('.speed-option').forEach(option => {
      option.classList.remove('active');
      if (parseFloat((option as HTMLElement).dataset.speed || '1') === speed) {
        option.classList.add('active');
      }
    });
  }
  
  private setQualityByLabel(quality: string): void {
    const qualityBadge = document.getElementById('uvf-quality-badge');
    
    // Update UI
    document.querySelectorAll('.quality-option').forEach(option => {
      option.classList.remove('active');
      if ((option as HTMLElement).dataset.quality === quality) {
        option.classList.add('active');
      }
    });
    
    // Update badge
    if (qualityBadge) {
      if (quality === 'auto') {
        qualityBadge.textContent = 'AUTO';
      } else {
        qualityBadge.textContent = quality + 'p';
      }
    }
    
    // If we have actual quality levels from HLS/DASH, apply them
    if (quality !== 'auto' && this.qualities.length > 0) {
      const qualityLevel = this.qualities.find(q => q.label === quality + 'p');
      if (qualityLevel) {
        const index = this.qualities.findIndex(q => q.label === quality + 'p');
        this.setQuality(index);
      }
    } else if (quality === 'auto') {
      this.setAutoQuality(true);
    }
  }
  
  private async togglePiP(): Promise<void> {
    try {
      if ((document as any).pictureInPictureElement) {
        await this.exitPictureInPicture();
      } else {
        await this.enterPictureInPicture();
      }
    } catch (error) {
      console.error('PiP toggle failed:', error);
    }
  }
  
  private setupCastContextSafe(): void {
    try {
      const castNs = (window as any).cast;
      if (castNs && castNs.framework) {
        this.setupCastContext();
      }
    } catch (_) {}
  }

  private setupCastContext(): void {
    if (this.castContext) return;
    try {
      const castNs = (window as any).cast;
      this.castContext = castNs.framework.CastContext.getInstance();
      const chromeNs = (window as any).chrome;
      const options: any = { receiverApplicationId: chromeNs?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID };
      try {
        const autoJoin = chromeNs?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED;
        if (autoJoin) options.autoJoinPolicy = autoJoin;
      } catch (_) {}
      this.castContext.setOptions(options);
      this.castContext.addEventListener(
        castNs.framework.CastContextEventType.SESSION_STATE_CHANGED,
        (ev: any) => {
          const state = ev.sessionState;
          if (state === castNs.framework.SessionState.SESSION_STARTED ||
              state === castNs.framework.SessionState.SESSION_RESUMED) {
            this.enableCastRemoteControl();
          } else if (state === castNs.framework.SessionState.SESSION_ENDED) {
            this.disableCastRemoteControl();
          }
        }
      );
    } catch (err) {
      if (this.config.debug) console.warn('[Cast] setupCastContext failed', err);
    }
  }

  private enableCastRemoteControl(): void {
    try {
      const castNs = (window as any).cast;
      if (!castNs || !castNs.framework) return;
      const session = castNs.framework.CastContext.getInstance().getCurrentSession();
      if (!session) return;
      if (!this.remotePlayer) this.remotePlayer = new castNs.framework.RemotePlayer();
      if (!this.remoteController) {
        this.remoteController = new castNs.framework.RemotePlayerController(this.remotePlayer);
        this._bindRemotePlayerEvents();
      }
      this.isCasting = true;
      try { this.video?.pause(); } catch (_) {}
      this._syncUIFromRemote();
      this._syncCastButtons();
    } catch (err) {
      if (this.config.debug) console.warn('[Cast] enableCastRemoteControl failed', err);
    }
  }

  private disableCastRemoteControl(): void {
    this.isCasting = false;
    this._syncCastButtons();
  }

  private _bindRemotePlayerEvents(): void {
    const castNs = (window as any).cast;
    if (!this.remoteController || !castNs) return;
    const RPET = castNs.framework.RemotePlayerEventType;
    const rc = this.remoteController;

    rc.addEventListener(RPET.IS_PAUSED_CHANGED, () => {
      if (!this.isCasting) return;
      if (this.remotePlayer && this.remotePlayer.isPaused === false) {
        // reflect playing UI
        const playIcon = document.getElementById('uvf-play-icon');
        const pauseIcon = document.getElementById('uvf-pause-icon');
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = 'block';
      } else {
        const playIcon = document.getElementById('uvf-play-icon');
        const pauseIcon = document.getElementById('uvf-pause-icon');
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
      }
    });

    rc.addEventListener(RPET.CURRENT_TIME_CHANGED, () => {
      if (!this.isCasting) return;
      const progressFilled = document.getElementById('uvf-progress-filled') as HTMLElement;
      const progressHandle = document.getElementById('uvf-progress-handle') as HTMLElement;
      const timeDisplay = document.getElementById('uvf-time-display');
      const duration = this.remotePlayer?.duration || 0;
      const current = Math.max(0, Math.min(this.remotePlayer?.currentTime || 0, duration));
      const percent = duration > 0 ? (current / duration) * 100 : 0;
      if (progressFilled) progressFilled.style.width = percent + '%';
      if (progressHandle) progressHandle.style.left = percent + '%';
      if (timeDisplay) (timeDisplay as HTMLElement).textContent = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
      // Enforce gate while casting
      this.enforceFreePreviewGate(current);
    });

    rc.addEventListener(RPET.DURATION_CHANGED, () => {
      if (!this.isCasting) return;
      const timeDisplay = document.getElementById('uvf-time-display');
      const duration = this.remotePlayer?.duration || 0;
      if (timeDisplay) (timeDisplay as HTMLElement).textContent = `${this.formatTime(this.remotePlayer?.currentTime || 0)} / ${this.formatTime(duration)}`;
    });

    rc.addEventListener(RPET.IS_MUTED_CHANGED, () => {
      if (!this.isCasting) return;
      this.updateVolumeUIFromRemote();
    });

    rc.addEventListener(RPET.VOLUME_LEVEL_CHANGED, () => {
      if (!this.isCasting) return;
      this.updateVolumeUIFromRemote();
    });

    rc.addEventListener(RPET.IS_CONNECTED_CHANGED, () => {
      if (!this.remotePlayer?.isConnected) {
        this.disableCastRemoteControl();
      }
    });
  }

  private updateVolumeUIFromRemote(): void {
    const volumeFill = document.getElementById('uvf-volume-fill') as HTMLElement;
    const volumeValue = document.getElementById('uvf-volume-value');
    const volumeIcon = document.getElementById('uvf-volume-icon');
    const muteIcon = document.getElementById('uvf-mute-icon');
    const level = Math.round(((this.remotePlayer?.volumeLevel || 0) * 100));
    if (volumeFill) volumeFill.style.width = level + '%';
    if (volumeValue) (volumeValue as HTMLElement).textContent = String(level);
    const isMuted = !!this.remotePlayer?.isMuted || level === 0;
    if (volumeIcon && muteIcon) {
      if (isMuted) {
        (volumeIcon as HTMLElement).style.display = 'none';
        (muteIcon as HTMLElement).style.display = 'block';
      } else {
        (volumeIcon as HTMLElement).style.display = 'block';
        (muteIcon as HTMLElement).style.display = 'none';
      }
    }
  }

  private _syncUIFromRemote(): void {
    const duration = this.remotePlayer?.duration || 0;
    const current = this.remotePlayer?.currentTime || 0;
    const percent = duration > 0 ? (current / duration) * 100 : 0;
    const progressFilled = document.getElementById('uvf-progress-filled') as HTMLElement;
    const progressHandle = document.getElementById('uvf-progress-handle') as HTMLElement;
    const timeDisplay = document.getElementById('uvf-time-display');
    if (progressFilled) progressFilled.style.width = percent + '%';
    if (progressHandle) progressHandle.style.left = percent + '%';
    if (timeDisplay) (timeDisplay as HTMLElement).textContent = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
    this.updateVolumeUIFromRemote();
    // Also enforce gate in case of immediate resume
    this.enforceFreePreviewGate(current);
  }

  private _syncCastButtons(): void {
    const castBtn = document.getElementById('uvf-cast-btn');
    const stopBtn = document.getElementById('uvf-stop-cast-btn');
    const wrapper = this.playerWrapper || this.container?.querySelector('.uvf-player-wrapper');
    if (stopBtn) (stopBtn as HTMLElement).style.display = this.isCasting ? 'inline-flex' : 'none';
    if (castBtn) {
      if (this.isCasting) {
        castBtn.classList.add('cast-grey');
        let title = 'Pick device';
        try {
          const castNs = (window as any).cast;
          const sess = castNs?.framework?.CastContext?.getInstance()?.getCurrentSession?.();
          const dev = sess && sess.getCastDevice ? sess.getCastDevice() : null;
          if (dev && dev.friendlyName) title += ` (${dev.friendlyName})`;
        } catch (_) {}
        castBtn.setAttribute('title', title);
        castBtn.setAttribute('aria-label', title);
      } else {
        castBtn.classList.remove('cast-grey');
        castBtn.setAttribute('title', 'Cast');
        castBtn.setAttribute('aria-label', 'Cast');
      }
    }
    if (wrapper) {
      if (this.isCasting) (wrapper as HTMLElement).classList.add('uvf-casting');
      else (wrapper as HTMLElement).classList.remove('uvf-casting');
    }
  }

  /**
   * Dynamically populate settings menu based on video capabilities
   */
  private updateSettingsMenu(): void {
    this.debugLog('updateSettingsMenu called');
    const settingsMenu = document.getElementById('uvf-settings-menu');
    if (!settingsMenu) {
      this.debugError('Settings menu element not found!');
      return;
    }

    this.debugLog('Settings menu element found, updating content...');
    // Detect available qualities from video
    this.detectAvailableQualities();
    // Detect available subtitles
    this.detectAvailableSubtitles();

    this.debugLog('Available qualities:', this.availableQualities);
    this.debugLog('Available subtitles:', this.availableSubtitles);
    this.debugLog('Settings config:', this.settingsConfig);

    // Generate accordion-style menu
    this.generateAccordionMenu();
  }
  
  /**
   * Generate accordion-style settings menu
   */
  private generateAccordionMenu(): void {
    const settingsMenu = document.getElementById('uvf-settings-menu');
    if (!settingsMenu) return;

    let menuHTML = '<div class="uvf-settings-accordion">';

    // Playback Speed Accordion Section (only if enabled in config)
    if (this.settingsConfig.speed) {
      const currentSpeedLabel = this.currentPlaybackRate === 1 ? 'Normal' : `${this.currentPlaybackRate}x`;
      menuHTML += `
        <div class="uvf-accordion-item">
          <div class="uvf-accordion-header" data-section="speed">
            <div class="uvf-accordion-title">
              <span class="uvf-accordion-icon">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M13,8.2c0-3.7-0.4-6.7-0.8-6.7s-0.8,3-0.8,6.7s0.4,6.7,0.8,6.7S13,11.9,13,8.2z M8.8,11.6 c0-2.8-0.3-5.1-0.6-5.1s-0.6,2.3-0.6,5.1s0.3,5.1,0.6,5.1S8.8,14.4,8.8,11.6z M17.2,11.6c0-2.8-0.3-5.1-0.6-5.1 s-0.6,2.3-0.6,5.1s0.3,5.1,0.6,5.1S17.2,14.4,17.2,11.6z M4.4,13c0-1.9-0.2-3.4-0.4-3.4S3.6,11.1,3.6,13s0.2,3.4,0.4,3.4 S4.4,14.9,4.4,13z M20.4,13c0-1.9-0.2-3.4-0.4-3.4S19.6,11.1,19.6,13s0.2,3.4,0.4,3.4S20.4,14.9,20.4,13z"/>
                </svg>
              </span>
              <span>Playback Speed</span>
            </div>
            <div class="uvf-accordion-current">${currentSpeedLabel}</div>
            <div class="uvf-accordion-arrow">▼</div>
          </div>
          <div class="uvf-accordion-content" data-section="speed">
            <div class="uvf-settings-option speed-option ${this.currentPlaybackRate === 0.25 ? 'active' : ''}" data-speed="0.25">0.25x</div>
            <div class="uvf-settings-option speed-option ${this.currentPlaybackRate === 0.5 ? 'active' : ''}" data-speed="0.5">0.5x</div>
            <div class="uvf-settings-option speed-option ${this.currentPlaybackRate === 0.75 ? 'active' : ''}" data-speed="0.75">0.75x</div>
            <div class="uvf-settings-option speed-option ${this.currentPlaybackRate === 1 ? 'active' : ''}" data-speed="1">Normal</div>
            <div class="uvf-settings-option speed-option ${this.currentPlaybackRate === 1.25 ? 'active' : ''}" data-speed="1.25">1.25x</div>
            <div class="uvf-settings-option speed-option ${this.currentPlaybackRate === 1.5 ? 'active' : ''}" data-speed="1.5">1.5x</div>
            <div class="uvf-settings-option speed-option ${this.currentPlaybackRate === 1.75 ? 'active' : ''}" data-speed="1.75">1.75x</div>
            <div class="uvf-settings-option speed-option ${this.currentPlaybackRate === 2 ? 'active' : ''}" data-speed="2">2x</div>
          </div>
        </div>`;
    }

    // Quality Accordion Section (only if enabled in config and qualities detected)
    if (this.settingsConfig.quality && this.availableQualities.length > 0) {
      const currentQuality = this.availableQualities.find(q => q.value === this.currentQuality);
      const currentQualityLabel = currentQuality ? currentQuality.label : 'Auto';
      
      menuHTML += `
        <div class="uvf-accordion-item">
          <div class="uvf-accordion-header" data-section="quality">
            <div class="uvf-accordion-title">
              <span class="uvf-accordion-icon">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M14.5,9L12,7V9H3.5C2.67,9 2,9.67 2,10.5V13.5C2,14.33 2.67,15 3.5,15H12V17L14.5,15L17,13L14.5,11V9M22,4H10A2,2 0 0,0 8,6V8H10V6H22V18H10V16H8V18A2,2 0 0,0 10,20H22A2,2 0 0,0 24,18V6A2,2 0 0,0 22,4M5,11V13H7V11H5M9,11V13H11V11H9Z"/>
                </svg>
              </span>
              <span>Quality</span>
            </div>
            <div class="uvf-accordion-current">${currentQualityLabel}</div>
            <div class="uvf-accordion-arrow">▼</div>
          </div>
          <div class="uvf-accordion-content" data-section="quality">`;
      
      this.availableQualities.forEach(quality => {
        const isActive = quality.value === this.currentQuality ? 'active' : '';
        menuHTML += `<div class="uvf-settings-option quality-option ${isActive}" data-quality="${quality.value}">${quality.label}</div>`;
      });
      
      menuHTML += `</div></div>`;
    }

    // Subtitles Accordion Section (only if enabled in config and subtitles available)
    if (this.settingsConfig.subtitles && this.availableSubtitles.length > 0) {
      const currentSubtitle = this.availableSubtitles.find(s => s.value === this.currentSubtitle);
      const currentSubtitleLabel = currentSubtitle ? currentSubtitle.label : 'Off';
      
      menuHTML += `
        <div class="uvf-accordion-item">
          <div class="uvf-accordion-header" data-section="subtitles">
            <div class="uvf-accordion-title">
              <span class="uvf-accordion-icon">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M18,11H16.5V10.5H14.5V13.5H16.5V13H18V14A1,1 0 0,1 17,15H14A1,1 0 0,1 13,14V10A1,1 0 0,1 14,9H17A1,1 0 0,1 18,10M11,11H9.5V10.5H7.5V13.5H9.5V13H11V14A1,1 0 0,1 10,15H7A1,1 0 0,1 6,14V10A1,1 0 0,1 7,9H10A1,1 0 0,1 11,10M19,4H5C3.89,4 3,4.89 3,6V18A2,2 0 0,0 5,20H19A2,2 0 0,0 21,18V6C21,4.89 20.11,4 19,4Z"/>
                </svg>
              </span>
              <span>Subtitles</span>
            </div>
            <div class="uvf-accordion-current">${currentSubtitleLabel}</div>
            <div class="uvf-accordion-arrow">▼</div>
          </div>
          <div class="uvf-accordion-content" data-section="subtitles">`;
      
      this.availableSubtitles.forEach(subtitle => {
        const isActive = subtitle.value === this.currentSubtitle ? 'active' : '';
        menuHTML += `<div class="uvf-settings-option subtitle-option ${isActive}" data-subtitle="${subtitle.value}">${subtitle.label}</div>`;
      });
      
      menuHTML += `</div></div>`;
    }
    
    // Close accordion container
    menuHTML += '</div>';
    
    // If no sections are enabled or available, show a message
    if (menuHTML === '<div class="uvf-settings-accordion"></div>') {
      menuHTML = '<div class="uvf-settings-accordion"><div class="uvf-settings-empty">No settings available</div></div>';
    }

    this.debugLog('Generated menu HTML length:', menuHTML.length);
    this.debugLog('Generated menu HTML content:', menuHTML.substring(0, 200) + (menuHTML.length > 200 ? '...' : ''));
    
    settingsMenu.innerHTML = menuHTML;
    this.debugLog('Settings menu HTML set successfully');

    // Add event listeners for settings options
    this.setupSettingsEventListeners();
    this.debugLog('Settings event listeners setup complete');
  }

  /**
   * Detect available video qualities from different sources
   */
  private detectAvailableQualities(): void {
    this.availableQualities = [{ value: 'auto', label: 'Auto' }];

    if (this.hls && this.hls.levels) {
      // HLS qualities
      this.hls.levels.forEach((level: any, index: number) => {
        if (level.height) {
          this.availableQualities.push({
            value: index.toString(),
            label: `${level.height}p`
          });
        }
      });
    } else if (this.dash && this.dash.getBitrateInfoListFor) {
      // DASH qualities
      try {
        const videoQualities = this.dash.getBitrateInfoListFor('video');
        videoQualities.forEach((quality: any, index: number) => {
          if (quality.height) {
            this.availableQualities.push({
              value: index.toString(),
              label: `${quality.height}p`
            });
          }
        });
      } catch (e) {
        this.debugError('Error detecting DASH qualities:', e);
      }
    } else if (this.video?.videoHeight) {
      // Native video - add common resolutions based on current resolution
      const height = this.video.videoHeight;
      const commonQualities = [2160, 1440, 1080, 720, 480, 360];
      
      commonQualities.forEach(quality => {
        if (quality <= height) {
          this.availableQualities.push({
            value: quality.toString(),
            label: `${quality}p`
          });
        }
      });
    }
  }

  /**
   * Detect available subtitle tracks
   */
  private detectAvailableSubtitles(): void {
    this.availableSubtitles = [{ value: 'off', label: 'Off' }];

    if (this.video?.textTracks) {
      // HTML5 text tracks
      Array.from(this.video.textTracks).forEach((track, index) => {
        if (track.kind === 'subtitles' || track.kind === 'captions') {
          this.availableSubtitles.push({
            value: index.toString(),
            label: track.label || track.language || `Track ${index + 1}`
          });
        }
      });
    }

    // HLS subtitles
    if (this.hls && this.hls.subtitleTracks) {
      this.hls.subtitleTracks.forEach((track: any, index: number) => {
        this.availableSubtitles.push({
          value: `hls-${index}`,
          label: track.name || track.lang || `Track ${index + 1}`
        });
      });
    }
  }

  /**
   * Setup event listeners for accordion-style settings menu
   */
  private setupSettingsEventListeners(): void {
    const settingsMenu = document.getElementById('uvf-settings-menu');
    if (!settingsMenu) return;

    // Accordion header click handlers
    settingsMenu.querySelectorAll('.uvf-accordion-header').forEach(header => {
      header.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const accordionItem = header.parentElement;
        const section = header.getAttribute('data-section');
        
        if (accordionItem && section) {
          this.toggleAccordionSection(accordionItem, section);
        }
      });
    });

    // Speed options
    settingsMenu.querySelectorAll('.speed-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const speed = parseFloat((e.target as HTMLElement).dataset.speed || '1');
        this.setPlaybackRateFromSettings(speed);
        this.updateAccordionAfterSelection('speed');
      });
    });

    // Quality options
    settingsMenu.querySelectorAll('.quality-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const quality = (e.target as HTMLElement).dataset.quality || 'auto';
        this.setQualityFromSettings(quality);
        this.updateAccordionAfterSelection('quality');
      });
    });

    // Subtitle options
    settingsMenu.querySelectorAll('.subtitle-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const subtitle = (e.target as HTMLElement).dataset.subtitle || 'off';
        this.setSubtitle(subtitle);
        this.updateAccordionAfterSelection('subtitles');
      });
    });
  }
  
  /**
   * Toggle accordion section
   */
  private toggleAccordionSection(accordionItem: Element, section: string): void {
    const isExpanded = accordionItem.classList.contains('expanded');
    
    // If clicking the same section that's already expanded, just close it
    if (isExpanded) {
      accordionItem.classList.remove('expanded');
      return;
    }
    
    // Otherwise, close all sections and open the clicked one
    const settingsMenu = document.getElementById('uvf-settings-menu');
    if (settingsMenu) {
      settingsMenu.querySelectorAll('.uvf-accordion-item.expanded').forEach(item => {
        item.classList.remove('expanded');
      });
    }
    
    // Open the clicked section
    accordionItem.classList.add('expanded');
  }
  
  /**
   * Hide settings menu with proper styling
   */
  private hideSettingsMenu(): void {
    const settingsMenu = document.getElementById('uvf-settings-menu');
    if (!settingsMenu) return;
    
    settingsMenu.classList.remove('active');
    
    // Apply fallback styles to ensure menu is hidden
    settingsMenu.style.display = 'none';
    settingsMenu.style.visibility = 'hidden';
    settingsMenu.style.opacity = '0';
    
    // Also close any expanded accordions
    settingsMenu.querySelectorAll('.uvf-accordion-item.expanded').forEach(item => {
      item.classList.remove('expanded');
    });
    
    this.debugLog('Settings menu hidden via hideSettingsMenu()');
  }

  /**
   * Update accordion after user makes a selection
   */
  private updateAccordionAfterSelection(section: string): void {
    // Close the accordion section after selection
    const settingsMenu = document.getElementById('uvf-settings-menu');
    if (settingsMenu) {
      settingsMenu.querySelectorAll('.uvf-accordion-item.expanded').forEach(item => {
        item.classList.remove('expanded');
      });
    }
    
    // Auto-close settings menu on mobile after a short delay
    if (this.isMobileDevice()) {
      setTimeout(() => {
        this.hideSettingsMenu();
      }, 300);
    } else {
      // Desktop: just refresh the menu to update current values
      setTimeout(() => {
        this.generateAccordionMenu();
        this.setupSettingsEventListeners();
      }, 100);
    }
  }

  /**
   * Update active states in settings menu
   */
  private updateSettingsActiveStates(className: string, activeElement: HTMLElement): void {
    const settingsMenu = document.getElementById('uvf-settings-menu');
    if (!settingsMenu) return;

    // Remove active class from all options of this type
    settingsMenu.querySelectorAll(`.${className}`).forEach(option => {
      option.classList.remove('active');
    });

    // Add active class to selected option
    activeElement.classList.add('active');
  }

  /**
   * Set playback rate for settings menu
   */
  private setPlaybackRateFromSettings(rate: number): void {
    this.currentPlaybackRate = rate;
    if (this.video) {
      this.video.playbackRate = rate;
    }
    this.debugLog(`Playback rate set to ${rate}x`);
  }

  /**
   * Set video quality for settings menu
   */
  private setQualityFromSettings(quality: string): void {
    this.currentQuality = quality;
    
    if (quality === 'auto') {
      // Enable auto quality
      if (this.hls) {
        this.hls.currentLevel = -1; // Auto
      } else if (this.dash) {
        this.dash.setAutoSwitchQualityFor('video', true);
      }
    } else {
      // Set specific quality
      const qualityIndex = parseInt(quality);
      
      if (this.hls && !isNaN(qualityIndex) && this.hls.levels[qualityIndex]) {
        this.hls.currentLevel = qualityIndex;
      } else if (this.dash && !isNaN(qualityIndex)) {
        this.dash.setAutoSwitchQualityFor('video', false);
        this.dash.setQualityFor('video', qualityIndex);
      }
    }
    
    this.debugLog(`Quality set to ${quality}`);
  }

  /**
   * Set subtitle track
   */
  private setSubtitle(subtitle: string): void {
    this.currentSubtitle = subtitle;
    
    if (subtitle === 'off') {
      // Disable all subtitles
      if (this.video?.textTracks) {
        Array.from(this.video.textTracks).forEach(track => {
          track.mode = 'disabled';
        });
      }
      if (this.hls) {
        this.hls.subtitleTrack = -1;
      }
    } else if (subtitle.startsWith('hls-')) {
      // HLS subtitle
      const index = parseInt(subtitle.replace('hls-', ''));
      if (this.hls && !isNaN(index)) {
        this.hls.subtitleTrack = index;
      }
    } else {
      // HTML5 text track
      const trackIndex = parseInt(subtitle);
      if (this.video?.textTracks && !isNaN(trackIndex)) {
        Array.from(this.video.textTracks).forEach((track, index) => {
          track.mode = index === trackIndex ? 'showing' : 'disabled';
        });
      }
    }
    
    this.debugLog(`Subtitle set to ${subtitle}`);
  }

  private _updateCastActiveTracks(): void {
    try {
      const castNs = (window as any).cast;
      if (!castNs || !castNs.framework) return;
      const session = castNs.framework.CastContext.getInstance().getCurrentSession();
      if (!session) return;
      const media = session.getMediaSession && session.getMediaSession();
      if (!media) return;
      let ids: number[] = [];
      if (this.selectedSubtitleKey && this.selectedSubtitleKey !== 'off') {
        const tid = this._castTrackIdByKey ? this._castTrackIdByKey[this.selectedSubtitleKey] : null;
        if (tid) ids = [tid];
      }
      if (typeof media.setActiveTracks === 'function') {
        media.setActiveTracks(ids, () => {}, () => {});
      } else if (typeof media.setActiveTrackIds === 'function') {
        media.setActiveTrackIds(ids);
      }
    } catch (_) {}
  }

  private onCastButtonClick(): void {
    // On iOS, use AirPlay instead of Google Cast
    if (this.isIOSDevice()) {
      this.showAirPlayPicker();
      return;
    }
    
    // Google Cast for non-iOS devices
    try {
      const castNs = (window as any).cast;
      if (this.isCasting && castNs && castNs.framework) {
        const ctx = castNs.framework.CastContext.getInstance();
        ctx.requestSession().catch(() => {});
        return;
      }
    } catch (_) {}
    // Not casting yet
    this.initCast();
  }
  
  /**
   * Show AirPlay picker for iOS devices
   */
  private showAirPlayPicker(): void {
    if (!this.video) {
      this.showNotification('Video not ready');
      return;
    }
    
    // Check if AirPlay is supported
    const videoElement = this.video as any;
    if (typeof videoElement.webkitShowPlaybackTargetPicker === 'function') {
      try {
        videoElement.webkitShowPlaybackTargetPicker();
        this.debugLog('AirPlay picker shown');
      } catch (error) {
        this.debugWarn('Failed to show AirPlay picker:', (error as Error).message);
        this.showNotification('AirPlay not available');
      }
    } else {
      this.debugWarn('AirPlay not supported on this device');
      this.showNotification('AirPlay not supported');
    }
  }

  private stopCasting(): void {
    try {
      const castNs = (window as any).cast;
      if (!castNs || !castNs.framework) { this.showNotification('Cast not ready'); return; }
      const ctx = castNs.framework.CastContext.getInstance();
      const sess = ctx.getCurrentSession && ctx.getCurrentSession();
      if (sess) {
        try { sess.endSession(true); } catch (_) {}
        this.disableCastRemoteControl();
        this.showNotification('Stopped casting');
      } else {
        this.showNotification('Not casting');
      }
    } catch (_) {
      // ignore
    } finally {
      this._syncCastButtons();
    }
  }

  private async initCast(): Promise<void> {
    try {
      let castNs = (window as any).cast;
      if (!castNs || !castNs.framework) {
        await this.loadScript('https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1');
        // wait briefly for framework
        const start = Date.now();
        while ((!((window as any).cast && (window as any).cast.framework)) && Date.now() - start < 3000) {
          await new Promise(r => setTimeout(r, 100));
        }
        castNs = (window as any).cast;
      }
      if (!(castNs && castNs.framework)) {
        this.showNotification('Cast framework not ready');
        return;
      }

      this.setupCastContext();
      const ctx = castNs.framework.CastContext.getInstance();
      await ctx.requestSession();
      const session = ctx.getCurrentSession();
      if (!session) { this.showNotification('No cast session'); return; }

      const url = this.source?.url || this.video?.src || '';
      const u = (url || '').toLowerCase();
      const contentType = u.includes('.m3u8') ? 'application/x-mpegurl'
                        : u.includes('.mpd')  ? 'application/dash+xml'
                        : u.includes('.webm') ? 'video/webm'
                        : 'video/mp4';

      const chromeNs = (window as any).chrome;
      const mediaInfo = new chromeNs.cast.media.MediaInfo(url, contentType);
      mediaInfo.streamType = chromeNs.cast.media.StreamType.BUFFERED;
      try {
        const md = new chromeNs.cast.media.GenericMediaMetadata();
        md.title = this.source?.metadata?.title || (this.video?.currentSrc ? this.video!.currentSrc.split('/').slice(-1)[0] : 'Web Player');
        mediaInfo.metadata = md;
      } catch (_) {}

      // Subtitle tracks -> Cast tracks mapping
      const castTracks: any[] = [];
      this._castTrackIdByKey = {};
      const inferTextTrackContentType = (trackUrl: string) => {
        const lu = (trackUrl || '').toLowerCase();
        if (lu.endsWith('.vtt')) return 'text/vtt';
        if (lu.endsWith('.srt')) return 'application/x-subrip';
        if (lu.endsWith('.ttml') || lu.endsWith('.dfxp') || lu.endsWith('.xml')) return 'application/ttml+xml';
        return 'text/vtt';
      };
      if (Array.isArray(this.subtitles) && this.subtitles.length > 0) {
        let nextId = 1;
        for (let i = 0; i < this.subtitles.length; i++) {
          const t = this.subtitles[i];
          const key = t.label || t.language || `Track ${i+1}`;
          try {
            const track = new chromeNs.cast.media.Track(nextId, chromeNs.cast.media.TrackType.TEXT);
            track.trackContentId = t.url;
            track.trackContentType = inferTextTrackContentType(t.url);
            track.subtype = chromeNs.cast.media.TextTrackType.SUBTITLES;
            track.name = key;
            track.language = t.language || '';
            track.customData = null;
            castTracks.push(track);
            this._castTrackIdByKey[key] = nextId;
            nextId++;
          } catch (_) {}
        }
      }
      if (castTracks.length > 0) {
        mediaInfo.tracks = castTracks;
        try {
          const style = new chromeNs.cast.media.TextTrackStyle();
          style.backgroundColor = '#00000000';
          style.foregroundColor = '#FFFFFFFF';
          style.edgeType = chromeNs.cast.media.TextTrackEdgeType.DROP_SHADOW;
          style.edgeColor = '#000000FF';
          style.fontScale = 1.0;
          mediaInfo.textTrackStyle = style;
        } catch (_) {}
      }

      const request = new chromeNs.cast.media.LoadRequest(mediaInfo);
      request.autoplay = true;
      try { request.currentTime = Math.max(0, Math.floor(this.video?.currentTime || 0)); } catch (_) {}
      // Determine selected subtitle key from currentSubtitleIndex
      const currentIdx = this.currentSubtitleIndex;
      this.selectedSubtitleKey = (currentIdx >= 0 && this.subtitles[currentIdx]) ? (this.subtitles[currentIdx].label || this.subtitles[currentIdx].language) : 'off';
      if (this.selectedSubtitleKey && this.selectedSubtitleKey !== 'off') {
        const tid = this._castTrackIdByKey[this.selectedSubtitleKey];
        if (tid) request.activeTrackIds = [tid];
      }

      await session.loadMedia(request);
      this.enableCastRemoteControl();
      this.showNotification('Casting to device');
    } catch (err) {
      if (this.config.debug) console.error('[Cast] init cast failed:', err);
      this.showNotification('Cast failed');
    }
  }
  
  private async shareVideo(): Promise<void> {
    const shareData: ShareData = { url: window.location.href };
    const t = (this.source?.metadata?.title || '').toString().trim();
    const d = (this.source?.metadata?.description || '').toString().trim();
    if (t) shareData.title = t;
    if (d) shareData.text = d;
    
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        this.showNotification('Link copied to clipboard');
      }
    } catch (error) {
      console.error('Share failed:', error);
      this.showNotification('Share failed');
    }
  }
  
  /**
   * Check if text is truncated and needs tooltip
   */
  private isTextTruncated(element: HTMLElement): boolean {
    return element.scrollWidth > element.offsetWidth || element.scrollHeight > element.offsetHeight;
  }

  /**
   * Show tooltip for truncated text
   */
  private showTextTooltip(element: HTMLElement, text: string): void {
    // Remove existing tooltip
    const existingTooltip = element.querySelector('.uvf-text-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'uvf-text-tooltip';
    tooltip.textContent = text;
    
    element.appendChild(tooltip);
    
    // Show tooltip with delay
    setTimeout(() => {
      tooltip.classList.add('show');
    }, 100);
  }

  /**
   * Hide tooltip
   */
  private hideTextTooltip(element: HTMLElement): void {
    const tooltip = element.querySelector('.uvf-text-tooltip');
    if (tooltip) {
      tooltip.classList.remove('show');
      setTimeout(() => {
        if (tooltip.parentElement) {
          tooltip.remove();
        }
      }, 300);
    }
  }

  /**
   * Setup tooltip handlers for title and description
   */
  private setupTextTooltips(): void {
    const titleElement = document.getElementById('uvf-video-title');
    const descElement = document.getElementById('uvf-video-description');

    if (titleElement) {
      titleElement.addEventListener('mouseenter', () => {
        const titleText = (this.source?.metadata?.title || '').toString().trim();
        if (this.isTextTruncated(titleElement) && titleText) {
          this.showTextTooltip(titleElement, titleText);
        }
      });
      
      titleElement.addEventListener('mouseleave', () => {
        this.hideTextTooltip(titleElement);
      });
      
      // Touch support for mobile
      titleElement.addEventListener('touchstart', () => {
        const titleText = (this.source?.metadata?.title || '').toString().trim();
        if (this.isTextTruncated(titleElement) && titleText) {
          this.showTextTooltip(titleElement, titleText);
          // Auto-hide after 3 seconds on touch
          setTimeout(() => {
            this.hideTextTooltip(titleElement);
          }, 3000);
        }
      });
    }

    if (descElement) {
      descElement.addEventListener('mouseenter', () => {
        const descText = (this.source?.metadata?.description || '').toString().trim();
        if (this.isTextTruncated(descElement) && descText) {
          this.showTextTooltip(descElement, descText);
        }
      });
      
      descElement.addEventListener('mouseleave', () => {
        this.hideTextTooltip(descElement);
      });
      
      // Touch support for mobile
      descElement.addEventListener('touchstart', () => {
        const descText = (this.source?.metadata?.description || '').toString().trim();
        if (this.isTextTruncated(descElement) && descText) {
          this.showTextTooltip(descElement, descText);
          // Auto-hide after 3 seconds on touch
          setTimeout(() => {
            this.hideTextTooltip(descElement);
          }, 3000);
        }
      });
    }
  }

  /**
   * Smart text truncation based on word count
   */
  private smartTruncateText(text: string, maxWords: number = 12): { truncated: string, needsTooltip: boolean } {
    const words = text.split(' ');
    if (words.length <= maxWords) {
      return { truncated: text, needsTooltip: false };
    }
    
    const truncated = words.slice(0, maxWords).join(' ') + '...';
    return { truncated, needsTooltip: true };
  }

  /**
   * Apply smart text display based on screen size and content length
   */
  private applySmartTextDisplay(titleEl: HTMLElement | null, descEl: HTMLElement | null, titleText: string, descText: string): void {
    const isDesktop = window.innerWidth >= 1024;
    const isMobile = window.innerWidth < 768;
    
    if (titleEl && titleText) {
      const wordCount = titleText.split(' ').length;
      
      if (isDesktop && wordCount > 8 && wordCount <= 15) {
        // Use multiline for moderately long titles on desktop
        titleEl.classList.add('multiline');
        titleEl.textContent = titleText;
      } else if (wordCount > 12) {
        // Smart truncation for very long titles
        const maxWords = isMobile ? 8 : isDesktop ? 12 : 10;
        const { truncated } = this.smartTruncateText(titleText, maxWords);
        titleEl.textContent = truncated;
        titleEl.classList.remove('multiline');
      } else {
        titleEl.textContent = titleText;
        titleEl.classList.remove('multiline');
      }
    }
    
    if (descEl && descText) {
      const wordCount = descText.split(' ').length;
      
      if (isDesktop && wordCount > 15 && wordCount <= 25) {
        // Use multiline for moderately long descriptions on desktop
        descEl.classList.add('multiline');
        descEl.textContent = descText;
      } else if (wordCount > 20) {
        // Smart truncation for very long descriptions
        const maxWords = isMobile ? 12 : isDesktop ? 18 : 15;
        const { truncated } = this.smartTruncateText(descText, maxWords);
        descEl.textContent = truncated;
        descEl.classList.remove('multiline');
      } else {
        descEl.textContent = descText;
        descEl.classList.remove('multiline');
      }
    }
  }

  private updateMetadataUI(): void {
    try {
      const md = this.source?.metadata || ({} as any);
      const titleBar = (this.container?.querySelector('.uvf-title-bar') as HTMLElement) || null;
      const titleEl = document.getElementById('uvf-video-title') as HTMLElement | null;
      const descEl = document.getElementById('uvf-video-description') as HTMLElement | null;
      const thumbEl = document.getElementById('uvf-video-thumb') as HTMLImageElement | null;

      const titleText = (md.title || '').toString().trim();
      const descText = (md.description || '').toString().trim();
      const thumbUrl = (md.thumbnailUrl || '').toString().trim();

      // Apply smart text display with truncation and multiline support
      this.applySmartTextDisplay(titleEl, descEl, titleText, descText);

      // Show/hide elements
      if (titleEl) {
        titleEl.style.display = titleText ? 'block' : 'none';
      }
      if (descEl) {
        descEl.style.display = descText ? 'block' : 'none';
      }

      // Thumbnail (removed from layout but keeping for compatibility)
      if (thumbEl) {
        thumbEl.style.display = 'none'; // Always hidden in new layout
      }

      // Hide entire title bar if nothing to show
      const hasAny = !!(titleText || descText);
      if (titleBar) {
        titleBar.style.display = hasAny ? '' : 'none';
      }

      // Setup tooltips for truncated text
      setTimeout(() => {
        this.setupTextTooltips();
      }, 100); // Small delay to ensure elements are rendered
      
    } catch (_) { /* ignore */ }
  }

  private showNotification(message: string): void {
    // Use the shortcut indicator for notifications
    this.showShortcutIndicator(message);
  }

  /**
   * Security check to determine if video can be played
   */
  private canPlayVideo(): boolean {
    const freeDuration = Number(this.config.freeDuration || 0);
    const currentTime = this.video?.currentTime || 0;
    
    // Always allow if no free duration limit is set
    if (freeDuration <= 0) return true;
    
    // Allow if payment was successful
    if (this.paymentSuccessful) return true;
    
    // Allow if within free preview duration
    if (currentTime < freeDuration) return true;
    
    // Check if paywall controller indicates user is authenticated
    if (this.paywallController && 
        typeof this.paywallController.isAuthenticated === 'function') {
      const isAuth = this.paywallController.isAuthenticated();
      if (isAuth) {
        this.paymentSuccessful = true;
        return true;
      }
    }
    
    return false;
  }

  /**
   * Enforce paywall security when bypass attempts are detected
   */
  private enforcePaywallSecurity(): void {
    this.debugLog('Enforcing paywall security');
    
    // Pause video immediately
    try {
      if (this.video && !this.video.paused) {
        this.video.pause();
      }
    } catch (_) {}
    
    // Activate paywall state
    this.isPaywallActive = true;
    
    // Show paywall overlay
    if (this.paywallController) {
      try {
        this.paywallController.openOverlay();
      } catch (error) {
        this.debugError('Error showing paywall overlay:', error);
      }
    }
    
    // Start monitoring for overlay tampering
    this.startOverlayMonitoring();
  }

  /**
   * Monitor overlay elements to detect removal attempts
   */
  private startOverlayMonitoring(): void {
    if (!this.playerWrapper || this.paymentSuccessful) return;
    
    // Clear existing monitor
    if (this.authValidationInterval) {
      clearInterval(this.authValidationInterval);
      this.authValidationInterval = null;
    }
    
    this.debugLog('Starting overlay monitoring - payment successful:', this.paymentSuccessful, 'paywall active:', this.isPaywallActive);
    
    // Monitor every 1000ms (less aggressive than before)
    this.authValidationInterval = setInterval(() => {
      // First check: stop monitoring if payment successful or paywall inactive
      if (!this.isPaywallActive || this.paymentSuccessful) {
        this.debugLog('Stopping overlay monitoring - payment successful:', this.paymentSuccessful, 'paywall active:', this.isPaywallActive);
        if (this.authValidationInterval) {
          clearInterval(this.authValidationInterval);
          this.authValidationInterval = null;
        }
        return;
      }
      
      // Double-check payment success before enforcing security
      if (this.paymentSuccessful) {
        this.debugLog('Payment successful detected during monitoring, stopping');
        if (this.authValidationInterval) {
          clearInterval(this.authValidationInterval);
          this.authValidationInterval = null;
        }
        return;
      }
      
      // Check for overlay presence
      const paywallOverlays = this.playerWrapper!.querySelectorAll('.uvf-paywall-overlay, .uvf-auth-overlay');
      const visibleOverlays = Array.from(paywallOverlays).filter(overlay => {
        const element = overlay as HTMLElement;
        return element.style.display !== 'none' && 
               element.offsetParent !== null && 
               window.getComputedStyle(element).visibility !== 'hidden';
      });
      
      if (visibleOverlays.length === 0) {
        this.overlayRemovalAttempts++;
        this.debugWarn(`Overlay removal attempt detected (${this.overlayRemovalAttempts}/${this.maxOverlayRemovalAttempts})`);
        
        // Final check before taking action - ensure payment wasn't just completed
        if (this.paymentSuccessful) {
          this.debugLog('Payment successful detected, ignoring overlay removal');
          if (this.authValidationInterval) {
            clearInterval(this.authValidationInterval);
            this.authValidationInterval = null;
          }
          return;
        }
        
        if (this.overlayRemovalAttempts >= this.maxOverlayRemovalAttempts) {
          this.handleSecurityViolation();
        } else {
          // Recreate overlay
          this.enforcePaywallSecurity();
        }
      }
      
      // Additional check: ensure video is paused if not authenticated
      if (this.video && !this.video.paused && !this.paymentSuccessful) {
        this.debugWarn('Unauthorized playbook detected, pausing video');
        try {
          this.video.pause();
          const freeDuration = Number(this.config.freeDuration || 0);
          if (freeDuration > 0) {
            this.video.currentTime = Math.max(0, freeDuration - 1);
          }
        } catch (_) {}
      }
    }, 1000);
  }

  /**
   * Handle severe security violation attempts
   */
  private handleSecurityViolation(): void {
    this.debugError('Security violation detected - disabling video');
    
    // Disable video completely
    if (this.video) {
      this.video.pause();
      this.video.currentTime = 0;
      this.video.src = ''; // Clear video source
      this.video.style.display = 'none';
    }
    
    // Show security violation message
    this.showSecurityViolationMessage();
    
    // Clear monitoring interval
    if (this.authValidationInterval) {
      clearInterval(this.authValidationInterval);
    }
  }

  /**
   * Show security violation message
   */
  private showSecurityViolationMessage(): void {
    if (!this.playerWrapper) return;
    
    // Clear existing content
    this.playerWrapper.innerHTML = '';
    
    // Create security violation overlay
    const securityOverlay = document.createElement('div');
    securityOverlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      color: #ff6b6b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      text-align: center;
      padding: 40px;
    `;
    
    const messageContainer = document.createElement('div');
    messageContainer.innerHTML = `
      <div style="font-size: 24px; font-weight: bold; margin-bottom: 16px; color: #ff6b6b;">
        🔒 Security Violation Detected
      </div>
      <div style="font-size: 16px; line-height: 1.5; color: rgba(255, 255, 255, 0.9);">
        Unauthorized access attempt detected.<br>
        Please refresh the page and complete authentication to continue.
      </div>
      <div style="margin-top: 24px;">
        <button onclick="window.location.reload()" style="
          background: #ff4d4f;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
        ">Reload Page</button>
      </div>
    `;
    
    securityOverlay.appendChild(messageContainer);
    this.playerWrapper.appendChild(securityOverlay);
  }

  /**
   * Force cleanup of all paywall/auth overlays
   */
  private forceCleanupOverlays(): void {
    this.debugLog('Force cleanup of overlays called');
    
    if (!this.playerWrapper) return;
    
    // Find and remove all overlay elements
    const overlays = this.playerWrapper.querySelectorAll('.uvf-paywall-overlay, .uvf-auth-overlay');
    overlays.forEach((overlay: Element) => {
      const htmlOverlay = overlay as HTMLElement;
      this.debugLog('Removing overlay:', htmlOverlay.className);
      
      // Hide immediately
      htmlOverlay.style.display = 'none';
      htmlOverlay.classList.remove('active');
      
      // Remove from DOM
      if (htmlOverlay.parentNode) {
        htmlOverlay.parentNode.removeChild(htmlOverlay);
      }
    });
    
    // Also tell paywall controller to clean up
    if (this.paywallController && typeof this.paywallController.destroyOverlays === 'function') {
      this.debugLog('Calling paywallController.destroyOverlays()');
      this.paywallController.destroyOverlays();
    }
  }

  /**
   * Show the EPG button in the controls
   */
  public showEPGButton(): void {
    const epgBtn = document.getElementById('uvf-epg-btn');
    if (epgBtn) {
      epgBtn.style.display = 'block';
      this.debugLog('EPG button shown');
    } else {
      this.debugLog('EPG button not found in DOM');
    }
  }

  /**
   * Hide the EPG button in the controls
   */
  public hideEPGButton(): void {
    const epgBtn = document.getElementById('uvf-epg-btn');
    if (epgBtn) {
      epgBtn.style.display = 'none';
      this.debugLog('EPG button hidden');
    }
  }

  /**
   * Set EPG data and show the EPG button if data is available
   * @param epgData - The EPG data to set
   */
  public setEPGData(epgData: any): void {
    if (epgData && Object.keys(epgData).length > 0) {
      this.showEPGButton();
      this.debugLog('EPG data set, button shown');
      // Emit event to notify that EPG data is available
      this.emit('epgDataSet', { data: epgData });
    } else {
      this.hideEPGButton();
      this.debugLog('No EPG data provided, button hidden');
    }
  }

  /**
   * Check if EPG button is currently visible
   */
  public isEPGButtonVisible(): boolean {
    const epgBtn = document.getElementById('uvf-epg-btn');
    return epgBtn ? epgBtn.style.display !== 'none' : false;
  }

  private async cleanup(): Promise<void> {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    if (this.dash) {
      this.dash.reset();
      this.dash = null;
    }

    this.qualities = [];
    this.currentQualityIndex = -1;
    this.autoQuality = true;
  }

  async destroy(): Promise<void> {
    await this.cleanup();

    // Clear timeouts
    if (this.hideControlsTimeout) {
      clearTimeout(this.hideControlsTimeout);
      this.hideControlsTimeout = null;
    }
    if (this.volumeHideTimeout) {
      clearTimeout(this.volumeHideTimeout);
      this.volumeHideTimeout = null;
    }

    // Clear security monitoring
    if (this.authValidationInterval) {
      clearInterval(this.authValidationInterval);
      this.authValidationInterval = null;
    }

    // Reset security state
    this.isPaywallActive = false;
    this.overlayRemovalAttempts = 0;

    // Destroy paywall controller
    if (this.paywallController && typeof this.paywallController.destroy === 'function') {
      this.paywallController.destroy();
      this.paywallController = null;
    }

    // Destroy chapter managers
    if (this.chapterManager && typeof this.chapterManager.destroy === 'function') {
      this.chapterManager.destroy();
      this.chapterManager = null;
    }
    if (this.coreChapterManager) {
      this.coreChapterManager.destroy();
      this.coreChapterManager = null;
    }

    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
      this.video.remove();
      this.video = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
    }

    this.events.removeAllListeners();
  }
}
