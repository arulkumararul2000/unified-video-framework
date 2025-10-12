/**
 * EventBatcher - Batches analytics events for efficient network usage
 */

import { AnalyticsEventData } from '../types/AnalyticsTypes';

export interface BatcherConfig {
  maxSize?: number;
  flushInterval?: number; // in milliseconds
  maxWaitTime?: number; // in milliseconds
  onFlush: (events: AnalyticsEventData[]) => Promise<void>;
  onError?: (error: Error, events: AnalyticsEventData[]) => void;
}

export class EventBatcher {
  private events: AnalyticsEventData[] = [];
  private flushTimer: any = null;
  private maxWaitTimer: any = null;
  private destroyed = false;

  private readonly maxSize: number;
  private readonly flushInterval: number;
  private readonly maxWaitTime: number;
  private readonly onFlush: (events: AnalyticsEventData[]) => Promise<void>;
  private readonly onError?: (error: Error, events: AnalyticsEventData[]) => void;

  constructor(config: BatcherConfig) {
    this.maxSize = config.maxSize || 10;
    this.flushInterval = config.flushInterval || 30000; // 30 seconds
    this.maxWaitTime = config.maxWaitTime || 60000; // 60 seconds
    this.onFlush = config.onFlush;
    this.onError = config.onError;
  }

  /**
   * Add an event to the batch
   */
  addEvent(event: AnalyticsEventData): void {
    if (this.destroyed) {
      return;
    }

    this.events.push(event);

    // Start max wait timer if this is the first event
    if (this.events.length === 1) {
      this.startMaxWaitTimer();
    }

    // Flush if batch is full
    if (this.events.length >= this.maxSize) {
      this.flush();
    } else {
      // Reset flush timer
      this.resetFlushTimer();
    }
  }

  /**
   * Manually flush all events
   */
  async flush(): Promise<void> {
    if (this.destroyed || this.events.length === 0) {
      return;
    }

    const eventsToFlush = [...this.events];
    this.events = [];
    this.clearTimers();

    try {
      await this.onFlush(eventsToFlush);
    } catch (error) {
      if (this.onError) {
        this.onError(error as Error, eventsToFlush);
      } else {
        console.error('EventBatcher flush error:', error);
      }
    }
  }

  /**
   * Get current batch size
   */
  getBatchSize(): number {
    return this.events.length;
  }

  /**
   * Check if batcher has pending events
   */
  hasPendingEvents(): boolean {
    return this.events.length > 0;
  }

  /**
   * Destroy the batcher and flush remaining events
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.clearTimers();

    // Flush remaining events
    if (this.events.length > 0) {
      await this.flush();
    }
  }

  private resetFlushTimer(): void {
    this.clearFlushTimer();
    
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.flushInterval);
  }

  private startMaxWaitTimer(): void {
    this.clearMaxWaitTimer();
    
    this.maxWaitTimer = setTimeout(() => {
      this.flush();
    }, this.maxWaitTime);
  }

  private clearFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private clearMaxWaitTimer(): void {
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearFlushTimer();
    this.clearMaxWaitTimer();
  }
}

/**
 * Create an EventBatcher with default configuration
 */
export function createEventBatcher(
  onFlush: (events: AnalyticsEventData[]) => Promise<void>,
  options: Partial<BatcherConfig> = {}
): EventBatcher {
  return new EventBatcher({
    onFlush,
    ...options
  });
}