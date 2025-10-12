/**
 * DynamicAnalyticsManager - Main analytics system
 * Manages multiple analytics providers dynamically
 */

import {
  DynamicAnalyticsConfig,
  AnalyticsProviderType,
  BaseAnalyticsProvider,
  AnalyticsEventData,
  VideoInfo,
  PlayerState,
  PlayerSessionInfo
} from '../types/AnalyticsTypes';
import { createAnalyticsProvider } from './AnalyticsProvider';

export class DynamicAnalyticsManager {
  private config: DynamicAnalyticsConfig;
  private providers: Map<string, BaseAnalyticsProvider> = new Map();
  private currentSessionId: string | null = null;
  private enabled: boolean;

  constructor(config: DynamicAnalyticsConfig) {
    this.config = config;
    this.enabled = config.enabled;
    this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    for (const providerConfig of this.config.providers) {
      if (providerConfig.enabled) {
        try {
          const provider = createAnalyticsProvider(
            providerConfig.type,
            providerConfig.name,
            providerConfig.config
          );
          
          await provider.initialize();
          this.providers.set(providerConfig.name, provider);
        } catch (error) {
          console.error(`Failed to initialize analytics provider "${providerConfig.name}":`, error);
        }
      }
    }
  }

  startSession(videoInfo: VideoInfo, userInfo: any = {}): string {
    if (!this.enabled) {
      return '';
    }

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentSessionId = sessionId;

    const sessionInfo: PlayerSessionInfo = {
      sessionId,
      playerId: 'default',
      startTime: Date.now(),
      userId: userInfo.userId,
      userType: userInfo.userType,
      customData: userInfo,
      initialVideo: videoInfo
    };

    this.providers.forEach(async (provider) => {
      if (provider.enabled) {
        try {
          await provider.startSession(sessionInfo);
        } catch (error) {
          console.error(`Provider "${provider.name}" failed to start session:`, error);
        }
      }
    });

    return sessionId;
  }

  async endSession(): Promise<void> {
    if (!this.currentSessionId || !this.enabled) {
      return;
    }

    const promises = Array.from(this.providers.values()).map(async (provider) => {
      if (provider.enabled) {
        try {
          await provider.endSession();
        } catch (error) {
          console.error(`Provider "${provider.name}" failed to end session:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
    this.currentSessionId = null;
  }

  trackEvent(eventType: string, playerState?: PlayerState, customData?: any): void {
    if (!this.enabled || !this.currentSessionId) {
      return;
    }

    const event: AnalyticsEventData = {
      eventType,
      timestamp: Date.now(),
      currentTime: playerState?.currentTime,
      player: playerState,
      custom: customData
    };

    this.providers.forEach(async (provider) => {
      if (provider.enabled) {
        try {
          await provider.trackEvent(event);
        } catch (error) {
          console.error(`Provider "${provider.name}" failed to track event:`, error);
        }
      }
    });
  }

  trackCustomEvent(eventType: string, data: any): void {
    if (!this.enabled) {
      return;
    }

    const event: AnalyticsEventData = {
      eventType: 'custom',
      timestamp: Date.now(),
      custom: { type: eventType, ...data }
    };

    this.providers.forEach(async (provider) => {
      if (provider.enabled) {
        try {
          await provider.trackEvent(event);
        } catch (error) {
          console.error(`Provider "${provider.name}" failed to track custom event:`, error);
        }
      }
    });
  }

  addProvider(name: string, type: AnalyticsProviderType, config: any): void {
    try {
      const provider = createAnalyticsProvider(type, name, config);
      provider.initialize().then(() => {
        this.providers.set(name, provider);
      });
    } catch (error) {
      console.error(`Failed to add provider "${name}":`, error);
    }
  }

  async removeProvider(name: string): Promise<void> {
    const provider = this.providers.get(name);
    if (provider) {
      try {
        await provider.destroy();
        this.providers.delete(name);
      } catch (error) {
        console.error(`Failed to remove provider "${name}":`, error);
      }
    }
  }

  toggleProvider(name: string, enabled: boolean): void {
    const provider = this.providers.get(name);
    if (provider) {
      provider.enabled = enabled;
    }
  }

  async initialize(): Promise<void> {
    // Already done in constructor, but this method is needed for interface compatibility
    return Promise.resolve();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async destroy(): Promise<void> {
    if (this.currentSessionId) {
      await this.endSession();
    }

    const promises = Array.from(this.providers.values()).map(async (provider) => {
      try {
        await provider.destroy();
      } catch (error) {
        console.error(`Provider "${provider.name}" failed to destroy:`, error);
      }
    });

    await Promise.allSettled(promises);
    this.providers.clear();
  }
}