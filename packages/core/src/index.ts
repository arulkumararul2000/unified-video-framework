/**
 * @unified-video/core
 * Core interfaces and implementations for the Unified Video Framework
 */

// Export all interfaces
export * from './interfaces';

// Export base classes
export { BasePlayer } from './BasePlayer';

// Export factory
export { VideoPlayerFactory } from './VideoPlayerFactory';
export type { Platform } from './VideoPlayerFactory';

// Export utilities
export { EventEmitter } from './utils/EventEmitter';

// Export chapter manager
export { ChapterManager } from './chapter-manager';
export type { ChapterManagerEvents } from './chapter-manager';

// Export version
export const VERSION = '1.0.0';
