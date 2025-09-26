import React from 'react';
type ViewStyle = any;
import { VideoSource, PlayerConfig, PlayerStateInterface, Quality, SubtitleTrack, PlayerError, PlayerEvent, EventHandler } from '@unified-video/core';
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
export declare const ReactNativePlayer: React.ForwardRefExoticComponent<ReactNativePlayerProps & React.RefAttributes<ReactNativePlayerRef>>;
export {};
//# sourceMappingURL=ReactNativePlayer.d.ts.map