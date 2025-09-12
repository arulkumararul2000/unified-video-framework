import { BasePlayer } from "../../core/dist/index.js";
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
                    onResume: () => { try {
                        this.play();
                    }
                    catch (_) { } },
                    onShow: () => {
                        try {
                            this.requestPause();
                        }
                        catch (_) { }
                    },
                    onClose: () => { }
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
            if (this.config.freeDuration && this.config.freeDuration > 0) {
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
                throw new Error('Fullscreen API not supported');
            }
            this.playerWrapper.classList.add('uvf-fullscreen');
            this.emit('onFullscreenChanged', true);
        }
        catch (error) {
            console.error('Failed to enter fullscreen:', error);
            throw error;
        }
    }
    async exitFullscreen() {
        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            }
            else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen();
            }
            else if (document.mozCancelFullScreen) {
                await document.mozCancelFullScreen();
            }
            else if (document.msExitFullscreen) {
                await document.msExitFullscreen();
            }
            if (this.playerWrapper) {
                this.playerWrapper.classList.remove('uvf-fullscreen');
            }
            this.emit('onFullscreenChanged', false);
        }
        catch (error) {
            console.error('Failed to exit fullscreen:', error);
            throw error;
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
            console.error('Failed to exit PiP:', error);
            throw error;
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
      
      /* Responsive Media Queries */
      /* Mobile devices (portrait) */
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
          aspect-ratio: unset !important; /* Let JS handle the aspect ratio */
        }
        
        .uvf-controls-bar {
          padding: 12px 8px;
          background: linear-gradient(to top, var(--uvf-overlay-strong) 0%, var(--uvf-overlay-medium) 70%, var(--uvf-overlay-transparent) 100%);
        }
        
        .uvf-controls-row {
          gap: 8px;
          flex-wrap: nowrap;
          align-items: center;
          justify-content: space-between;
        }
        
        /* Mobile control sizing - 70% of desktop size */
        .uvf-control-btn {
          width: 28px;  /* 70% of 40px */
          height: 28px;
          min-width: 28px;
          min-height: 28px;
        }
        
        .uvf-control-btn.play-pause {
          width: 35px;  /* 70% of 50px */
          height: 35px;
          min-width: 35px;
          min-height: 35px;
        }
        
        .uvf-control-btn svg {
          width: 14px;  /* 70% of 20px */
          height: 14px;
        }
        
        .uvf-control-btn.play-pause svg {
          width: 17px;  /* 70% of 24px */
          height: 17px;
        }
        
        /* Skip buttons */
        #uvf-skip-back svg,
        #uvf-skip-forward svg {
          width: 15px;  /* 70% of 22px */
          height: 15px;
        }
        
        .uvf-time-display {
          font-size: 10px;  /* 70% of 14px */
          min-width: 84px;   /* 70% of 120px */
          padding: 0 7px;    /* 70% of 10px */
          order: 4;
        }
        
        /* Volume control mobile adjustments */
        .uvf-volume-control {
          order: 3;
        }
        
        .uvf-volume-panel {
          left: -60px;
          width: 140px;
        }
        
        .uvf-volume-slider {
          width: 80px;  /* Reduced from 120px for mobile */
        }
        
        /* Right controls mobile layout */
        .uvf-right-controls {
          order: 5;
          gap: 6px;
          margin-left: 4px;
        }
        
        .uvf-top-controls {
          top: 8px;
          right: 8px;
          gap: 6px;
        }
        
        .uvf-top-btn {
          width: 28px;  /* 70% of 40px */
          height: 28px;
          min-width: 28px;
          min-height: 28px;
        }
        
        .uvf-top-btn svg {
          width: 14px;  /* 70% of 20px */
          height: 14px;
        }
        
        .uvf-title-bar {
          padding: 8px;
        }
        
        .uvf-video-title {
          font-size: 13px;  /* 70% of 18px */
        }
        
        .uvf-video-subtitle {
          font-size: 9px;   /* 70% of 13px */
        }
        
        .uvf-center-play-btn {
          width: 56px;  /* 70% of 80px */
          height: 56px;
        }
        
        .uvf-center-play-btn svg {
          width: 25px;  /* 70% of 35px */
          height: 25px;
        }
        
        .uvf-progress-bar-wrapper {
          height: 6px;  /* Slightly reduced for mobile */
          margin-bottom: 8px;
        }
        
        .uvf-progress-handle {
          width: 14px;  /* Slightly larger for touch */
          height: 14px;
        }
        
        .uvf-settings-menu {
          min-width: 140px;
          bottom: 30px;
          right: 8px;
          font-size: 12px;
        }
        
        .uvf-settings-option {
          padding: 6px 12px;
          font-size: 12px;
        }
        
        .uvf-quality-badge {
          font-size: 9px;  /* 70% of 11px, but more readable at 9px */
          padding: 2px 4px;
        }
        
        /* Ensure all controls remain visible and functional */
        .uvf-controls-row > * {
          flex-shrink: 0;
        }
        
        /* Mobile-specific control group ordering for better layout */
        .uvf-control-btn:nth-child(1) { order: 1; } /* play-pause */
        .uvf-control-btn:nth-child(2) { order: 2; } /* skip-back */
        .uvf-control-btn:nth-child(3) { order: 3; } /* skip-forward */
      }
      
      /* Mobile devices (landscape) */
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
        
        .uvf-controls-bar {
          padding: 8px;
        }
        
        .uvf-top-controls {
          top: 6px;
          right: 6px;
        }
        
        .uvf-title-bar {
          padding: 6px;
        }
        
        .uvf-control-btn {
          width: 28px;  /* 70% sizing for landscape mobile */
          height: 28px;
        }
        
        .uvf-control-btn svg {
          width: 14px;
          height: 14px;
        }
        
        .uvf-control-btn.play-pause {
          width: 35px;  /* 70% of 50px */
          height: 35px;
        }
        
        .uvf-control-btn.play-pause svg {
          width: 17px;
          height: 17px;
        }
        
        .uvf-top-btn {
          width: 28px;
          height: 28px;
        }
        
        .uvf-top-btn svg {
          width: 14px;
          height: 14px;
        }
        
        .uvf-time-display {
          font-size: 10px;
          min-width: 80px;
        }
      }
      
      /* Tablet devices */
      @media screen and (min-width: 768px) and (max-width: 1023px) {
        .uvf-controls-bar {
          padding: 18px 15px;
        }
        
        .uvf-control-btn {
          width: 36px;  /* 90% of desktop size for tablets */
          height: 36px;
        }
        
        .uvf-control-btn svg {
          width: 18px;
          height: 18px;
        }
        
        .uvf-control-btn.play-pause {
          width: 45px;  /* 90% of 50px */
          height: 45px;
        }
        
        .uvf-control-btn.play-pause svg {
          width: 22px;  /* 90% of 24px */
          height: 22px;
        }
        
        .uvf-top-btn {
          width: 36px;
          height: 36px;
        }
        
        .uvf-top-btn svg {
          width: 18px;
          height: 18px;
        }
        
        .uvf-top-controls {
          top: 15px;
          right: 15px;
        }
        
        .uvf-title-bar {
          padding: 15px;
        }
        
        .uvf-video-title {
          font-size: 16px;  /* 90% of 18px */
        }
        
        .uvf-video-subtitle {
          font-size: 12px;  /* 90% of 13px */
        }
        
        .uvf-time-display {
          font-size: 13px;  /* 90% of 14px */
          min-width: 108px;  /* 90% of 120px */
        }
        
        .uvf-center-play-btn {
          width: 72px;  /* 90% of 80px */
          height: 72px;
        }
        
        .uvf-center-play-btn svg {
          width: 32px;  /* 90% of 35px */
          height: 32px;
        }
      }
      
      /* Large screens */
      @media screen and (min-width: 1024px) {
        .uvf-responsive-container {
          padding: 10px;
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
        fullscreenBtn?.addEventListener('click', () => {
            if (this.isFullscreen()) {
                this.exitFullscreen();
            }
            else {
                this.enterFullscreen();
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
                        this.enterFullscreen();
                        shortcutText = 'Fullscreen';
                    }
                    else {
                        this.exitFullscreen();
                        shortcutText = 'Exit Fullscreen';
                    }
                    break;
                case 'p':
                    e.preventDefault();
                    this.togglePiP();
                    shortcutText = 'Picture-in-Picture';
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
                            onResume: () => {
                                try {
                                    this.play();
                                    this.previewGateHit = false;
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
            if (s === 0 || (this.video && (this.video.currentTime || 0) < s)) {
                this.previewGateHit = false;
            }
            const cur = this.video ? (this.video.currentTime || 0) : 0;
            this.enforceFreePreviewGate(cur, true);
        }
        catch (_) { }
    }
    resetFreePreviewGate() {
        this.previewGateHit = false;
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