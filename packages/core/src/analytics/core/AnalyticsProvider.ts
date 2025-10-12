/**
 * AnalyticsProvider - Base provider and factory functions
 */

import {
  BaseAnalyticsProvider,
  AnalyticsEventData,
  PlayerSessionInfo,
  AnalyticsProviderType,
  DynamicAnalyticsConfig,
  PlayerAnalyticsConfig
} from '../types/AnalyticsTypes';
import { PlayerAnalyticsAdapter } from '../adapters/PlayerAnalyticsAdapter';

/**
 * Abstract base class for analytics providers
 */
export abstract class AnalyticsProvider implements BaseAnalyticsProvider {
  public name: string;
  public enabled: boolean;

  constructor(name: string, enabled = true) {
    this.name = name;
    this.enabled = enabled;
  }

  abstract initialize(): Promise<void>;
  abstract trackEvent(event: AnalyticsEventData): Promise<void>;
  abstract startSession(sessionInfo: PlayerSessionInfo): Promise<string>;
  abstract endSession(): Promise<void>;
  abstract flush(): Promise<void>;
  abstract destroy(): Promise<void>;
}

/**
 * Create analytics provider based on type and configuration
 */
export function createAnalyticsProvider(
  type: AnalyticsProviderType,
  name: string,
  config: any
): BaseAnalyticsProvider {
  switch (type) {
    case AnalyticsProviderType.PLAYER_ANALYTICS:
      return new PlayerAnalyticsAdapter(name, config);
    
    case AnalyticsProviderType.CUSTOM:
      if (config.factory) {
        return config.factory(config);
      }
      throw new Error(`Custom provider "${name}" requires a factory function`);
    
    case AnalyticsProviderType.GOOGLE_ANALYTICS:
    case AnalyticsProviderType.ADOBE_ANALYTICS:
    default:
      throw new Error(`Analytics provider type "${type}" is not supported yet`);
  }
}

/**
 * Get default analytics configuration
 */
export function getDefaultAnalyticsConfig(): DynamicAnalyticsConfig {
  return {
    enabled: true,
    providers: [],
    globalSettings: {
      enableConsoleLogging: false,
      enableErrorReporting: true,
      sessionTimeout: 60, // 60 minutes
      defaultBatchSize: 10,
      defaultFlushInterval: 30, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000 // 1 second
    }
  };
}

/**
 * Helper function to create Player Analytics provider config
 */
export function createPlayerAnalyticsProviderConfig(
  baseUrl: string,
  apiKey: string,
  playerId: string,
  options: Partial<PlayerAnalyticsConfig> = {}
): PlayerAnalyticsConfig {
  return {
    baseUrl,
    apiKey,
    playerId,
    tenantId: options.tenantId,
    heartbeatInterval: options.heartbeatInterval || 10,
    batchSize: options.batchSize || 10,
    flushInterval: options.flushInterval || 30,
    enableOfflineStorage: options.enableOfflineStorage !== false,
    maxRetries: options.maxRetries || 3,
    retryDelay: options.retryDelay || 1000
  };
}

/**
 * Validate analytics configuration
 */
export function validateAnalyticsConfig(config: DynamicAnalyticsConfig): void {
  if (!config) {
    throw new Error('Analytics configuration is required');
  }

  if (typeof config.enabled !== 'boolean') {
    throw new Error('Analytics configuration must specify enabled state');
  }

  if (!Array.isArray(config.providers)) {
    throw new Error('Analytics configuration must include providers array');
  }

  config.providers.forEach((provider, index) => {
    if (!provider.name) {
      throw new Error(`Provider at index ${index} must have a name`);
    }
    
    if (!provider.type) {
      throw new Error(`Provider "${provider.name}" must have a type`);
    }
    
    if (typeof provider.enabled !== 'boolean') {
      throw new Error(`Provider "${provider.name}" must specify enabled state`);
    }

    if (provider.type === AnalyticsProviderType.PLAYER_ANALYTICS) {
      validatePlayerAnalyticsConfig(provider.config);
    }
  });
}

/**
 * Validate Player Analytics specific configuration
 */
function validatePlayerAnalyticsConfig(config: PlayerAnalyticsConfig): void {
  if (!config.baseUrl) {
    throw new Error('Player Analytics provider requires baseUrl');
  }
  
  if (!config.apiKey) {
    throw new Error('Player Analytics provider requires apiKey');
  }
  
  if (!config.playerId) {
    throw new Error('Player Analytics provider requires playerId');
  }
}

/**
 * Merge analytics configurations
 */
export function mergeAnalyticsConfigs(
  defaultConfig: DynamicAnalyticsConfig,
  userConfig: Partial<DynamicAnalyticsConfig>
): DynamicAnalyticsConfig {
  return {
    enabled: userConfig.enabled !== undefined ? userConfig.enabled : defaultConfig.enabled,
    providers: userConfig.providers || defaultConfig.providers,
    globalSettings: {
      ...defaultConfig.globalSettings,
      ...userConfig.globalSettings
    }
  };
}