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
    onReady?: (player: WebPlayer) => void;
    onError?: (error: unknown) => void;
};
export declare const WebPlayerView: React.FC<WebPlayerViewProps>;
export default WebPlayerView;
//# sourceMappingURL=WebPlayerView.d.ts.map