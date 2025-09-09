export class EventEmitter {
    constructor() {
        this.events = new Map();
    }
    on(event, handler) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(handler);
    }
    off(event, handler) {
        if (!this.events.has(event))
            return;
        if (handler) {
            this.events.get(event).delete(handler);
        }
        else {
            this.events.delete(event);
        }
    }
    once(event, handler) {
        const onceWrapper = (...args) => {
            handler(...args);
            this.off(event, onceWrapper);
        };
        this.on(event, onceWrapper);
    }
    emit(event, ...args) {
        if (!this.events.has(event))
            return;
        this.events.get(event).forEach(handler => {
            try {
                handler(...args);
            }
            catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
    }
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        }
        else {
            this.events.clear();
        }
    }
    listenerCount(event) {
        return this.events.has(event) ? this.events.get(event).size : 0;
    }
    eventNames() {
        return Array.from(this.events.keys());
    }
}
//# sourceMappingURL=EventEmitter.js.map