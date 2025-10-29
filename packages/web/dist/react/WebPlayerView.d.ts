import React from 'react';
import type { CSSProperties } from 'react';
import type { SubtitleTrack, VideoMetadata } from '../../core/dist';
import { WebPlayer } from '../WebPlayer';
import type { EPGData, EPGConfig, EPGProgram, EPGProgramRow } from './types/EPGTypes';
export interface ChapterAPI {
    loadChapters: (chapters: any) => Promise<void>;
    loadChaptersFromUrl: (url: string) => Promise<void>;
    getCurrentSegment: () => any | null;
    skipToSegment: (segmentId: string) => void;
    getSegments: () => any[];
    updateChapterConfig: (config: any) => void;
    hasChapters: () => boolean;
    getChapters: () => any | null;
    getCoreChapters: () => any[];
    getCoreSegments: () => any[];
    getCurrentChapterInfo: () => any | null;
    seekToChapter: (chapterId: string) => void;
    getNextChapter: () => any | null;
    getPreviousChapter: () => any | null;
}
export interface QualityAPI {
    getQualities: () => any[];
    getCurrentQuality: () => any | null;
    setQuality: (index: number) => void;
    setAutoQuality: (enabled: boolean) => void;
}
export interface EPGControlAPI {
    setEPGData: (data: any) => void;
    showEPGButton: () => void;
    hideEPGButton: () => void;
    isEPGButtonVisible: () => boolean;
}
export interface UIHelperAPI {
    focusPlayer: () => void;
    showFullscreenTip: () => void;
    triggerFullscreenButton: () => void;
    showTemporaryMessage: (message: string) => void;
    showFullscreenInstructions: () => void;
    enterFullscreenSynchronously: () => void;
}
export interface FullscreenAPI {
    enterFullscreen: () => Promise<void>;
    exitFullscreen: () => Promise<void>;
    toggleFullscreen: () => Promise<void>;
    enterPictureInPicture: () => Promise<void>;
    exitPictureInPicture: () => Promise<void>;
}
export interface PlaybackAPI {
    play: () => Promise<void>;
    pause: () => void;
    requestPause: () => void;
    seek: (time: number) => void;
    setVolume: (level: number) => void;
    mute: () => void;
    unmute: () => void;
    toggleMute: () => void;
    setPlaybackRate: (rate: number) => void;
    getPlaybackRate: () => number;
    getCurrentTime: () => number;
    getDuration: () => number;
    getState: () => any;
}
export type WebPlayerViewProps = {
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
    customControls?: boolean;
    settings?: {
        enabled?: boolean;
        speed?: boolean;
        quality?: boolean;
        subtitles?: boolean;
    };
    qualityFilter?: {
        allowedHeights?: number[];
        allowedLabels?: string[];
        minHeight?: number;
        maxHeight?: number;
    };
    premiumQualities?: {
        enabled?: boolean;
        requiredHeights?: number[];
        requiredLabels?: string[];
        minPremiumHeight?: number;
        isPremiumUser?: boolean;
        premiumLabel?: string;
        onPremiumQualityClick?: (quality: {
            height: number;
            label: string;
        }) => void;
        unlockUrl?: string;
    };
    showFrameworkBranding?: boolean;
    watermark?: boolean | {
        enabled?: boolean;
        text?: string;
        showTime?: boolean;
        updateInterval?: number;
        randomPosition?: boolean;
        position?: {
            x?: number | 'left' | 'center' | 'right' | 'random';
            y?: number | 'top' | 'center' | 'bottom' | 'random';
        };
        style?: {
            fontSize?: number;
            fontFamily?: string;
            opacity?: number;
            color?: string;
            gradientColors?: [string, string];
        };
    };
    paywall?: import('../../core/dist').PaywallConfig;
    paywallConfigUrl?: string;
    emailAuth?: {
        enabled?: boolean;
        skipIfAuthenticated?: boolean;
        apiEndpoints?: {
            requestOtp?: string;
            verifyOtp?: string;
            refreshToken?: string;
            logout?: string;
        };
        sessionStorage?: {
            tokenKey?: string;
            refreshTokenKey?: string;
            userIdKey?: string;
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
    url: string;
    type?: 'mp4' | 'hls' | 'dash' | 'webm' | 'auto';
    subtitles?: SubtitleTrack[];
    metadata?: VideoMetadata;
    cast?: boolean;
    className?: string;
    style?: CSSProperties;
    playerTheme?: string | {
        accent?: string;
        accent2?: string;
        iconColor?: string;
        textPrimary?: string;
        textSecondary?: string;
    };
    responsive?: {
        enabled?: boolean;
        aspectRatio?: number;
        maxWidth?: string;
        maxHeight?: string;
        breakpoints?: {
            mobile?: number;
            tablet?: number;
        };
        mobilePortrait?: {
            maxHeight?: string;
            aspectRatio?: number;
        };
        mobileLandscape?: {
            maxHeight?: string;
            aspectRatio?: number;
        };
        tablet?: {
            maxWidth?: string;
            maxHeight?: string;
        };
    };
    settingsScrollbar?: {
        style?: 'default' | 'compact' | 'overlay';
        widthPx?: number;
        intensity?: number;
    };
    autoFocusPlayer?: boolean;
    showFullscreenTipOnMount?: boolean;
    playerRef?: React.RefObject<WebPlayer>;
    onChapterAPI?: (api: ChapterAPI) => void;
    onQualityAPI?: (api: QualityAPI) => void;
    onEPGAPI?: (api: EPGControlAPI) => void;
    onUIHelperAPI?: (api: UIHelperAPI) => void;
    onFullscreenAPI?: (api: FullscreenAPI) => void;
    onPlaybackAPI?: (api: PlaybackAPI) => void;
    onReady?: (player: WebPlayer) => void;
    onError?: (error: unknown) => void;
    onPlay?: () => void;
    onPause?: () => void;
    onEnded?: () => void;
    onTimeUpdate?: (data: {
        currentTime: number;
        duration: number;
    }) => void;
    onProgress?: (data: {
        buffered: number;
    }) => void;
    onVolumeChange?: (data: {
        volume: number;
        muted: boolean;
    }) => void;
    onQualityChange?: (quality: any) => void;
    onBuffering?: (isBuffering: boolean) => void;
    onFullscreenChange?: (isFullscreen: boolean) => void;
    onPictureInPictureChange?: (isPiP: boolean) => void;
    epg?: EPGData;
    epgConfig?: Partial<EPGConfig>;
    showEPG?: boolean;
    onToggleEPG?: (visible: boolean) => void;
    onEPGFavorite?: (program: EPGProgram, channel: EPGProgramRow) => void | Promise<void>;
    onEPGRecord?: (program: EPGProgram, channel: EPGProgramRow) => void | Promise<void>;
    onEPGSetReminder?: (program: EPGProgram, channel: EPGProgramRow) => void | Promise<void>;
    onEPGCatchup?: (program: EPGProgram, channel: EPGProgramRow) => void | Promise<void>;
    onEPGProgramSelect?: (program: EPGProgram, channel: EPGProgramRow) => void;
    onEPGChannelSelect?: (channel: EPGProgramRow) => void;
    chapters?: {
        enabled?: boolean;
        data?: {
            videoId: string;
            duration: number;
            segments: Array<{
                id: string;
                type: 'intro' | 'recap' | 'content' | 'credits' | 'ad' | 'sponsor' | 'offensive';
                startTime: number;
                endTime: number;
                title: string;
                skipLabel?: string;
                description?: string;
                thumbnail?: string;
                autoSkip?: boolean;
                autoSkipDelay?: number;
                metadata?: Record<string, any>;
            }>;
        };
        dataUrl?: string;
        autoHide?: boolean;
        autoHideDelay?: number;
        showChapterMarkers?: boolean;
        skipButtonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
        customStyles?: {
            skipButton?: {
                backgroundColor?: string;
                borderColor?: string;
                textColor?: string;
                fontSize?: string;
                borderRadius?: string;
                padding?: string;
                fontWeight?: string;
            };
            progressMarkers?: {
                intro?: string;
                recap?: string;
                credits?: string;
                ad?: string;
            };
        };
        userPreferences?: {
            autoSkipIntro?: boolean;
            autoSkipRecap?: boolean;
            autoSkipCredits?: boolean;
            showSkipButtons?: boolean;
            skipButtonTimeout?: number;
            rememberChoices?: boolean;
            resumePlaybackAfterSkip?: boolean;
        };
    };
    navigation?: {
        backButton?: {
            enabled?: boolean;
            icon?: 'arrow' | 'chevron' | 'custom';
            customIcon?: string;
            title?: string;
            ariaLabel?: string;
            onClick?: () => void | Promise<void>;
            href?: string;
            replace?: boolean;
        };
        closeButton?: {
            enabled?: boolean;
            icon?: 'x' | 'close' | 'custom';
            customIcon?: string;
            title?: string;
            ariaLabel?: string;
            onClick?: () => void | Promise<void>;
            exitFullscreen?: boolean;
            closeModal?: boolean;
        };
    };
    onNavigationBackClicked?: () => void;
    onNavigationCloseClicked?: () => void;
    googleAds?: {
        adTagUrl: string;
        midrollTimes?: number[];
        companionAdSlots?: Array<{
            containerId: string;
            width: number;
            height: number;
        }>;
        onAdStart?: () => void;
        onAdEnd?: () => void;
        onAdError?: (error: any) => void;
        onAllAdsComplete?: () => void;
    };
    onChapterChange?: (chapter: any) => void;
    onSegmentEntered?: (segment: any) => void;
    onSegmentExited?: (segment: any) => void;
    onSegmentSkipped?: (segment: any) => void;
    onChapterSegmentEntered?: (data: {
        segment: any;
        timestamp: number;
    }) => void;
    onChapterSegmentSkipped?: (data: {
        fromSegment: any;
        toSegment?: any;
        timestamp: number;
    }) => void;
    onChapterSkipButtonShown?: (data: {
        segment: any;
        position: string;
    }) => void;
    onChapterSkipButtonHidden?: (data: {
        segment: any;
        reason: string;
    }) => void;
    onChaptersLoaded?: (data: {
        segmentCount: number;
        chapters: any[];
    }) => void;
    onChaptersLoadError?: (data: {
        error: Error;
        url?: string;
    }) => void;
};
export declare const WebPlayerView: React.FC<WebPlayerViewProps>;
export default WebPlayerView;
//# sourceMappingURL=WebPlayerView.d.ts.map