/**
 * Simple event emitter for handling player events in React Native
 */

type EventHandler = (...args: any[]) => void;

export class EventEmitter {
  private events: Map<string, Set<EventHandler>>;

  constructor() {
    this.events = new Map();
  }

  on(event: string, handler: EventHandler): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
  }

  off(event: string, handler?: EventHandler): void {
    if (!this.events.has(event)) return;
    
    if (handler) {
      this.events.get(event)!.delete(handler);
    } else {
      this.events.delete(event);
    }
  }

  once(event: string, handler: EventHandler): void {
    const onceWrapper = (...args: any[]) => {
      handler(...args);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events.has(event)) return;
    
    this.events.get(event)!.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  listenerCount(event: string): number {
    return this.events.has(event) ? this.events.get(event)!.size : 0;
  }

  eventNames(): string[] {
    return Array.from(this.events.keys());
  }
}
