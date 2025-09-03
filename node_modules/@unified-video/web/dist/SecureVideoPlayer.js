"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureVideoPlayer = void 0;
const WebPlayer_1 = require("./WebPlayer");
class SecureVideoPlayer extends WebPlayer_1.WebPlayer {
    constructor() {
        super();
        this.analyticsData = [];
        this.watchStartTime = 0;
        this.totalWatchTime = 0;
        this.lastSeekPosition = 0;
        this.bufferingStartTime = 0;
        this.totalBufferingTime = 0;
        this.sessionId = this.generateSessionId();
        this.secureConfig = {};
    }
    async setupPlayer() {
        await super.setupPlayer();
        this.applySecurityMeasures();
        if (this.secureConfig.drm) {
            this.configureDRM();
        }
        if (this.secureConfig.watermark) {
            this.setupWatermark();
        }
        if (this.secureConfig.analytics?.enabled) {
            this.setupAnalytics();
        }
        if (this.secureConfig.features) {
            this.setupCustomControls();
        }
        this.startHeartbeat();
    }
    async initialize(container, config) {
        this.secureConfig = config || {};
        if (this.secureConfig.security?.domainLock) {
            this.validateDomain();
        }
        if (this.secureConfig.security?.token) {
            await this.validateToken();
        }
        await super.initialize(container, this.secureConfig);
    }
    applySecurityMeasures() {
        if (!this.secureConfig.security)
            return;
        if (this.secureConfig.security.preventInspect) {
            this.preventInspection();
        }
        if (this.secureConfig.security.preventScreenCapture) {
            this.preventScreenCapture();
        }
        this.disableTextSelection();
    }
    preventInspection() {
        document.addEventListener('contextmenu', (e) => {
            if (this.container?.contains(e.target)) {
                e.preventDefault();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.keyCode === 123 ||
                (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67))) {
                e.preventDefault();
            }
        });
        let devtools = { open: false, orientation: null };
        const threshold = 160;
        setInterval(() => {
            if (window.outerHeight - window.innerHeight > threshold ||
                window.outerWidth - window.innerWidth > threshold) {
                if (!devtools.open) {
                    devtools.open = true;
                    this.handleDevToolsOpen();
                }
            }
            else {
                devtools.open = false;
            }
        }, 500);
    }
    handleDevToolsOpen() {
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
    preventScreenCapture() {
        if (this.container) {
            this.container.style.cssText += `
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      `;
        }
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
        this.detectScreenRecording();
    }
    detectScreenRecording() {
        const suspiciousExtensions = [
            'screen-capture',
            'screencastify',
            'loom',
            'awesome-screenshot'
        ];
        this.screenRecordingProtection = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeName && suspiciousExtensions.some(ext => node.nodeName.toLowerCase().includes(ext))) {
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
    handleScreenRecordingDetected() {
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
    disableTextSelection() {
        if (this.container) {
            this.container.style.userSelect = 'none';
            this.container.style.webkitUserSelect = 'none';
            this.container.addEventListener('selectstart', (e) => {
                e.preventDefault();
            });
        }
    }
    validateDomain() {
        const currentDomain = window.location.hostname;
        const allowedDomains = this.secureConfig.security?.domainLock || [];
        if (!allowedDomains.includes(currentDomain)) {
            throw new Error(`Domain ${currentDomain} is not authorized to play this video`);
        }
    }
    async validateToken() {
        const token = this.secureConfig.security?.token;
        const otp = this.secureConfig.security?.otp;
        if (!token) {
            throw new Error('Security token is required');
        }
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
        }
        catch (error) {
            console.error('Token validation error:', error);
        }
    }
    configureDRM() {
        if (!this.video)
            return;
        const video = this.video;
        if (video.requestMediaKeySystemAccess) {
            this.setupEME();
        }
        if (this.secureConfig.drm?.widevine || this.secureConfig.drm?.fairplay) {
            this.setupShakaPlayer();
        }
    }
    async setupEME() {
        const config = this.secureConfig.drm;
        if (!config)
            return;
        const keySystemConfigs = {};
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
        for (const [keySystem, configs] of Object.entries(keySystemConfigs)) {
            try {
                const access = await navigator.requestMediaKeySystemAccess(keySystem, configs);
                const mediaKeys = await access.createMediaKeys();
                await this.video.setMediaKeys(mediaKeys);
                this.setupLicenseRequest(mediaKeys, keySystem);
                console.log(`DRM system ${keySystem} initialized`);
                break;
            }
            catch (error) {
                console.error(`Failed to setup ${keySystem}:`, error);
            }
        }
    }
    setupLicenseRequest(mediaKeys, keySystem) {
        if (!this.video)
            return;
        this.video.addEventListener('encrypted', async (event) => {
            const session = mediaKeys.createSession();
            session.addEventListener('message', async (event) => {
                const message = event.message;
                const licenseUrl = this.getLicenseUrl(keySystem);
                if (licenseUrl) {
                    try {
                        const response = await this.requestLicense(licenseUrl, message, keySystem);
                        await session.update(response);
                    }
                    catch (error) {
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
    getLicenseUrl(keySystem) {
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
    async requestLicense(url, message, keySystem) {
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
    getLicenseHeaders(keySystem) {
        const token = this.secureConfig.security?.token || '';
        let headers = {
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
    async setupShakaPlayer() {
        if (!window.shaka) {
            await this.loadScript('https://cdn.jsdelivr.net/npm/shaka-player@latest/dist/shaka-player.compiled.js');
        }
        const shaka = window.shaka;
        if (!shaka.Player.isBrowserSupported()) {
            console.error('Browser does not support Shaka Player');
            return;
        }
        const player = new shaka.Player(this.video);
        const drmConfig = {};
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
        this.shakaPlayer = player;
    }
    setupWatermark() {
        if (!this.container || !this.video)
            return;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context)
            return;
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
        this.renderWatermark();
    }
    renderWatermark() {
        if (!this.watermarkLayer)
            return;
        const { canvas, context } = this.watermarkLayer;
        const config = this.secureConfig.watermark;
        if (!config)
            return;
        canvas.width = this.container?.offsetWidth || 0;
        canvas.height = this.container?.offsetHeight || 0;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const watermarkText = this.buildWatermarkText();
        context.font = `${config.fontSize || 16}px Arial, sans-serif`;
        context.fillStyle = config.fontColor || 'rgba(255, 255, 255, 0.5)';
        context.globalAlpha = config.opacity || 0.5;
        const position = this.calculateWatermarkPosition(context, watermarkText);
        if (config.blinking) {
            const show = Math.floor(Date.now() / 1000) % 2 === 0;
            if (!show) {
                requestAnimationFrame(() => this.renderWatermark());
                return;
            }
        }
        const lines = watermarkText.split('\n');
        lines.forEach((line, index) => {
            context.fillText(line, position.x, position.y + (index * 20));
        });
        if (config.moving) {
            setTimeout(() => this.renderWatermark(), config.interval || 3000);
        }
        else {
            requestAnimationFrame(() => this.renderWatermark());
        }
    }
    buildWatermarkText() {
        const config = this.secureConfig.watermark;
        if (!config)
            return '';
        const parts = [];
        if (config.text)
            parts.push(config.text);
        if (config.email)
            parts.push(config.email);
        if (config.userId)
            parts.push(`ID: ${config.userId}`);
        if (config.ip)
            parts.push(`IP: ${config.ip}`);
        parts.push(new Date().toLocaleString());
        return parts.join('\n');
    }
    calculateWatermarkPosition(context, text) {
        const config = this.secureConfig.watermark;
        const canvas = this.watermarkLayer?.canvas;
        if (!config || !canvas)
            return { x: 0, y: 0 };
        const metrics = context.measureText(text.split('\n')[0]);
        const textWidth = metrics.width;
        const textHeight = (text.split('\n').length * 20);
        const padding = 20;
        let x = padding;
        let y = padding + 16;
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
    setupAnalytics() {
        if (!this.secureConfig.analytics?.enabled)
            return;
        this.trackEvent({
            eventType: 'player_loaded',
            timestamp: Date.now(),
            sessionId: this.sessionId,
            videoId: (this.source?.metadata?.id ?? this.source?.metadata?.title),
            userId: this.secureConfig.watermark?.userId,
            data: {
                url: window.location.href,
                userAgent: navigator.userAgent,
                screenResolution: `${screen.width}x${screen.height}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
        });
        this.analyticsTimer = window.setInterval(() => {
            this.reportAnalytics();
        }, this.secureConfig.analytics.interval || 30000);
        this.setupAnalyticsTracking();
    }
    setupAnalyticsTracking() {
        this.on('onPlay', () => {
            this.watchStartTime = Date.now();
            this.trackEvent({
                eventType: 'play',
                timestamp: Date.now(),
                sessionId: this.sessionId,
                videoId: (this.source?.metadata?.id ?? this.source?.metadata?.title),
                userId: this.secureConfig.watermark?.userId,
                data: {
                    currentTime: this.getCurrentTime(),
                    duration: this.getDuration()
                }
            });
        });
        this.on('onPause', () => {
            if (this.watchStartTime > 0) {
                this.totalWatchTime += Date.now() - this.watchStartTime;
                this.watchStartTime = 0;
            }
            this.trackEvent({
                eventType: 'pause',
                timestamp: Date.now(),
                sessionId: this.sessionId,
                videoId: (this.source?.metadata?.id ?? this.source?.metadata?.title),
                userId: this.secureConfig.watermark?.userId,
                data: {
                    currentTime: this.getCurrentTime(),
                    totalWatchTime: this.totalWatchTime
                }
            });
        });
        this.on('onSeeking', () => {
            this.lastSeekPosition = this.getCurrentTime();
        });
        this.on('onSeeked', () => {
            this.trackEvent({
                eventType: 'seek',
                timestamp: Date.now(),
                sessionId: this.sessionId,
                videoId: (this.source?.metadata?.id ?? this.source?.metadata?.title),
                userId: this.secureConfig.watermark?.userId,
                data: {
                    from: this.lastSeekPosition,
                    to: this.getCurrentTime()
                }
            });
        });
        this.on('onBuffering', (isBuffering) => {
            if (isBuffering) {
                this.bufferingStartTime = Date.now();
            }
            else if (this.bufferingStartTime > 0) {
                this.totalBufferingTime += Date.now() - this.bufferingStartTime;
                this.bufferingStartTime = 0;
                this.trackEvent({
                    eventType: 'buffering',
                    timestamp: Date.now(),
                    sessionId: this.sessionId,
                    videoId: (this.source?.metadata?.id ?? this.source?.metadata?.title),
                    userId: this.secureConfig.watermark?.userId,
                    data: {
                        duration: this.totalBufferingTime,
                        currentTime: this.getCurrentTime()
                    }
                });
            }
        });
        this.on('onQualityChanged', (quality) => {
            this.trackEvent({
                eventType: 'quality_change',
                timestamp: Date.now(),
                sessionId: this.sessionId,
                videoId: (this.source?.metadata?.id ?? this.source?.metadata?.title),
                userId: this.secureConfig.watermark?.userId,
                data: {
                    quality: quality.label,
                    bitrate: quality.bitrate,
                    resolution: `${quality.width}x${quality.height}`
                }
            });
        });
        this.on('onError', (error) => {
            this.trackEvent({
                eventType: 'error',
                timestamp: Date.now(),
                sessionId: this.sessionId,
                videoId: (this.source?.metadata?.id ?? this.source?.metadata?.title),
                userId: this.secureConfig.watermark?.userId,
                data: {
                    errorCode: error.code,
                    errorMessage: error.message,
                    errorType: error.type,
                    fatal: error.fatal
                }
            });
        });
        this.on('onEnded', () => {
            if (this.watchStartTime > 0) {
                this.totalWatchTime += Date.now() - this.watchStartTime;
            }
            this.trackEvent({
                eventType: 'ended',
                timestamp: Date.now(),
                sessionId: this.sessionId,
                videoId: (this.source?.metadata?.id ?? this.source?.metadata?.title),
                userId: this.secureConfig.watermark?.userId,
                data: {
                    totalWatchTime: this.totalWatchTime,
                    completionRate: (this.getCurrentTime() / this.getDuration()) * 100,
                    totalBufferingTime: this.totalBufferingTime
                }
            });
        });
    }
    trackEvent(event) {
        this.analyticsData.push(event);
        const criticalEvents = ['error', 'security_warning', 'ended'];
        if (criticalEvents.includes(event.eventType)) {
            this.reportAnalytics();
        }
    }
    async reportAnalytics() {
        if (this.analyticsData.length === 0)
            return;
        const endpoint = this.secureConfig.analytics?.endpoint;
        if (!endpoint)
            return;
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
        }
        catch (error) {
            console.error('Failed to report analytics:', error);
            this.analyticsData.unshift(...events);
        }
    }
    setupCustomControls() {
        if (!this.secureConfig.features)
            return;
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
        if (this.secureConfig.features.qualitySelector) {
            this.createQualitySelector(controls);
        }
        if (this.secureConfig.features.speedControl) {
            this.createSpeedControl(controls);
        }
        if (this.secureConfig.features.keyboardShortcuts) {
            this.setupKeyboardShortcuts();
        }
        this.customControls = controls;
        this.container?.appendChild(controls);
    }
    createQualitySelector(container) {
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
    createSpeedControl(container) {
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
            if (speed === 1)
                option.selected = true;
            select.appendChild(option);
        });
        select.addEventListener('change', () => {
            this.setPlaybackRate(parseFloat(select.value));
        });
        container.appendChild(select);
    }
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.container?.contains(document.activeElement))
                return;
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
    startHeartbeat() {
        this.heartbeatTimer = window.setInterval(() => {
            this.sendHeartbeat();
        }, 30000);
    }
    async sendHeartbeat() {
        const endpoint = this.secureConfig.analytics?.endpoint;
        if (!endpoint)
            return;
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
        }
        catch (error) {
            console.error('Heartbeat failed:', error);
        }
    }
    generateSessionId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    async destroy() {
        if (this.watermarkLayer) {
            if (this.watermarkLayer.animationFrame) {
                cancelAnimationFrame(this.watermarkLayer.animationFrame);
            }
            this.watermarkLayer.canvas.remove();
            this.watermarkLayer = undefined;
        }
        if (this.analyticsTimer) {
            clearInterval(this.analyticsTimer);
            this.reportAnalytics();
        }
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        if (this.screenRecordingProtection) {
            this.screenRecordingProtection.disconnect();
        }
        if (this.customControls) {
            this.customControls.remove();
        }
        if (this.shakaPlayer) {
            await this.shakaPlayer.destroy();
        }
        await super.destroy();
    }
}
exports.SecureVideoPlayer = SecureVideoPlayer;
exports.default = SecureVideoPlayer;
//# sourceMappingURL=SecureVideoPlayer.js.map