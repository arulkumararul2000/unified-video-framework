import { EventEmitter } from './utils/EventEmitter.js';
export class BasePlayer {
    constructor() {
        this.container = null;
        this.source = null;
        this.subtitles = [];
        this.currentSubtitleIndex = -1;
        this.config = this.getDefaultConfig();
        this.events = new EventEmitter();
        this.state = this.getDefaultState();
    }
    getDefaultConfig() {
        return {
            autoPlay: false,
            muted: false,
            volume: 1.0,
            controls: true,
            loop: false,
            preload: 'metadata',
            playsInline: true,
            enableAdaptiveBitrate: true,
            debug: false,
            freeDuration: 0
        };
    }
    getDefaultState() {
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
    async initialize(container, config) {
        if (typeof container === 'string') {
            const element = document.querySelector(container);
            if (!element) {
                throw new Error(`Container element not found: ${container}`);
            }
            this.container = element;
        }
        else {
            this.container = container;
        }
        this.config = { ...this.getDefaultConfig(), ...config };
        this.state.volume = this.config.volume || 1.0;
        this.state.isMuted = this.config.muted || false;
        await this.setupPlayer();
    }
    async play() {
        this.state.isPlaying = true;
        this.state.isPaused = false;
        this.emit('onPlay');
    }
    pause() {
        this.state.isPlaying = false;
        this.state.isPaused = true;
        this.emit('onPause');
    }
    stop() {
        this.pause();
        this.seek(0);
        this.state.isEnded = true;
    }
    setVolume(level) {
        const volume = Math.max(0, Math.min(1, level));
        this.state.volume = volume;
        this.emit('onVolumeChanged', volume);
    }
    mute() {
        this.state.isMuted = true;
        this.emit('onVolumeChanged', 0);
    }
    unmute() {
        this.state.isMuted = false;
        this.emit('onVolumeChanged', this.state.volume);
    }
    toggleMute() {
        if (this.state.isMuted) {
            this.unmute();
        }
        else {
            this.mute();
        }
    }
    setPlaybackRate(rate) {
        this.state.playbackRate = rate;
    }
    getPlaybackRate() {
        return this.state.playbackRate;
    }
    getCurrentTime() {
        return this.state.currentTime;
    }
    getDuration() {
        return this.state.duration;
    }
    getBufferedPercentage() {
        return this.state.bufferedPercentage;
    }
    getState() {
        return { ...this.state };
    }
    isPlaying() {
        return this.state.isPlaying;
    }
    isPaused() {
        return this.state.isPaused;
    }
    isEnded() {
        return this.state.isEnded;
    }
    async toggleFullscreen() {
        if (document.fullscreenElement) {
            await this.exitFullscreen();
        }
        else {
            await this.enterFullscreen();
        }
    }
    on(event, handler) {
        this.events.on(event, handler);
    }
    off(event, handler) {
        this.events.off(event, handler);
    }
    once(event, handler) {
        this.events.once(event, handler);
    }
    emit(event, ...args) {
        this.events.emit(event, ...args);
    }
    getSubtitles() {
        return this.subtitles;
    }
    setSubtitleTrack(index) {
        if (index >= 0 && index < this.subtitles.length) {
            this.currentSubtitleIndex = index;
            this.applySubtitleTrack(this.subtitles[index]);
        }
    }
    disableSubtitles() {
        this.currentSubtitleIndex = -1;
        this.removeSubtitles();
    }
    handleError(error) {
        this.state.isError = true;
        this.state.isPlaying = false;
        this.emit('onError', error);
        if (this.config.debug) {
            console.error('[VideoPlayer Error]', error);
        }
    }
    updateTime(time) {
        this.state.currentTime = time;
        this.emit('onTimeUpdate', time);
    }
    updateBuffered(percentage) {
        this.state.bufferedPercentage = percentage;
        this.emit('onProgress', percentage);
    }
    setBuffering(isBuffering) {
        this.state.isBuffering = isBuffering;
        this.emit('onBuffering', isBuffering);
    }
}
//# sourceMappingURL=BasePlayer.js.map