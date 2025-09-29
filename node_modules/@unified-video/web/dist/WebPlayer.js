import { BasePlayer } from '@unified-video/core';
export class WebPlayer extends BasePlayer {
    constructor() {
        super(...arguments);
        this.video = null;
        this.hls = null;
        this.dash = null;
        this.qualities = [];
        this.currentQualityIndex = -1;
        this.autoQuality = true;
        this.useCustomControls = true;
        this.controlsContainer = null;
        this.hideControlsTimeout = null;
        this.volumeHideTimeout = null;
        this.isVolumeSliding = false;
        this.isDragging = false;
        this.watermarkCanvas = null;
        this.playerWrapper = null;
        this.previewGateHit = false;
        this.paymentSuccessTime = 0;
        this.paymentSuccessful = false;
        this.isPaywallActive = false;
        this.authValidationInterval = null;
        this.overlayRemovalAttempts = 0;
        this.maxOverlayRemovalAttempts = 3;
        this.lastSecurityCheck = 0;
        this.castContext = null;
        this.remotePlayer = null;
        this.remoteController = null;
        this.isCasting = false;
        this._castTrackIdByKey = {};
        this.selectedSubtitleKey = 'off';
        this._kiTo = null;
        this.paywallController = null;
        this._playPromise = null;
        this._deferredPause = false;
        this._lastToggleAt = 0;
        this._TOGGLE_DEBOUNCE_MS = 120;
        this.hasTriedButtonFallback = false;
        this.lastUserInteraction = 0;
    }
    debugLog(message, ...args) {
        if (this.config.debug) {
            console.log(`[WebPlayer] ${message}`, ...args);
        }
    }
    debugError(message, ...args) {
        if (this.config.debug) {
            console.error(`[WebPlayer] ${message}`, ...args);
        }
    }
    debugWarn(message, ...args) {
        if (this.config.debug) {
            console.warn(`[WebPlayer] ${message}`, ...args);
        }
    }
    async setupPlayer() {
        if (!this.container) {
            throw new Error('Container element is required');
        }
        this.injectStyles();
        const wrapper = document.createElement('div');
        wrapper.className = 'uvf-player-wrapper';
        this.playerWrapper = wrapper;
        const videoContainer = document.createElement('div');
        videoContainer.className = 'uvf-video-container';
        this.video = document.createElement('video');
        this.video.className = 'uvf-video';
        this.video.controls = false;
        this.video.autoplay = this.config.autoPlay ?? false;
        this.video.muted = this.config.muted ?? false;
        this.video.loop = this.config.loop ?? false;
        this.video.playsInline = this.config.playsInline ?? true;
        this.video.preload = this.config.preload ?? 'metadata';
        if (this.config.crossOrigin) {
            this.video.crossOrigin = this.config.crossOrigin;
        }
        this.watermarkCanvas = document.createElement('canvas');
        this.watermarkCanvas.className = 'uvf-watermark-layer';
        videoContainer.appendChild(this.video);
        videoContainer.appendChild(this.watermarkCanvas);
        if (this.useCustomControls) {
            this.createCustomControls(videoContainer);
        }
        wrapper.appendChild(videoContainer);
        this.container.innerHTML = '';
        this.container.appendChild(wrapper);
        this.applyScrollbarPreferencesFromDataset();
        this.setupVideoEventListeners();
        this.setupControlsEventListeners();
        this.setupKeyboardShortcuts();
        this.setupWatermark();
        this.setupFullscreenListeners();
        try {
            const pw = this.config.paywall || null;
            if (pw && pw.enabled) {
                const { PaywallController } = await import('./paywall/PaywallController');
                this.paywallController = new PaywallController(pw, {
                    getOverlayContainer: () => this.playerWrapper,
                    onResume: () => {
                        try {
                            this.debugLog('onResume callback triggered - payment/auth successful');
                            this.previewGateHit = false;
                            this.paymentSuccessTime = Date.now();
                            this.paymentSuccessful = true;
                            this.isPaywallActive = false;
                            this.overlayRemovalAttempts = 0;
                            if (this.authValidationInterval) {
                                this.debugLog('Clearing security monitoring interval');
                                clearInterval(this.authValidationInterval);
                                this.authValidationInterval = null;
                            }
                            this.forceCleanupOverlays();
                            this.debugLog('Payment successful - all security restrictions lifted, resuming playback');
                            setTimeout(() => {
                                this.play();
                            }, 150);
                        }
                        catch (error) {
                            this.debugError('Error in onResume callback:', error);
                        }
                    },
                    onShow: () => {
                        this.isPaywallActive = true;
                        this.startOverlayMonitoring();
                        try {
                            this.requestPause();
                        }
                        catch (_) { }
                    },
                    onClose: () => {
                        this.debugLog('onClose callback triggered - paywall closing');
                        this.isPaywallActive = false;
                        if (this.authValidationInterval) {
                            this.debugLog('Clearing security monitoring interval on close');
                            clearInterval(this.authValidationInterval);
                            this.authValidationInterval = null;
                        }
                        this.overlayRemovalAttempts = 0;
                    }
                });
                this.on('onFreePreviewEnded', () => {
                    this.debugLog('onFreePreviewEnded event triggered, calling paywallController.openOverlay()');
                    try {
                        this.paywallController?.openOverlay();
                    }
                    catch (error) {
                        this.debugError('Error calling paywallController.openOverlay():', error);
                    }
                });
            }
        }
        catch (_) { }
        this.setupCastContextSafe();
        this.updateMetadataUI();
    }
    setupVideoEventListeners() {
        if (!this.video)
            return;
        this.video.addEventListener('play', () => {
            if (!this.paymentSuccessful && this.config.freeDuration && this.config.freeDuration > 0) {
                const lim = Number(this.config.freeDuration);
                const cur = (this.video?.currentTime || 0);
                if (!this.previewGateHit && cur >= lim) {
                    try {
                        this.video?.pause();
                    }
                    catch (_) { }
                    this.showNotification('Free preview ended. Please rent to continue.');
                    return;
                }
            }
            this.state.isPlaying = true;
            this.state.isPaused = false;
            this.emit('onPlay');
        });
        this.video.addEventListener('playing', () => {
            if (this._deferredPause) {
                this._deferredPause = false;
                try {
                    this.video?.pause();
                }
                catch (_) { }
            }
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
            if (!this.video)
                return;
            const t = this.video.currentTime || 0;
            this.updateTime(t);
            this.enforceFreePreviewGate(t);
        });
        this.video.addEventListener('progress', () => {
            this.updateBufferProgress();
        });
        this.video.addEventListener('waiting', () => {
            this.setBuffering(true);
        });
        this.video.addEventListener('canplay', () => {
            this.setBuffering(false);
            this.emit('onReady');
            this.updateTimeDisplay();
            if (this._deferredPause) {
                this._deferredPause = false;
                try {
                    this.video?.pause();
                }
                catch (_) { }
            }
        });
        this.video.addEventListener('loadedmetadata', () => {
            if (!this.video)
                return;
            this.state.duration = this.video.duration || 0;
            this.debugLog('Metadata loaded - duration:', this.video.duration);
            this.updateTimeDisplay();
            this.emit('onLoadedMetadata', {
                duration: this.video.duration || 0,
                width: this.video.videoWidth || 0,
                height: this.video.videoHeight || 0
            });
        });
        this.video.addEventListener('volumechange', () => {
            if (!this.video)
                return;
            this.state.volume = this.video.volume;
            this.state.isMuted = this.video.muted;
            this.emit('onVolumeChanged', this.video.volume);
        });
        this.video.addEventListener('error', (e) => {
            if (!this.video)
                return;
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
            if (!this.video)
                return;
            const t = this.video.currentTime || 0;
            this.enforceFreePreviewGate(t, true);
            this.emit('onSeeked');
        });
    }
    getMediaErrorMessage(code) {
        switch (code) {
            case 1: return 'Media loading aborted';
            case 2: return 'Network error';
            case 3: return 'Media decoding failed';
            case 4: return 'Media format not supported';
            default: return 'Unknown media error';
        }
    }
    updateBufferProgress() {
        if (!this.video)
            return;
        const buffered = this.video.buffered;
        if (buffered.length > 0) {
            const bufferedEnd = buffered.end(buffered.length - 1);
            const duration = this.video.duration;
            const percentage = duration > 0 ? (bufferedEnd / duration) * 100 : 0;
            this.updateBuffered(percentage);
        }
    }
    async load(source) {
        this.source = source;
        this.subtitles = (source.subtitles || []);
        await this.cleanup();
        if (!this.video) {
            throw new Error('Video element not initialized');
        }
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
            if (source.subtitles && source.subtitles.length > 0) {
                this.loadSubtitles(source.subtitles);
            }
            if (source.metadata) {
                if (source.metadata.posterUrl && this.video) {
                    this.video.poster = source.metadata.posterUrl;
                }
                this.updateMetadataUI();
            }
            else {
                this.updateMetadataUI();
            }
        }
        catch (error) {
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
    detectSourceType(source) {
        if (source.type && source.type !== 'auto') {
            return source.type;
        }
        const url = source.url.toLowerCase();
        if (url.includes('.m3u8'))
            return 'hls';
        if (url.includes('.mpd'))
            return 'dash';
        if (url.includes('.mp4'))
            return 'mp4';
        if (url.includes('.webm'))
            return 'webm';
        return 'mp4';
    }
    async loadHLS(url) {
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
            this.hls.on(window.Hls.Events.MANIFEST_PARSED, (event, data) => {
                this.qualities = data.levels.map((level, index) => ({
                    height: level.height,
                    width: level.width || 0,
                    bitrate: level.bitrate,
                    label: `${level.height}p`,
                    index: index
                }));
                if (this.config.autoPlay) {
                    this.play();
                }
            });
            this.hls.on(window.Hls.Events.LEVEL_SWITCHED, (event, data) => {
                if (this.qualities[data.level]) {
                    this.currentQualityIndex = data.level;
                    this.state.currentQuality = this.qualities[data.level];
                    this.emit('onQualityChanged', this.qualities[data.level]);
                }
            });
            this.hls.on(window.Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    this.handleHLSError(data);
                }
            });
        }
        else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            this.video.src = url;
        }
        else {
            throw new Error('HLS is not supported in this browser');
        }
    }
    handleHLSError(data) {
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
    async loadDASH(url) {
        if (!window.dashjs) {
            await this.loadScript('https://cdn.dashjs.org/latest/dash.all.min.js');
        }
        this.dash = window.dashjs.MediaPlayer().create();
        this.dash.initialize(this.video, url, this.config.autoPlay);
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
        this.dash.on(window.dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e) => {
            if (e.mediaType === 'video') {
                this.updateDASHQuality(e.newQuality);
            }
        });
        this.dash.on(window.dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
            const bitrateList = this.dash.getBitrateInfoListFor('video');
            if (bitrateList && bitrateList.length > 0) {
                this.qualities = bitrateList.map((info, index) => ({
                    height: info.height || 0,
                    width: info.width || 0,
                    bitrate: info.bitrate,
                    label: `${info.height}p`,
                    index: index
                }));
            }
        });
        this.dash.on(window.dashjs.MediaPlayer.events.ERROR, (e) => {
            this.handleError({
                code: 'DASH_ERROR',
                message: e.error.message,
                type: 'media',
                fatal: true,
                details: e
            });
        });
    }
    updateDASHQuality(qualityIndex) {
        if (this.qualities[qualityIndex]) {
            this.currentQualityIndex = qualityIndex;
            this.state.currentQuality = this.qualities[qualityIndex];
            this.emit('onQualityChanged', this.qualities[qualityIndex]);
        }
    }
    async loadNative(url) {
        if (!this.video)
            return;
        this.video.src = url;
        this.video.load();
    }
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }
    loadSubtitles(subtitles) {
        if (!this.video)
            return;
        const existingTracks = this.video.querySelectorAll('track');
        existingTracks.forEach(track => track.remove());
        subtitles.forEach((subtitle, index) => {
            const track = document.createElement('track');
            track.kind = subtitle.kind || 'subtitles';
            track.label = subtitle.label;
            track.src = subtitle.url || '';
            if (subtitle.default || index === 0) {
                track.default = true;
            }
            this.video.appendChild(track);
        });
    }
    isAbortPlayError(err) {
        return !!err && ((err.name === 'AbortError') ||
            (typeof err.message === 'string' && /interrupted by a call to pause\(\)/i.test(err.message)));
    }
    async play() {
        if (!this.video)
            throw new Error('Video element not initialized');
        if (!this.canPlayVideo()) {
            this.debugWarn('Playbook blocked by security check');
            this.enforcePaywallSecurity();
            return;
        }
        const now = Date.now();
        if (now - this._lastToggleAt < this._TOGGLE_DEBOUNCE_MS)
            return;
        this._lastToggleAt = now;
        if (!this.video.paused || this._playPromise)
            return;
        try {
            this._deferredPause = false;
            this._playPromise = this.video.play();
            await this._playPromise;
            this._playPromise = null;
            if (this._deferredPause) {
                this._deferredPause = false;
                this.video.pause();
            }
            await super.play();
        }
        catch (err) {
            this._playPromise = null;
            if (this.isAbortPlayError(err)) {
                return;
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
    pause() {
        if (!this.video)
            return;
        const now = Date.now();
        if (now - this._lastToggleAt < this._TOGGLE_DEBOUNCE_MS)
            return;
        this._lastToggleAt = now;
        if (this._playPromise || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            this._deferredPause = true;
            return;
        }
        this.video.pause();
        super.pause();
    }
    requestPause() {
        this._deferredPause = true;
        if (!this._playPromise && this.video && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            try {
                this.video.pause();
            }
            catch (_) { }
        }
    }
    seek(time) {
        if (!this.video)
            return;
        const freeDuration = Number(this.config.freeDuration || 0);
        if (freeDuration > 0 && !this.paymentSuccessful) {
            const requestedTime = Math.max(0, Math.min(time, this.video.duration || time));
            if (requestedTime >= freeDuration) {
                this.debugWarn('Seek blocked - beyond free preview limit');
                this.enforcePaywallSecurity();
                this.video.currentTime = Math.max(0, freeDuration - 1);
                return;
            }
        }
        const d = this.video.duration;
        if (typeof d === 'number' && isFinite(d) && d > 0) {
            this.video.currentTime = Math.max(0, Math.min(time, d));
        }
        else {
            this.video.currentTime = Math.max(0, time);
        }
    }
    setVolume(level) {
        if (!this.video)
            return;
        this.video.volume = Math.max(0, Math.min(1, level));
        super.setVolume(level);
    }
    mute() {
        if (!this.video)
            return;
        this.video.muted = true;
        super.mute();
    }
    unmute() {
        if (!this.video)
            return;
        this.video.muted = false;
        super.unmute();
    }
    setPlaybackRate(rate) {
        if (!this.video)
            return;
        this.video.playbackRate = rate;
        super.setPlaybackRate(rate);
    }
    getCurrentTime() {
        if (this.video && typeof this.video.currentTime === 'number') {
            return this.video.currentTime;
        }
        return super.getCurrentTime();
    }
    getQualities() {
        return this.qualities;
    }
    getCurrentQuality() {
        return this.currentQualityIndex >= 0 ? this.qualities[this.currentQualityIndex] : null;
    }
    setQuality(index) {
        if (this.hls) {
            this.hls.currentLevel = index;
        }
        else if (this.dash) {
            this.dash.setQualityFor('video', index);
        }
        this.currentQualityIndex = index;
        this.autoQuality = false;
    }
    setAutoQuality(enabled) {
        this.autoQuality = enabled;
        if (this.hls) {
            this.hls.currentLevel = enabled ? -1 : this.currentQualityIndex;
        }
        else if (this.dash) {
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
    async enterFullscreen() {
        if (!this.playerWrapper)
            return;
        try {
            if (!document.fullscreenEnabled &&
                !document.webkitFullscreenEnabled &&
                !document.mozFullScreenEnabled &&
                !document.msFullscreenEnabled) {
                this.debugWarn('Fullscreen not supported by browser');
                return;
            }
            if (document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement) {
                this.debugLog('Already in fullscreen mode');
                return;
            }
            const element = this.playerWrapper;
            if (element.requestFullscreen) {
                await element.requestFullscreen().catch(err => {
                    this.debugWarn('Fullscreen request failed:', err.message);
                });
            }
            else if (element.webkitRequestFullscreen) {
                await element.webkitRequestFullscreen().catch((err) => {
                    this.debugWarn('WebKit fullscreen request failed:', err.message);
                });
            }
            else if (element.mozRequestFullScreen) {
                await element.mozRequestFullScreen().catch((err) => {
                    this.debugWarn('Mozilla fullscreen request failed:', err.message);
                });
            }
            else if (element.msRequestFullscreen) {
                await element.msRequestFullscreen().catch((err) => {
                    this.debugWarn('MS fullscreen request failed:', err.message);
                });
            }
            else {
                this.debugWarn('Fullscreen API not supported by this browser');
                return;
            }
            this.playerWrapper.classList.add('uvf-fullscreen');
            this.emit('onFullscreenChanged', true);
        }
        catch (error) {
            this.debugWarn('Failed to enter fullscreen:', error.message);
        }
    }
    async exitFullscreen() {
        try {
            if (!document.fullscreenElement &&
                !document.webkitFullscreenElement &&
                !document.mozFullScreenElement &&
                !document.msFullscreenElement) {
                this.debugLog('Not in fullscreen mode');
                return;
            }
            if (document.exitFullscreen) {
                await document.exitFullscreen().catch(err => {
                    this.debugWarn('Exit fullscreen failed:', err.message);
                });
            }
            else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen().catch((err) => {
                    this.debugWarn('WebKit exit fullscreen failed:', err.message);
                });
            }
            else if (document.mozCancelFullScreen) {
                await document.mozCancelFullScreen().catch((err) => {
                    this.debugWarn('Mozilla exit fullscreen failed:', err.message);
                });
            }
            else if (document.msExitFullscreen) {
                await document.msExitFullscreen().catch((err) => {
                    this.debugWarn('MS exit fullscreen failed:', err.message);
                });
            }
            if (this.playerWrapper) {
                this.playerWrapper.classList.remove('uvf-fullscreen');
            }
            this.emit('onFullscreenChanged', false);
        }
        catch (error) {
            this.debugWarn('Failed to exit fullscreen:', error.message);
        }
    }
    async enterPictureInPicture() {
        if (!this.video)
            return;
        try {
            if (this.video.requestPictureInPicture) {
                await this.video.requestPictureInPicture();
            }
            else {
                throw new Error('Picture-in-Picture not supported');
            }
        }
        catch (error) {
            console.error('Failed to enter PiP:', error);
            throw error;
        }
    }
    async exitPictureInPicture() {
        try {
            if (document.exitPictureInPicture) {
                await document.exitPictureInPicture();
            }
        }
        catch (error) {
            this.debugWarn('Failed to exit PiP:', error.message);
        }
    }
    focusPlayer() {
        if (this.playerWrapper) {
            this.playerWrapper.focus();
            this.debugLog('Player focused programmatically');
        }
    }
    showFullscreenTip() {
        this.showShortcutIndicator('💡 Double-click or use ⌨️ F key for fullscreen');
        this.debugLog('Tip: Double-click the video area or press F key for fullscreen, or use the fullscreen button in controls');
    }
    isBraveBrowser() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isBrave = (userAgent.includes('brave') ||
            !!navigator.brave ||
            window.chrome && window.chrome.app && window.chrome.app.isInstalled === false);
        this.debugLog('Browser detection - Is Brave:', isBrave, 'User Agent:', userAgent);
        return isBrave;
    }
    async checkFullscreenPermissions() {
        try {
            const fullscreenEnabled = document.fullscreenEnabled ||
                document.webkitFullscreenEnabled ||
                document.mozFullScreenEnabled ||
                document.msFullscreenEnabled;
            this.debugLog('Fullscreen permissions check:', {
                fullscreenEnabled,
                documentFullscreenEnabled: document.fullscreenEnabled,
                webkitEnabled: document.webkitFullscreenEnabled,
                mozEnabled: document.mozFullScreenEnabled,
                msEnabled: document.msFullscreenEnabled,
                currentOrigin: window.location.origin,
                currentHref: window.location.href,
                isSecureContext: window.isSecureContext,
                protocol: window.location.protocol,
                isBrave: this.isBraveBrowser(),
                isPrivate: this.isPrivateWindow()
            });
            if ('permissions' in navigator) {
                try {
                    const permission = await navigator.permissions.query({ name: 'fullscreen' });
                    this.debugLog('Fullscreen permission state:', permission.state);
                }
                catch (err) {
                    this.debugLog('Permissions API check failed:', err.message);
                }
            }
        }
        catch (error) {
            this.debugWarn('Permission check failed:', error.message);
        }
    }
    isPrivateWindow() {
        try {
            if ('webkitRequestFileSystem' in window) {
                return new Promise((resolve) => {
                    window.webkitRequestFileSystem(window.TEMPORARY, 1, () => resolve(false), () => resolve(true));
                });
            }
            if ('MozAppearance' in document.documentElement.style) {
                if (window.indexedDB === null)
                    return true;
                if (window.indexedDB === undefined)
                    return true;
            }
            try {
                window.localStorage.setItem('test', '1');
                window.localStorage.removeItem('test');
                return false;
            }
            catch {
                return true;
            }
        }
        catch {
            return false;
        }
        return false;
    }
    triggerFullscreenButton() {
        const fullscreenBtn = document.getElementById('uvf-fullscreen-btn');
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
        this.checkFullscreenPermissions();
        if (fullscreenBtn) {
            this.debugLog('Triggering fullscreen button click');
            if (isBrave) {
                this.debugLog('Applying Brave browser specific fullscreen handling');
                if (Date.now() - this.lastUserInteraction > 1000) {
                    this.debugWarn('User gesture may be stale for Brave browser');
                    this.showTemporaryMessage('Click the fullscreen button directly in Brave browser');
                    return;
                }
                this.requestFullscreenPermissionBrave().then(() => {
                    this.performFullscreenButtonClick(fullscreenBtn);
                }).catch(() => {
                    this.performFullscreenButtonClick(fullscreenBtn);
                });
            }
            else {
                this.performFullscreenButtonClick(fullscreenBtn);
            }
        }
        else {
            this.debugWarn('Fullscreen button not found');
            this.showShortcutIndicator('Fullscreen Button Missing');
            if (isBrave) {
                this.showTemporaryMessage('Brave: Please use fullscreen button in controls');
            }
            else {
                this.showTemporaryMessage('Press F key when player controls are visible');
            }
        }
    }
    performFullscreenButtonClick(fullscreenBtn) {
        const events = [
            new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window,
                detail: 1,
                button: 0,
                buttons: 1,
                isTrusted: true
            }),
            new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true,
                view: window,
                detail: 1,
                button: 0,
                buttons: 0,
                isTrusted: true
            }),
            new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                detail: 1,
                button: 0,
                buttons: 0,
                isTrusted: true
            })
        ];
        this.debugLog('Dispatching mouse events:', events.length);
        events.forEach((event, index) => {
            try {
                fullscreenBtn.dispatchEvent(event);
                this.debugLog(`Event ${index + 1} dispatched:`, event.type);
            }
            catch (error) {
                this.debugWarn(`Event ${index + 1} dispatch failed:`, error.message);
            }
        });
        try {
            fullscreenBtn.click();
            this.debugLog('Direct button click executed');
        }
        catch (error) {
            this.debugWarn('Direct button click failed:', error.message);
        }
        try {
            fullscreenBtn.focus();
            setTimeout(() => fullscreenBtn.blur(), 100);
        }
        catch (error) {
            this.debugLog('Button focus failed:', error.message);
        }
        this.showShortcutIndicator('Fullscreen');
    }
    async requestFullscreenPermissionBrave() {
        try {
            if ('permissions' in navigator && 'request' in navigator.permissions) {
                await navigator.permissions.request({ name: 'fullscreen' });
                this.debugLog('Brave fullscreen permission requested');
            }
        }
        catch (error) {
            this.debugLog('Brave permission request failed:', error.message);
        }
    }
    async enterFullscreenWithBraveSupport() {
        if (!this.playerWrapper) {
            throw new Error('Player wrapper not available');
        }
        this.debugLog('Attempting Brave-specific fullscreen entry');
        await this.requestFullscreenPermissionBrave();
        if (document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement) {
            this.debugLog('Already in fullscreen mode');
            return;
        }
        const fullscreenEnabled = document.fullscreenEnabled ||
            document.webkitFullscreenEnabled ||
            document.mozFullScreenEnabled ||
            document.msFullscreenEnabled;
        if (!fullscreenEnabled) {
            throw new Error('Fullscreen not supported or disabled in Brave settings');
        }
        if ('permissions' in navigator) {
            try {
                const permission = await navigator.permissions.query({ name: 'fullscreen' });
                this.debugLog('Brave fullscreen permission state:', permission.state);
                if (permission.state === 'denied') {
                    throw new Error('Fullscreen permission denied in Brave site settings');
                }
            }
            catch (permError) {
                this.debugLog('Permission check failed:', permError.message);
            }
        }
        let fullscreenError = null;
        try {
            if (this.playerWrapper.requestFullscreen) {
                this.debugLog('Attempting standard requestFullscreen()');
                await this.playerWrapper.requestFullscreen({
                    navigationUI: 'hide'
                });
            }
            else if (this.playerWrapper.webkitRequestFullscreen) {
                this.debugLog('Attempting webkitRequestFullscreen()');
                await this.playerWrapper.webkitRequestFullscreen();
            }
            else if (this.playerWrapper.mozRequestFullScreen) {
                this.debugLog('Attempting mozRequestFullScreen()');
                await this.playerWrapper.mozRequestFullScreen();
            }
            else if (this.playerWrapper.msRequestFullscreen) {
                this.debugLog('Attempting msRequestFullscreen()');
                await this.playerWrapper.msRequestFullscreen();
            }
            else {
                throw new Error('No fullscreen API available');
            }
            this.playerWrapper.classList.add('uvf-fullscreen');
            this.emit('onFullscreenChanged', true);
            this.debugLog('Brave fullscreen entry successful');
        }
        catch (error) {
            fullscreenError = error;
            this.debugWarn('Brave fullscreen attempt failed:', fullscreenError.message);
            if (fullscreenError.message.includes('denied') ||
                fullscreenError.message.includes('not allowed')) {
                throw new Error('Brave Browser: Fullscreen blocked. Check site permissions in Settings > Site and Shields Settings');
            }
            else if (fullscreenError.message.includes('gesture') ||
                fullscreenError.message.includes('user activation')) {
                throw new Error('Brave Browser: User interaction required. Click the fullscreen button directly');
            }
            else {
                throw new Error(`Brave Browser: ${fullscreenError.message}`);
            }
        }
    }
    showTemporaryMessage(message) {
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
    enterFullscreenSynchronously() {
        if (!this.playerWrapper) {
            throw new Error('Player wrapper not available');
        }
        if (!document.fullscreenEnabled &&
            !document.webkitFullscreenEnabled &&
            !document.mozFullScreenEnabled &&
            !document.msFullscreenEnabled) {
            throw new Error('Fullscreen not supported by browser');
        }
        if (document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement) {
            this.debugLog('Already in fullscreen mode');
            return;
        }
        this.debugLog('Attempting synchronous fullscreen');
        const element = this.playerWrapper;
        if (element.requestFullscreen) {
            element.requestFullscreen().then(() => {
                this.debugLog('Successfully entered fullscreen via requestFullscreen');
                this.playerWrapper?.classList.add('uvf-fullscreen');
                this.emit('onFullscreenChanged', true);
            }).catch((error) => {
                this.debugWarn('requestFullscreen failed:', error.message);
                throw error;
            });
        }
        else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
            this.debugLog('Successfully requested fullscreen via webkitRequestFullscreen');
            this.playerWrapper?.classList.add('uvf-fullscreen');
            this.emit('onFullscreenChanged', true);
        }
        else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
            this.debugLog('Successfully requested fullscreen via mozRequestFullScreen');
            this.playerWrapper?.classList.add('uvf-fullscreen');
            this.emit('onFullscreenChanged', true);
        }
        else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
            this.debugLog('Successfully requested fullscreen via msRequestFullscreen');
            this.playerWrapper?.classList.add('uvf-fullscreen');
            this.emit('onFullscreenChanged', true);
        }
        else {
            throw new Error('Fullscreen API not supported by this browser');
        }
    }
    async requestFullscreenWithUserGesture(event) {
        if (!this.playerWrapper)
            return false;
        try {
            if (!document.fullscreenEnabled &&
                !document.webkitFullscreenEnabled &&
                !document.mozFullScreenEnabled &&
                !document.msFullscreenEnabled) {
                this.debugWarn('Fullscreen not supported by browser');
                return false;
            }
            if (document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement) {
                this.debugLog('Already in fullscreen mode');
                return false;
            }
            const timeSinceInteraction = Date.now() - this.lastUserInteraction;
            this.debugLog('Attempting fullscreen within user gesture context', {
                eventType: event.type,
                timeSinceInteraction,
                isTrusted: event.isTrusted
            });
            const element = this.playerWrapper;
            if (element.requestFullscreen) {
                await element.requestFullscreen();
            }
            else if (element.webkitRequestFullscreen) {
                await element.webkitRequestFullscreen();
            }
            else if (element.mozRequestFullScreen) {
                await element.mozRequestFullScreen();
            }
            else if (element.msRequestFullscreen) {
                await element.msRequestFullscreen();
            }
            else {
                this.debugWarn('Fullscreen API not supported by this browser');
                return false;
            }
            this.playerWrapper.classList.add('uvf-fullscreen');
            this.emit('onFullscreenChanged', true);
            this.debugLog('Successfully entered fullscreen');
            return true;
        }
        catch (error) {
            this.debugWarn('Failed to enter fullscreen:', error.message);
            return false;
        }
    }
    showFullscreenInstructions() {
        const existingOverlay = document.getElementById('uvf-fullscreen-instructions');
        if (existingOverlay) {
            existingOverlay.remove();
        }
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
        const content = overlay.querySelector('.uvf-fullscreen-instruction-content');
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
        const icon = overlay.querySelector('.uvf-fullscreen-icon');
        if (icon) {
            icon.style.cssText = `
        font-size: 48px;
        margin-bottom: 16px;
      `;
        }
        const title = overlay.querySelector('h3');
        if (title) {
            title.style.cssText = `
        margin: 0 0 16px 0;
        font-size: 24px;
        font-weight: 600;
      `;
        }
        const text = overlay.querySelector('p');
        if (text) {
            text.style.cssText = `
        margin: 0 0 16px 0;
        font-size: 16px;
        opacity: 0.9;
      `;
        }
        const pointer = overlay.querySelector('.uvf-fullscreen-pointer');
        if (pointer) {
            pointer.style.cssText = `
        font-size: 14px;
        opacity: 0.8;
        margin-bottom: 24px;
      `;
        }
        const button = overlay.querySelector('.uvf-instruction-close');
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
        if (this.playerWrapper) {
            this.playerWrapper.appendChild(overlay);
        }
        setTimeout(() => {
            if (overlay.parentElement) {
                overlay.remove();
            }
        }, 5000);
        const fullscreenBtn = document.getElementById('uvf-fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.style.animation = 'pulse 2s infinite';
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
            setTimeout(() => {
                fullscreenBtn.style.animation = '';
            }, 3000);
        }
        this.debugLog('Showing fullscreen instructions overlay');
    }
    async attemptFullscreen() {
        try {
            await this.enterFullscreen();
            return true;
        }
        catch (error) {
            const errorMessage = error.message;
            if (errorMessage.includes('user gesture') ||
                errorMessage.includes('user activation') ||
                errorMessage.includes('Permissions check failed')) {
                const fullscreenBtn = document.getElementById('uvf-fullscreen-btn');
                if (fullscreenBtn && !this.hasTriedButtonFallback) {
                    this.hasTriedButtonFallback = true;
                    this.debugLog('Attempting fullscreen via button as fallback');
                    setTimeout(() => {
                        this.hasTriedButtonFallback = false;
                    }, 1000);
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        detail: 1
                    });
                    fullscreenBtn.dispatchEvent(clickEvent);
                    return false;
                }
                else {
                    this.showShortcutIndicator('Click Fullscreen Button');
                    this.debugWarn('Fullscreen requires direct user interaction. Please click the fullscreen button in the player controls.');
                    return false;
                }
            }
            else {
                this.debugWarn('Fullscreen failed:', errorMessage);
                return false;
            }
        }
    }
    applySubtitleTrack(track) {
        if (!this.video)
            return;
        const tracks = this.video.textTracks;
        for (let i = 0; i < tracks.length; i++) {
            const textTrack = tracks[i];
            if (textTrack.label === track.label) {
                textTrack.mode = 'showing';
            }
            else {
                textTrack.mode = 'hidden';
            }
        }
    }
    removeSubtitles() {
        if (!this.video)
            return;
        const tracks = this.video.textTracks;
        for (let i = 0; i < tracks.length; i++) {
            tracks[i].mode = 'hidden';
        }
    }
    injectStyles() {
        if (document.getElementById('uvf-player-styles'))
            return;
        const style = document.createElement('style');
        style.id = 'uvf-player-styles';
        style.textContent = this.getPlayerStyles();
        document.head.appendChild(style);
    }
    getPlayerStyles() {
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
      
      /* Player focus styles for better UX */
      .uvf-player-wrapper:focus {
        outline: 2px solid var(--uvf-accent-1);
        outline-offset: -2px;
      }
      
      .uvf-player-wrapper:focus-visible {
        outline: 2px solid var(--uvf-accent-1);
        outline-offset: -2px;
      }
      
      .uvf-player-wrapper:focus:not(:focus-visible) {
        outline: none;
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
      
      /* Center Play Button */
      .uvf-center-play-btn {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80px;
        height: 80px;
        background: rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 8;
      }
      
      .uvf-center-play-btn:hover {
        transform: translate(-50%, -50%) scale(1.1);
        background: rgba(255,255,255,0.2);
        box-shadow: 0 0 40px rgba(255,255,255,0.4);
      }
      
      .uvf-center-play-btn.hidden {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
        pointer-events: none;
      }
      
      .uvf-center-play-btn svg {
        width: 35px;
        height: 35px;
        fill: var(--uvf-icon-color);
        margin-left: 4px;
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
        margin-bottom: 15px;
      }
      
      .uvf-progress-bar-wrapper {
        position: relative;
        width: 100%;
        height: 6px;
        background: rgba(255,255,255,0.1);
        border-radius: 3px;
        cursor: pointer;
        overflow: visible;
        transition: transform 0.2s ease;
      }
      
      .uvf-progress-bar-wrapper:hover {
        transform: scaleY(1.5);
      }
      
      .uvf-progress-buffered {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: rgba(255,255,255,0.2);
        border-radius: 3px;
        pointer-events: none;
      }
      
      .uvf-progress-filled {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: linear-gradient(90deg, var(--uvf-accent-1), var(--uvf-accent-2));
        border-radius: 3px;
        pointer-events: none;
        box-shadow: 0 0 10px var(--uvf-accent-1-20);
      }
      
      .uvf-progress-handle {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%) scale(0);
        width: 16px;
        height: 16px;
        background: #fff;
        border-radius: 50%;
        box-shadow: 0 0 15px rgba(255,255,255,0.5);
        transition: transform 0.2s ease;
        pointer-events: none;
      }
      
      .uvf-progress-bar-wrapper:hover .uvf-progress-handle {
        transform: translate(-50%, -50%) scale(1);
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
      
      /* Skip button specific styles for consistency */
      #uvf-skip-back svg,
      #uvf-skip-forward svg {
        width: 22px;
        height: 22px;
        stroke-width: 0;
        transform: scale(1);
      }
      
      #uvf-skip-forward svg {
        transform: scale(1) scaleX(-1); /* Mirror the icon for forward */
      }
      
      .uvf-control-btn.play-pause {
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, var(--uvf-accent-1), var(--uvf-accent-2));
      }
      
      .uvf-control-btn.play-pause svg {
        width: 24px;
        height: 24px;
      }
      
      /* Time Display */
      .uvf-time-display {
        color: var(--uvf-text-primary);
        font-size: 14px;
        font-weight: 500;
        min-width: 120px;
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
        background: rgba(0,0,0,0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 10px 0;
        min-width: 200px;
        max-height: 60vh;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        /* Firefox */
        scrollbar-width: thin;
        scrollbar-color: var(--uvf-firefox-scrollbar-color) transparent;
        /* Avoid layout shift when scrollbar appears */
        scrollbar-gutter: stable both-edges;
        /* Space on the right so content doesn't hug the scrollbar */
        padding-right: 6px;
        opacity: 0;
        visibility: hidden;
        transform: translateY(10px);
        transition: all 0.3s ease;
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
        transform: translateY(0);
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
      
      /* Title Bar */
      .uvf-title-bar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        padding: 20px;
        z-index: 7;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease;
      }
      
      .uvf-player-wrapper:hover .uvf-title-bar,
      .uvf-player-wrapper.controls-visible .uvf-title-bar {
        opacity: 1;
        transform: translateY(0);
      }
      
      .uvf-title-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .uvf-video-thumb {
        width: 56px;
        height: 56px;
        border-radius: 8px;
        object-fit: cover;
        box-shadow: 0 4px 14px rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.25);
        background: rgba(255,255,255,0.05);
      }
      .uvf-title-text { display: flex; flex-direction: column; }
      .uvf-video-title {
        color: var(--uvf-text-primary);
        font-size: 18px;
        font-weight: 600;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
      }
      
      .uvf-video-subtitle {
        color: var(--uvf-text-secondary);
        font-size: 13px;
        margin-top: 4px;
        max-width: min(70vw, 900px);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      /* Top Controls */
      .uvf-top-controls {
        position: absolute;
        top: 20px;
        right: 20px;
        z-index: 10;
        display: flex;
        gap: 10px;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease;
      }
      
      .uvf-player-wrapper:hover .uvf-top-controls,
      .uvf-player-wrapper.controls-visible .uvf-top-controls,
      .uvf-player-wrapper.uvf-casting .uvf-top-controls {
        opacity: 1;
        transform: translateY(0);
      }
      
      .uvf-top-btn {
        width: 40px;
        height: 40px;
        background: rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
      }
      
      .uvf-top-btn:hover {
        background: rgba(255,255,255,0.2);
        transform: scale(1.1);
        box-shadow: 0 0 20px rgba(255,255,255,0.3);
      }

      .uvf-top-btn.cast-grey {
        opacity: 0.6;
        filter: grayscale(0.6);
        box-shadow: none;
        background: rgba(255,255,255,0.08);
      }
      .uvf-top-btn.cast-grey:hover {
        transform: none;
        background: rgba(255,255,255,0.12);
        box-shadow: none;
      }
      
      .uvf-top-btn svg {
        width: 20px;
        height: 20px;
        fill: var(--uvf-icon-color);
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
      
      /* Hide top elements with controls */
      .uvf-player-wrapper.no-cursor .uvf-title-bar,
      .uvf-player-wrapper.no-cursor .uvf-top-controls {
        opacity: 0 !important;
        transform: translateY(-10px) !important;
        pointer-events: none;
      }
      
      /* Fullscreen specific styles */
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
      
      /* Maintain consistent control sizing in fullscreen */
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
      
      .uvf-player-wrapper.uvf-fullscreen .uvf-top-btn {
        width: 40px;
        height: 40px;
        min-width: 40px;
        min-height: 40px;
      }
      
      .uvf-player-wrapper.uvf-fullscreen .uvf-top-btn svg {
        width: 20px;
        height: 20px;
      }
      
      .uvf-player-wrapper.uvf-fullscreen .uvf-time-display {
        font-size: 14px;
        min-width: 120px;
        padding: 0 10px;
      }
      
      .uvf-player-wrapper.uvf-fullscreen .uvf-center-play-btn {
        width: 80px;
        height: 80px;
      }
      
      .uvf-player-wrapper.uvf-fullscreen .uvf-center-play-btn svg {
        width: 35px;
        height: 35px;
      }
      
      /* Ensure overlays remain visible in fullscreen with consistent spacing */
      .uvf-player-wrapper.uvf-fullscreen .uvf-title-bar,
      .uvf-player-wrapper.uvf-fullscreen .uvf-top-controls,
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
      
      .uvf-player-wrapper.uvf-fullscreen .uvf-title-bar {
        padding: 20px 30px;
      }
      
      .uvf-player-wrapper.uvf-fullscreen .uvf-top-controls {
        top: 20px;
        right: 30px;
        gap: 10px;
      }
      
      /* Fullscreen hover and visibility states */
      .uvf-player-wrapper.uvf-fullscreen:hover .uvf-title-bar,
      .uvf-player-wrapper.uvf-fullscreen:hover .uvf-top-controls,
      .uvf-player-wrapper.uvf-fullscreen.controls-visible .uvf-title-bar,
      .uvf-player-wrapper.uvf-fullscreen.controls-visible .uvf-top-controls {
        opacity: 1;
        transform: translateY(0);
      }
      
      /* Fullscreen mobile responsive adjustments */
      @media screen and (max-width: 767px) {
        .uvf-player-wrapper.uvf-fullscreen .uvf-controls-bar {
          padding: 15px 20px;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-title-bar {
          padding: 15px 20px;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-top-controls {
          top: 15px;
          right: 20px;
        }
        
        /* Mobile controls in fullscreen - slightly larger than normal mobile */
        .uvf-player-wrapper.uvf-fullscreen .uvf-control-btn {
          width: 36px;
          height: 36px;
          min-width: 36px;
          min-height: 36px;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-control-btn.play-pause {
          width: 44px;
          height: 44px;
          min-width: 44px;
          min-height: 44px;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-control-btn svg {
          width: 18px;
          height: 18px;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-control-btn.play-pause svg {
          width: 22px;
          height: 22px;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-top-btn {
          width: 36px;
          height: 36px;
          min-width: 36px;
          min-height: 36px;
        }
        
        .uvf-player-wrapper.uvf-fullscreen .uvf-top-btn svg {
          width: 18px;
          height: 18px;
        }
      }
      
      /* Enhanced Responsive Media Queries with UX Best Practices */
      /* Mobile devices (portrait) - Enhanced UX */
      @media screen and (max-width: 767px) and (orientation: portrait) {
        .uvf-responsive-container {
          padding: 0;
          width: 100vw !important;
          margin: 0;
        }
        
        .uvf-responsive-container .uvf-player-wrapper {
          width: 100vw !important;
        }
        
        .uvf-responsive-container .uvf-video-container {
          width: 100vw !important;
          aspect-ratio: unset !important;
        }
        
        /* Enhanced mobile controls bar with better spacing */
        .uvf-controls-bar {
          padding: 16px 12px;
          background: linear-gradient(to top, var(--uvf-overlay-strong) 0%, var(--uvf-overlay-medium) 80%, var(--uvf-overlay-transparent) 100%);
        }
        
        .uvf-progress-section {
          margin-bottom: 16px;
        }
        
        /* Mobile-first responsive controls layout */
        .uvf-controls-row {
          gap: 12px;
          flex-wrap: nowrap;
          align-items: center;
          justify-content: flex-start;
          position: relative;
        }
        
        /* Touch-friendly control sizing (minimum 44px touch target) */
        .uvf-control-btn {
          width: 44px;
          height: 44px;
          min-width: 44px;
          min-height: 44px;
          border-radius: 22px;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(8px);
        }
        
        .uvf-control-btn.play-pause {
          width: 52px;
          height: 52px;
          min-width: 52px;
          min-height: 52px;
          border-radius: 26px;
          background: linear-gradient(135deg, var(--uvf-accent-1), var(--uvf-accent-2));
          box-shadow: 0 4px 12px rgba(var(--uvf-accent-1), 0.3);
        }
        
        .uvf-control-btn svg {
          width: 20px;
          height: 20px;
        }
        
        .uvf-control-btn.play-pause svg {
          width: 24px;
          height: 24px;
        }
        
        /* Skip buttons with clear visual hierarchy */
        #uvf-skip-back,
        #uvf-skip-forward {
          background: rgba(255,255,255,0.12);
        }
        
        #uvf-skip-back svg,
        #uvf-skip-forward svg {
          width: 22px;
          height: 22px;
        }
        
        /* Mobile time display - compact but readable */
        .uvf-time-display {
          font-size: 12px;
          font-weight: 600;
          min-width: 90px;
          padding: 0 8px;
          order: 4;
          margin-left: auto;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        }
        
        /* Simplified volume control for mobile */
        .uvf-volume-control {
          order: 3;
          position: relative;
        }
        
        /* Hide volume panel on mobile - use device controls */
        .uvf-volume-panel {
          display: none;
        }
        
        /* Mobile volume button as simple mute toggle */
        .uvf-volume-control .uvf-control-btn {
          width: 44px;
          height: 44px;
        }
        
        /* Compact right controls for mobile */
        .uvf-right-controls {
          order: 5;
          gap: 8px;
          margin-left: 8px;
          display: flex;
          align-items: center;
        }
        
        /* Hide less essential controls on mobile */
        .uvf-quality-badge {
          display: none;
        }
        
        /* Settings menu - hidden by default, accessible via menu */
        .uvf-settings-menu {
          min-width: 160px;
          bottom: 60px;
          right: 12px;
          font-size: 14px;
          max-height: 50vh;
        }
        
        .uvf-settings-option {
          padding: 12px 16px;
          font-size: 14px;
          min-height: 44px;
          display: flex;
          align-items: center;
        }
        
        .uvf-settings-option:hover {
          background: rgba(255,255,255,0.15);
          padding-left: 20px;
        }
        
        /* Simplified settings - hide complex options */
        .uvf-settings-group:first-child .uvf-settings-option[data-speed="0.5"],
        .uvf-settings-group:first-child .uvf-settings-option[data-speed="0.75"],
        .uvf-settings-group:first-child .uvf-settings-option[data-speed="2"] {
          display: none;
        }
        }
        
        /* Enhanced top controls for mobile */
        .uvf-top-controls {
          top: 12px;
          right: 12px;
          gap: 8px;
        }
        
        /* Touch-friendly top buttons */
        .uvf-top-btn {
          width: 44px;
          height: 44px;
          min-width: 44px;
          min-height: 44px;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
        }
        
        .uvf-top-btn svg {
          width: 20px;
          height: 20px;
        }
        
        /* Hide less essential top controls on mobile */
        #uvf-share-btn {
          display: none;
        }
        
        /* Enhanced title bar for mobile */
        .uvf-title-bar {
          padding: 12px;
        }
        
        .uvf-video-title {
          font-size: 16px;
          font-weight: 700;
          line-height: 1.2;
        }
        
        .uvf-video-subtitle {
          font-size: 12px;
          margin-top: 4px;
          opacity: 0.8;
        }
        
        .uvf-video-thumb {
          width: 48px;
          height: 48px;
          border-radius: 6px;
        }
        
        /* Touch-optimized center play button */
        .uvf-center-play-btn {
          width: 72px;
          height: 72px;
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(15px);
          border: 2px solid rgba(255,255,255,0.4);
        }
        
        .uvf-center-play-btn svg {
          width: 32px;
          height: 32px;
        }
        
        /* Enhanced progress bar for touch */
        .uvf-progress-bar-wrapper {
          height: 8px;
          margin-bottom: 12px;
          border-radius: 4px;
          background: rgba(255,255,255,0.15);
          position: relative;
          cursor: pointer;
        }
        
        /* Larger touch target for progress bar */
        .uvf-progress-bar-wrapper::before {
          content: '';
          position: absolute;
          top: -10px;
          left: 0;
          right: 0;
          bottom: -10px;
          z-index: 1;
        }
        
        .uvf-progress-handle {
          width: 18px;
          height: 18px;
          background: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        
        .uvf-progress-bar-wrapper:active .uvf-progress-handle {
          transform: translate(-50%, -50%) scale(1.2);
        }
        
        /* Mobile accessibility improvements */
        .uvf-control-btn,
        .uvf-top-btn {
          position: relative;
          overflow: visible;
        }
        
        /* Enhanced focus states for mobile */
        .uvf-control-btn:focus,
        .uvf-top-btn:focus {
          outline: 2px solid var(--uvf-accent-1);
          outline-offset: 2px;
        }
        
        /* Mobile control reordering for optimal UX */
        .uvf-controls-row {
          display: flex;
          align-items: center;
        }
        
        /* Priority order for mobile controls */
        .uvf-control-btn.play-pause { order: 1; }
        #uvf-skip-back { order: 2; }
        #uvf-skip-forward { order: 3; }
        .uvf-volume-control { order: 4; }
        .uvf-time-display { order: 5; }
        .uvf-right-controls { order: 6; }
        
        /* Hide PiP on mobile - not commonly supported */
        #uvf-pip-btn {
          display: none;
        }
        
        /* Essential controls only in right section */
        .uvf-right-controls > *:not(#uvf-settings-btn):not(#uvf-fullscreen-btn) {
          display: none;
        }
        
        /* Ensure all controls remain visible and functional */
        .uvf-controls-row > * {
          flex-shrink: 0;
        }
        
        /* Loading spinner optimization for mobile */
        .uvf-loading-spinner {
          width: 48px;
          height: 48px;
          border-width: 4px;
        }
        
        /* Mobile shortcut indicators */
        .uvf-shortcut-indicator {
          font-size: 20px;
          padding: 16px 24px;
          border-radius: 12px;
          max-width: 280px;
        }
      }
      
      /* Mobile devices (landscape) - Optimized for fullscreen viewing */
      @media screen and (max-width: 767px) and (orientation: landscape) {
        .uvf-responsive-container {
          width: 100vw !important;
          height: 100vh !important;
          margin: 0;
          padding: 0;
        }
        
        .uvf-responsive-container .uvf-player-wrapper {
          width: 100vw !important;
          height: 100vh !important;
        }
        
        .uvf-responsive-container .uvf-video-container {
          width: 100vw !important;
          height: 100vh !important;
          aspect-ratio: unset !important;
        }
        
        /* Compact controls for landscape */
        .uvf-controls-bar {
          padding: 10px 12px;
          background: linear-gradient(to top, var(--uvf-overlay-strong) 0%, var(--uvf-overlay-medium) 80%, var(--uvf-overlay-transparent) 100%);
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
        
        /* Compact top controls */
        .uvf-top-controls {
          top: 8px;
          right: 12px;
          gap: 6px;
        }
        
        .uvf-top-btn {
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
        }
        
        .uvf-top-btn svg {
          width: 18px;
          height: 18px;
        }
        
        .uvf-title-bar {
          padding: 8px 12px;
        }
        
        .uvf-video-title {
          font-size: 14px;
        }
        
        .uvf-video-subtitle {
          font-size: 11px;
        }
        
        .uvf-time-display {
          font-size: 11px;
          min-width: 80px;
          padding: 0 6px;
        }
        
        /* Hide volume panel in landscape too */
        .uvf-volume-panel {
          display: none;
        }
        
        /* Compact progress bar for landscape */
        .uvf-progress-bar-wrapper {
          height: 6px;
          margin-bottom: 8px;
        }
        
        .uvf-progress-handle {
          width: 16px;
          height: 16px;
        }
      }
      
      /* Tablet devices - Enhanced UX with desktop features */
      @media screen and (min-width: 768px) and (max-width: 1023px) {
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
        
        /* Tablet top controls */
        .uvf-top-btn {
          width: 42px;
          height: 42px;
          min-width: 42px;
          min-height: 42px;
        }
        
        .uvf-top-btn svg {
          width: 19px;
          height: 19px;
        }
        
        .uvf-top-controls {
          top: 16px;
          right: 16px;
          gap: 8px;
        }
        
        .uvf-title-bar {
          padding: 16px;
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
          min-width: 110px;
          padding: 0 8px;
        }
        
        /* Tablet center play button */
        .uvf-center-play-btn {
          width: 76px;
          height: 76px;
        }
        
        .uvf-center-play-btn svg {
          width: 34px;
          height: 34px;
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
        .uvf-progress-bar-wrapper {
          height: 7px;
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
        
        /* Enhanced top controls */
        .uvf-top-btn {
          width: 40px;
          height: 40px;
          transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
        }
        
        .uvf-top-btn:hover {
          transform: scale(1.1);
          background: var(--uvf-overlay-medium);
        }
        
        .uvf-top-btn svg {
          width: 20px;
          height: 20px;
        }
        
        .uvf-top-controls {
          top: 20px;
          right: 20px;
          gap: 10px;
        }
        
        .uvf-title-bar {
          padding: 20px;
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
          min-width: 120px;
          padding: 0 10px;
        }
        
        /* Enhanced center play button */
        .uvf-center-play-btn {
          width: 80px;
          height: 80px;
          transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
        }
        
        .uvf-center-play-btn:hover {
          transform: scale(1.1);
          background: var(--uvf-primary-color);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }
        
        .uvf-center-play-btn svg {
          width: 35px;
          height: 35px;
        }
        
        /* Enhanced progress bar for desktop */
        .uvf-progress-bar-wrapper:hover .uvf-progress-handle {
          transform: scale(1.2);
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
        
        .uvf-top-btn {
          width: 44px;
          height: 44px;
        }
        
        .uvf-top-btn svg {
          width: 22px;
          height: 22px;
        }
        
        .uvf-center-play-btn {
          width: 90px;
          height: 90px;
        }
        
        .uvf-center-play-btn svg {
          width: 40px;
          height: 40px;
        }
        
        .uvf-video-title {
          font-size: 20px;
        }
        
        .uvf-time-display {
          font-size: 15px;
          min-width: 130px;
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
        .uvf-control-btn,
        .uvf-top-btn {
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
        .uvf-top-btn,
        .uvf-center-play-btn,
        .uvf-progress-handle,
        .uvf-volume-slider,
        .uvf-settings-option {
          transition: none !important;
        }
        
        .uvf-control-btn:hover,
        .uvf-top-btn:hover,
        .uvf-center-play-btn:hover {
          transform: none !important;
        }
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
        }
        
        .uvf-top-btn {
          min-width: 44px;
          min-height: 44px;
        }
        
        .uvf-progress-bar-wrapper {
          height: 8px;
          cursor: pointer;
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
        
        .uvf-top-btn:active {
          background: var(--uvf-overlay-medium);
          transform: scale(0.95);
        }
      }
      
      /* Keyboard navigation and accessibility */
      .uvf-control-btn:focus-visible,
      .uvf-top-btn:focus-visible,
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
        .uvf-control-btn,
        .uvf-top-btn {
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
    createCustomControls(container) {
        const topGradient = document.createElement('div');
        topGradient.className = 'uvf-top-gradient';
        container.appendChild(topGradient);
        const controlsGradient = document.createElement('div');
        controlsGradient.className = 'uvf-controls-gradient';
        container.appendChild(controlsGradient);
        const titleBar = document.createElement('div');
        titleBar.className = 'uvf-title-bar';
        titleBar.innerHTML = `
      <div class="uvf-title-content">
        <img class="uvf-video-thumb" id="uvf-video-thumb" alt="thumbnail" style="display:none;" />
        <div class="uvf-title-text">
          <div class=\"uvf-video-title\" id=\"uvf-video-title\" style=\"display:none;\"></div>
          <div class=\"uvf-video-subtitle\" id=\"uvf-video-description\" style=\"display:none;\"></div>
        </div>
      </div>
    `;
        container.appendChild(titleBar);
        const topControls = document.createElement('div');
        topControls.className = 'uvf-top-controls';
        topControls.innerHTML = `
      <div class="uvf-top-btn" id="uvf-cast-btn" title="Cast" aria-label="Cast">
        <svg viewBox="0 0 24 24">
          <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
        </svg>
      </div>
      <button class="uvf-pill-btn uvf-stop-cast-btn" id="uvf-stop-cast-btn" title="Stop Casting" aria-label="Stop Casting" style="display: none;">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6h12v12H6z"/>
        </svg>
        <span>Stop Casting</span>
      </button>
      <div class="uvf-top-btn" id="uvf-share-btn" title="Share">
        <svg viewBox="0 0 24 24">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
        </svg>
      </div>
    `;
        container.appendChild(topControls);
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'uvf-loading-container';
        loadingContainer.id = 'uvf-loading';
        loadingContainer.innerHTML = '<div class="uvf-loading-spinner"></div>';
        container.appendChild(loadingContainer);
        const centerPlayBtn = document.createElement('div');
        centerPlayBtn.className = 'uvf-center-play-btn';
        centerPlayBtn.id = 'uvf-center-play';
        centerPlayBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
        container.appendChild(centerPlayBtn);
        const shortcutIndicator = document.createElement('div');
        shortcutIndicator.className = 'uvf-shortcut-indicator';
        shortcutIndicator.id = 'uvf-shortcut-indicator';
        container.appendChild(shortcutIndicator);
        const controlsBar = document.createElement('div');
        controlsBar.className = 'uvf-controls-bar';
        controlsBar.id = 'uvf-controls';
        const progressSection = document.createElement('div');
        progressSection.className = 'uvf-progress-section';
        const progressBar = document.createElement('div');
        progressBar.className = 'uvf-progress-bar-wrapper';
        progressBar.id = 'uvf-progress-bar';
        progressBar.innerHTML = `
      <div class="uvf-progress-buffered" id="uvf-progress-buffered"></div>
      <div class="uvf-progress-filled" id="uvf-progress-filled"></div>
      <div class="uvf-progress-handle" id="uvf-progress-handle"></div>
      <div class="uvf-time-tooltip" id="uvf-time-tooltip">00:00</div>
    `;
        progressSection.appendChild(progressBar);
        const controlsRow = document.createElement('div');
        controlsRow.className = 'uvf-controls-row';
        const playPauseBtn = document.createElement('button');
        playPauseBtn.className = 'uvf-control-btn play-pause';
        playPauseBtn.id = 'uvf-play-pause';
        playPauseBtn.innerHTML = `
      <svg viewBox="0 0 24 24" id="uvf-play-icon">
        <path d="M8 5v14l11-7z"/>
      </svg>
      <svg viewBox="0 0 24 24" id="uvf-pause-icon" style="display: none;">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
      </svg>
    `;
        controlsRow.appendChild(playPauseBtn);
        const skipBackBtn = document.createElement('button');
        skipBackBtn.className = 'uvf-control-btn';
        skipBackBtn.id = 'uvf-skip-back';
        skipBackBtn.setAttribute('title', 'Skip backward 10s');
        skipBackBtn.setAttribute('aria-label', 'Skip backward 10 seconds');
        skipBackBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>';
        controlsRow.appendChild(skipBackBtn);
        const skipForwardBtn = document.createElement('button');
        skipForwardBtn.className = 'uvf-control-btn';
        skipForwardBtn.id = 'uvf-skip-forward';
        skipForwardBtn.setAttribute('title', 'Skip forward 10s');
        skipForwardBtn.setAttribute('aria-label', 'Skip forward 10 seconds');
        skipForwardBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>';
        controlsRow.appendChild(skipForwardBtn);
        const volumeControl = document.createElement('div');
        volumeControl.className = 'uvf-volume-control';
        volumeControl.innerHTML = `
      <button class="uvf-control-btn" id="uvf-volume-btn">
        <svg viewBox="0 0 24 24" id="uvf-volume-icon">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
        <svg viewBox="0 0 24 24" id="uvf-mute-icon" style="display: none;">
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
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
        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'uvf-time-display';
        timeDisplay.id = 'uvf-time-display';
        timeDisplay.textContent = '00:00 / 00:00';
        controlsRow.appendChild(timeDisplay);
        const rightControls = document.createElement('div');
        rightControls.className = 'uvf-right-controls';
        const qualityBadge = document.createElement('div');
        qualityBadge.className = 'uvf-quality-badge';
        qualityBadge.id = 'uvf-quality-badge';
        qualityBadge.textContent = 'HD';
        rightControls.appendChild(qualityBadge);
        const settingsContainer = document.createElement('div');
        settingsContainer.style.position = 'relative';
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'uvf-control-btn';
        settingsBtn.id = 'uvf-settings-btn';
        settingsBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>';
        settingsContainer.appendChild(settingsBtn);
        const settingsMenu = document.createElement('div');
        settingsMenu.className = 'uvf-settings-menu';
        settingsMenu.id = 'uvf-settings-menu';
        settingsMenu.innerHTML = `
      <div class="uvf-settings-group">
        <div class="uvf-settings-label">Playback Speed</div>
        <div class="uvf-settings-option speed-option" data-speed="0.5">0.5x</div>
        <div class="uvf-settings-option speed-option" data-speed="0.75">0.75x</div>
        <div class="uvf-settings-option speed-option active" data-speed="1">Normal</div>
        <div class="uvf-settings-option speed-option" data-speed="1.25">1.25x</div>
        <div class="uvf-settings-option speed-option" data-speed="1.5">1.5x</div>
        <div class="uvf-settings-option speed-option" data-speed="2">2x</div>
      </div>
      <div class="uvf-settings-group">
        <div class="uvf-settings-label">Quality</div>
        <div class="uvf-settings-option quality-option active" data-quality="auto">Auto</div>
        <div class="uvf-settings-option quality-option" data-quality="1080">1080p</div>
        <div class="uvf-settings-option quality-option" data-quality="720">720p</div>
        <div class="uvf-settings-option quality-option" data-quality="480">480p</div>
      </div>
    `;
        settingsContainer.appendChild(settingsMenu);
        rightControls.appendChild(settingsContainer);
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
        epgBtn.style.display = 'none';
        rightControls.appendChild(epgBtn);
        const pipBtn = document.createElement('button');
        pipBtn.className = 'uvf-control-btn';
        pipBtn.id = 'uvf-pip-btn';
        pipBtn.title = 'Picture-in-Picture';
        pipBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>';
        rightControls.appendChild(pipBtn);
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'uvf-control-btn';
        fullscreenBtn.id = 'uvf-fullscreen-btn';
        fullscreenBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
        rightControls.appendChild(fullscreenBtn);
        controlsRow.appendChild(rightControls);
        controlsBar.appendChild(progressSection);
        controlsBar.appendChild(controlsRow);
        container.appendChild(controlsBar);
        this.controlsContainer = controlsBar;
    }
    setupControlsEventListeners() {
        if (!this.useCustomControls || !this.video)
            return;
        const wrapper = this.container?.querySelector('.uvf-player-wrapper');
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
        this.video.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        wrapper?.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        centerPlay?.addEventListener('click', () => this.togglePlayPause());
        playPauseBtn?.addEventListener('click', () => this.togglePlayPause());
        this.video.addEventListener('click', () => this.togglePlayPause());
        this.video.addEventListener('play', () => {
            const playIcon = document.getElementById('uvf-play-icon');
            const pauseIcon = document.getElementById('uvf-pause-icon');
            if (playIcon)
                playIcon.style.display = 'none';
            if (pauseIcon)
                pauseIcon.style.display = 'block';
            if (centerPlay)
                centerPlay.classList.add('hidden');
            setTimeout(() => {
                if (this.state.isPlaying) {
                    this.scheduleHideControls();
                }
            }, 1000);
        });
        this.video.addEventListener('pause', () => {
            const playIcon = document.getElementById('uvf-play-icon');
            const pauseIcon = document.getElementById('uvf-pause-icon');
            if (playIcon)
                playIcon.style.display = 'block';
            if (pauseIcon)
                pauseIcon.style.display = 'none';
            if (centerPlay)
                centerPlay.classList.remove('hidden');
            this.showControls();
        });
        skipBackBtn?.addEventListener('click', () => this.seek(this.video.currentTime - 10));
        skipForwardBtn?.addEventListener('click', () => this.seek(this.video.currentTime + 10));
        volumeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMuteAction();
        });
        volumeBtn?.addEventListener('mouseenter', () => {
            clearTimeout(this.volumeHideTimeout);
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
            clearTimeout(this.volumeHideTimeout);
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
        volumeSlider?.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.isVolumeSliding = true;
            volumePanel?.classList.add('active');
            this.handleVolumeChange(e);
        });
        volumeSlider?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleVolumeChange(e);
        });
        document.addEventListener('mousemove', (e) => {
            if (this.isVolumeSliding) {
                this.handleVolumeChange(e);
            }
            if (this.isDragging && progressBar) {
                this.handleProgressChange(e);
            }
        });
        document.addEventListener('mouseup', () => {
            if (this.isVolumeSliding) {
                this.isVolumeSliding = false;
                setTimeout(() => {
                    if (!volumePanel?.matches(':hover') && !volumeBtn?.matches(':hover')) {
                        volumePanel?.classList.remove('active');
                    }
                }, 2000);
            }
            this.isDragging = false;
        });
        progressBar?.addEventListener('click', (e) => this.handleProgressChange(e));
        progressBar?.addEventListener('mousedown', () => this.isDragging = true);
        this.video.addEventListener('timeupdate', () => {
            const progressFilled = document.getElementById('uvf-progress-filled');
            const progressHandle = document.getElementById('uvf-progress-handle');
            const timeDisplay = document.getElementById('uvf-time-display');
            if (this.video && progressFilled && progressHandle) {
                const percent = (this.video.currentTime / this.video.duration) * 100;
                progressFilled.style.width = percent + '%';
                progressHandle.style.left = percent + '%';
            }
            this.updateTimeDisplay();
        });
        this.video.addEventListener('progress', () => {
            const progressBuffered = document.getElementById('uvf-progress-buffered');
            if (this.video && progressBuffered && this.video.buffered.length > 0) {
                const buffered = (this.video.buffered.end(0) / this.video.duration) * 100;
                progressBuffered.style.width = buffered + '%';
            }
        });
        this.video.addEventListener('volumechange', () => {
            const volumeFill = document.getElementById('uvf-volume-fill');
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
                }
                else {
                    volumeIcon.style.display = 'block';
                    muteIcon.style.display = 'none';
                }
            }
        });
        fullscreenBtn?.addEventListener('click', (event) => {
            const isBrave = this.isBraveBrowser();
            const isPrivate = this.isPrivateWindow();
            this.debugLog('Fullscreen button clicked:', {
                isBrave,
                isPrivate,
                isFullscreen: this.isFullscreen(),
                eventTrusted: event.isTrusted,
                eventType: event.type,
                timestamp: Date.now()
            });
            this.lastUserInteraction = Date.now();
            this.checkFullscreenPermissions();
            if (this.isFullscreen()) {
                this.debugLog('Exiting fullscreen via button');
                this.exitFullscreen().catch(err => {
                    this.debugWarn('Exit fullscreen button failed:', err.message);
                });
            }
            else {
                this.debugLog('Entering fullscreen via button');
                if (isBrave && !isPrivate) {
                    this.enterFullscreenWithBraveSupport().catch(err => {
                        this.debugWarn('Brave fullscreen button failed:', err.message);
                        this.showTemporaryMessage('Brave Browser: Please allow fullscreen in site settings');
                    });
                }
                else {
                    this.enterFullscreen().catch(err => {
                        this.debugWarn('Fullscreen button failed:', err.message);
                        if (isBrave) {
                            this.showTemporaryMessage('Try refreshing the page or check Brave shields settings');
                        }
                    });
                }
            }
        });
        const updateFullscreenIcon = () => {
            const fullscreenBtn = document.getElementById('uvf-fullscreen-btn');
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = this.isFullscreen()
                    ? '<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>'
                    : '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
            }
        };
        this.on('onFullscreenChanged', updateFullscreenIcon);
        this.video.addEventListener('waiting', () => {
            const loading = document.getElementById('uvf-loading');
            if (loading)
                loading.classList.add('active');
        });
        this.video.addEventListener('canplay', () => {
            const loading = document.getElementById('uvf-loading');
            if (loading)
                loading.classList.remove('active');
        });
        this.controlsContainer?.addEventListener('mouseenter', () => {
            clearTimeout(this.hideControlsTimeout);
        });
        this.controlsContainer?.addEventListener('mouseleave', () => {
            if (this.state.isPlaying) {
                this.scheduleHideControls();
            }
        });
        progressBar?.addEventListener('mousemove', (e) => this.updateTimeTooltip(e));
        progressBar?.addEventListener('mouseleave', () => this.hideTimeTooltip());
        const settingsMenu = document.getElementById('uvf-settings-menu');
        settingsBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsMenu?.classList.toggle('active');
        });
        document.querySelectorAll('.speed-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const speed = parseFloat(e.target.dataset.speed || '1');
                this.setSpeed(speed);
                settingsMenu?.classList.remove('active');
            });
        });
        document.querySelectorAll('.quality-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const quality = e.target.dataset.quality;
                this.setQualityByLabel(quality || 'auto');
                settingsMenu?.classList.remove('active');
            });
        });
        const epgBtn = document.getElementById('uvf-epg-btn');
        epgBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.debugLog('EPG button clicked');
            this.emit('epgToggle', {});
        });
        const pipBtn = document.getElementById('uvf-pip-btn');
        pipBtn?.addEventListener('click', () => this.togglePiP());
        const castBtn = document.getElementById('uvf-cast-btn');
        const stopCastBtn = document.getElementById('uvf-stop-cast-btn');
        const shareBtn = document.getElementById('uvf-share-btn');
        castBtn?.addEventListener('click', () => this.onCastButtonClick());
        stopCastBtn?.addEventListener('click', () => this.stopCasting());
        shareBtn?.addEventListener('click', () => this.shareVideo());
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#uvf-settings-btn') &&
                !e.target.closest('#uvf-settings-menu')) {
                settingsMenu?.classList.remove('active');
            }
        });
    }
    setupKeyboardShortcuts() {
        const handleKeydown = (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }
            this.debugLog('Keyboard event:', e.key, 'target:', target.tagName);
            let shortcutText = '';
            this.lastUserInteraction = Date.now();
            switch (e.key) {
                case ' ':
                case 'Spacebar':
                case 'k':
                    e.preventDefault();
                    e.stopPropagation();
                    this.debugLog('Space/K pressed, current state:', {
                        isPlaying: this.state.isPlaying,
                        videoPaused: this.video?.paused,
                        videoExists: !!this.video
                    });
                    const willPlay = this.video?.paused || false;
                    this.debugLog('Will perform action:', willPlay ? 'PLAY' : 'PAUSE');
                    this.togglePlayPause();
                    shortcutText = willPlay ? 'Play' : 'Pause';
                    this.debugLog('Showing icon:', shortcutText);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.seek(Math.max(0, this.video.currentTime - 10));
                    shortcutText = '-10s';
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.seek(Math.min(this.video.duration, this.video.currentTime + 10));
                    shortcutText = '+10s';
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.changeVolume(0.1);
                    if (this.isCasting && this.remotePlayer) {
                        shortcutText = `Volume ${Math.round(((this.remotePlayer.volumeLevel || 0) * 100))}%`;
                    }
                    else {
                        shortcutText = `Volume ${Math.round((this.video?.volume || 0) * 100)}%`;
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.changeVolume(-0.1);
                    if (this.isCasting && this.remotePlayer) {
                        shortcutText = `Volume ${Math.round(((this.remotePlayer.volumeLevel || 0) * 100))}%`;
                    }
                    else {
                        shortcutText = `Volume ${Math.round((this.video?.volume || 0) * 100)}%`;
                    }
                    break;
                case 'm':
                    e.preventDefault();
                    this.toggleMuteAction();
                    if (this.isCasting && this.remotePlayer) {
                        shortcutText = this.remotePlayer.isMuted ? 'Muted' : 'Unmuted';
                    }
                    else {
                        shortcutText = this.video?.muted ? 'Muted' : 'Unmuted';
                    }
                    break;
                case 'f':
                    e.preventDefault();
                    if (!document.fullscreenElement) {
                        this.triggerFullscreenButton();
                    }
                    else {
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
        document.addEventListener('keydown', handleKeydown, { capture: true });
        if (this.playerWrapper) {
            this.playerWrapper.addEventListener('keydown', handleKeydown);
            this.playerWrapper.setAttribute('tabindex', '0');
            this.playerWrapper.addEventListener('focus', () => {
                this.debugLog('Player focused - keyboard shortcuts available');
            });
            this.playerWrapper.addEventListener('click', (e) => {
                const target = e.target;
                if (!target.closest('.uvf-controls')) {
                    this.playerWrapper?.focus();
                    this.lastUserInteraction = Date.now();
                }
            });
            this.playerWrapper.addEventListener('mousedown', () => {
                this.playerWrapper?.focus();
                this.lastUserInteraction = Date.now();
            });
            this.playerWrapper.addEventListener('dblclick', (e) => {
                const target = e.target;
                if (!target.closest('.uvf-controls')) {
                    e.preventDefault();
                    this.debugLog('Double-click detected - attempting fullscreen');
                    if (!document.fullscreenElement) {
                        this.triggerFullscreenButton();
                    }
                    else {
                        this.exitFullscreen();
                    }
                }
            });
        }
        if (this.video) {
            this.video.addEventListener('keydown', handleKeydown);
        }
    }
    setupWatermark() {
        if (!this.watermarkCanvas)
            return;
        const ctx = this.watermarkCanvas.getContext('2d');
        if (!ctx)
            return;
        const renderWatermark = () => {
            const container = this.watermarkCanvas.parentElement;
            if (!container)
                return;
            this.watermarkCanvas.width = container.offsetWidth;
            this.watermarkCanvas.height = container.offsetHeight;
            ctx.clearRect(0, 0, this.watermarkCanvas.width, this.watermarkCanvas.height);
            const wrapper = this.playerWrapper;
            let c1 = '#ff0000';
            let c2 = '#ff4d4f';
            try {
                if (wrapper) {
                    const styles = getComputedStyle(wrapper);
                    const v1 = styles.getPropertyValue('--uvf-accent-1').trim();
                    const v2 = styles.getPropertyValue('--uvf-accent-2').trim();
                    if (v1)
                        c1 = v1;
                    if (v2)
                        c2 = v2;
                }
            }
            catch (_) { }
            const gradient = ctx.createLinearGradient(0, 0, 200, 0);
            gradient.addColorStop(0, c1);
            gradient.addColorStop(1, c2);
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.font = '14px Arial';
            ctx.fillStyle = gradient;
            ctx.textAlign = 'left';
            const text = `PREMIUM • ${new Date().toLocaleTimeString()}`;
            const x = 20 + Math.random() * (this.watermarkCanvas.width - 200);
            const y = 40 + Math.random() * (this.watermarkCanvas.height - 80);
            ctx.fillText(text, x, y);
            ctx.restore();
        };
        setInterval(renderWatermark, 5000);
        renderWatermark();
    }
    setPaywallConfig(config) {
        try {
            if (!config)
                return;
            if (this.paywallController && typeof this.paywallController.updateConfig === 'function') {
                this.paywallController.updateConfig(config);
            }
            else {
                if (config.enabled) {
                    import('./paywall/PaywallController').then((m) => {
                        this.paywallController = new m.PaywallController(config, {
                            getOverlayContainer: () => this.playerWrapper,
                            onResume: (accessInfo) => {
                                try {
                                    this.previewGateHit = false;
                                    this.paymentSuccessTime = Date.now();
                                    if (accessInfo && (accessInfo.accessGranted || accessInfo.paymentSuccessful)) {
                                        this.paymentSuccessful = true;
                                        this.debugLog('Access granted via email auth - preview gate permanently disabled, resuming playback');
                                    }
                                    else {
                                        this.paymentSuccessful = true;
                                        this.debugLog('Payment successful (via setPaywallConfig) - preview gate permanently disabled, resuming playback');
                                    }
                                    this.play();
                                }
                                catch (_) { }
                            },
                            onShow: () => {
                                try {
                                    this.requestPause();
                                }
                                catch (_) { }
                            },
                            onClose: () => {
                            }
                        });
                    }).catch(() => { });
                }
            }
        }
        catch (_) { }
    }
    togglePlayPause() {
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
        }
        else {
            this.debugLog('Video is playing, calling pause()');
            this.pause();
        }
    }
    enforceFreePreviewGate(current, fromSeek = false) {
        try {
            const lim = Number(this.config.freeDuration || 0);
            if (!(lim > 0))
                return;
            if (this.previewGateHit && !fromSeek)
                return;
            if (this.paymentSuccessful) {
                this.debugLog('Skipping preview gate - payment was successful, access granted permanently for this session');
                return;
            }
            const timeSincePayment = Date.now() - this.paymentSuccessTime;
            if (this.paymentSuccessTime > 0 && timeSincePayment < 5000) {
                this.debugLog('Skipping preview gate - recent payment success:', timeSincePayment + 'ms ago');
                return;
            }
            if (current >= lim - 0.01 && !this.previewGateHit) {
                this.previewGateHit = true;
                this.showNotification('Free preview ended.');
                this.emit('onFreePreviewEnded');
                this.debugLog('Free preview gate hit, paywallController exists:', !!this.paywallController);
                if (this.paywallController) {
                    this.debugLog('Calling paywallController.openOverlay() directly');
                    this.paywallController.openOverlay();
                }
                else {
                    this.debugLog('No paywallController available');
                }
            }
            if (current >= lim - 0.01) {
                if (this.isCasting && this.remoteController) {
                    try {
                        if (this.remotePlayer && this.remotePlayer.isPaused === false) {
                            this.remoteController.playOrPause();
                        }
                    }
                    catch (_) { }
                }
                else if (this.video) {
                    try {
                        this.requestPause();
                        if (fromSeek || ((this.video.currentTime || 0) > lim)) {
                            this.video.currentTime = Math.max(0, lim - 0.1);
                        }
                    }
                    catch (_) { }
                }
            }
        }
        catch (_) { }
    }
    setFreeDuration(seconds) {
        try {
            const s = Math.max(0, Number(seconds) || 0);
            this.config.freeDuration = s;
            if (!this.paymentSuccessful && (s === 0 || (this.video && (this.video.currentTime || 0) < s))) {
                this.previewGateHit = false;
            }
            if (!this.paymentSuccessful) {
                const cur = this.video ? (this.video.currentTime || 0) : 0;
                this.enforceFreePreviewGate(cur, true);
            }
        }
        catch (_) { }
    }
    resetFreePreviewGate() {
        if (!this.paymentSuccessful) {
            this.previewGateHit = false;
        }
    }
    resetPaymentStatus() {
        this.paymentSuccessful = false;
        this.paymentSuccessTime = 0;
        this.previewGateHit = false;
        this.debugLog('Payment status reset - preview gate re-enabled');
    }
    toggleMuteAction() {
        if (this.isCasting && this.remoteController) {
            try {
                this.remoteController.muteOrUnmute();
            }
            catch (_) { }
            return;
        }
        if (this.video?.muted) {
            this.unmute();
        }
        else {
            this.mute();
        }
    }
    handleVolumeChange(e) {
        const slider = document.getElementById('uvf-volume-slider');
        if (!slider)
            return;
        const rect = slider.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percent = Math.max(0, Math.min(1, x / width));
        if (this.isCasting && this.remoteController && this.remotePlayer) {
            try {
                if (this.remotePlayer.isMuted) {
                    try {
                        this.remoteController.muteOrUnmute();
                    }
                    catch (_) { }
                    this.remotePlayer.isMuted = false;
                }
                this.remotePlayer.volumeLevel = percent;
                this.remoteController.setVolumeLevel();
            }
            catch (_) { }
            this.updateVolumeUIFromRemote();
        }
        else if (this.video) {
            this.setVolume(percent);
            this.video.muted = false;
        }
    }
    handleProgressChange(e) {
        const progressBar = document.getElementById('uvf-progress-bar');
        if (!progressBar || !this.video)
            return;
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const time = percent * this.video.duration;
        this.seek(time);
    }
    formatTime(seconds) {
        if (!seconds || isNaN(seconds))
            return '00:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        else {
            return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }
    updateTimeDisplay() {
        const timeDisplay = document.getElementById('uvf-time-display');
        if (timeDisplay && this.video) {
            const current = this.formatTime(this.video.currentTime || 0);
            const duration = this.formatTime(this.video.duration || 0);
            timeDisplay.textContent = `${current} / ${duration}`;
            this.debugLog('Time display updated:', `${current} / ${duration}`);
        }
    }
    showControls() {
        clearTimeout(this.hideControlsTimeout);
        const wrapper = this.container?.querySelector('.uvf-player-wrapper');
        if (wrapper) {
            wrapper.classList.add('controls-visible');
            wrapper.classList.remove('no-cursor');
        }
    }
    hideControls() {
        if (!this.state.isPlaying)
            return;
        const wrapper = this.container?.querySelector('.uvf-player-wrapper');
        if (wrapper) {
            wrapper.classList.remove('controls-visible');
            wrapper.classList.add('no-cursor');
        }
    }
    scheduleHideControls() {
        if (!this.state.isPlaying)
            return;
        clearTimeout(this.hideControlsTimeout);
        const timeout = this.isFullscreen() ? 4000 : 3000;
        this.hideControlsTimeout = setTimeout(() => {
            if (this.state.isPlaying && !this.controlsContainer?.matches(':hover')) {
                this.hideControls();
            }
        }, timeout);
    }
    isFullscreen() {
        return !!(document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement);
    }
    setupFullscreenListeners() {
        const handleFullscreenChange = () => {
            const isFullscreen = this.isFullscreen();
            if (this.playerWrapper) {
                if (isFullscreen) {
                    this.playerWrapper.classList.add('uvf-fullscreen');
                }
                else {
                    this.playerWrapper.classList.remove('uvf-fullscreen');
                }
            }
            this.showControls();
            if (isFullscreen && this.state.isPlaying) {
                this.scheduleHideControls();
            }
            this.emit('onFullscreenChanged', isFullscreen);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
        let lastMouseMoveTime = 0;
        let mouseInactivityTimeout = null;
        const handleMouseMovement = () => {
            const now = Date.now();
            lastMouseMoveTime = now;
            this.showControls();
            clearTimeout(mouseInactivityTimeout);
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
        const handleTouchMovement = () => {
            this.showControls();
            if (this.state.isPlaying) {
                this.scheduleHideControls();
            }
        };
        if (this.playerWrapper) {
            this.playerWrapper.addEventListener('mousemove', handleMouseMovement, { passive: true });
            this.playerWrapper.addEventListener('mouseenter', () => this.showControls());
            this.playerWrapper.addEventListener('touchstart', handleTouchMovement, { passive: true });
            this.playerWrapper.addEventListener('touchmove', handleTouchMovement, { passive: true });
        }
    }
    updateTimeTooltip(e) {
        const progressBar = document.getElementById('uvf-progress-bar');
        const timeTooltip = document.getElementById('uvf-time-tooltip');
        if (!progressBar || !timeTooltip || !this.video)
            return;
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const time = percent * this.video.duration;
        timeTooltip.textContent = this.formatTime(time);
        timeTooltip.style.left = `${e.clientX - rect.left}px`;
        timeTooltip.style.opacity = '1';
    }
    hideTimeTooltip() {
        const timeTooltip = document.getElementById('uvf-time-tooltip');
        if (timeTooltip) {
            timeTooltip.style.opacity = '0';
        }
    }
    showShortcutIndicator(text) {
        const el = document.getElementById('uvf-shortcut-indicator');
        this.debugLog('showShortcutIndicator called with:', text, 'element found:', !!el);
        if (!el) {
            this.debugError('uvf-shortcut-indicator element not found!');
            return;
        }
        try {
            const resetAnim = () => {
                el.classList.remove('active');
                void el.offsetWidth;
                el.classList.add('active');
            };
            const setIcon = (svg) => {
                el.classList.add('uvf-ki-icon');
                el.innerHTML = `<div class="uvf-ki uvf-ki-icon">${svg}</div>`;
                resetAnim();
            };
            const setSkip = (dir, num) => {
                el.classList.add('uvf-ki-icon');
                const svg = dir === 'fwd'
                    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.01 19c-3.31 0-6-2.69-6-6s2.69-6 6-6V5l5 5-5 5V9c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4h2c0 3.31-2.69 6-6 6z"/></svg>`
                    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`;
                el.innerHTML = `<div class="uvf-ki uvf-ki-skip"><div class="uvf-ki-skip-num">${num}</div>${svg}</div>`;
                resetAnim();
            };
            const setVolume = (percent, muted = false) => {
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
            const setText = (t) => {
                el.classList.remove('uvf-ki-icon');
                el.innerHTML = `<div class="uvf-ki uvf-ki-text">${t}</div>`;
                resetAnim();
            };
            if (text === 'Play') {
                setIcon(`<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`);
            }
            else if (text === 'Pause') {
                setIcon(`<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`);
            }
            else if (text === '+10s') {
                setSkip('fwd', 10);
            }
            else if (text === '-10s') {
                setSkip('back', 10);
            }
            else if (/^Volume\s+(\d+)%$/.test(text)) {
                const m = text.match(/^Volume\s+(\d+)%$/);
                const val = m ? parseInt(m[1], 10) : 0;
                setVolume(val);
            }
            else if (text === 'Muted' || text === 'Unmuted') {
                const muted = text === 'Muted';
                const level = (this.isCasting && this.remotePlayer) ? Math.round(((this.remotePlayer.volumeLevel || 0) * 100)) : Math.round((this.video?.volume || 0) * 100);
                setVolume(level, muted);
            }
            else if (text === 'Fullscreen') {
                setIcon(`<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`);
            }
            else if (text === 'Exit Fullscreen') {
                setIcon(`<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`);
            }
            else if (text === 'Picture-in-Picture') {
                setIcon(`<svg viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>`);
            }
            else if (/^\d+%$/.test(text)) {
                setText(text);
            }
            else {
                setText(text);
            }
            clearTimeout(this._kiTo);
            this._kiTo = setTimeout(() => {
                try {
                    el.classList.remove('active');
                }
                catch (_) { }
            }, 1000);
        }
        catch (err) {
            try {
                el.textContent = String(text || '');
                el.classList.add('active');
                setTimeout(() => el.classList.remove('active'), 1000);
            }
            catch (_) { }
        }
    }
    setSettingsScrollbarStyle(mode) {
        const wrapper = this.playerWrapper;
        if (!wrapper)
            return;
        wrapper.classList.remove('uvf-scrollbar-compact', 'uvf-scrollbar-overlay');
        switch (mode) {
            case 'compact':
                wrapper.classList.add('uvf-scrollbar-compact');
                break;
            case 'overlay':
                wrapper.classList.add('uvf-scrollbar-overlay');
                break;
            default:
                break;
        }
    }
    setSettingsScrollbarConfig(options) {
        const wrapper = this.playerWrapper;
        if (!wrapper)
            return;
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
    applyScrollbarPreferencesFromDataset() {
        const container = this.container;
        if (!container)
            return;
        const ds = container.dataset || {};
        const stylePref = (ds.scrollbarStyle || '').toLowerCase();
        if (stylePref === 'compact' || stylePref === 'overlay' || stylePref === 'default') {
            this.setSettingsScrollbarStyle(stylePref);
        }
        const width = Number(ds.scrollbarWidth);
        const intensity = Number(ds.scrollbarIntensity);
        const options = {};
        if (Number.isFinite(width))
            options.widthPx = width;
        if (Number.isFinite(intensity))
            options.intensity = intensity;
        if (options.widthPx !== undefined || options.intensity !== undefined) {
            this.setSettingsScrollbarConfig(options);
        }
    }
    setTheme(theme) {
        const wrapper = this.playerWrapper;
        if (!wrapper)
            return;
        try {
            let accent1 = null;
            let accent2 = null;
            let iconColor = null;
            let textPrimary = null;
            let textSecondary = null;
            let overlayStrong = null;
            let overlayMedium = null;
            let overlayTransparent = null;
            if (typeof theme === 'string') {
                accent1 = theme;
            }
            else if (theme && typeof theme === 'object') {
                accent1 = theme.accent || null;
                accent2 = theme.accent2 || null;
                iconColor = theme.iconColor || null;
                textPrimary = theme.textPrimary || null;
                textSecondary = theme.textSecondary || null;
                overlayStrong = theme.overlayStrong || null;
                overlayMedium = theme.overlayMedium || null;
                overlayTransparent = theme.overlayTransparent || null;
            }
            if (accent1)
                wrapper.style.setProperty('--uvf-accent-1', accent1);
            if (!accent2 && accent1) {
                const rgb = this._parseRgb(accent1);
                if (rgb) {
                    const lighter = this._lightenRgb(rgb, 0.35);
                    accent2 = this._rgbToString(lighter);
                }
                else {
                    accent2 = accent1;
                }
            }
            if (accent2)
                wrapper.style.setProperty('--uvf-accent-2', accent2);
            if (accent1) {
                const a20 = this._toRgba(accent1, 0.2);
                if (a20)
                    wrapper.style.setProperty('--uvf-accent-1-20', a20);
            }
            if (iconColor)
                wrapper.style.setProperty('--uvf-icon-color', iconColor);
            if (textPrimary)
                wrapper.style.setProperty('--uvf-text-primary', textPrimary);
            if (textSecondary)
                wrapper.style.setProperty('--uvf-text-secondary', textSecondary);
            if (overlayStrong)
                wrapper.style.setProperty('--uvf-overlay-strong', overlayStrong);
            if (overlayMedium)
                wrapper.style.setProperty('--uvf-overlay-medium', overlayMedium);
            if (overlayTransparent)
                wrapper.style.setProperty('--uvf-overlay-transparent', overlayTransparent);
        }
        catch (_) {
        }
    }
    _parseRgb(input) {
        try {
            const s = (input || '').trim().toLowerCase();
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
            if (s.startsWith('rgb(') || s.startsWith('rgba(')) {
                const nums = s.replace(/rgba?\(/, '').replace(/\)/, '').split(',').map(x => parseFloat(x.trim()));
                if (nums.length >= 3) {
                    return { r: Math.round(nums[0]), g: Math.round(nums[1]), b: Math.round(nums[2]) };
                }
            }
        }
        catch (_) { }
        return null;
    }
    _rgbToString(rgb) {
        const c = (n) => Math.max(0, Math.min(255, Math.round(n)));
        return `rgb(${c(rgb.r)}, ${c(rgb.g)}, ${c(rgb.b)})`;
    }
    _lightenRgb(rgb, amount) {
        const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
        const amt = Math.max(0, Math.min(1, amount));
        return {
            r: clamp(rgb.r + (255 - rgb.r) * amt),
            g: clamp(rgb.g + (255 - rgb.g) * amt),
            b: clamp(rgb.b + (255 - rgb.b) * amt),
        };
    }
    _toRgba(input, alpha) {
        const rgb = this._parseRgb(input);
        if (!rgb)
            return null;
        const a = Math.max(0, Math.min(1, alpha));
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
    }
    changeVolume(delta) {
        if (this.isCasting && this.remoteController && this.remotePlayer) {
            const cur = this.remotePlayer.volumeLevel || 0;
            const next = Math.max(0, Math.min(1, cur + delta));
            try {
                if (this.remotePlayer.isMuted) {
                    try {
                        this.remoteController.muteOrUnmute();
                    }
                    catch (_) { }
                    this.remotePlayer.isMuted = false;
                }
                this.remotePlayer.volumeLevel = next;
                this.remoteController.setVolumeLevel();
            }
            catch (_) { }
            this.updateVolumeUIFromRemote();
            return;
        }
        if (!this.video)
            return;
        this.video.volume = Math.max(0, Math.min(1, this.video.volume + delta));
    }
    setSpeed(speed) {
        if (!this.video)
            return;
        this.video.playbackRate = speed;
        document.querySelectorAll('.speed-option').forEach(option => {
            option.classList.remove('active');
            if (parseFloat(option.dataset.speed || '1') === speed) {
                option.classList.add('active');
            }
        });
    }
    setQualityByLabel(quality) {
        const qualityBadge = document.getElementById('uvf-quality-badge');
        document.querySelectorAll('.quality-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.quality === quality) {
                option.classList.add('active');
            }
        });
        if (qualityBadge) {
            if (quality === 'auto') {
                qualityBadge.textContent = 'AUTO';
            }
            else {
                qualityBadge.textContent = quality + 'p';
            }
        }
        if (quality !== 'auto' && this.qualities.length > 0) {
            const qualityLevel = this.qualities.find(q => q.label === quality + 'p');
            if (qualityLevel) {
                const index = this.qualities.findIndex(q => q.label === quality + 'p');
                this.setQuality(index);
            }
        }
        else if (quality === 'auto') {
            this.setAutoQuality(true);
        }
    }
    async togglePiP() {
        try {
            if (document.pictureInPictureElement) {
                await this.exitPictureInPicture();
            }
            else {
                await this.enterPictureInPicture();
            }
        }
        catch (error) {
            console.error('PiP toggle failed:', error);
        }
    }
    setupCastContextSafe() {
        try {
            const castNs = window.cast;
            if (castNs && castNs.framework) {
                this.setupCastContext();
            }
        }
        catch (_) { }
    }
    setupCastContext() {
        if (this.castContext)
            return;
        try {
            const castNs = window.cast;
            this.castContext = castNs.framework.CastContext.getInstance();
            const chromeNs = window.chrome;
            const options = { receiverApplicationId: chromeNs?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID };
            try {
                const autoJoin = chromeNs?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED;
                if (autoJoin)
                    options.autoJoinPolicy = autoJoin;
            }
            catch (_) { }
            this.castContext.setOptions(options);
            this.castContext.addEventListener(castNs.framework.CastContextEventType.SESSION_STATE_CHANGED, (ev) => {
                const state = ev.sessionState;
                if (state === castNs.framework.SessionState.SESSION_STARTED ||
                    state === castNs.framework.SessionState.SESSION_RESUMED) {
                    this.enableCastRemoteControl();
                }
                else if (state === castNs.framework.SessionState.SESSION_ENDED) {
                    this.disableCastRemoteControl();
                }
            });
        }
        catch (err) {
            if (this.config.debug)
                console.warn('[Cast] setupCastContext failed', err);
        }
    }
    enableCastRemoteControl() {
        try {
            const castNs = window.cast;
            if (!castNs || !castNs.framework)
                return;
            const session = castNs.framework.CastContext.getInstance().getCurrentSession();
            if (!session)
                return;
            if (!this.remotePlayer)
                this.remotePlayer = new castNs.framework.RemotePlayer();
            if (!this.remoteController) {
                this.remoteController = new castNs.framework.RemotePlayerController(this.remotePlayer);
                this._bindRemotePlayerEvents();
            }
            this.isCasting = true;
            try {
                this.video?.pause();
            }
            catch (_) { }
            this._syncUIFromRemote();
            this._syncCastButtons();
        }
        catch (err) {
            if (this.config.debug)
                console.warn('[Cast] enableCastRemoteControl failed', err);
        }
    }
    disableCastRemoteControl() {
        this.isCasting = false;
        this._syncCastButtons();
    }
    _bindRemotePlayerEvents() {
        const castNs = window.cast;
        if (!this.remoteController || !castNs)
            return;
        const RPET = castNs.framework.RemotePlayerEventType;
        const rc = this.remoteController;
        rc.addEventListener(RPET.IS_PAUSED_CHANGED, () => {
            if (!this.isCasting)
                return;
            if (this.remotePlayer && this.remotePlayer.isPaused === false) {
                const playIcon = document.getElementById('uvf-play-icon');
                const pauseIcon = document.getElementById('uvf-pause-icon');
                if (playIcon)
                    playIcon.style.display = 'none';
                if (pauseIcon)
                    pauseIcon.style.display = 'block';
            }
            else {
                const playIcon = document.getElementById('uvf-play-icon');
                const pauseIcon = document.getElementById('uvf-pause-icon');
                if (playIcon)
                    playIcon.style.display = 'block';
                if (pauseIcon)
                    pauseIcon.style.display = 'none';
            }
        });
        rc.addEventListener(RPET.CURRENT_TIME_CHANGED, () => {
            if (!this.isCasting)
                return;
            const progressFilled = document.getElementById('uvf-progress-filled');
            const progressHandle = document.getElementById('uvf-progress-handle');
            const timeDisplay = document.getElementById('uvf-time-display');
            const duration = this.remotePlayer?.duration || 0;
            const current = Math.max(0, Math.min(this.remotePlayer?.currentTime || 0, duration));
            const percent = duration > 0 ? (current / duration) * 100 : 0;
            if (progressFilled)
                progressFilled.style.width = percent + '%';
            if (progressHandle)
                progressHandle.style.left = percent + '%';
            if (timeDisplay)
                timeDisplay.textContent = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
            this.enforceFreePreviewGate(current);
        });
        rc.addEventListener(RPET.DURATION_CHANGED, () => {
            if (!this.isCasting)
                return;
            const timeDisplay = document.getElementById('uvf-time-display');
            const duration = this.remotePlayer?.duration || 0;
            if (timeDisplay)
                timeDisplay.textContent = `${this.formatTime(this.remotePlayer?.currentTime || 0)} / ${this.formatTime(duration)}`;
        });
        rc.addEventListener(RPET.IS_MUTED_CHANGED, () => {
            if (!this.isCasting)
                return;
            this.updateVolumeUIFromRemote();
        });
        rc.addEventListener(RPET.VOLUME_LEVEL_CHANGED, () => {
            if (!this.isCasting)
                return;
            this.updateVolumeUIFromRemote();
        });
        rc.addEventListener(RPET.IS_CONNECTED_CHANGED, () => {
            if (!this.remotePlayer?.isConnected) {
                this.disableCastRemoteControl();
            }
        });
    }
    updateVolumeUIFromRemote() {
        const volumeFill = document.getElementById('uvf-volume-fill');
        const volumeValue = document.getElementById('uvf-volume-value');
        const volumeIcon = document.getElementById('uvf-volume-icon');
        const muteIcon = document.getElementById('uvf-mute-icon');
        const level = Math.round(((this.remotePlayer?.volumeLevel || 0) * 100));
        if (volumeFill)
            volumeFill.style.width = level + '%';
        if (volumeValue)
            volumeValue.textContent = String(level);
        const isMuted = !!this.remotePlayer?.isMuted || level === 0;
        if (volumeIcon && muteIcon) {
            if (isMuted) {
                volumeIcon.style.display = 'none';
                muteIcon.style.display = 'block';
            }
            else {
                volumeIcon.style.display = 'block';
                muteIcon.style.display = 'none';
            }
        }
    }
    _syncUIFromRemote() {
        const duration = this.remotePlayer?.duration || 0;
        const current = this.remotePlayer?.currentTime || 0;
        const percent = duration > 0 ? (current / duration) * 100 : 0;
        const progressFilled = document.getElementById('uvf-progress-filled');
        const progressHandle = document.getElementById('uvf-progress-handle');
        const timeDisplay = document.getElementById('uvf-time-display');
        if (progressFilled)
            progressFilled.style.width = percent + '%';
        if (progressHandle)
            progressHandle.style.left = percent + '%';
        if (timeDisplay)
            timeDisplay.textContent = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
        this.updateVolumeUIFromRemote();
        this.enforceFreePreviewGate(current);
    }
    _syncCastButtons() {
        const castBtn = document.getElementById('uvf-cast-btn');
        const stopBtn = document.getElementById('uvf-stop-cast-btn');
        const wrapper = this.playerWrapper || this.container?.querySelector('.uvf-player-wrapper');
        if (stopBtn)
            stopBtn.style.display = this.isCasting ? 'inline-flex' : 'none';
        if (castBtn) {
            if (this.isCasting) {
                castBtn.classList.add('cast-grey');
                let title = 'Pick device';
                try {
                    const castNs = window.cast;
                    const sess = castNs?.framework?.CastContext?.getInstance()?.getCurrentSession?.();
                    const dev = sess && sess.getCastDevice ? sess.getCastDevice() : null;
                    if (dev && dev.friendlyName)
                        title += ` (${dev.friendlyName})`;
                }
                catch (_) { }
                castBtn.setAttribute('title', title);
                castBtn.setAttribute('aria-label', title);
            }
            else {
                castBtn.classList.remove('cast-grey');
                castBtn.setAttribute('title', 'Cast');
                castBtn.setAttribute('aria-label', 'Cast');
            }
        }
        if (wrapper) {
            if (this.isCasting)
                wrapper.classList.add('uvf-casting');
            else
                wrapper.classList.remove('uvf-casting');
        }
    }
    _updateCastActiveTracks() {
        try {
            const castNs = window.cast;
            if (!castNs || !castNs.framework)
                return;
            const session = castNs.framework.CastContext.getInstance().getCurrentSession();
            if (!session)
                return;
            const media = session.getMediaSession && session.getMediaSession();
            if (!media)
                return;
            let ids = [];
            if (this.selectedSubtitleKey && this.selectedSubtitleKey !== 'off') {
                const tid = this._castTrackIdByKey ? this._castTrackIdByKey[this.selectedSubtitleKey] : null;
                if (tid)
                    ids = [tid];
            }
            if (typeof media.setActiveTracks === 'function') {
                media.setActiveTracks(ids, () => { }, () => { });
            }
            else if (typeof media.setActiveTrackIds === 'function') {
                media.setActiveTrackIds(ids);
            }
        }
        catch (_) { }
    }
    onCastButtonClick() {
        try {
            const castNs = window.cast;
            if (this.isCasting && castNs && castNs.framework) {
                const ctx = castNs.framework.CastContext.getInstance();
                ctx.requestSession().catch(() => { });
                return;
            }
        }
        catch (_) { }
        this.initCast();
    }
    stopCasting() {
        try {
            const castNs = window.cast;
            if (!castNs || !castNs.framework) {
                this.showNotification('Cast not ready');
                return;
            }
            const ctx = castNs.framework.CastContext.getInstance();
            const sess = ctx.getCurrentSession && ctx.getCurrentSession();
            if (sess) {
                try {
                    sess.endSession(true);
                }
                catch (_) { }
                this.disableCastRemoteControl();
                this.showNotification('Stopped casting');
            }
            else {
                this.showNotification('Not casting');
            }
        }
        catch (_) {
        }
        finally {
            this._syncCastButtons();
        }
    }
    async initCast() {
        try {
            let castNs = window.cast;
            if (!castNs || !castNs.framework) {
                await this.loadScript('https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1');
                const start = Date.now();
                while ((!(window.cast && window.cast.framework)) && Date.now() - start < 3000) {
                    await new Promise(r => setTimeout(r, 100));
                }
                castNs = window.cast;
            }
            if (!(castNs && castNs.framework)) {
                this.showNotification('Cast framework not ready');
                return;
            }
            this.setupCastContext();
            const ctx = castNs.framework.CastContext.getInstance();
            await ctx.requestSession();
            const session = ctx.getCurrentSession();
            if (!session) {
                this.showNotification('No cast session');
                return;
            }
            const url = this.source?.url || this.video?.src || '';
            const u = (url || '').toLowerCase();
            const contentType = u.includes('.m3u8') ? 'application/x-mpegurl'
                : u.includes('.mpd') ? 'application/dash+xml'
                    : u.includes('.webm') ? 'video/webm'
                        : 'video/mp4';
            const chromeNs = window.chrome;
            const mediaInfo = new chromeNs.cast.media.MediaInfo(url, contentType);
            mediaInfo.streamType = chromeNs.cast.media.StreamType.BUFFERED;
            try {
                const md = new chromeNs.cast.media.GenericMediaMetadata();
                md.title = this.source?.metadata?.title || (this.video?.currentSrc ? this.video.currentSrc.split('/').slice(-1)[0] : 'Web Player');
                mediaInfo.metadata = md;
            }
            catch (_) { }
            const castTracks = [];
            this._castTrackIdByKey = {};
            const inferTextTrackContentType = (trackUrl) => {
                const lu = (trackUrl || '').toLowerCase();
                if (lu.endsWith('.vtt'))
                    return 'text/vtt';
                if (lu.endsWith('.srt'))
                    return 'application/x-subrip';
                if (lu.endsWith('.ttml') || lu.endsWith('.dfxp') || lu.endsWith('.xml'))
                    return 'application/ttml+xml';
                return 'text/vtt';
            };
            if (Array.isArray(this.subtitles) && this.subtitles.length > 0) {
                let nextId = 1;
                for (let i = 0; i < this.subtitles.length; i++) {
                    const t = this.subtitles[i];
                    const key = t.label || t.language || `Track ${i + 1}`;
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
                    }
                    catch (_) { }
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
                }
                catch (_) { }
            }
            const request = new chromeNs.cast.media.LoadRequest(mediaInfo);
            request.autoplay = true;
            try {
                request.currentTime = Math.max(0, Math.floor(this.video?.currentTime || 0));
            }
            catch (_) { }
            const currentIdx = this.currentSubtitleIndex;
            this.selectedSubtitleKey = (currentIdx >= 0 && this.subtitles[currentIdx]) ? (this.subtitles[currentIdx].label || this.subtitles[currentIdx].language) : 'off';
            if (this.selectedSubtitleKey && this.selectedSubtitleKey !== 'off') {
                const tid = this._castTrackIdByKey[this.selectedSubtitleKey];
                if (tid)
                    request.activeTrackIds = [tid];
            }
            await session.loadMedia(request);
            this.enableCastRemoteControl();
            this.showNotification('Casting to device');
        }
        catch (err) {
            if (this.config.debug)
                console.error('[Cast] init cast failed:', err);
            this.showNotification('Cast failed');
        }
    }
    async shareVideo() {
        const shareData = { url: window.location.href };
        const t = (this.source?.metadata?.title || '').toString().trim();
        const d = (this.source?.metadata?.description || '').toString().trim();
        if (t)
            shareData.title = t;
        if (d)
            shareData.text = d;
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            }
            else {
                await navigator.clipboard.writeText(window.location.href);
                this.showNotification('Link copied to clipboard');
            }
        }
        catch (error) {
            console.error('Share failed:', error);
            this.showNotification('Share failed');
        }
    }
    updateMetadataUI() {
        try {
            const md = this.source?.metadata || {};
            const titleBar = this.container?.querySelector('.uvf-title-bar') || null;
            const titleEl = document.getElementById('uvf-video-title');
            const descEl = document.getElementById('uvf-video-description');
            const thumbEl = document.getElementById('uvf-video-thumb');
            const titleText = (md.title || '').toString().trim();
            const descText = (md.description || '').toString().trim();
            const thumbUrl = (md.thumbnailUrl || '').toString().trim();
            if (titleEl) {
                titleEl.textContent = titleText;
                titleEl.style.display = titleText ? 'block' : 'none';
            }
            if (descEl) {
                descEl.textContent = descText;
                descEl.style.display = descText ? 'block' : 'none';
            }
            if (thumbEl) {
                if (thumbUrl) {
                    thumbEl.src = thumbUrl;
                    thumbEl.style.display = 'block';
                }
                else {
                    thumbEl.removeAttribute('src');
                    thumbEl.style.display = 'none';
                }
            }
            const hasAny = !!(titleText || descText || thumbUrl);
            if (titleBar) {
                titleBar.style.display = hasAny ? '' : 'none';
            }
        }
        catch (_) { }
    }
    showNotification(message) {
        this.showShortcutIndicator(message);
    }
    canPlayVideo() {
        const freeDuration = Number(this.config.freeDuration || 0);
        const currentTime = this.video?.currentTime || 0;
        if (freeDuration <= 0)
            return true;
        if (this.paymentSuccessful)
            return true;
        if (currentTime < freeDuration)
            return true;
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
    enforcePaywallSecurity() {
        this.debugLog('Enforcing paywall security');
        try {
            if (this.video && !this.video.paused) {
                this.video.pause();
            }
        }
        catch (_) { }
        this.isPaywallActive = true;
        if (this.paywallController) {
            try {
                this.paywallController.openOverlay();
            }
            catch (error) {
                this.debugError('Error showing paywall overlay:', error);
            }
        }
        this.startOverlayMonitoring();
    }
    startOverlayMonitoring() {
        if (!this.playerWrapper || this.paymentSuccessful)
            return;
        if (this.authValidationInterval) {
            clearInterval(this.authValidationInterval);
            this.authValidationInterval = null;
        }
        this.debugLog('Starting overlay monitoring - payment successful:', this.paymentSuccessful, 'paywall active:', this.isPaywallActive);
        this.authValidationInterval = setInterval(() => {
            if (!this.isPaywallActive || this.paymentSuccessful) {
                this.debugLog('Stopping overlay monitoring - payment successful:', this.paymentSuccessful, 'paywall active:', this.isPaywallActive);
                if (this.authValidationInterval) {
                    clearInterval(this.authValidationInterval);
                    this.authValidationInterval = null;
                }
                return;
            }
            if (this.paymentSuccessful) {
                this.debugLog('Payment successful detected during monitoring, stopping');
                if (this.authValidationInterval) {
                    clearInterval(this.authValidationInterval);
                    this.authValidationInterval = null;
                }
                return;
            }
            const paywallOverlays = this.playerWrapper.querySelectorAll('.uvf-paywall-overlay, .uvf-auth-overlay');
            const visibleOverlays = Array.from(paywallOverlays).filter(overlay => {
                const element = overlay;
                return element.style.display !== 'none' &&
                    element.offsetParent !== null &&
                    window.getComputedStyle(element).visibility !== 'hidden';
            });
            if (visibleOverlays.length === 0) {
                this.overlayRemovalAttempts++;
                this.debugWarn(`Overlay removal attempt detected (${this.overlayRemovalAttempts}/${this.maxOverlayRemovalAttempts})`);
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
                }
                else {
                    this.enforcePaywallSecurity();
                }
            }
            if (this.video && !this.video.paused && !this.paymentSuccessful) {
                this.debugWarn('Unauthorized playbook detected, pausing video');
                try {
                    this.video.pause();
                    const freeDuration = Number(this.config.freeDuration || 0);
                    if (freeDuration > 0) {
                        this.video.currentTime = Math.max(0, freeDuration - 1);
                    }
                }
                catch (_) { }
            }
        }, 1000);
    }
    handleSecurityViolation() {
        this.debugError('Security violation detected - disabling video');
        if (this.video) {
            this.video.pause();
            this.video.currentTime = 0;
            this.video.src = '';
            this.video.style.display = 'none';
        }
        this.showSecurityViolationMessage();
        if (this.authValidationInterval) {
            clearInterval(this.authValidationInterval);
        }
    }
    showSecurityViolationMessage() {
        if (!this.playerWrapper)
            return;
        this.playerWrapper.innerHTML = '';
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
    forceCleanupOverlays() {
        this.debugLog('Force cleanup of overlays called');
        if (!this.playerWrapper)
            return;
        const overlays = this.playerWrapper.querySelectorAll('.uvf-paywall-overlay, .uvf-auth-overlay');
        overlays.forEach((overlay) => {
            const htmlOverlay = overlay;
            this.debugLog('Removing overlay:', htmlOverlay.className);
            htmlOverlay.style.display = 'none';
            htmlOverlay.classList.remove('active');
            if (htmlOverlay.parentNode) {
                htmlOverlay.parentNode.removeChild(htmlOverlay);
            }
        });
        if (this.paywallController && typeof this.paywallController.destroyOverlays === 'function') {
            this.debugLog('Calling paywallController.destroyOverlays()');
            this.paywallController.destroyOverlays();
        }
    }
    showEPGButton() {
        const epgBtn = document.getElementById('uvf-epg-btn');
        if (epgBtn) {
            epgBtn.style.display = 'block';
            this.debugLog('EPG button shown');
        }
        else {
            this.debugLog('EPG button not found in DOM');
        }
    }
    hideEPGButton() {
        const epgBtn = document.getElementById('uvf-epg-btn');
        if (epgBtn) {
            epgBtn.style.display = 'none';
            this.debugLog('EPG button hidden');
        }
    }
    setEPGData(epgData) {
        if (epgData && Object.keys(epgData).length > 0) {
            this.showEPGButton();
            this.debugLog('EPG data set, button shown');
            this.emit('epgDataSet', { data: epgData });
        }
        else {
            this.hideEPGButton();
            this.debugLog('No EPG data provided, button hidden');
        }
    }
    isEPGButtonVisible() {
        const epgBtn = document.getElementById('uvf-epg-btn');
        return epgBtn ? epgBtn.style.display !== 'none' : false;
    }
    async cleanup() {
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
    async destroy() {
        await this.cleanup();
        if (this.hideControlsTimeout) {
            clearTimeout(this.hideControlsTimeout);
        }
        if (this.volumeHideTimeout) {
            clearTimeout(this.volumeHideTimeout);
        }
        if (this.authValidationInterval) {
            clearInterval(this.authValidationInterval);
            this.authValidationInterval = null;
        }
        this.isPaywallActive = false;
        this.overlayRemovalAttempts = 0;
        if (this.paywallController && typeof this.paywallController.destroy === 'function') {
            this.paywallController.destroy();
            this.paywallController = null;
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
//# sourceMappingURL=WebPlayer.js.map