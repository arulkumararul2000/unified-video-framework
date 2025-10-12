/**
 * PlayerAnalytics - Main Analytics Class
 * Simplified analytics interface for easy integration
 */

import { DynamicAnalyticsManager } from './DynamicAnalyticsManager';
import {
  DynamicAnalyticsConfig,
  AnalyticsProviderType,
  PlayerAnalyticsConfig,
  VideoInfo,
  PlayerState
} from '../types/AnalyticsTypes';

export class PlayerAnalytics {
  private analyticsManager: DynamicAnalyticsManager;
  private currentSessionId: string | null = null;

  constructor(config: DynamicAnalyticsConfig) {
    this.analyticsManager = new DynamicAnalyticsManager(config);
  }

  /**
   * Initialize analytics
   */
  async initialize(): Promise<void> {
    return this.analyticsManager.initialize();
  }

  /**
   * Start a new analytics session
   */
  startSession(videoInfo: VideoInfo, userInfo: any = {}): string {
    this.currentSessionId = this.analyticsManager.startSession(videoInfo, userInfo);
    return this.currentSessionId;
  }

  /**
   * End the current analytics session
   */
  async endSession(): Promise<void> {
    if (this.currentSessionId) {
      await this.analyticsManager.endSession();
      this.currentSessionId = null;
    }
  }

  /**
   * Track a player event
   */
  trackEvent(eventType: string, playerState?: PlayerState, customData?: any): void {
    this.analyticsManager.trackEvent(eventType, playerState, customData);
  }

  /**
   * Track a custom event
   */
  trackCustomEvent(eventType: string, data: any): void {
    this.analyticsManager.trackCustomEvent(eventType, data);
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Check if analytics is enabled
   */
  isEnabled(): boolean {
    return this.analyticsManager.isEnabled();
  }

  /**
   * Add a provider at runtime
   */
  addProvider(name: string, type: AnalyticsProviderType, config: any): void {
    this.analyticsManager.addProvider(name, type, config);
  }

  /**
   * Remove a provider
   */
  async removeProvider(name: string): Promise<void> {
    return this.analyticsManager.removeProvider(name);
  }

  /**
   * Toggle a provider
   */
  toggleProvider(name: string, enabled: boolean): void {
    this.analyticsManager.toggleProvider(name, enabled);
  }

  /**
   * Destroy analytics and cleanup
   */
  async destroy(): Promise<void> {
    if (this.currentSessionId) {
      await this.endSession();
    }
    return this.analyticsManager.destroy();
  }
}

/**
 * Helper function to create a basic PlayerAnalytics instance
 */
export function createPlayerAnalytics(
  baseUrl: string,
  apiKey: string,
  playerId: string,
  options: Partial<PlayerAnalyticsConfig> = {}
): PlayerAnalytics {
  const config: DynamicAnalyticsConfig = {
    enabled: true,
    providers: [
      {
        name: 'player-analytics',
        type: AnalyticsProviderType.PLAYER_ANALYTICS,
        enabled: true,
        priority: 1,
        config: {
          baseUrl,
          apiKey,
          playerId,
          heartbeatInterval: options.heartbeatInterval || 10,
          batchSize: options.batchSize || 10,
          flushInterval: options.flushInterval || 30,
          enableOfflineStorage: options.enableOfflineStorage !== false,
          maxRetries: options.maxRetries || 3,
          retryDelay: options.retryDelay || 1000,
          ...options
        }
      }
    ],
    globalSettings: {
      enableConsoleLogging: false,
      enableErrorReporting: true,
      sessionTimeout: 60
    }
  };

  return new PlayerAnalytics(config);
}