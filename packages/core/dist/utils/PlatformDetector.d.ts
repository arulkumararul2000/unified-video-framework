import { PlatformInfo } from '../interfaces';
export declare class PlatformDetector {
    private cachedPlatform;
    detect(): PlatformInfo;
    private detectPlatform;
    private detectReactNativePlatform;
    private detectWebPlatform;
    private getTizenVersion;
    private getWebOSVersion;
    private getRokuVersion;
    private getWindowsVersion;
    private getIOSVersion;
    private getAndroidVersion;
    private getOS;
    private isMobileWeb;
    private isSmallScreen;
    private hasTouchSupport;
    private getScreenSize;
    isTV(): boolean;
    isMobile(): boolean;
    isDesktop(): boolean;
    isApple(): boolean;
    isAndroid(): boolean;
    isSamsung(): boolean;
    isLG(): boolean;
    isRoku(): boolean;
    clearCache(): void;
}
//# sourceMappingURL=PlatformDetector.d.ts.map