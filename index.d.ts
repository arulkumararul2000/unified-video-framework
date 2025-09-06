/**
 * Unified Video Framework - TypeScript Definitions
 */

export * from './packages/core/dist/index';
export * from './packages/web/dist/index';

// Re-export the main classes
export { VideoPlayerFactory, BasePlayer } from './packages/core/dist/index';
export { WebPlayer, WebPlayerView } from './packages/web/dist/index';

// Export namespaces for sub-packages
export * as core from './packages/core/dist/index';
export * as web from './packages/web/dist/index';
