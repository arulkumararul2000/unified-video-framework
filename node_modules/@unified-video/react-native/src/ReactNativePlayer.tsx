/**
 * React Native implementation of the video player
 */

import React, { useRef, useImperativeHandle, forwardRef, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import Video, { 
  OnLoadData, 
  OnProgressData, 
  OnSeekData,
  LoadError,
  OnBufferData,
  OnBandwidthUpdateData,
  VideoProperties,
  TextTrackType,
  SelectedTrackType
} from 'react-native-video';
import { 
  IVideoPlayer,
  VideoSource,
  PlayerConfig,
  PlayerState,
  Quality,
  SubtitleTrack,
  PlayerError,
  PlayerEvents
} from '@unified-video/core';
import { EventEmitter } from './utils/EventEmitter';

interface ReactNativePlayerProps {
  style?: ViewStyle;
  config?: PlayerConfig;
  onReady?: () => void;
  onError?: (error: PlayerError) => void;
}

export interface ReactNativePlayerRef extends IVideoPlayer {
  getVideoRef: () => Video | null;
}

export const ReactNativePlayer = forwardRef<ReactNativePlayerRef, ReactNativePlayerProps>(
  ({ style, config = {}, onReady, onError }, ref) => {
    const videoRef = useRef<Video>(null);
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
    const getState = useCallback((): PlayerState => ({
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
      async initialize(container: any, cfg?: PlayerConfig): Promise<void> {
        // In React Native, initialization is handled by component mount
        if (onReady) onReady();
        events.emit('onReady');
      },

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
        await this.enterFullscreen();
      },

      async enterPictureInPicture(): Promise<void> {
        if (Platform.OS === 'ios' && videoRef.current) {
          (videoRef.current as any).restoreUserInterfaceForPictureInPictureStop?.();
        }
      },

      async exitPictureInPicture(): Promise<void> {
        // PiP exit implementation
      },

      on(event: keyof PlayerEvents, handler: Function): void {
        events.on(event as string, handler);
      },

      off(event: keyof PlayerEvents, handler?: Function): void {
        events.off(event as string, handler);
      },

      once(event: keyof PlayerEvents, handler: Function): void {
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

      getVideoRef: () => videoRef.current
    };

    useImperativeHandle(ref, () => playerMethods, [
      paused, volume, muted, rate, currentTime, duration, 
      qualities, selectedQuality, source, buffering
    ]);

    // Video event handlers
    const handleLoad = useCallback((data: OnLoadData) => {
      setDuration(data.duration);
      
      // Extract quality levels if available
      if (data.videoTracks && data.videoTracks.length > 0) {
        const qualityLevels = data.videoTracks.map((track, index) => ({
          height: track.height || 0,
          width: track.width || 0,
          bitrate: track.bitrate || 0,
          label: `${track.height}p`,
          index
        }));
        setQualities(qualityLevels);
      }

      events.emit('onLoadedMetadata', {
        duration: data.duration,
        width: data.naturalSize?.width,
        height: data.naturalSize?.height
      });
    }, [events]);

    const handleProgress = useCallback((data: OnProgressData) => {
      setCurrentTime(data.currentTime);
      events.emit('onTimeUpdate', data.currentTime);
      
      if (data.playableDuration && duration > 0) {
        const bufferedPercentage = (data.playableDuration / duration) * 100;
        events.emit('onProgress', bufferedPercentage);
      }
    }, [duration, events]);

    const handleBuffer = useCallback((data: OnBufferData) => {
      setBuffering(data.isBuffering);
      events.emit('onBuffering', data.isBuffering);
    }, [events]);

    const handleError = useCallback((error: LoadError) => {
      const playerError: PlayerError = {
        code: error.error?.code || 'UNKNOWN',
        message: error.error?.localizedDescription || 'Unknown error',
        type: 'media',
        fatal: true,
        details: error.error
      };
      
      if (onError) onError(playerError);
      events.emit('onError', playerError);
    }, [events, onError]);

    const handleEnd = useCallback(() => {
      events.emit('onEnded');
    }, [events]);

    const handleSeek = useCallback((data: OnSeekData) => {
      setCurrentTime(data.currentTime);
      events.emit('onSeeked');
    }, [events]);

    const handleBandwidthUpdate = useCallback((data: OnBandwidthUpdateData) => {
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
      type: 'text/vtt' as TextTrackType,
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
              ? { type: SelectedTrackType.INDEX, value: selectedTextTrack }
              : { type: SelectedTrackType.DISABLED }
          }
          onLoad={handleLoad}
          onProgress={handleProgress}
          onBuffer={handleBuffer}
          onError={handleError}
          onEnd={handleEnd}
          onSeek={handleSeek}
          onBandwidthUpdate={handleBandwidthUpdate}
          onTimedMetadata={(metadata) => console.log('Metadata:', metadata)}
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
