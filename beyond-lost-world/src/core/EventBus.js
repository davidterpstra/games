// Tiny synchronous publish/subscribe bus. Every system talks through it, which keeps the
// modules decoupled and gives a single place to forward events to a future multiplayer server.
export class EventBus {
  constructor() { this.handlers = new Map(); }

  /** Subscribe. Returns an unsubscribe function. */
  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }

  once(event, fn) {
    const off = this.on(event, (payload) => { off(); fn(payload); });
    return off;
  }

  off(event, fn) { this.handlers.get(event)?.delete(fn); }

  emit(event, payload) {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.error(`[bus] handler for "${event}" failed`, err); }
    }
  }
}

/** The shared game-wide bus. */
export const bus = new EventBus();
