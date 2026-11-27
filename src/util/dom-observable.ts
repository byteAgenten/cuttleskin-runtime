import { Observable, type EventSink, type Listener } from './observable';
import { screenBBox, type ScreenBBox } from './screen-bbox';

/**
 * Every DOM event type maps to `(name, element, event, bbox)`. The name identifies the element
 * for the application (see `ElementConfig.name`), so it does not need to know SVG IDs.
 */
export type DomEventMap = Record<
  string,
  [name: string, element: Element, event: Event, bbox: ScreenBBox]
>;

/**
 * Observable that forwards DOM events of an element.
 * Exactly one native listener is registered per event type, regardless of the number of subscribers,
 * and it is removed once the last subscriber is gone.
 */
export class DomObservable extends Observable<DomEventMap> {
  readonly #element: Element;
  readonly #name: string | undefined;
  readonly #attached = new Set<string>();

  /** `name` is passed to the listeners; without it, the ID of the element. */
  constructor(element: Element, parent?: EventSink, prefix?: string, name?: string) {
    super(parent, prefix);
    this.#element = element;
    this.#name = name;
  }

  override on(event: string, listener: Listener<DomEventMap[string]>): () => void {
    const unsubscribe = super.on(event, listener);
    if (!this.#attached.has(event)) {
      this.#element.addEventListener(event, this.#handleEvent);
      this.#attached.add(event);
    }
    return unsubscribe;
  }

  override off(event: string, listener: Listener<DomEventMap[string]>): void {
    super.off(event, listener);
    if (this.listenerCount(event) === 0) this.#detach(event);
  }

  override destroy(): void {
    super.destroy();
    for (const event of [...this.#attached]) this.#detach(event);
  }

  #detach(event: string): void {
    if (!this.#attached.delete(event)) return;
    this.#element.removeEventListener(event, this.#handleEvent);
  }

  readonly #handleEvent = (event: Event): void => {
    this.emit(
      event.type,
      this.#name ?? this.#element.id,
      this.#element,
      event,
      screenBBox(this.#element),
    );
  };
}
