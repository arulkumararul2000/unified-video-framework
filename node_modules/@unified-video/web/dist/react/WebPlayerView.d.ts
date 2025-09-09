import React from 'react';
import type { CSSProperties } from 'react';
import type { SubtitleTrack, VideoMetadata } from '@unified-video/core';
import { WebPlayer } from '../WebPlayer';
export type WebPlayerViewProps = {
    autoPlay?: boolean;
    muted?: boolean;
    enableAdaptiveBitrate?: boolean;
    debug?: boolean;
    freeDuration?: number;
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
};
export declare const WebPlayerView: React.FC<WebPlayerViewProps>;
export default WebPlayerView;
//# sourceMappingURL=WebPlayerView.d.ts.map