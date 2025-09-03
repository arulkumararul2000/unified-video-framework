/**
 * @unified-video/web
 * Web implementation of the Unified Video Framework
 */

// Re-export core interfaces for convenience
export * from '@unified-video/core';

// Export web player implementation
export { WebPlayer } from './WebPlayer';
export { WebPlayerView } from './react/WebPlayerView';

// Version
export const VERSION = '1.0.0';
