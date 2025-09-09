export interface VideoSource {
    url: string;
    type?: 'mp4' | 'hls' | 'dash' | 'webm' | 'auto';
    drm?: DRMConfig;
    subtitles?: SubtitleTrack[];
    metadata?: VideoMetadata;
}
export interface DRMConfig {
    licenseUrl: string;
    certificateUrl?: string;
    headers?: Record<string, string>;
    type: 'widevine' | 'playready' | 'fairplay' | 'clearkey';
}
export interface SubtitleTrack {
    url: string;
    language: string;
    label: string;
    kind: 'subtitles' | 'captions' | 'descriptions';
    default?: boolean;
}
export interface VideoMetadata {
    id?: string;
    title?: string;
    description?: string;
    duration?: number;
    thumbnailUrl?: string;
    posterUrl?: string;
}
export interface Quality {
    height: number;
    width: number;
    bitrate: number;
    label: string;
    index: number;
}
export interface PlayerState {
    isPlaying: boolean;
    isPaused: boolean;
    isBuffering: boolean;
    isEnded: boolean;
    isError: boolean;
    currentTime: number;
    duration: number;
    bufferedPercentage: number;
    volume: number;
    isMuted: boolean;
    playbackRate: number;
    currentQuality?: Quality;
    availableQualities: Quality[];
}
export interface PlayerEvents {
    onReady?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
    onEnded?: () => void;
    onTimeUpdate?: (time: number) => void;
    onBuffering?: (isBuffering: boolean) => void;
    onError?: (error: PlayerError) => void;
    onQualityChanged?: (quality: Quality) => void;
    onVolumeChanged?: (volume: number) => void;
    onFullscreenChanged?: (isFullscreen: boolean) => void;
    onProgress?: (buffered: number) => void;
    onSeeking?: () => void;
    onSeeked?: () => void;
    onLoadedMetadata?: (metadata: VideoMetadata) => void;
    onFreePreviewEnded?: () => void;
}
export interface PlayerError {
    code: string;
    message: string;
    type: 'network' | 'media' | 'drm' | 'unknown';
    fatal: boolean;
    details?: any;
}
export interface PaywallConfig {
    enabled: boolean;
    apiBase: string;
    userId: string;
    videoId: string;
    gateways: Array<'stripe' | 'cashfree'>;
    branding?: {
        title?: string;
        description?: string;
        logoUrl?: string;
        theme?: any;
    };
    popup?: {
        width?: number;
        height?: number;
    };
    emailAuth?: {
        enabled: boolean;
        skipIfAuthenticated?: boolean;
        sessionStorage?: {
            tokenKey?: string;
            refreshTokenKey?: string;
            userIdKey?: string;
        };
        api?: {
            requestOtp: string;
            verifyOtp: string;
            refreshToken?: string;
            logout?: string;
        };
        ui?: {
            title?: string;
            description?: string;
            emailPlaceholder?: string;
            otpPlaceholder?: string;
            submitButtonText?: string;
            resendButtonText?: string;
            resendCooldown?: number;
        };
        validation?: {
            otpLength?: number;
            otpTimeout?: number;
            rateLimiting?: {
                maxAttempts?: number;
                windowMinutes?: number;
            };
        };
    };
}
export interface PlayerConfig {
    autoPlay?: boolean;
    muted?: boolean;
    volume?: number;
    controls?: boolean;
    loop?: boolean;
    preload?: 'none' | 'metadata' | 'auto';
    crossOrigin?: 'anonymous' | 'use-credentials';
    playsInline?: boolean;
    defaultQuality?: number;
    enableAdaptiveBitrate?: boolean;
    debug?: boolean;
    freeDuration?: number;
    paywall?: PaywallConfig;
}
export interface IVideoPlayer {
    initialize(container: HTMLElement | string, config?: PlayerConfig): Promise<void>;
    destroy(): Promise<void>;
    load(source: VideoSource): Promise<void>;
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
    getState(): PlayerState;
    isPlaying(): boolean;
    isPaused(): boolean;
    isEnded(): boolean;
    enterFullscreen(): Promise<void>;
    exitFullscreen(): Promise<void>;
    toggleFullscreen(): Promise<void>;
    enterPictureInPicture(): Promise<void>;
    exitPictureInPicture(): Promise<void>;
    on(event: keyof PlayerEvents, handler: Function): void;
    off(event: keyof PlayerEvents, handler?: Function): void;
    once(event: keyof PlayerEvents, handler: Function): void;
    getSubtitles(): SubtitleTrack[];
    setSubtitleTrack(index: number): void;
    disableSubtitles(): void;
    setAudioTrack?(index: number): void;
    getAudioTracks?(): any[];
    getThumbnail?(time: number): string;
    getStats?(): any;
    setFreeDuration?(seconds: number): void;
    resetFreePreviewGate?(): void;
}
//# sourceMappingURL=IVideoPlayer.d.ts.map