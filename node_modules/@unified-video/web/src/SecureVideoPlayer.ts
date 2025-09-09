/**
 * SecureVideoPlayer - VdoCipher-like implementation with DRM, watermarking, and security features
 */

import { WebPlayer } from './WebPlayer';
import { 
  VideoSource, 
  PlayerConfig,
  PlayerError,
  Quality
} from '@unified-video/core';

// Extended configuration for secure player
export interface SecurePlayerConfig {
  // DRM Configuration
  drm?: {
    widevine?: {
      licenseUrl: string;
      certificateUrl?: string;
      headers?: Record<string, string>;
    };
    fairplay?: {
      licenseUrl: string;
      certificateUrl: string;
      headers?: Record<string, string>;
    };
    playready?: {
      licenseUrl: string;
      headers?: Record<string, string>;
    };
  };

  // Security Configuration
  security?: {
    token: string;
    otp?: string;
    preventScreenCapture?: boolean;
    preventInspect?: boolean;
    domainLock?: string[];
    ipWhitelist?: string[];
    maxConcurrentStreams?: number;
    sessionTimeout?: number;
  };

  // Watermark Configuration
  watermark?: {
    text?: string;
    email?: string;
    userId?: string;
    ip?: string;
    opacity?: number;
    fontSize?: number;
    fontColor?: string;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'random';
    moving?: boolean;
    interval?: number;
    blinking?: boolean;
  };

  // Analytics Configuration
  analytics?: {
    enabled?: boolean;
    endpoint?: string;
    interval?: number;
    customData?: Record<string, any>;
  };

  // Advanced Features
  features?: {
    speedControl?: boolean;
    qualitySelector?: boolean;
    chapters?: boolean;
    thumbnailPreview?: boolean;
    keyboardShortcuts?: boolean;
    gestureControl?: boolean;
    chromecast?: boolean;
    airplay?: boolean;
  };
}

export interface DRMConfig {
  server: string;
  headers?: Record<string, string>;
  withCredentials?: boolean;
  certificateUrl?: string;
}

export interface WatermarkLayer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  animationFrame?: number;
}

export interface AnalyticsEvent {
  eventType: string;
  timestamp: number;
  sessionId: string;
  videoId?: string;
  userId?: string;
  data: Record<string, any>;
}

export class SecureVideoPlayer extends WebPlayer {
  private secureConfig: SecurePlayerConfig;
  private watermarkLayer?: WatermarkLayer;
  private analyticsTimer?: number;
  private sessionId: string;
  private heartbeatTimer?: number;
  private qualityMenu?: HTMLElement;
  private customControls?: HTMLElement;
  private thumbnailPreview?: HTMLElement;
  private analyticsData: AnalyticsEvent[] = [];
  private watchStartTime: number = 0;
  private totalWatchTime: number = 0;
  private lastSeekPosition: number = 0;
  private bufferingStartTime: number = 0;
  private totalBufferingTime: number = 0;
  private screenRecordingProtection?: MutationObserver;

  constructor() {
    super();
    this.sessionId = this.generateSessionId();
    this.secureConfig = {} as SecurePlayerConfig;
  }

  protected async setupPlayer(): Promise<void> {
    await super.setupPlayer();
    
    // Apply security measures
    this.applySecurityMeasures();
    
    // Setup DRM if configured
    if (this.secureConfig.drm) {
      this.configureDRM();
    }
    
    // Setup watermark if configured
    if (this.secureConfig.watermark) {
      this.setupWatermark();
    }
    
    // Setup analytics if enabled
    if (this.secureConfig.analytics?.enabled) {
      this.setupAnalytics();
    }
    
    // Setup custom controls if needed
    if (this.secureConfig.features) {
      this.setupCustomControls();
    }
    
    // Start session heartbeat
    this.startHeartbeat();
  }

  async initialize(container: HTMLElement | string, config?: any): Promise<void> {
    this.secureConfig = config || {} as SecurePlayerConfig;
    
    // Validate domain if domain lock is enabled
    if (this.secureConfig.security?.domainLock) {
      this.validateDomain();
    }
    
    // Validate token
    if (this.secureConfig.security?.token) {
      await this.validateToken();
    }
    
    await super.initialize(container, this.secureConfig as any);
  }

  private applySecurityMeasures(): void {
    if (!this.secureConfig.security) return;

    // Prevent right-click context menu
    if (this.secureConfig.security.preventInspect) {
      this.preventInspection();
    }

    // Prevent screen capture (limited effectiveness)
    if (this.secureConfig.security.preventScreenCapture) {
      this.preventScreenCapture();
    }

    // Disable text selection
    this.disableTextSelection();
  }

  private preventInspection(): void {
    // Prevent right-click
    document.addEventListener('contextmenu', (e) => {
      if (this.container?.contains(e.target as Node)) {
        e.preventDefault();
      }
    });

    // Prevent F12 and other dev tools shortcuts
    document.addEventListener('keydown', (e) => {
      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.keyCode === 123 || 
          (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67))) {
        e.preventDefault();
      }
    });

    // Detect dev tools (basic detection)
    let devtools = { open: false, orientation: null };
    const threshold = 160;
    
    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          this.handleDevToolsOpen();
        }
      } else {
        devtools.open = false;
      }
    }, 500);
  }

  private handleDevToolsOpen(): void {
    console.warn('Developer tools detected');
    this.trackEvent({
      eventType: 'security_warning',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      data: {
        type: 'devtools_opened',
        url: window.location.href
      }
    });
  }

  private preventScreenCapture(): void {
    // CSS-based screen capture prevention (limited support)
    if (this.container) {
      this.container.style.cssText += `
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      `;
    }

    // Add overlay div that becomes black when screenshot is attempted (experimental)
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9998;
      pointer-events: none;
      mix-blend-mode: screen;
      background: transparent;
    `;
    this.container?.appendChild(overlay);

    // Monitor for screen recording indicators (limited effectiveness)
    this.detectScreenRecording();
  }

  private detectScreenRecording(): void {
    // Check for common screen recording extensions (very limited)
    const suspiciousExtensions = [
      'screen-capture',
      'screencastify',
      'loom',
      'awesome-screenshot'
    ];

    // Monitor DOM mutations for recording indicators
    this.screenRecordingProtection = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName && suspiciousExtensions.some(ext => 
            node.nodeName.toLowerCase().includes(ext))) {
            this.handleScreenRecordingDetected();
          }
        });
      });
    });

    this.screenRecordingProtection.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private handleScreenRecordingDetected(): void {
    console.warn('Potential screen recording detected');
    this.trackEvent({
      eventType: 'security_warning',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      data: {
        type: 'screen_recording_suspected',
        url: window.location.href
      }
    });
  }

  private disableTextSelection(): void {
    if (this.container) {
      this.container.style.userSelect = 'none';
      this.container.style.webkitUserSelect = 'none';
      
      // Prevent text selection via JavaScript
      this.container.addEventListener('selectstart', (e) => {
        e.preventDefault();
      });
    }
  }

  private validateDomain(): void {
    const currentDomain = window.location.hostname;
    const allowedDomains = this.secureConfig.security?.domainLock || [];
    
    if (!allowedDomains.includes(currentDomain)) {
      throw new Error(`Domain ${currentDomain} is not authorized to play this video`);
    }
  }

  private async validateToken(): Promise<void> {
    const token = this.secureConfig.security?.token;
    const otp = this.secureConfig.security?.otp;
    
    if (!token) {
      throw new Error('Security token is required');
    }

    // In production, validate token with backend
    try {
      const response = await fetch(`${this.secureConfig.analytics?.endpoint || '/api'}/validate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          otp,
          sessionId: this.sessionId,
          domain: window.location.hostname,
          userAgent: navigator.userAgent
        })
      });

      if (!response.ok) {
        throw new Error('Token validation failed');
      }
    } catch (error) {
      console.error('Token validation error:', error);
      // In demo mode, continue without validation
    }
  }

  private configureDRM(): void {
    if (!this.video) return;

    const video = this.video as any;

    // Setup EME (Encrypted Media Extensions)
    if (video.requestMediaKeySystemAccess) {
      this.setupEME();
    }

    // Configure Shaka Player for DRM if needed
    if (this.secureConfig.drm?.widevine || this.secureConfig.drm?.fairplay) {
      this.setupShakaPlayer();
    }
  }

  private async setupEME(): Promise<void> {
    const config = this.secureConfig.drm;
    if (!config) return;

    const keySystemConfigs: Record<string, any> = {};

    // Widevine configuration
    if (config.widevine) {
      keySystemConfigs['com.widevine.alpha'] = [{
        initDataTypes: ['cenc'],
        videoCapabilities: [{
          contentType: 'video/mp4;codecs="avc1.42E01E"'
        }],
        audioCapabilities: [{
          contentType: 'audio/mp4;codecs="mp4a.40.2"'
        }]
      }];
    }

    // PlayReady configuration
    if (config.playready) {
      keySystemConfigs['com.microsoft.playready'] = [{
        initDataTypes: ['cenc'],
        videoCapabilities: [{
          contentType: 'video/mp4;codecs="avc1.42E01E"'
        }],
        audioCapabilities: [{
          contentType: 'audio/mp4;codecs="mp4a.40.2"'
        }]
      }];
    }

    // FairPlay configuration
    if (config.fairplay) {
      keySystemConfigs['com.apple.fps.1_0'] = [{
        initDataTypes: ['cenc'],
        videoCapabilities: [{
          contentType: 'video/mp4;codecs="avc1.42E01E"'
        }],
        audioCapabilities: [{
          contentType: 'audio/mp4;codecs="mp4a.40.2"'
        }]
      }];
    }

    // Request access to key systems
    for (const [keySystem, configs] of Object.entries(keySystemConfigs)) {
      try {
        const access = await navigator.requestMediaKeySystemAccess(keySystem, configs);
        const mediaKeys = await access.createMediaKeys();
        await this.video!.setMediaKeys(mediaKeys);
        
        // Set up license request handling
        this.setupLicenseRequest(mediaKeys, keySystem);
        
        console.log(`DRM system ${keySystem} initialized`);
        break;
      } catch (error) {
        console.error(`Failed to setup ${keySystem}:`, error);
      }
    }
  }

  private setupLicenseRequest(mediaKeys: MediaKeys, keySystem: string): void {
    if (!this.video) return;

    this.video.addEventListener('encrypted', async (event: any) => {
      const session = mediaKeys.createSession();
      
      session.addEventListener('message', async (event: any) => {
        const message = event.message;
        const licenseUrl = this.getLicenseUrl(keySystem);
        
        if (licenseUrl) {
          try {
            const response = await this.requestLicense(licenseUrl, message, keySystem);
            await session.update(response);
          } catch (error) {
            this.handleError({
              code: 'DRM_LICENSE_ERROR',
              message: `Failed to acquire license: ${error}`,
              type: 'drm',
              fatal: true,
              details: error
            });
          }
        }
      });

      await session.generateRequest(event.initDataType, event.initData);
    });
  }

  private getLicenseUrl(keySystem: string): string | null {
    switch (keySystem) {
      case 'com.widevine.alpha':
        return this.secureConfig.drm?.widevine?.licenseUrl || null;
      case 'com.microsoft.playready':
        return this.secureConfig.drm?.playready?.licenseUrl || null;
      case 'com.apple.fps.1_0':
        return this.secureConfig.drm?.fairplay?.licenseUrl || null;
      default:
        return null;
    }
  }

  private async requestLicense(url: string, message: ArrayBuffer, keySystem: string): Promise<ArrayBuffer> {
    const headers = this.getLicenseHeaders(keySystem);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/octet-stream'
      },
      body: message
    });

    if (!response.ok) {
      throw new Error(`License request failed: ${response.status}`);
    }

    return await response.arrayBuffer();
  }

  private getLicenseHeaders(keySystem: string): Record<string, string> {
    const token = this.secureConfig.security?.token || '';
    let headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`
    };

    switch (keySystem) {
      case 'com.widevine.alpha':
        headers = { ...headers, ...this.secureConfig.drm?.widevine?.headers };
        break;
      case 'com.microsoft.playready':
        headers = { ...headers, ...this.secureConfig.drm?.playready?.headers };
        break;
      case 'com.apple.fps.1_0':
        headers = { ...headers, ...this.secureConfig.drm?.fairplay?.headers };
        break;
    }

    return headers;
  }

  private async setupShakaPlayer(): Promise<void> {
    // Load Shaka Player if not already loaded
    if (!(window as any).shaka) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/shaka-player@latest/dist/shaka-player.compiled.js');
    }

    const shaka = (window as any).shaka;
    
    if (!shaka.Player.isBrowserSupported()) {
      console.error('Browser does not support Shaka Player');
      return;
    }

    const player = new shaka.Player(this.video);
    
    // Configure DRM
    const drmConfig: any = {};
    
    if (this.secureConfig.drm?.widevine) {
      drmConfig['com.widevine.alpha'] = {
        serverUrl: this.secureConfig.drm.widevine.licenseUrl,
        httpRequestHeaders: this.secureConfig.drm.widevine.headers || {}
      };
    }
    
    if (this.secureConfig.drm?.playready) {
      drmConfig['com.microsoft.playready'] = {
        serverUrl: this.secureConfig.drm.playready.licenseUrl,
        httpRequestHeaders: this.secureConfig.drm.playready.headers || {}
      };
    }

    player.configure({
      drm: {
        servers: drmConfig
      }
    });

    // Store Shaka player instance
    (this as any).shakaPlayer = player;
  }

  protected setupWatermark(): void {
    if (!this.container || !this.video) return;

    // Create watermark canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) return;

    canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    `;

    this.watermarkLayer = {
      canvas,
      context
    };

    this.container.style.position = 'relative';
    this.container.appendChild(canvas);

    // Start watermark rendering
    this.renderWatermark();
  }

  private renderWatermark(): void {
    if (!this.watermarkLayer) return;

    const { canvas, context } = this.watermarkLayer;
    const config = this.secureConfig.watermark;
    
    if (!config) return;

    // Resize canvas to match video
    canvas.width = this.container?.offsetWidth || 0;
    canvas.height = this.container?.offsetHeight || 0;

    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Prepare watermark text
    const watermarkText = this.buildWatermarkText();
    
    // Set text properties
    context.font = `${config.fontSize || 16}px Arial, sans-serif`;
    context.fillStyle = config.fontColor || 'rgba(255, 255, 255, 0.5)';
    context.globalAlpha = config.opacity || 0.5;

    // Calculate position
    const position = this.calculateWatermarkPosition(context, watermarkText);

    // Apply blinking effect if enabled
    if (config.blinking) {
      const show = Math.floor(Date.now() / 1000) % 2 === 0;
      if (!show) {
        requestAnimationFrame(() => this.renderWatermark());
        return;
      }
    }

    // Draw watermark text
    const lines = watermarkText.split('\n');
    lines.forEach((line, index) => {
      context.fillText(line, position.x, position.y + (index * 20));
    });

    // Schedule next render
    if (config.moving) {
      setTimeout(() => this.renderWatermark(), config.interval || 3000);
    } else {
      requestAnimationFrame(() => this.renderWatermark());
    }
  }

  private buildWatermarkText(): string {
    const config = this.secureConfig.watermark;
    if (!config) return '';

    const parts: string[] = [];
    
    if (config.text) parts.push(config.text);
    if (config.email) parts.push(config.email);
    if (config.userId) parts.push(`ID: ${config.userId}`);
    if (config.ip) parts.push(`IP: ${config.ip}`);
    
    // Add timestamp
    parts.push(new Date().toLocaleString());
    
    return parts.join('\n');
  }

  private calculateWatermarkPosition(context: CanvasRenderingContext2D, text: string): { x: number, y: number } {
    const config = this.secureConfig.watermark;
    const canvas = this.watermarkLayer?.canvas;
    
    if (!config || !canvas) return { x: 0, y: 0 };

    const metrics = context.measureText(text.split('\n')[0]);
    const textWidth = metrics.width;
    const textHeight = (text.split('\n').length * 20);
    const padding = 20;

    let x = padding;
    let y = padding + 16; // Account for font baseline

    switch (config.position) {
      case 'top-right':
        x = canvas.width - textWidth - padding;
        break;
      case 'bottom-left':
        y = canvas.height - textHeight - padding;
        break;
      case 'bottom-right':
        x = canvas.width - textWidth - padding;
        y = canvas.height - textHeight - padding;
        break;
      case 'center':
        x = (canvas.width - textWidth) / 2;
        y = (canvas.height - textHeight) / 2;
        break;
      case 'random':
        x = Math.random() * (canvas.width - textWidth - padding * 2) + padding;
        y = Math.random() * (canvas.height - textHeight - padding * 2) + padding;
        break;
    }

    return { x, y };
  }

  private setupAnalytics(): void {
    if (!this.secureConfig.analytics?.enabled) return;

    // Track initial load
    this.trackEvent({
      eventType: 'player_loaded',
      timestamp: Date.now(),
      sessionId: this.sessionId,
videoId: ((this.source as any)?.metadata?.id ?? this.source?.metadata?.title),
      userId: this.secureConfig.watermark?.userId,
      data: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });

    // Setup periodic analytics reporting
    this.analyticsTimer = window.setInterval(() => {
      this.reportAnalytics();
    }, this.secureConfig.analytics.interval || 30000);

    // Track video events
    this.setupAnalyticsTracking();
  }

  private setupAnalyticsTracking(): void {
    // Track play event
    this.on('onPlay', () => {
      this.watchStartTime = Date.now();
      this.trackEvent({
        eventType: 'play',
        timestamp: Date.now(),
        sessionId: this.sessionId,
        videoId: ((this.source as any)?.metadata?.id ?? this.source?.metadata?.title),
        userId: this.secureConfig.watermark?.userId,
        data: {
          currentTime: this.getCurrentTime(),
          duration: this.getDuration()
        }
      });
    });

    // Track pause event
    this.on('onPause', () => {
      if (this.watchStartTime > 0) {
        this.totalWatchTime += Date.now() - this.watchStartTime;
        this.watchStartTime = 0;
      }
      
      this.trackEvent({
        eventType: 'pause',
        timestamp: Date.now(),
        sessionId: this.sessionId,
        videoId: ((this.source as any)?.metadata?.id ?? this.source?.metadata?.title),
        userId: this.secureConfig.watermark?.userId,
        data: {
          currentTime: this.getCurrentTime(),
          totalWatchTime: this.totalWatchTime
        }
      });
    });

    // Track seek events
    this.on('onSeeking', () => {
      this.lastSeekPosition = this.getCurrentTime();
    });

    this.on('onSeeked', () => {
      this.trackEvent({
        eventType: 'seek',
        timestamp: Date.now(),
        sessionId: this.sessionId,
        videoId: ((this.source as any)?.metadata?.id ?? this.source?.metadata?.title),
        userId: this.secureConfig.watermark?.userId,
        data: {
          from: this.lastSeekPosition,
          to: this.getCurrentTime()
        }
      });
    });

    // Track buffering
    this.on('onBuffering', (isBuffering: boolean) => {
      if (isBuffering) {
        this.bufferingStartTime = Date.now();
      } else if (this.bufferingStartTime > 0) {
        this.totalBufferingTime += Date.now() - this.bufferingStartTime;
        this.bufferingStartTime = 0;
        
        this.trackEvent({
          eventType: 'buffering',
          timestamp: Date.now(),
          sessionId: this.sessionId,
          videoId: ((this.source as any)?.metadata?.id ?? this.source?.metadata?.title),
          userId: this.secureConfig.watermark?.userId,
          data: {
            duration: this.totalBufferingTime,
            currentTime: this.getCurrentTime()
          }
        });
      }
    });

    // Track quality changes
    this.on('onQualityChanged', (quality: Quality) => {
      this.trackEvent({
        eventType: 'quality_change',
        timestamp: Date.now(),
        sessionId: this.sessionId,
        videoId: ((this.source as any)?.metadata?.id ?? this.source?.metadata?.title),
        userId: this.secureConfig.watermark?.userId,
        data: {
          quality: quality.label,
          bitrate: quality.bitrate,
          resolution: `${quality.width}x${quality.height}`
        }
      });
    });

    // Track errors
    this.on('onError', (error: PlayerError) => {
      this.trackEvent({
        eventType: 'error',
        timestamp: Date.now(),
        sessionId: this.sessionId,
        videoId: ((this.source as any)?.metadata?.id ?? this.source?.metadata?.title),
        userId: this.secureConfig.watermark?.userId,
        data: {
          errorCode: error.code,
          errorMessage: error.message,
          errorType: (error as any).type || 'unknown',
          fatal: error.fatal
        }
      });
    });

    // Track video ended
    this.on('onEnded', () => {
      if (this.watchStartTime > 0) {
        this.totalWatchTime += Date.now() - this.watchStartTime;
      }
      
      this.trackEvent({
        eventType: 'ended',
        timestamp: Date.now(),
        sessionId: this.sessionId,
        videoId: ((this.source as any)?.metadata?.id ?? this.source?.metadata?.title),
        userId: this.secureConfig.watermark?.userId,
        data: {
          totalWatchTime: this.totalWatchTime,
          completionRate: (this.getCurrentTime() / this.getDuration()) * 100,
          totalBufferingTime: this.totalBufferingTime
        }
      });
    });
  }

  private trackEvent(event: AnalyticsEvent): void {
    this.analyticsData.push(event);
    
    // Send immediately for critical events
    const criticalEvents = ['error', 'security_warning', 'ended'];
    if (criticalEvents.includes(event.eventType)) {
      this.reportAnalytics();
    }
  }

  private async reportAnalytics(): Promise<void> {
    if (this.analyticsData.length === 0) return;
    
    const endpoint = this.secureConfig.analytics?.endpoint;
    if (!endpoint) return;

    const events = [...this.analyticsData];
    this.analyticsData = [];

    try {
      await fetch(`${endpoint}/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secureConfig.security?.token || ''}`
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          events,
          metadata: {
            ...this.secureConfig.analytics?.customData,
            timestamp: Date.now()
          }
        })
      });
    } catch (error) {
      console.error('Failed to report analytics:', error);
      // Re-add events for retry
      this.analyticsData.unshift(...events);
    }
  }

  private setupCustomControls(): void {
    if (!this.secureConfig.features) return;

    // Create custom controls container
    const controls = document.createElement('div');
    controls.className = 'secure-player-controls';
    controls.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(0,0,0,0.8));
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 15px;
      z-index: 10000;
    `;

    // Add quality selector
    if (this.secureConfig.features.qualitySelector) {
      this.createQualitySelector(controls);
    }

    // Add speed control
    if (this.secureConfig.features.speedControl) {
      this.createSpeedControl(controls);
    }

    // Add keyboard shortcuts
    if (this.secureConfig.features.keyboardShortcuts) {
      this.setupKeyboardShortcuts();
    }

    this.customControls = controls;
    this.container?.appendChild(controls);
  }

  private createQualitySelector(container: HTMLElement): void {
    const button = document.createElement('button');
    button.innerHTML = 'Quality';
    button.style.cssText = `
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
    `;

    const menu = document.createElement('div');
    menu.style.cssText = `
      position: absolute;
      bottom: 100%;
      background: rgba(0,0,0,0.9);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 4px;
      padding: 5px 0;
      display: none;
      min-width: 100px;
    `;

    // Populate quality options
    this.getQualities().forEach((quality, index) => {
      const option = document.createElement('div');
      option.textContent = quality.label;
      option.style.cssText = `
        padding: 5px 15px;
        color: white;
        cursor: pointer;
      `;
      option.addEventListener('click', () => {
        this.setQuality(index);
        menu.style.display = 'none';
      });
      menu.appendChild(option);
    });

    // Add auto option
    const autoOption = document.createElement('div');
    autoOption.textContent = 'Auto';
    autoOption.style.cssText = `
      padding: 5px 15px;
      color: white;
      cursor: pointer;
      border-top: 1px solid rgba(255,255,255,0.3);
    `;
    autoOption.addEventListener('click', () => {
      this.setAutoQuality(true);
      menu.style.display = 'none';
    });
    menu.appendChild(autoOption);

    button.addEventListener('click', () => {
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.appendChild(button);
    wrapper.appendChild(menu);
    container.appendChild(wrapper);

    this.qualityMenu = menu;
  }

  private createSpeedControl(container: HTMLElement): void {
    const select = document.createElement('select');
    select.style.cssText = `
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      padding: 5px;
      border-radius: 4px;
      cursor: pointer;
    `;

    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    speeds.forEach(speed => {
      const option = document.createElement('option');
      option.value = speed.toString();
      option.textContent = `${speed}x`;
      if (speed === 1) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      this.setPlaybackRate(parseFloat(select.value));
    });

    container.appendChild(select);
  }

  protected setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if (!this.container?.contains(document.activeElement)) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          this.isPlaying() ? this.pause() : this.play();
          break;
        case 'f':
          e.preventDefault();
          this.toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          this.toggleMute();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.seek(this.getCurrentTime() - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.seek(this.getCurrentTime() + 10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.setVolume(this.state.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.setVolume(this.state.volume - 0.1);
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
          this.seek((this.getDuration() * percent) / 100);
          break;
      }
    });
  }

  private startHeartbeat(): void {
    // Send heartbeat every 30 seconds to maintain session
    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }

  private async sendHeartbeat(): Promise<void> {
    const endpoint = this.secureConfig.analytics?.endpoint;
    if (!endpoint) return;

    try {
      await fetch(`${endpoint}/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secureConfig.security?.token || ''}`
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          timestamp: Date.now(),
          currentTime: this.getCurrentTime(),
          playing: this.isPlaying()
        })
      });
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }

  private generateSessionId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async destroy(): Promise<void> {
    // Clean up watermark
    if (this.watermarkLayer) {
      if (this.watermarkLayer.animationFrame) {
        cancelAnimationFrame(this.watermarkLayer.animationFrame);
      }
      this.watermarkLayer.canvas.remove();
      this.watermarkLayer = undefined;
    }

    // Clean up analytics
    if (this.analyticsTimer) {
      clearInterval(this.analyticsTimer);
      this.reportAnalytics(); // Send final analytics
    }

    // Clean up heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // Clean up screen recording protection
    if (this.screenRecordingProtection) {
      this.screenRecordingProtection.disconnect();
    }

    // Clean up custom controls
    if (this.customControls) {
      this.customControls.remove();
    }

    // Clean up Shaka player if used
    if ((this as any).shakaPlayer) {
      await (this as any).shakaPlayer.destroy();
    }

    await super.destroy();
  }
}

// Export for use
export default SecureVideoPlayer;
