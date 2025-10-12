/**
 * Video Player Analytics - Main module exports
 * Comprehensive analytics tracking for video players with dynamic provider support
 */

import { DynamicAnalyticsConfig } from './types/AnalyticsTypes';
import { DynamicAnalyticsManager } from './core/DynamicAnalyticsManager';

// Main analytics manager
export { DynamicAnalyticsManager } from './core/DynamicAnalyticsManager';

// Core classes
export { PlayerAnalytics, createPlayerAnalytics } from './core/PlayerAnalytics';
export { EventBatcher, createEventBatcher } from './core/EventBatcher';
export { 
  AnalyticsProvider, 
  createAnalyticsProvider, 
  getDefaultAnalyticsConfig,
  createPlayerAnalyticsProviderConfig,
  validateAnalyticsConfig,
  mergeAnalyticsConfigs
} from './core/AnalyticsProvider';

// Analytics Adapters
export { PlayerAnalyticsAdapter } from './adapters/PlayerAnalyticsAdapter';

// All types
export * from './types/AnalyticsTypes';

// Utilities
export { DeviceDetection, deviceDetection } from './utils/DeviceDetection';

// Factory function for easy setup
export function createDynamicAnalyticsManager(config: DynamicAnalyticsConfig): DynamicAnalyticsManager {
  return new DynamicAnalyticsManager(config);
}

// Re-export commonly used types and enums for convenience
export { AnalyticsProviderType } from './types/AnalyticsTypes';
export type {
  DynamicAnalyticsConfig,
  PlayerAnalyticsConfig,
  AnalyticsEventData,
  VideoInfo,
  PlayerState,
  DeviceInfo,
  EngagementData,
  PlayerSessionInfo,
  AnalyticsEventType,
  BaseAnalyticsProvider
} from './types/AnalyticsTypes';
