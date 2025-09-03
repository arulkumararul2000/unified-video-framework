import { PlatformType, PlatformInfo } from '../interfaces';

export class PlatformDetector {
  private cachedPlatform: PlatformInfo | null = null;

  detect(): PlatformInfo {
    if (this.cachedPlatform) {
      return this.cachedPlatform;
    }

    this.cachedPlatform = this.detectPlatform();
    return this.cachedPlatform;
  }

  private detectPlatform(): PlatformInfo {
    // Check if we're in React Native environment
    if (typeof window === 'undefined' || (global as any).nativeCallSyncHook) {
      return this.detectReactNativePlatform();
    }

    // Web environment detection
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      return this.detectWebPlatform();
    }

    // Default fallback
    return {
      type: PlatformType.WEB,
      os: 'unknown',
      version: 'unknown',
      isTV: false,
      isMobile: false,
      isDesktop: true
    };
  }

  private detectReactNativePlatform(): PlatformInfo {
    try {
      // This would be available in React Native environment
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
    } catch (e) {
      // If React Native is not available, fall back to web detection
      return this.detectWebPlatform();
    }
  }

  private detectWebPlatform(): PlatformInfo {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform?.toLowerCase() || '';

    // Tizen (Samsung TV)
    if (userAgent.includes('tizen') || (window as any).tizen) {
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

    // WebOS (LG TV)
    if (userAgent.includes('webos') || userAgent.includes('web0s') || (window as any).webOS) {
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

    // Roku
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

    // Windows/UWP
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

    // iOS (Safari on iPhone/iPad)
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

    // Android
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

    // Apple TV (tvOS browser)
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

    // Default to web
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

  private getTizenVersion(): string {
    try {
      if ((window as any).tizen && (window as any).tizen.systeminfo) {
        return (window as any).tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version');
      }
    } catch (e) {
      console.error('Failed to get Tizen version:', e);
    }
    return 'unknown';
  }

  private getWebOSVersion(): string {
    try {
      if ((window as any).webOS && (window as any).webOS.systemInfo) {
        return (window as any).webOS.systemInfo.version;
      }
    } catch (e) {
      console.error('Failed to get webOS version:', e);
    }
    return 'unknown';
  }

  private getRokuVersion(userAgent: string): string {
    const match = userAgent.match(/roku\/dvp-(\d+\.\d+)/);
    return match ? match[1] : 'unknown';
  }

  private getWindowsVersion(userAgent: string): string {
    if (userAgent.includes('windows nt 10.0')) return '10';
    if (userAgent.includes('windows nt 6.3')) return '8.1';
    if (userAgent.includes('windows nt 6.2')) return '8';
    if (userAgent.includes('windows nt 6.1')) return '7';
    return 'unknown';
  }

  private getIOSVersion(userAgent: string): string {
    const match = userAgent.match(/os (\d+)_(\d+)_?(\d+)?/);
    if (match) {
      return `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}`;
    }
    return 'unknown';
  }

  private getAndroidVersion(userAgent: string): string {
    const match = userAgent.match(/android (\d+\.?\d*)/);
    return match ? match[1] : 'unknown';
  }

  private getOS(): string {
    const platform = navigator.platform?.toLowerCase() || '';
    const userAgent = navigator.userAgent.toLowerCase();

    if (platform.includes('mac')) return 'macos';
    if (platform.includes('win')) return 'windows';
    if (platform.includes('linux')) return 'linux';
    if (userAgent.includes('cros')) return 'chromeos';
    
    return 'unknown';
  }

  private isMobileWeb(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    return mobileRegex.test(userAgent) || this.isSmallScreen();
  }

  private isSmallScreen(): boolean {
    return window.innerWidth <= 768 && window.innerHeight <= 1024;
  }

  private hasTouchSupport(): boolean {
    return 'ontouchstart' in window || 
           navigator.maxTouchPoints > 0 || 
           (navigator as any).msMaxTouchPoints > 0;
  }

  private getScreenSize(): { width: number; height: number } {
    return {
      width: window.screen?.width || window.innerWidth,
      height: window.screen?.height || window.innerHeight
    };
  }

  // Utility methods for specific platform checks
  isTV(): boolean {
    return this.detect().isTV;
  }

  isMobile(): boolean {
    return this.detect().isMobile;
  }

  isDesktop(): boolean {
    return this.detect().isDesktop || false;
  }

  isApple(): boolean {
    const platform = this.detect().type;
    return [PlatformType.IOS, PlatformType.APPLE_TV].includes(platform);
  }

  isAndroid(): boolean {
    const platform = this.detect().type;
    return [PlatformType.ANDROID, PlatformType.ANDROID_TV].includes(platform);
  }

  isSamsung(): boolean {
    return this.detect().type === PlatformType.TIZEN;
  }

  isLG(): boolean {
    return this.detect().type === PlatformType.WEBOS;
  }

  isRoku(): boolean {
    return this.detect().type === PlatformType.ROKU;
  }

  // Clear cached platform info (useful for testing)
  clearCache(): void {
    this.cachedPlatform = null;
  }
}
