/**
 * @unified-video/web
 * Web implementation of the Unified Video Framework
 */

// Re-export core interfaces for convenience
export * from '../../core/dist/index';

// Export web player implementation
export { WebPlayer } from './WebPlayer';
export { WebPlayerView } from './react/WebPlayerView';
export { SecureVideoPlayer } from './SecureVideoPlayer';

// Export EPG (Electronic Program Guide) components
export * from './react/EPG';

// Version
export const VERSION = '1.0.0';
