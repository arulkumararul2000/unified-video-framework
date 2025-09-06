/**
 * Factory for creating video player instances based on platform
 */

import { IVideoPlayer, PlayerConfig } from './interfaces/IVideoPlayer';

export type Platform = 
  | 'web'
  | 'ios' 
  | 'android'
  | 'tizen'
  | 'webos'
  | 'roku'
  | 'androidtv'
  | 'appletv'
  | 'windows';

export class VideoPlayerFactory {
  /**
   * Create a video player instance for the specified platform
   */
  static async create(
    platform: Platform,
    container: HTMLElement | string | any,
    config?: PlayerConfig
  ): Promise<IVideoPlayer> {
    // Dynamic imports will be resolved at runtime
    // This allows the factory to work even if not all platform packages are installed
    
    switch (platform) {
      case 'web':
        // Dynamic imports will be resolved at runtime when the package is available
        try {
          const WebModule = await (eval('import("@unified-video/web")') as Promise<any>);
          if (WebModule?.WebPlayer) {
            const player = new WebModule.WebPlayer();
            await player.initialize(container, config);
            return player;
          }
        } catch (e) {
          // Package not installed or not available
        }
        break;
        
      case 'ios':
      case 'android':
        try {
          const RNModule = await (eval('import("@unified-video/react-native")') as Promise<any>);
          if (RNModule?.ReactNativePlayer) {
            // React Native player is a component, handle differently
            return RNModule.ReactNativePlayer;
          }
        } catch (e) {
          // Package not installed or not available
        }
        break;
        
      case 'tizen':
      case 'webos':
        try {
          const EnactModule = await (eval('import("@unified-video/enact")') as Promise<any>);
          if (EnactModule?.EnactPlayer) {
            const player = new EnactModule.EnactPlayer();
            await player.initialize(container, config);
            return player;
          }
        } catch (e) {
          // Package not installed or not available
        }
        break;
        
      case 'roku':
        try {
          const RokuModule = await (eval('import("@unified-video/roku")') as Promise<any>);
          if (RokuModule?.RokuPlayer) {
            const player = new RokuModule.RokuPlayer();
            await player.initialize(container, config);
            return player;
          }
        } catch (e) {
          // Package not installed or not available
        }
        break;
        
      default:
        throw new Error(`Platform '${platform}' is not supported`);
    }
    
    throw new Error(`Failed to load player for platform '${platform}'`);
  }
  
  /**
   * Detect the current platform
   */
  static detectPlatform(): Platform {
    // Check if running in React Native
    if (typeof global !== 'undefined' && (global as any).nativeCallSyncHook) {
      // React Native environment
      try {
        // Use eval to prevent webpack from trying to resolve react-native
        const RN = eval('require("react-native")');
        if (RN && RN.Platform) {
          return RN.Platform.OS as Platform;
        }
      } catch (e) {
        // React Native not available, fall through to other checks
      }
    }
    
    // Check if running in browser
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      
      // Check for Smart TV platforms
      if (userAgent.includes('tizen')) return 'tizen';
      if (userAgent.includes('webos')) return 'webos';
      if (userAgent.includes('roku')) return 'roku';
      
      // Check for mobile browsers (might be Android TV)
      if (userAgent.includes('android') && userAgent.includes('tv')) {
        return 'androidtv';
      }
      
      // Check for Apple TV
      if (userAgent.includes('appletv')) return 'appletv';
      
      // Check for Windows
      if (userAgent.includes('windows')) return 'windows';
      
      // Default to web
      return 'web';
    }
    
    // Check if running in Node.js (server-side)
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      return 'web'; // Default to web for SSR
    }
    
    throw new Error('Unable to detect platform');
  }
  
  /**
   * Create a video player for the current platform
   */
  static async createForCurrentPlatform(
    container: HTMLElement | string | any,
    config?: PlayerConfig
  ): Promise<IVideoPlayer> {
    const platform = this.detectPlatform();
    return this.create(platform, container, config);
  }
}
