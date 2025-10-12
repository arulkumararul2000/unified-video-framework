/**
 * Device Detection Utility
 * Detects device information for analytics
 */

import { DeviceDetectionResult, DeviceInfo, NetworkInfo } from '../types/AnalyticsTypes';

export class DeviceDetection {
  private static instance: DeviceDetection;

  static getInstance(): DeviceDetection {
    if (!DeviceDetection.instance) {
      DeviceDetection.instance = new DeviceDetection();
    }
    return DeviceDetection.instance;
  }

  /**
   * Detect device information
   */
  detectDevice(): DeviceDetectionResult {
    const userAgent = this.getUserAgent();
    
    return {
      deviceType: this.getDeviceType(userAgent),
      os: this.getOS(userAgent),
      osVersion: this.getOSVersion(userAgent),
      browser: this.getBrowser(userAgent),
      browserVersion: this.getBrowserVersion(userAgent),
      screen: this.getScreenInfo(),
      userAgent,
      isMobile: this.isMobile(userAgent),
      isTablet: this.isTablet(userAgent),
      isDesktop: this.isDesktop(userAgent),
      isSmartTV: this.isSmartTV(userAgent),
      isTizen: this.isTizen(userAgent),
      isWebOS: this.isWebOS(userAgent),
      isRoku: this.isRoku(userAgent)
    };
  }

  /**
   * Get device information in analytics format
   */
  getDeviceInfo(): DeviceInfo {
    const detection = this.detectDevice();
    
    return {
      deviceType: detection.deviceType,
      os: detection.os,
      osVersion: detection.osVersion,
      browser: detection.browser,
      browserVersion: detection.browserVersion,
      screen: detection.screen,
      userAgent: detection.userAgent,
      language: this.getLanguage(),
      timezone: this.getTimezone()
    };
  }

  /**
   * Get network information
   */
  getNetworkInfo(): NetworkInfo {
    const connection = this.getConnection();
    
    return {
      connectionType: connection?.type,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      online: navigator?.onLine ?? true
    };
  }

  private getUserAgent(): string {
    return typeof navigator !== 'undefined' ? navigator.userAgent : '';
  }

  private getDeviceType(userAgent: string): DeviceInfo['deviceType'] {
    if (this.isSmartTV(userAgent)) return 'smart_tv';
    if (this.isMobile(userAgent)) return 'mobile';
    if (this.isTablet(userAgent)) return 'tablet';
    return 'desktop';
  }

  private getOS(userAgent: string): string {
    if (/Windows NT/i.test(userAgent)) return 'Windows';
    if (/Mac OS X/i.test(userAgent)) return 'macOS';
    if (/Linux/i.test(userAgent)) return 'Linux';
    if (/Android/i.test(userAgent)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
    if (/Tizen/i.test(userAgent)) return 'Tizen';
    if (/webOS/i.test(userAgent)) return 'webOS';
    if (/Roku/i.test(userAgent)) return 'Roku';
    return 'Unknown';
  }

  private getOSVersion(userAgent: string): string | undefined {
    let match;
    
    // Windows
    match = userAgent.match(/Windows NT ([\d.]+)/);
    if (match) return match[1];
    
    // macOS
    match = userAgent.match(/Mac OS X ([\d_]+)/);
    if (match) return match[1].replace(/_/g, '.');
    
    // iOS
    match = userAgent.match(/OS ([\d_]+)/);
    if (match) return match[1].replace(/_/g, '.');
    
    // Android
    match = userAgent.match(/Android ([\d.]+)/);
    if (match) return match[1];
    
    // Tizen
    match = userAgent.match(/Tizen ([\d.]+)/);
    if (match) return match[1];
    
    return undefined;
  }

  private getBrowser(userAgent: string): string | undefined {
    if (/Chrome/i.test(userAgent) && !/Edge/i.test(userAgent)) return 'Chrome';
    if (/Firefox/i.test(userAgent)) return 'Firefox';
    if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) return 'Safari';
    if (/Edge/i.test(userAgent)) return 'Edge';
    if (/Opera/i.test(userAgent)) return 'Opera';
    if (/Samsung/i.test(userAgent)) return 'Samsung Internet';
    return undefined;
  }

  private getBrowserVersion(userAgent: string): string | undefined {
    let match;
    
    // Chrome
    match = userAgent.match(/Chrome\/([\d.]+)/);
    if (match && !/Edge/i.test(userAgent)) return match[1];
    
    // Firefox
    match = userAgent.match(/Firefox\/([\d.]+)/);
    if (match) return match[1];
    
    // Safari
    match = userAgent.match(/Version\/([\d.]+).*Safari/);
    if (match) return match[1];
    
    // Edge
    match = userAgent.match(/Edge\/([\d.]+)/);
    if (match) return match[1];
    
    // Opera
    match = userAgent.match(/Opera.*Version\/([\d.]+)/);
    if (match) return match[1];
    
    return undefined;
  }

  private getScreenInfo(): { width: number; height: number; orientation?: 'portrait' | 'landscape' } {
    if (typeof window === 'undefined' || !window.screen) {
      return { width: 1920, height: 1080 };
    }

    const orientation: 'portrait' | 'landscape' = window.screen.width > window.screen.height ? 'landscape' : 'portrait';
    
    return {
      width: window.screen.width,
      height: window.screen.height,
      orientation
    };
  }

  private getLanguage(): string {
    if (typeof navigator === 'undefined') return 'en-US';
    return navigator.language || 'en-US';
  }

  private getTimezone(): string {
    if (typeof Intl === 'undefined') return 'UTC';
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }

  private getConnection(): any {
    if (typeof navigator === 'undefined') return null;
    return (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  }

  private isMobile(userAgent: string): boolean {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  }

  private isTablet(userAgent: string): boolean {
    return /iPad|Android.*(?!.*Mobile)/i.test(userAgent);
  }

  private isDesktop(userAgent: string): boolean {
    return !this.isMobile(userAgent) && !this.isSmartTV(userAgent);
  }

  private isSmartTV(userAgent: string): boolean {
    return /Smart.*TV|Tizen|webOS|Roku|PlayStation|Xbox/i.test(userAgent);
  }

  private isTizen(userAgent: string): boolean {
    return /Tizen/i.test(userAgent);
  }

  private isWebOS(userAgent: string): boolean {
    return /webOS/i.test(userAgent);
  }

  private isRoku(userAgent: string): boolean {
    return /Roku/i.test(userAgent);
  }
}

// Global instance
export const deviceDetection = DeviceDetection.getInstance();