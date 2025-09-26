/**
 * React Native implementation of the video player
 */

import React, { useRef, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
// Conditional import for react-native (should be peer dependency)
let View: any, StyleSheet: any, Platform: any;
type ViewStyle = any;

try {
  const RN = require('react-native');
  View = RN.View;
  StyleSheet = RN.StyleSheet;
  Platform = RN.Platform;
} catch (error) {
  // react-native is not installed - create mock implementations
  console.warn('react-native is not installed. Components will not render.');
  View = 'div' as any;
  StyleSheet = { create: (styles: any) => styles } as any;
  Platform = { OS: 'web', Version: '1.0' } as any;
}
// Type definitions for react-native-video
interface RNVideoTypes {
  OnLoadData?: any;
  OnProgressData?: any;
  OnSeekData?: any;
  LoadError?: any;
  OnBufferData?: any;
  OnBandwidthUpdateData?: any;
  TextTrackType?: any;
  SelectedTrackType?: any;
}

// Conditional import for react-native-video (should be peer dependency)
let Video: any;
let videoTypes: RNVideoTypes = {};

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
} catch (error) {
  // react-native-video is not installed - create mock implementation
  console.warn('react-native-video is not installed. Video playback will not work.');
  Video = 'div' as any;
  videoTypes = {
    TextTrackType: { VTT: 'text/vtt' },
    SelectedTrackType: { INDEX: 'index', DISABLED: 'disabled' }
  };
}
import { 
  VideoSource,
  PlayerConfig,
  PlayerStateInterface,
  Quality,
  SubtitleTrack,
  PlayerError,
  PlayerEvent,
  EventHandler
} from '@unified-video/core';
import { EventEmitter } from './utils/EventEmitter';

interface ReactNativePlayerProps {
  style?: ViewStyle;
  config?: PlayerConfig;
  onReady?: () => void;
  onError?: (error: PlayerError) => void;
}

export interface ReactNativePlayerRef {
  destroy(): Promise<void>;
  load(videoSource: VideoSource): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  setVolume(level: number): void;
  mute(): void;
  unmute(): void;
  toggleMute(): void;
  getQualities(): Quality[];
  getCurrentQuality(): Quality | null;
  setQuality(index: number): void;
  setAutoQuality(enabled: boolean): void;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getBufferedPercentage(): number;
  getState(): PlayerStateInterface;
  isPlaying(): boolean;
  isPaused(): boolean;
  isEnded(): boolean;
  enterFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
  toggleFullscreen(): Promise<void>;
  enterPictureInPicture(): Promise<void>;
  exitPictureInPicture(): Promise<void>;
  on(event: PlayerEvent, handler: EventHandler): void;
  off(event: PlayerEvent, handler?: EventHandler): void;
  once(event: PlayerEvent, handler: EventHandler): void;
  getSubtitles(): SubtitleTrack[];
  setSubtitleTrack(index: number): void;
  disableSubtitles(): void;
  getVideoRef(): any;
}

export const ReactNativePlayer = forwardRef<ReactNativePlayerRef, ReactNativePlayerProps>(
  ({ style, config = {}, onError }, ref) => {
    const videoRef = useRef<any>(null);
    const events = useRef(new EventEmitter()).current;
    
    const [source, setSource] = useState<VideoSource | null>(null);
    const [paused, setPaused] = useState(!config.autoPlay);
    const [volume, setVolume] = useState(config.volume ?? 1.0);
    const [muted, setMuted] = useState(config.muted ?? false);
    const [rate, setRate] = useState(1.0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffering, setBuffering] = useState(false);
    const [qualities, setQualities] = useState<Quality[]>([]);
    const [selectedQuality, setSelectedQuality] = useState<Quality | null>(null);
    const [selectedTextTrack, setSelectedTextTrack] = useState<number>(-1);

    // State getter
    const getState = useCallback((): PlayerStateInterface => ({
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

    // Implement IVideoPlayer interface
    const playerMethods: ReactNativePlayerRef = {
      // Remove initialize method as it's not needed for ReactNativePlayerRef

      async destroy(): Promise<void> {
        setSource(null);
        events.removeAllListeners();
      },

      async load(videoSource: VideoSource): Promise<void> {
        const videoSrc: any = {
          uri: videoSource.url,
          type: videoSource.type
        };

        // Add DRM if provided
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

      async play(): Promise<void> {
        setPaused(false);
        events.emit('onPlay');
      },

      pause(): void {
        setPaused(true);
        events.emit('onPause');
      },

      stop(): void {
        setPaused(true);
        setCurrentTime(0);
        if (videoRef.current) {
          videoRef.current.seek(0);
        }
      },

      seek(time: number): void {
        if (videoRef.current) {
          videoRef.current.seek(time);
          setCurrentTime(time);
          events.emit('onSeeking');
        }
      },

      setVolume(level: number): void {
        const vol = Math.max(0, Math.min(1, level));
        setVolume(vol);
        events.emit('onVolumeChanged', vol);
      },

      mute(): void {
        setMuted(true);
        events.emit('onVolumeChanged', 0);
      },

      unmute(): void {
        setMuted(false);
        events.emit('onVolumeChanged', volume);
      },

      toggleMute(): void {
        setMuted(!muted);
        events.emit('onVolumeChanged', muted ? volume : 0);
      },

      getQualities(): Quality[] {
        return qualities;
      },

      getCurrentQuality(): Quality | null {
        return selectedQuality;
      },

      setQuality(index: number): void {
        if (qualities[index]) {
          setSelectedQuality(qualities[index]);
          // Platform-specific quality switching would go here
          events.emit('onQualityChanged', qualities[index]);
        }
      },

      setAutoQuality(enabled: boolean): void {
        // Auto quality selection logic
        if (enabled && qualities.length > 0) {
          // Select best quality based on bandwidth
          const bestQuality = qualities[qualities.length - 1];
          setSelectedQuality(bestQuality);
        }
      },

      setPlaybackRate(rate: number): void {
        setRate(rate);
      },

      getPlaybackRate(): number {
        return rate;
      },

      getCurrentTime(): number {
        return currentTime;
      },

      getDuration(): number {
        return duration;
      },

      getBufferedPercentage(): number {
        return 0; // Would need to calculate from buffer data
      },

      getState,

      isPlaying(): boolean {
        return !paused;
      },

      isPaused(): boolean {
        return paused;
      },

      isEnded(): boolean {
        return currentTime >= duration && duration > 0;
      },

      async enterFullscreen(): Promise<void> {
        if (videoRef.current) {
          (videoRef.current as any).presentFullscreenPlayer?.();
          events.emit('onFullscreenChanged', true);
        }
      },

      async exitFullscreen(): Promise<void> {
        if (videoRef.current) {
          (videoRef.current as any).dismissFullscreenPlayer?.();
          events.emit('onFullscreenChanged', false);
        }
      },

      async toggleFullscreen(): Promise<void> {
        // Toggle implementation would check current state
        await playerMethods.enterFullscreen();
      },

      async enterPictureInPicture(): Promise<void> {
        if (Platform.OS === 'ios' && videoRef.current) {
          (videoRef.current as any).restoreUserInterfaceForPictureInPictureStop?.();
        }
      },

      async exitPictureInPicture(): Promise<void> {
        // PiP exit implementation
      },

      on(event: PlayerEvent, handler: EventHandler): void {
        events.on(event as string, handler);
      },

      off(event: PlayerEvent, handler?: EventHandler): void {
        events.off(event as string, handler);
      },

      once(event: PlayerEvent, handler: EventHandler): void {
        events.once(event as string, handler);
      },

      getSubtitles(): SubtitleTrack[] {
        return source?.subtitles || [];
      },

      setSubtitleTrack(index: number): void {
        setSelectedTextTrack(index);
      },

      disableSubtitles(): void {
        setSelectedTextTrack(-1);
      },

      getVideoRef(): any {
        return videoRef.current;
      }
    };

    useImperativeHandle(ref, () => playerMethods, [
      paused, volume, muted, rate, currentTime, duration, 
      qualities, selectedQuality, source, buffering
    ]);

    // Video event handlers
    const handleLoad = useCallback((data: any) => {
      setDuration(data.duration);
      
      // Extract quality levels if available
      if (data.videoTracks && data.videoTracks.length > 0) {
        const qualityLevels = data.videoTracks.map((track: any, index: number) => ({
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

    const handleProgress = useCallback((data: any) => {
      setCurrentTime(data.currentTime);
      events.emit('onTimeUpdate', data.currentTime);
      
      if (data.playableDuration && duration > 0) {
        const bufferedPercentage = (data.playableDuration / duration) * 100;
        events.emit('onProgress', bufferedPercentage);
      }
    }, [duration, events]);

    const handleBuffer = useCallback((data: any) => {
      setBuffering(data.isBuffering);
      events.emit('onBuffering', data.isBuffering);
    }, [events]);

    const handleError = useCallback((error: any) => {
      const playerError: PlayerError = {
        code: error.error?.code || 'UNKNOWN',
        message: error.error?.localizedDescription || 'Unknown error',
        timestamp: Date.now(),
        fatal: true,
        data: error.error
      };
      
      if (onError) onError(playerError);
      events.emit('onError', playerError);
    }, [events, onError]);

    const handleEnd = useCallback(() => {
      events.emit('onEnded');
    }, [events]);

    const handleSeek = useCallback((data: any) => {
      setCurrentTime(data.currentTime);
      events.emit('onSeeked');
    }, [events]);

    const handleBandwidthUpdate = useCallback((data: any) => {
      // Could use this for adaptive bitrate switching
      console.log('Bandwidth update:', data.bitrate);
    }, []);

    if (!source) {
      return <View style={[styles.container, style]} />;
    }

    // Convert source to react-native-video format
    const videoSource: any = {
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

    // Convert subtitles to text tracks
    const textTracks = source.subtitles?.map(subtitle => ({
      type: 'text/vtt' as any,
      language: subtitle.language,
      title: subtitle.label,
      uri: subtitle.url
    }));

    return (
      <View style={[styles.container, style]}>
        <Video
          ref={videoRef}
          source={videoSource}
          style={styles.video}
          paused={paused}
          volume={volume}
          muted={muted}
          rate={rate}
          resizeMode="contain"
          repeat={config.loop || false}
          controls={config.controls !== false}
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
          progressUpdateInterval={250}
          textTracks={textTracks}
          selectedTextTrack={
            selectedTextTrack >= 0 
              ? { type: videoTypes.SelectedTrackType?.INDEX || 'index', value: selectedTextTrack }
              : { type: videoTypes.SelectedTrackType?.DISABLED || 'disabled' }
          }
          onLoad={handleLoad}
          onProgress={handleProgress}
          onBuffer={handleBuffer}
          onError={handleError}
          onEnd={handleEnd}
          onSeek={handleSeek}
          onBandwidthUpdate={handleBandwidthUpdate}
          onTimedMetadata={(metadata: any) => console.log('Metadata:', metadata)}
        />
      </View>
    );
  }
);

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
