import React from 'react';
import type { CSSProperties } from 'react';
import type { SubtitleTrack, VideoMetadata } from '@unified-video/core';
import { WebPlayer } from '../WebPlayer';
import type { EPGData, EPGConfig, EPGProgram, EPGProgramRow } from './types/EPGTypes';
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
    paywall?: import('@unified-video/core').PaywallConfig;
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
    onReady?: (player: WebPlayer) => void;
    onError?: (error: unknown) => void;
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
};
export declare const WebPlayerView: React.FC<WebPlayerViewProps>;
export default WebPlayerView;
//# sourceMappingURL=WebPlayerView.d.ts.map