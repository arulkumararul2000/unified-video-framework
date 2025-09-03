"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoPlayer = void 0;
const events_1 = require("events");
const interfaces_1 = require("./interfaces");
class VideoPlayer {
    constructor(config = {}) {
        this.errors = [];
        this.config = {
            autoPlay: false,
            muted: false,
            controls: true,
            loop: false,
            preload: 'metadata',
            playsInline: true,
            ...config
        };
        this.eventEmitter = new events_1.EventEmitter();
        this.state = interfaces_1.PlayerState.IDLE;
        this.metrics = this.initializeMetrics();
    }
    on(event, handler) {
        this.eventEmitter.on(event, handler);
    }
    off(event, handler) {
        this.eventEmitter.off(event, handler);
    }
    once(event, handler) {
        this.eventEmitter.once(event, handler);
    }
    removeAllListeners(event) {
        if (event) {
            this.eventEmitter.removeAllListeners(event);
        }
        else {
            this.eventEmitter.removeAllListeners();
        }
    }
    emit(event, data) {
        this.eventEmitter.emit(event, data);
        if (this.config.analytics?.enabled) {
            this.trackAnalytics(event, data);
        }
    }
    getState() {
        return this.state;
    }
    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        if (oldState !== newState) {
            this.emit('statechange', { oldState, newState });
        }
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.applyConfig();
    }
    getMetrics() {
        return {
            ...this.metrics,
            errors: [...this.errors]
        };
    }
    initializeMetrics() {
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
    generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    handleError(error) {
        this.errors.push(error);
        this.emit('error', error);
        if (error.fatal) {
            this.setState(interfaces_1.PlayerState.ERROR);
        }
    }
    trackAnalytics(event, data) {
        if (!this.config.analytics?.providers)
            return;
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
            }
            catch (error) {
                console.error(`Analytics provider ${provider.name} failed:`, error);
            }
        });
    }
    cleanup() {
        this.removeAllListeners();
        this.state = interfaces_1.PlayerState.IDLE;
        this.currentSource = undefined;
    }
    formatTime(seconds) {
        if (!isFinite(seconds))
            return '00:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}:${this.pad(minutes)}:${this.pad(secs)}`;
        }
        return `${minutes}:${this.pad(secs)}`;
    }
    pad(num) {
        return num.toString().padStart(2, '0');
    }
    isBuffering() {
        return this.state === interfaces_1.PlayerState.BUFFERING;
    }
}
exports.VideoPlayer = VideoPlayer;
//# sourceMappingURL=VideoPlayer.js.map