"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoPlayer = exports.ReactNativeVideoPlayer = void 0;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
class ReactNativeVideoPlayer {
    constructor(container, config) {
        this.state = 'idle';
        this.listeners = new Map();
        this.config = config;
        console.log('ReactNativeVideoPlayer initialized for', react_native_1.Platform.OS);
    }
    async load(source) {
        this.state = 'loading';
        return Promise.resolve();
    }
    async play() {
        this.state = 'playing';
        this.emit('play');
        return Promise.resolve();
    }
    pause() {
        this.state = 'paused';
        this.emit('pause');
    }
    seek(position) {
        this.emit('seeking', { position });
    }
    setVolume(volume) {
        this.emit('volumechange', { volume });
    }
    getCurrentTime() {
        return 0;
    }
    getDuration() {
        return 0;
    }
    getVolume() {
        return 1;
    }
    isMuted() {
        return false;
    }
    mute() {
        this.emit('volumechange', { muted: true });
    }
    unmute() {
        this.emit('volumechange', { muted: false });
    }
    setPlaybackRate(rate) {
    }
    getPlaybackRate() {
        return 1;
    }
    enterFullscreen() {
        if (react_native_1.Platform.OS === 'ios') {
        }
        else if (react_native_1.Platform.OS === 'android') {
        }
    }
    exitFullscreen() {
    }
    enterPictureInPicture() {
        if (react_native_1.Platform.OS === 'ios' && react_native_1.Platform.Version >= 14) {
        }
        else if (react_native_1.Platform.OS === 'android' && react_native_1.Platform.Version >= 26) {
        }
    }
    exitPictureInPicture() {
    }
    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(handler);
    }
    off(event, handler) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    emit(event, data) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
    }
    destroy() {
        this.listeners.clear();
        this.state = 'idle';
    }
    getState() {
        return this.state;
    }
}
exports.ReactNativeVideoPlayer = ReactNativeVideoPlayer;
const VideoPlayer = ({ source, config, style, ...callbacks }) => {
    const videoRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
    }, []);
    return (<react_native_1.View style={[styles.container, style]}>
      
      
    </react_native_1.View>);
};
exports.VideoPlayer = VideoPlayer;
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    video: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
    },
});
exports.default = ReactNativeVideoPlayer;
//# sourceMappingURL=VideoPlayer.js.map