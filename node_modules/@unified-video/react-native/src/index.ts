/**
 * @unified-video/react-native
 * React Native implementation for iOS and Android
 */

// Export main video player
export { ReactNativeVideoPlayer, VideoPlayer } from './VideoPlayer';

// Re-export core types for convenience
export type {
  VideoSource,
  VideoPlayerConfig,
  VideoPlayerInterface,
  DRMConfig,
  SubtitleTrack,
  AudioTrack,
  Quality,
  PlayerStateEnum as PlayerState,
  PlayerEvent,
  PlayerError,
  PlayerMetrics
} from '@unified-video/core';

// Export version
export const VERSION = '1.0.0';

// Export platform identifier
export const PLATFORM = 'react-native';
