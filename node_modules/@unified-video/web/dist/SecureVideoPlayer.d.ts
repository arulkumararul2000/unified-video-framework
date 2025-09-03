import { WebPlayer } from './WebPlayer';
import { PlayerConfig } from '@unified-video/core';
export interface SecurePlayerConfig extends PlayerConfig {
    drm?: {
        widevine?: {
            licenseUrl: string;
            certificateUrl?: string;
            headers?: Record<string, string>;
        };
        fairplay?: {
            licenseUrl: string;
            certificateUrl: string;
            headers?: Record<string, string>;
        };
        playready?: {
            licenseUrl: string;
            headers?: Record<string, string>;
        };
    };
    security?: {
        token: string;
        otp?: string;
        preventScreenCapture?: boolean;
        preventInspect?: boolean;
        domainLock?: string[];
        ipWhitelist?: string[];
        maxConcurrentStreams?: number;
        sessionTimeout?: number;
    };
    watermark?: {
        text?: string;
        email?: string;
        userId?: string;
        ip?: string;
        opacity?: number;
        fontSize?: number;
        fontColor?: string;
        position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'random';
        moving?: boolean;
        interval?: number;
        blinking?: boolean;
    };
    analytics?: {
        enabled?: boolean;
        endpoint?: string;
        interval?: number;
        customData?: Record<string, any>;
    };
    features?: {
        speedControl?: boolean;
        qualitySelector?: boolean;
        chapters?: boolean;
        thumbnailPreview?: boolean;
        keyboardShortcuts?: boolean;
        gestureControl?: boolean;
        chromecast?: boolean;
        airplay?: boolean;
    };
}
export interface DRMConfig {
    server: string;
    headers?: Record<string, string>;
    withCredentials?: boolean;
    certificateUrl?: string;
}
export interface WatermarkLayer {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    animationFrame?: number;
}
export interface AnalyticsEvent {
    eventType: string;
    timestamp: number;
    sessionId: string;
    videoId?: string;
    userId?: string;
    data: Record<string, any>;
}
export declare class SecureVideoPlayer extends WebPlayer {
    private secureConfig;
    private watermarkLayer?;
    private analyticsTimer?;
    private sessionId;
    private heartbeatTimer?;
    private qualityMenu?;
    private customControls?;
    private thumbnailPreview?;
    private analyticsData;
    private watchStartTime;
    private totalWatchTime;
    private lastSeekPosition;
    private bufferingStartTime;
    private totalBufferingTime;
    private screenRecordingProtection?;
    constructor();
    protected setupPlayer(): Promise<void>;
    initialize(container: HTMLElement | string, config?: SecurePlayerConfig): Promise<void>;
    private applySecurityMeasures;
    private preventInspection;
    private handleDevToolsOpen;
    private preventScreenCapture;
    private detectScreenRecording;
    private handleScreenRecordingDetected;
    private disableTextSelection;
    private validateDomain;
    private validateToken;
    private configureDRM;
    private setupEME;
    private setupLicenseRequest;
    private getLicenseUrl;
    private requestLicense;
    private getLicenseHeaders;
    private setupShakaPlayer;
    protected setupWatermark(): void;
    private renderWatermark;
    private buildWatermarkText;
    private calculateWatermarkPosition;
    private setupAnalytics;
    private setupAnalyticsTracking;
    private trackEvent;
    private reportAnalytics;
    private setupCustomControls;
    private createQualitySelector;
    private createSpeedControl;
    protected setupKeyboardShortcuts(): void;
    private startHeartbeat;
    private sendHeartbeat;
    private generateSessionId;
    destroy(): Promise<void>;
}
export default SecureVideoPlayer;
//# sourceMappingURL=SecureVideoPlayer.d.ts.map