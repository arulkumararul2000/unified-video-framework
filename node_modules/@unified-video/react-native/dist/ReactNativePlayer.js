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
exports.ReactNativePlayer = void 0;
const react_1 = __importStar(require("react"));
let View, StyleSheet, Platform;
try {
    const RN = require('react-native');
    View = RN.View;
    StyleSheet = RN.StyleSheet;
    Platform = RN.Platform;
}
catch (error) {
    console.warn('react-native is not installed. Components will not render.');
    View = 'div';
    StyleSheet = { create: (styles) => styles };
    Platform = { OS: 'web', Version: '1.0' };
}
let Video;
let videoTypes = {};
try {
    const RNVideo = require('react-native-video');
    Video = RNVideo.default || RNVideo;
    videoTypes = {
        OnLoadData: RNVideo.OnLoadData,
        OnProgressData: RNVideo.OnProgressData,
        OnSeekData: RNVideo.OnSeekData,
        LoadError: RNVideo.LoadError,
        OnBufferData: RNVideo.OnBufferData,
        OnBandwidthUpdateData: RNVideo.OnBandwidthUpdateData,
        TextTrackType: RNVideo.TextTrackType,
        SelectedTrackType: RNVideo.SelectedTrackType
    };
}
catch (error) {
    console.warn('react-native-video is not installed. Video playback will not work.');
    Video = 'div';
    videoTypes = {
        TextTrackType: { VTT: 'text/vtt' },
        SelectedTrackType: { INDEX: 'index', DISABLED: 'disabled' }
    };
}
const EventEmitter_1 = require("./utils/EventEmitter");
exports.ReactNativePlayer = (0, react_1.forwardRef)(({ style, config = {}, onError }, ref) => {
    const videoRef = (0, react_1.useRef)(null);
    const events = (0, react_1.useRef)(new EventEmitter_1.EventEmitter()).current;
    const [source, setSource] = (0, react_1.useState)(null);
    const [paused, setPaused] = (0, react_1.useState)(!config.autoPlay);
    const [volume, setVolume] = (0, react_1.useState)(config.volume ?? 1.0);
    const [muted, setMuted] = (0, react_1.useState)(config.muted ?? false);
    const [rate, setRate] = (0, react_1.useState)(1.0);
    const [currentTime, setCurrentTime] = (0, react_1.useState)(0);
    const [duration, setDuration] = (0, react_1.useState)(0);
    const [buffering, setBuffering] = (0, react_1.useState)(false);
    const [qualities, setQualities] = (0, react_1.useState)([]);
    const [selectedQuality, setSelectedQuality] = (0, react_1.useState)(null);
    const [selectedTextTrack, setSelectedTextTrack] = (0, react_1.useState)(-1);
    const getState = (0, react_1.useCallback)(() => ({
        isPlaying: !paused,
        isPaused: paused,
        isBuffering: buffering,
        isEnded: false,
        isError: false,
        currentTime,
        duration,
        bufferedPercentage: 0,
        volume,
        isMuted: muted,
        playbackRate: rate,
        currentQuality: selectedQuality,
        availableQualities: qualities
    }), [paused, buffering, currentTime, duration, volume, muted, rate, selectedQuality, qualities]);
    const playerMethods = {
        async destroy() {
            setSource(null);
            events.removeAllListeners();
        },
        async load(videoSource) {
            const videoSrc = {
                uri: videoSource.url,
                type: videoSource.type
            };
            if (videoSource.drm) {
                videoSrc.drm = {
                    type: Platform.select({
                        ios: videoSource.drm.type === 'widevine' ? 'fairplay' : videoSource.drm.type,
                        android: videoSource.drm.type
                    }),
                    licenseServer: videoSource.drm.licenseUrl,
                    headers: videoSource.drm.headers
                };
                if (videoSource.drm.certificateUrl) {
                    videoSrc.drm.certificateUrl = videoSource.drm.certificateUrl;
                }
            }
            setSource(videoSource);
            events.emit('onLoad', videoSource);
        },
        async play() {
            setPaused(false);
            events.emit('onPlay');
        },
        pause() {
            setPaused(true);
            events.emit('onPause');
        },
        stop() {
            setPaused(true);
            setCurrentTime(0);
            if (videoRef.current) {
                videoRef.current.seek(0);
            }
        },
        seek(time) {
            if (videoRef.current) {
                videoRef.current.seek(time);
                setCurrentTime(time);
                events.emit('onSeeking');
            }
        },
        setVolume(level) {
            const vol = Math.max(0, Math.min(1, level));
            setVolume(vol);
            events.emit('onVolumeChanged', vol);
        },
        mute() {
            setMuted(true);
            events.emit('onVolumeChanged', 0);
        },
        unmute() {
            setMuted(false);
            events.emit('onVolumeChanged', volume);
        },
        toggleMute() {
            setMuted(!muted);
            events.emit('onVolumeChanged', muted ? volume : 0);
        },
        getQualities() {
            return qualities;
        },
        getCurrentQuality() {
            return selectedQuality;
        },
        setQuality(index) {
            if (qualities[index]) {
                setSelectedQuality(qualities[index]);
                events.emit('onQualityChanged', qualities[index]);
            }
        },
        setAutoQuality(enabled) {
            if (enabled && qualities.length > 0) {
                const bestQuality = qualities[qualities.length - 1];
                setSelectedQuality(bestQuality);
            }
        },
        setPlaybackRate(rate) {
            setRate(rate);
        },
        getPlaybackRate() {
            return rate;
        },
        getCurrentTime() {
            return currentTime;
        },
        getDuration() {
            return duration;
        },
        getBufferedPercentage() {
            return 0;
        },
        getState,
        isPlaying() {
            return !paused;
        },
        isPaused() {
            return paused;
        },
        isEnded() {
            return currentTime >= duration && duration > 0;
        },
        async enterFullscreen() {
            if (videoRef.current) {
                videoRef.current.presentFullscreenPlayer?.();
                events.emit('onFullscreenChanged', true);
            }
        },
        async exitFullscreen() {
            if (videoRef.current) {
                videoRef.current.dismissFullscreenPlayer?.();
                events.emit('onFullscreenChanged', false);
            }
        },
        async toggleFullscreen() {
            await playerMethods.enterFullscreen();
        },
        async enterPictureInPicture() {
            if (Platform.OS === 'ios' && videoRef.current) {
                videoRef.current.restoreUserInterfaceForPictureInPictureStop?.();
            }
        },
        async exitPictureInPicture() {
        },
        on(event, handler) {
            events.on(event, handler);
        },
        off(event, handler) {
            events.off(event, handler);
        },
        once(event, handler) {
            events.once(event, handler);
        },
        getSubtitles() {
            return source?.subtitles || [];
        },
        setSubtitleTrack(index) {
            setSelectedTextTrack(index);
        },
        disableSubtitles() {
            setSelectedTextTrack(-1);
        },
        getVideoRef() {
            return videoRef.current;
        }
    };
    (0, react_1.useImperativeHandle)(ref, () => playerMethods, [
        paused, volume, muted, rate, currentTime, duration,
        qualities, selectedQuality, source, buffering
    ]);
    const handleLoad = (0, react_1.useCallback)((data) => {
        setDuration(data.duration);
        if (data.videoTracks && data.videoTracks.length > 0) {
            const qualityLevels = data.videoTracks.map((track, index) => ({
                id: index.toString(),
                height: track.height || 0,
                width: track.width || 0,
                bitrate: track.bitrate || 0,
                label: `${track.height}p`
            }));
            setQualities(qualityLevels);
        }
        events.emit('onLoadedMetadata', {
            duration: data.duration,
            width: data.naturalSize?.width,
            height: data.naturalSize?.height
        });
    }, [events]);
    const handleProgress = (0, react_1.useCallback)((data) => {
        setCurrentTime(data.currentTime);
        events.emit('onTimeUpdate', data.currentTime);
        if (data.playableDuration && duration > 0) {
            const bufferedPercentage = (data.playableDuration / duration) * 100;
            events.emit('onProgress', bufferedPercentage);
        }
    }, [duration, events]);
    const handleBuffer = (0, react_1.useCallback)((data) => {
        setBuffering(data.isBuffering);
        events.emit('onBuffering', data.isBuffering);
    }, [events]);
    const handleError = (0, react_1.useCallback)((error) => {
        const playerError = {
            code: error.error?.code || 'UNKNOWN',
            message: error.error?.localizedDescription || 'Unknown error',
            timestamp: Date.now(),
            fatal: true,
            data: error.error
        };
        if (onError)
            onError(playerError);
        events.emit('onError', playerError);
    }, [events, onError]);
    const handleEnd = (0, react_1.useCallback)(() => {
        events.emit('onEnded');
    }, [events]);
    const handleSeek = (0, react_1.useCallback)((data) => {
        setCurrentTime(data.currentTime);
        events.emit('onSeeked');
    }, [events]);
    const handleBandwidthUpdate = (0, react_1.useCallback)((data) => {
        console.log('Bandwidth update:', data.bitrate);
    }, []);
    if (!source) {
        return <View style={[styles.container, style]}/>;
    }
    const videoSource = {
        uri: source.url
    };
    if (source.drm) {
        videoSource.drm = {
            type: Platform.select({
                ios: source.drm.type === 'widevine' ? 'fairplay' : source.drm.type,
                android: source.drm.type
            }),
            licenseServer: source.drm.licenseUrl,
            headers: source.drm.headers
        };
    }
    const textTracks = source.subtitles?.map(subtitle => ({
        type: 'text/vtt',
        language: subtitle.language,
        title: subtitle.label,
        uri: subtitle.url
    }));
    return (<View style={[styles.container, style]}>
        <Video ref={videoRef} source={videoSource} style={styles.video} paused={paused} volume={volume} muted={muted} rate={rate} resizeMode="contain" repeat={config.loop || false} controls={config.controls !== false} playInBackground={false} playWhenInactive={false} ignoreSilentSwitch="ignore" progressUpdateInterval={250} textTracks={textTracks} selectedTextTrack={selectedTextTrack >= 0
            ? { type: videoTypes.SelectedTrackType?.INDEX || 'index', value: selectedTextTrack }
            : { type: videoTypes.SelectedTrackType?.DISABLED || 'disabled' }} onLoad={handleLoad} onProgress={handleProgress} onBuffer={handleBuffer} onError={handleError} onEnd={handleEnd} onSeek={handleSeek} onBandwidthUpdate={handleBandwidthUpdate} onTimedMetadata={(metadata) => console.log('Metadata:', metadata)}/>
      </View>);
});
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000'
    },
    video: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
    }
});
//# sourceMappingURL=ReactNativePlayer.js.map