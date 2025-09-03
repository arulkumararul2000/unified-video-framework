type EventHandler = (...args: any[]) => void;
export declare class EventEmitter {
    private events;
    constructor();
    on(event: string, handler: EventHandler): void;
    off(event: string, handler?: EventHandler): void;
    once(event: string, handler: EventHandler): void;
    emit(event: string, ...args: any[]): void;
    removeAllListeners(event?: string): void;
    listenerCount(event: string): number;
    eventNames(): string[];
}
export {};
//# sourceMappingURL=EventEmitter.d.ts.map