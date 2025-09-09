import { PlatformType } from '../interfaces';
export class PlatformDetector {
    constructor() {
        this.cachedPlatform = null;
    }
    detect() {
        if (this.cachedPlatform) {
            return this.cachedPlatform;
        }
        this.cachedPlatform = this.detectPlatform();
        return this.cachedPlatform;
    }
    detectPlatform() {
        if (typeof window === 'undefined' || global.nativeCallSyncHook) {
            return this.detectReactNativePlatform();
        }
        if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
            return this.detectWebPlatform();
        }
        return {
            type: PlatformType.WEB,
            os: 'unknown',
            version: 'unknown',
            isTV: false,
            isMobile: false,
            isDesktop: true
        };
    }
    detectReactNativePlatform() {
        try {
            const { Platform } = require('react-native');
            if (Platform.isTV) {
                return {
                    type: Platform.OS === 'ios' ? PlatformType.APPLE_TV : PlatformType.ANDROID_TV,
                    os: Platform.OS,
                    version: Platform.Version?.toString() || 'unknown',
                    isTV: true,
                    isMobile: false,
                    isDesktop: false
                };
            }
            return {
                type: Platform.OS === 'ios' ? PlatformType.IOS : PlatformType.ANDROID,
                os: Platform.OS,
                version: Platform.Version?.toString() || 'unknown',
                isTV: false,
                isMobile: true,
                isDesktop: false
            };
        }
        catch (e) {
            return this.detectWebPlatform();
        }
    }
    detectWebPlatform() {
        const userAgent = navigator.userAgent.toLowerCase();
        const platform = navigator.platform?.toLowerCase() || '';
        if (userAgent.includes('tizen') || window.tizen) {
            return {
                type: PlatformType.TIZEN,
                os: 'tizen',
                version: this.getTizenVersion(),
                isTV: true,
                isMobile: false,
                isDesktop: false,
                screenSize: this.getScreenSize()
            };
        }
        if (userAgent.includes('webos') || userAgent.includes('web0s') || window.webOS) {
            return {
                type: PlatformType.WEBOS,
                os: 'webos',
                version: this.getWebOSVersion(),
                isTV: true,
                isMobile: false,
                isDesktop: false,
                screenSize: this.getScreenSize()
            };
        }
        if (userAgent.includes('roku')) {
            return {
                type: PlatformType.ROKU,
                os: 'roku',
                version: this.getRokuVersion(userAgent),
                isTV: true,
                isMobile: false,
                isDesktop: false
            };
        }
        if (platform.includes('win') || userAgent.includes('windows')) {
            return {
                type: PlatformType.WINDOWS,
                os: 'windows',
                version: this.getWindowsVersion(userAgent),
                isTV: false,
                isMobile: false,
                isDesktop: true,
                hasTouch: this.hasTouchSupport(),
                screenSize: this.getScreenSize()
            };
        }
        if (/iphone|ipad|ipod/.test(userAgent) ||
            (platform === 'macintel' && navigator.maxTouchPoints > 1)) {
            return {
                type: PlatformType.IOS,
                os: 'ios',
                version: this.getIOSVersion(userAgent),
                isTV: false,
                isMobile: true,
                isDesktop: false,
                hasTouch: true,
                screenSize: this.getScreenSize()
            };
        }
        if (userAgent.includes('android')) {
            const isTV = userAgent.includes('tv') || userAgent.includes('aft');
            return {
                type: isTV ? PlatformType.ANDROID_TV : PlatformType.ANDROID,
                os: 'android',
                version: this.getAndroidVersion(userAgent),
                isTV: isTV,
                isMobile: !isTV,
                isDesktop: false,
                hasTouch: !isTV,
                screenSize: this.getScreenSize()
            };
        }
        if (userAgent.includes('appletv')) {
            return {
                type: PlatformType.APPLE_TV,
                os: 'tvos',
                version: 'unknown',
                isTV: true,
                isMobile: false,
                isDesktop: false
            };
        }
        return {
            type: PlatformType.WEB,
            os: this.getOS(),
            version: 'unknown',
            isTV: false,
            isMobile: this.isMobileWeb(),
            isDesktop: !this.isMobileWeb(),
            hasTouch: this.hasTouchSupport(),
            screenSize: this.getScreenSize()
        };
    }
    getTizenVersion() {
        try {
            if (window.tizen && window.tizen.systeminfo) {
                return window.tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version');
            }
        }
        catch (e) {
            console.error('Failed to get Tizen version:', e);
        }
        return 'unknown';
    }
    getWebOSVersion() {
        try {
            if (window.webOS && window.webOS.systemInfo) {
                return window.webOS.systemInfo.version;
            }
        }
        catch (e) {
            console.error('Failed to get webOS version:', e);
        }
        return 'unknown';
    }
    getRokuVersion(userAgent) {
        const match = userAgent.match(/roku\/dvp-(\d+\.\d+)/);
        return match ? match[1] : 'unknown';
    }
    getWindowsVersion(userAgent) {
        if (userAgent.includes('windows nt 10.0'))
            return '10';
        if (userAgent.includes('windows nt 6.3'))
            return '8.1';
        if (userAgent.includes('windows nt 6.2'))
            return '8';
        if (userAgent.includes('windows nt 6.1'))
            return '7';
        return 'unknown';
    }
    getIOSVersion(userAgent) {
        const match = userAgent.match(/os (\d+)_(\d+)_?(\d+)?/);
        if (match) {
            return `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}`;
        }
        return 'unknown';
    }
    getAndroidVersion(userAgent) {
        const match = userAgent.match(/android (\d+\.?\d*)/);
        return match ? match[1] : 'unknown';
    }
    getOS() {
        const platform = navigator.platform?.toLowerCase() || '';
        const userAgent = navigator.userAgent.toLowerCase();
        if (platform.includes('mac'))
            return 'macos';
        if (platform.includes('win'))
            return 'windows';
        if (platform.includes('linux'))
            return 'linux';
        if (userAgent.includes('cros'))
            return 'chromeos';
        return 'unknown';
    }
    isMobileWeb() {
        const userAgent = navigator.userAgent.toLowerCase();
        const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
        return mobileRegex.test(userAgent) || this.isSmallScreen();
    }
    isSmallScreen() {
        return window.innerWidth <= 768 && window.innerHeight <= 1024;
    }
    hasTouchSupport() {
        return 'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            navigator.msMaxTouchPoints > 0;
    }
    getScreenSize() {
        return {
            width: window.screen?.width || window.innerWidth,
            height: window.screen?.height || window.innerHeight
        };
    }
    isTV() {
        return this.detect().isTV;
    }
    isMobile() {
        return this.detect().isMobile;
    }
    isDesktop() {
        return this.detect().isDesktop || false;
    }
    isApple() {
        const platform = this.detect().type;
        return [PlatformType.IOS, PlatformType.APPLE_TV].includes(platform);
    }
    isAndroid() {
        const platform = this.detect().type;
        return [PlatformType.ANDROID, PlatformType.ANDROID_TV].includes(platform);
    }
    isSamsung() {
        return this.detect().type === PlatformType.TIZEN;
    }
    isLG() {
        return this.detect().type === PlatformType.WEBOS;
    }
    isRoku() {
        return this.detect().type === PlatformType.ROKU;
    }
    clearCache() {
        this.cachedPlatform = null;
    }
}
//# sourceMappingURL=PlatformDetector.js.map