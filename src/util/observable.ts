/** Event name -> listener argument tuple. */
export type EventMap = Record<string, unknown[]>;

export type Listener<Args extends unknown[]> = (...args: Args) => void;

type AnyListener = (...args: readonly unknown[]) => void;

/** Receiver of bubbled events, usually the parent observable. */
export interface EventSink {
  bubble(event: string, args: readonly unknown[]): void;
}

/**
 * Event emitter with optional bubbling to a parent.
 * Events emitted here are re-dispatched on the parent as `<prefix>.<event>`,
 * so `graphic.on('element.click', ...)` captures clicks of all elements.
 */
export class Observable<Events extends EventMap = EventMap> implements EventSink {
  readonly #listeners = new Map<string, Set<AnyListener>>();
  readonly #parent: EventSink | undefined;
  readonly #prefix: string | undefined;

  constructor(parent?: EventSink, prefix?: string) {
    this.#parent = parent;
    this.#prefix = prefix;
  }

  /** Registers a listener and returns a function that removes it again. */
  on<K extends keyof Events & string>(event: K, listener: Listener<Events[K]>): () => void {
    let listeners = this.#listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(event, listeners);
    }
    listeners.add(listener as AnyListener);
    return () => {
      this.off(event, listener);
    };
  }

  off<K extends keyof Events & string>(event: K, listener: Listener<Events[K]>): void {
    const listeners = this.#listeners.get(event);
    if (!listeners) return;
    listeners.delete(listener as AnyListener);
    if (listeners.size === 0) this.#listeners.delete(event);
  }

  emit<K extends keyof Events & string>(event: K, ...args: Events[K]): void {
    this.#dispatch(event, args);
    this.#parent?.bubble(this.#prefix ? `${this.#prefix}.${event}` : event, args);
  }

  bubble(event: string, args: readonly unknown[]): void {
    this.#dispatch(event, args);
    this.#parent?.bubble(event, args);
  }

  listenerCount(event: keyof Events & string): number {
    return this.#listeners.get(event)?.size ?? 0;
  }

  destroy(): void {
    this.#listeners.clear();
  }

  #dispatch(event: string, args: readonly unknown[]): void {
    const listeners = this.#listeners.get(event);
    if (!listeners) return;
    // Copy so listeners may unsubscribe while being notified
    for (const listener of [...listeners]) {
      listener(...args);
    }
  }
}
