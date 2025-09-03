"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTML5Player = void 0;
const VideoPlayer_1 = require("@video-framework/core/src/VideoPlayer");
const interfaces_1 = require("@video-framework/core/src/interfaces");
const hls_js_1 = __importDefault(require("hls.js"));
const dashjs_1 = __importDefault(require("dashjs"));
class HTML5Player extends VideoPlayer_1.VideoPlayer {
    constructor(container, config = {}) {
        super(config);
        this.qualities = [];
        this.currentQuality = null;
        this.subtitleTracks = [];
        this.audioTracks = [];
        this.isInitialized = false;
        this.container = container;
        this.videoElement = this.createVideoElement();
        this.setupEventListeners();
        this.applyConfig();
    }
    createVideoElement() {
        const video = document.createElement('video');
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.backgroundColor = '#000';
        if (this.config.controls)
            video.controls = true;
        if (this.config.muted)
            video.muted = true;
        if (this.config.loop)
            video.loop = true;
        if (this.config.playsInline)
            video.playsInline = true;
        if (this.config.crossOrigin)
            video.crossOrigin = this.config.crossOrigin;
        this.container.appendChild(video);
        return video;
    }
    setupEventListeners() {
        this.videoElement.addEventListener('loadstart', () => {
            this.setState(interfaces_1.PlayerState.LOADING);
            this.emit('loadstart');
        });
        this.videoElement.addEventListener('loadedmetadata', () => {
            this.setState(interfaces_1.PlayerState.READY);
            this.emit('loadedmetadata');
        });
        this.videoElement.addEventListener('play', () => {
            this.setState(interfaces_1.PlayerState.PLAYING);
            this.emit('play');
        });
        this.videoElement.addEventListener('pause', () => {
            this.setState(interfaces_1.PlayerState.PAUSED);
            this.emit('pause');
        });
        this.videoElement.addEventListener('ended', () => {
            this.setState(interfaces_1.PlayerState.ENDED);
            this.emit('ended');
        });
        this.videoElement.addEventListener('error', (e) => {
            const error = {
                code: this.videoElement.error?.code.toString() || 'UNKNOWN',
                message: this.videoElement.error?.message || 'Unknown error',
                timestamp: Date.now(),
                fatal: true
            };
            this.handleError(error);
        });
        this.videoElement.addEventListener('timeupdate', () => {
            this.emit('timeupdate', {
                currentTime: this.videoElement.currentTime,
                duration: this.videoElement.duration
            });
        });
        this.videoElement.addEventListener('progress', () => {
            this.emit('progress', {
                buffered: this.getBufferedRanges(),
                currentTime: this.videoElement.currentTime
            });
        });
        this.videoElement.addEventListener('waiting', () => {
            this.setState(interfaces_1.PlayerState.BUFFERING);
            this.emit('waiting');
        });
        this.videoElement.addEventListener('canplay', () => {
            if (this.state === interfaces_1.PlayerState.BUFFERING) {
                this.setState(interfaces_1.PlayerState.PLAYING);
            }
            this.emit('canplay');
        });
        this.videoElement.addEventListener('volumechange', () => {
            this.emit('volumechange', {
                volume: this.videoElement.volume,
                muted: this.videoElement.muted
            });
        });
    }
    async load(source) {
        this.currentSource = source;
        this.cleanupStreamingLibraries();
        try {
            if (source.drm) {
                await this.configureDRM(source.drm);
            }
            if (this.isHLS(source)) {
                await this.loadHLS(source);
            }
            else if (this.isDASH(source)) {
                await this.loadDASH(source);
            }
            else {
                this.videoElement.src = source.url;
                this.videoElement.load();
            }
            if (source.subtitles) {
                this.loadSubtitles(source.subtitles);
            }
            this.isInitialized = true;
            if (this.config.autoPlay) {
                await this.play();
            }
        }
        catch (error) {
            console.error('Failed to load video:', error);
            throw error;
        }
    }
    isHLS(source) {
        return source.type === 'application/x-mpegURL' ||
            source.url.includes('.m3u8');
    }
    isDASH(source) {
        return source.type === 'application/dash+xml' ||
            source.url.includes('.mpd');
    }
    async loadHLS(source) {
        if (hls_js_1.default.isSupported()) {
            this.hls = new hls_js_1.default({
                startLevel: this.config.adaptiveBitrate?.startLevel || -1,
                autoStartLoad: true,
                debug: false
            });
            this.hls.loadSource(source.url);
            this.hls.attachMedia(this.videoElement);
            this.hls.on(hls_js_1.default.Events.MANIFEST_PARSED, (event, data) => {
                this.qualities = data.levels.map((level, index) => ({
                    id: `level_${index}`,
                    label: `${level.height}p`,
                    height: level.height,
                    width: level.width,
                    bitrate: level.bitrate,
                    frameRate: level.frameRate,
                    codec: level.codecSet
                }));
                this.emit('ready');
            });
            this.hls.on(hls_js_1.default.Events.LEVEL_SWITCHED, (event, data) => {
                this.currentQuality = this.qualities[data.level];
                this.emit('qualitychange', this.currentQuality);
            });
            this.hls.on(hls_js_1.default.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    const error = {
                        code: data.type,
                        message: data.details,
                        timestamp: Date.now(),
                        fatal: true,
                        data: data
                    };
                    this.handleError(error);
                }
            });
        }
        else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            this.videoElement.src = source.url;
            this.videoElement.load();
        }
    }
    async loadDASH(source) {
        this.dash = dashjs_1.default.MediaPlayer().create();
        this.dash.initialize(this.videoElement, source.url, this.config.autoPlay || false);
        this.dash.updateSettings({
            streaming: {
                abr: {
                    autoSwitchBitrate: {
                        video: this.config.adaptiveBitrate?.autoLevelEnabled !== false
                    }
                }
            }
        });
        this.dash.on(dashjs_1.default.MediaPlayer.events.STREAM_INITIALIZED, () => {
            const bitrateInfoList = this.dash.getBitrateInfoListFor('video');
            this.qualities = bitrateInfoList.map((info, index) => ({
                id: `bitrate_${index}`,
                label: `${info.height}p`,
                height: info.height,
                width: info.width,
                bitrate: info.bitrate,
                frameRate: 0,
                codec: ''
            }));
            this.emit('ready');
        });
        this.dash.on(dashjs_1.default.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e) => {
            if (e.mediaType === 'video') {
                this.currentQuality = this.qualities[e.newQuality];
                this.emit('qualitychange', this.currentQuality);
            }
        });
        this.dash.on(dashjs_1.default.MediaPlayer.events.ERROR, (e) => {
            const error = {
                code: e.error.code,
                message: e.error.message,
                timestamp: Date.now(),
                fatal: true,
                data: e
            };
            this.handleError(error);
        });
    }
    loadSubtitles(subtitles) {
        const existingTracks = this.videoElement.querySelectorAll('track');
        existingTracks.forEach(track => track.remove());
        subtitles.forEach((subtitle, index) => {
            const track = document.createElement('track');
            track.kind = subtitle.kind || 'subtitles';
            track.label = subtitle.label;
            track.srclang = subtitle.language;
            if (subtitle.url) {
                track.src = subtitle.url;
            }
            if (subtitle.default || index === 0) {
                track.default = true;
            }
            this.videoElement.appendChild(track);
        });
        this.subtitleTracks = subtitles;
    }
    async play() {
        try {
            await this.videoElement.play();
        }
        catch (error) {
            console.error('Play failed:', error);
            throw error;
        }
    }
    pause() {
        this.videoElement.pause();
    }
    stop() {
        this.pause();
        this.videoElement.currentTime = 0;
    }
    seek(position) {
        this.videoElement.currentTime = position;
    }
    setVolume(volume) {
        this.videoElement.volume = Math.max(0, Math.min(1, volume));
    }
    setPlaybackRate(rate) {
        this.videoElement.playbackRate = rate;
    }
    getCurrentTime() {
        return this.videoElement.currentTime;
    }
    getDuration() {
        return this.videoElement.duration || 0;
    }
    getVolume() {
        return this.videoElement.volume;
    }
    getPlaybackRate() {
        return this.videoElement.playbackRate;
    }
    isMuted() {
        return this.videoElement.muted;
    }
    setMuted(muted) {
        this.videoElement.muted = muted;
    }
    getAvailableQualities() {
        return this.qualities;
    }
    getCurrentQuality() {
        return this.currentQuality;
    }
    setQuality(quality) {
        const index = this.qualities.findIndex(q => q.id === quality.id);
        if (index >= 0) {
            if (this.hls) {
                this.hls.currentLevel = index;
            }
            else if (this.dash) {
                this.dash.setQualityFor('video', index);
            }
        }
    }
    enableAutoQuality(enabled) {
        if (this.hls) {
            this.hls.currentLevel = enabled ? -1 : this.hls.currentLevel;
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
    getSubtitleTracks() {
        return this.subtitleTracks;
    }
    getCurrentSubtitleTrack() {
        const textTracks = this.videoElement.textTracks;
        for (let i = 0; i < textTracks.length; i++) {
            if (textTracks[i].mode === 'showing') {
                return this.subtitleTracks[i] || null;
            }
        }
        return null;
    }
    setSubtitleTrack(track) {
        const textTracks = this.videoElement.textTracks;
        for (let i = 0; i < textTracks.length; i++) {
            textTracks[i].mode = 'disabled';
        }
        if (track) {
            const index = this.subtitleTracks.findIndex(t => t.id === track.id);
            if (index >= 0 && textTracks[index]) {
                textTracks[index].mode = 'showing';
            }
        }
    }
    getAudioTracks() {
        return this.audioTracks;
    }
    getCurrentAudioTrack() {
        return this.audioTracks[0] || null;
    }
    setAudioTrack(track) {
    }
    enterFullscreen() {
        if (this.container.requestFullscreen) {
            this.container.requestFullscreen();
        }
    }
    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
    isFullscreen() {
        return document.fullscreenElement === this.container;
    }
    enterPictureInPicture() {
        if (this.videoElement.requestPictureInPicture) {
            this.videoElement.requestPictureInPicture();
        }
    }
    exitPictureInPicture() {
        if (document.exitPictureInPicture) {
            document.exitPictureInPicture();
        }
    }
    isPictureInPicture() {
        return document.pictureInPictureElement === this.videoElement;
    }
    getBufferedRanges() {
        return this.videoElement.buffered;
    }
    getSeekableRanges() {
        return this.videoElement.seekable;
    }
    getBandwidth() {
        if (this.hls) {
            return this.hls.bandwidthEstimate || 0;
        }
        else if (this.dash) {
            return this.dash.getAverageThroughput('video') || 0;
        }
        return 0;
    }
    getNetworkState() {
        return this.videoElement.networkState;
    }
    getVideoWidth() {
        return this.videoElement.videoWidth;
    }
    getVideoHeight() {
        return this.videoElement.videoHeight;
    }
    getDroppedFrames() {
        const quality = this.videoElement.getVideoPlaybackQuality?.();
        return quality?.droppedVideoFrames || 0;
    }
    getDecodedFrames() {
        const quality = this.videoElement.getVideoPlaybackQuality?.();
        return quality?.totalVideoFrames || 0;
    }
    applyConfig() {
        if (this.config.controls !== undefined) {
            this.videoElement.controls = this.config.controls;
        }
        if (this.config.muted !== undefined) {
            this.videoElement.muted = this.config.muted;
        }
        if (this.config.loop !== undefined) {
            this.videoElement.loop = this.config.loop;
        }
        if (this.config.preload) {
            this.videoElement.preload = this.config.preload;
        }
    }
    async configureDRM(drmConfig) {
        console.log('DRM configuration:', drmConfig);
    }
    cleanupStreamingLibraries() {
        if (this.hls) {
            this.hls.destroy();
            this.hls = undefined;
        }
        if (this.dash) {
            this.dash.reset();
            this.dash = undefined;
        }
    }
    destroy() {
        this.cleanupStreamingLibraries();
        this.cleanup();
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.removeAttribute('src');
            this.videoElement.load();
            this.container.removeChild(this.videoElement);
        }
    }
}
exports.HTML5Player = HTML5Player;
//# sourceMappingURL=HTML5Player.js.map