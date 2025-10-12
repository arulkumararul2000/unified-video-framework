/**
 * PlayerAnalyticsAdapter - Adapter for integrating with player analytics API
 * Maps internal analytics events to the player analytics system format
 * Implements BaseAnalyticsProvider interface
 */

import { 
  AnalyticsEventData,
  PlayerSessionInfo,
  BaseAnalyticsProvider,
  PlayerAnalyticsConfig
} from '../types/AnalyticsTypes';
import { deviceDetection } from '../utils/DeviceDetection';

export class PlayerAnalyticsAdapter implements BaseAnalyticsProvider {
  public name: string;
  public enabled: boolean;
  private config: PlayerAnalyticsConfig;
  private currentSessionId: string | null = null;
  private eventQueue: AnalyticsEventData[] = [];
  private flushTimer: any = null;

  constructor(name: string, config: PlayerAnalyticsConfig) {
    this.name = name;
    this.enabled = true;
    this.config = config;
  }

  async initialize(): Promise<void> {
    // No initialization needed
  }

  async startSession(sessionInfo: PlayerSessionInfo): Promise<string> {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentSessionId = sessionId;

    const event: AnalyticsEventData = {
      eventType: 'session_start',
      timestamp: Date.now(),
      video: sessionInfo.initialVideo,
      device: deviceDetection.getDeviceInfo(),
      metadata: {
        sessionId,
        playerId: this.config.playerId,
        userId: sessionInfo.userId,
        customData: sessionInfo.customData
      }
    };

    await this.trackEvent(event);
    return sessionId;
  }

  async trackEvent(event: AnalyticsEventData): Promise<void> {
    if (!this.enabled) {
      return;
    }

    this.eventQueue.push(event);

    // Auto-flush if batch size reached
    if (this.eventQueue.length >= (this.config.batchSize || 10)) {
      await this.flush();
    } else {
      // Schedule flush
      this.scheduleFlush();
    }
  }

  async endSession(): Promise<void> {
    if (this.currentSessionId) {
      const event: AnalyticsEventData = {
        eventType: 'session_end',
        timestamp: Date.now(),
        metadata: {
          sessionId: this.currentSessionId,
          playerId: this.config.playerId
        }
      };

      await this.trackEvent(event);
      await this.flush();
      this.currentSessionId = null;
    }
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    try {
      const payload = {
        session: {
          sessionId: this.currentSessionId || 'unknown',
          playerId: this.config.playerId,
          timestamp: Date.now(),
          customData: {}
        },
        events
      };

      const response = await fetch(`${this.config.baseUrl}/analytics/player/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          ...(this.config.tenantId && { 'X-Tenant-ID': this.config.tenantId })
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Analytics API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send analytics events:', error);
      // Re-queue events on failure
      this.eventQueue = [...events, ...this.eventQueue];
    }
  }

  async destroy(): Promise<void> {
    if (this.currentSessionId) {
      await this.endSession();
    }

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush attempt
    if (this.eventQueue.length > 0) {
      await this.flush();
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flush().catch(console.error);
    }, (this.config.flushInterval || 30) * 1000);
  }
}