/**
 * @unified-video/enact
 * Enact TV implementation for Samsung Tizen and LG webOS
 */

// Export main video player
export { default as VideoPlayer } from './VideoPlayer';

// Export TV-specific adapters
export { default as TizenAdapter } from './adapters/TizenAdapter';

// Export TV utilities
export const TVUtils = {
  /**
   * Check if running on Samsung Tizen TV
   */
  isTizen: () => {
    return typeof window !== 'undefined' && window.tizen !== undefined;
  },

  /**
   * Check if running on LG webOS TV
   */
  isWebOS: () => {
    return typeof window !== 'undefined' && window.webOS !== undefined;
  },

  /**
   * Get TV platform info
   */
  getPlatformInfo: () => {
    if (TVUtils.isTizen()) {
      return {
        platform: 'tizen',
        version: window.tizen?.systeminfo?.getCapability('http://tizen.org/feature/platform.version')
      };
    }
    if (TVUtils.isWebOS()) {
      return {
        platform: 'webos',
        version: window.webOS?.platform?.tv?.version
      };
    }
    return {
      platform: 'unknown',
      version: null
    };
  },

  /**
   * Register TV remote key handlers
   */
  registerRemoteKeys: () => {
    if (TVUtils.isTizen()) {
      // Register Tizen remote control keys
      if (window.tizen && window.tizen.tvinputdevice) {
        const keys = [
          'MediaPlayPause',
          'MediaPlay',
          'MediaPause',
          'MediaStop',
          'MediaFastForward',
          'MediaRewind'
        ];
        keys.forEach(key => {
          try {
            window.tizen.tvinputdevice.registerKey(key);
          } catch (e) {
            console.warn(`Failed to register key: ${key}`);
          }
        });
      }
    }
    // webOS handles keys automatically
  }
};

// Export version
export const VERSION = '1.0.0';

// Export platform identifier
export const PLATFORM = 'tv';
