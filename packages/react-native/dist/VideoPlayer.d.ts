import React from 'react';
import type { VideoSource, VideoPlayerConfig, VideoPlayerInterface, VideoPlayerState } from '../../core/src/interfaces';
export declare class ReactNativeVideoPlayer implements VideoPlayerInterface {
    private videoRef;
    private config;
    private state;
    private listeners;
    constructor(container: any, config: VideoPlayerConfig);
    load(source: VideoSource): Promise<void>;
    play(): Promise<void>;
    pause(): void;
    seek(position: number): void;
    setVolume(volume: number): void;
    getCurrentTime(): number;
    getDuration(): number;
    getVolume(): number;
    isMuted(): boolean;
    mute(): void;
    unmute(): void;
    setPlaybackRate(rate: number): void;
    getPlaybackRate(): number;
    enterFullscreen(): void;
    exitFullscreen(): void;
    enterPictureInPicture(): void;
    exitPictureInPicture(): void;
    on(event: string, handler: Function): void;
    off(event: string, handler: Function): void;
    private emit;
    destroy(): void;
    getState(): VideoPlayerState;
}
export declare const VideoPlayer: React.FC<{
    source: VideoSource;
    config?: VideoPlayerConfig;
    style?: any;
    onReady?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
    onEnd?: () => void;
    onError?: (error: any) => void;
}>;
export default ReactNativeVideoPlayer;
//# sourceMappingURL=VideoPlayer.d.ts.map