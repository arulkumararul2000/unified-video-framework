/**
 * Google IMA Ads Manager
 * Supports ALL Google ad types:
 * - Pre-roll (before video)
 * - Mid-roll (during video)
 * - Post-roll (after video)
 * - Overlay ads (non-linear)
 * - Companion ads (sidebar/banner)
 * - Bumper ads (short 6s ads)
 * - Skippable & non-skippable ads
 */

export interface GoogleAdsConfig {
  // Ad tag URL (VAST/VMAP)
  adTagUrl: string;
  
  // Optional: Specific ad break times (for mid-rolls)
  // If not provided, uses VMAP schedule from ad server
  midrollTimes?: number[];  // e.g., [30, 60, 120] = ads at 30s, 60s, 120s
  
  // Companion ad containers
  companionAdSlots?: Array<{
    containerId: string;  // HTML element ID
    width: number;
    height: number;
  }>;
  
  // Callbacks
  onAdStart?: () => void;
  onAdEnd?: () => void;
  onAdError?: (error: any) => void;
  onAllAdsComplete?: () => void;
  onAdCuePoints?: (cuePoints: number[]) => void;  // Called when ad schedule is loaded
}

export class GoogleAdsManager {
  private video: HTMLVideoElement;
  private adContainer: HTMLElement;
  private config: GoogleAdsConfig;
  private adsManager: any = null;
  private adsLoader: any = null;
  private adDisplayContainer: any = null;
  private isAdPlaying = false;

  constructor(video: HTMLVideoElement, adContainer: HTMLElement, config: GoogleAdsConfig) {
    this.video = video;
    this.adContainer = adContainer;
    this.config = config;
  }

  /**
   * Initialize ads system
   */
  async initialize(): Promise<void> {
    try {
      await this.loadIMASDK();
      this.setupAdsLoader();
    } catch (error) {
      console.error('Failed to initialize Google Ads:', error);
      this.config.onAdError?.(error);
    }
  }

  /**
   * Load Google IMA SDK
   */
  private loadIMASDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).google?.ima) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google IMA SDK'));
      document.head.appendChild(script);
    });
  }

  /**
   * Setup ads loader
   */
  private setupAdsLoader(): void {
    const google = (window as any).google;
    
    // Create ad display container
    this.adDisplayContainer = new google.ima.AdDisplayContainer(
      this.adContainer,
      this.video
    );
    
    // Create ads loader
    this.adsLoader = new google.ima.AdsLoader(this.adDisplayContainer);
    
    // Register for ads loaded event
    this.adsLoader.addEventListener(
      google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      (event: any) => this.onAdsManagerLoaded(event),
      false
    );
    
    // Register for error event
    this.adsLoader.addEventListener(
      google.ima.AdErrorEvent.Type.AD_ERROR,
      (event: any) => this.onAdError(event),
      false
    );
    
    // Signal when video content completes (for post-rolls)
    this.video.addEventListener('ended', () => {
      if (!this.isAdPlaying) {
        this.adsLoader?.contentComplete();
      }
    });
  }

  /**
   * Request ads
   */
  requestAds(): void {
    const google = (window as any).google;
    
    try {
      const adsRequest = new google.ima.AdsRequest();
      adsRequest.adTagUrl = this.config.adTagUrl;
      
      // Set video dimensions
      adsRequest.linearAdSlotWidth = this.video.clientWidth;
      adsRequest.linearAdSlotHeight = this.video.clientHeight;
      adsRequest.nonLinearAdSlotWidth = this.video.clientWidth;
      adsRequest.nonLinearAdSlotHeight = Math.floor(this.video.clientHeight / 3);
      
      // Set companion ad slots if provided
      if (this.config.companionAdSlots && this.config.companionAdSlots.length > 0) {
        const companionAdSlots = this.config.companionAdSlots.map(slot => {
          return new google.ima.CompanionAdSelectionSettings();
        });
        adsRequest.setAdWillAutoPlay(true);
        adsRequest.setAdWillPlayMuted(false);
      }
      
      // Request ads
      this.adsLoader.requestAds(adsRequest);
    } catch (error) {
      console.error('Error requesting ads:', error);
      this.config.onAdError?.(error);
    }
  }

  /**
   * Initialize ad display container (must be called on user gesture)
   */
  initAdDisplayContainer(): void {
    try {
      this.adDisplayContainer?.initialize();
    } catch (error) {
      console.warn('Ad display container already initialized');
    }
  }

  /**
   * Handle ads manager loaded
   */
  private onAdsManagerLoaded(event: any): void {
    const google = (window as any).google;
    
    // Setup ads rendering settings
    const adsRenderingSettings = new google.ima.AdsRenderingSettings();
    adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;
    adsRenderingSettings.enablePreloading = true;
    
    // Get the ads manager
    this.adsManager = event.getAdsManager(this.video, adsRenderingSettings);
    
    // Extract cue points (ad break times) from VMAP/ad server
    try {
      const cuePoints = this.adsManager.getCuePoints();
      if (cuePoints && cuePoints.length > 0) {
        // Process all cue points including pre-roll (0) and post-roll (-1)
        const allCuePoints = cuePoints.map((time: number) => {
          // Convert special values to actual times
          if (time === 0) return 0;           // Pre-roll at start
          if (time === -1) return -1;         // Post-roll (will be converted to video duration later)
          return time;                         // Mid-roll at specific time
        });
        
        console.log('📍 Ad cue points detected (pre/mid/post):', allCuePoints);
        
        // Notify callback with all cue points
        if (this.config.onAdCuePoints) {
          this.config.onAdCuePoints(allCuePoints);
        }
      }
    } catch (error) {
      console.warn('Could not extract ad cue points:', error);
    }
    
    // Setup ads manager event listeners
    this.setupAdsManagerListeners();
    
    try {
      // Initialize ads manager
      this.adsManager.init(
        this.video.clientWidth,
        this.video.clientHeight,
        google.ima.ViewMode.NORMAL
      );
      
      // Start ads
      this.adsManager.start();
    } catch (error) {
      console.error('Error starting ads:', error);
      this.video.play().catch(() => {});
    }
  }

  /**
   * Setup ads manager event listeners
   */
  private setupAdsManagerListeners(): void {
    const google = (window as any).google;
    
    // Content pause - ad is about to play
    this.adsManager.addEventListener(
      google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED,
      () => {
        console.log('Ad: Content paused');
        this.isAdPlaying = true;
        this.video.pause();
        this.config.onAdStart?.();
      }
    );
    
    // Content resume - ad finished
    this.adsManager.addEventListener(
      google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,
      () => {
        console.log('Ad: Content resume');
        this.isAdPlaying = false;
        this.config.onAdEnd?.();
        this.video.play().catch(() => {});
      }
    );
    
    // Ad started
    this.adsManager.addEventListener(
      google.ima.AdEvent.Type.STARTED,
      (event: any) => {
        const ad = event.getAd();
        console.log('Ad started:', {
          type: ad.isLinear() ? 'Linear (video)' : 'Non-linear (overlay)',
          duration: ad.getDuration(),
          skippable: ad.getSkipTimeOffset() !== -1,
          title: ad.getTitle(),
        });
      }
    );
    
    // Ad completed
    this.adsManager.addEventListener(
      google.ima.AdEvent.Type.COMPLETE,
      () => {
        console.log('Ad completed');
      }
    );
    
    // All ads completed
    this.adsManager.addEventListener(
      google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
      () => {
        console.log('All ads completed');
        this.config.onAllAdsComplete?.();
      }
    );
    
    // Ad error
    this.adsManager.addEventListener(
      google.ima.AdErrorEvent.Type.AD_ERROR,
      (event: any) => this.onAdError(event)
    );
    
    // Ad skipped
    this.adsManager.addEventListener(
      google.ima.AdEvent.Type.SKIPPED,
      () => {
        console.log('Ad skipped by user');
      }
    );
  }

  /**
   * Handle ad error
   */
  private onAdError(event: any): void {
    const error = event.getError?.();
    console.error('Ad error:', error?.getMessage?.() || error);
    
    this.config.onAdError?.(error);
    
    // Destroy ads manager on error
    if (this.adsManager) {
      this.adsManager.destroy();
    }
    
    // Resume content playback
    this.isAdPlaying = false;
    this.video.play().catch(() => {});
  }

  /**
   * Pause ad
   */
  pause(): void {
    if (this.adsManager && this.isAdPlaying) {
      this.adsManager.pause();
    }
  }

  /**
   * Resume ad
   */
  resume(): void {
    if (this.adsManager && this.isAdPlaying) {
      this.adsManager.resume();
    }
  }

  /**
   * Skip ad (if skippable)
   */
  skip(): void {
    if (this.adsManager) {
      this.adsManager.skip();
    }
  }

  /**
   * Resize ads
   */
  resize(width: number, height: number): void {
    const google = (window as any).google;
    if (this.adsManager) {
      this.adsManager.resize(width, height, google.ima.ViewMode.NORMAL);
    }
  }

  /**
   * Set volume
   */
  setVolume(volume: number): void {
    if (this.adsManager) {
      this.adsManager.setVolume(volume);
    }
  }

  /**
   * Check if ad is currently playing
   */
  isPlayingAd(): boolean {
    return this.isAdPlaying;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.adsManager) {
      this.adsManager.destroy();
      this.adsManager = null;
    }
    
    if (this.adsLoader) {
      this.adsLoader.destroy();
      this.adsLoader = null;
    }
    
    this.isAdPlaying = false;
  }
}
