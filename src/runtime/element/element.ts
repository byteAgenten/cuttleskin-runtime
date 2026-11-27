import type { ElementConfig } from '@cuttleskin/config';
import type { AssetResolver } from '../../util/assets';
import { DomObservable } from '../../util/dom-observable';
import { createLogger } from '../../util/logger';
import { Observable, type EventSink } from '../../util/observable';
import { screenBBox, type ScreenBBox } from '../../util/screen-bbox';
import type { TaskScheduler, Unschedule } from '../scheduling';
import type { AttributeName, AttributeTypes, AttributeValues } from './attributes';
import { ElementState } from './element-state';

/** Function modifying the element state for the next render. */
export type TransformFn = (state: ElementState) => void;

/** Runtime events of an element; bubbled to the parent as `element.<event>`. */
export type ElementEvents = {
  render: [element: RuntimeElement];
  destroy: [element: RuntimeElement];
};

/** Services an element depends on. */
export interface ElementContext {
  readonly scheduler: TaskScheduler;
  readonly assets: AssetResolver;
  /** Receives bubbled runtime and DOM events, usually the graphic. */
  readonly events?: EventSink;
}

interface TransformEntry {
  readonly fn: TransformFn;
  readonly priority: number;
}

const log = createLogger('cuttleskin.element');

/**
 * Runtime wrapper of an SVG element.
 * - Collects transform functions and renders them in priority order in the render phase
 * - Restores the original markup state when transforms are removed or the element is destroyed
 * - Forwards DOM events via `dom` (e.g. `element.dom.on('click', ...)`, bubbled as `element.click`)
 */
export class RuntimeElement extends Observable<ElementEvents> {
  readonly node: SVGGraphicsElement;
  /** DOM events of the node. */
  readonly dom: DomObservable;
  readonly #state: ElementState;
  readonly #scheduler: TaskScheduler;
  #transforms: TransformEntry[] = [];
  #unscheduleRender: Unschedule | undefined;

  constructor(node: SVGGraphicsElement, context: ElementContext, config?: ElementConfig) {
    super(context.events, 'element');
    this.node = node;
    this.dom = new DomObservable(node, context.events, 'element', config?.name);
    this.#state = new ElementState(node, context.assets);
    this.#scheduler = context.scheduler;

    // Configured events are forwarded to the parent even without a direct subscriber
    for (const event of config?.events ?? []) {
      this.dom.on(event, () => undefined);
    }
  }

  get id(): string {
    return this.node.id;
  }

  getDefaultValue<K extends AttributeName>(attribute: K): AttributeTypes[K] {
    return this.#state.getDefaultValue(attribute);
  }

  getDefaultValues<A extends AttributeName>(attributes: readonly A[]): AttributeValues<A> {
    return this.#state.getDefaultValues(attributes);
  }

  /**
   * Adds a transform function executed on every render; higher priorities run first.
   * Returns a function that removes it again and re-renders the element.
   */
  transform(fn: TransformFn, priority = 0): () => void {
    const entry: TransformEntry = { fn, priority };
    this.#transforms.push(entry);
    this.#scheduleRender();

    return () => {
      const index = this.#transforms.indexOf(entry);
      if (index < 0) return;
      this.#transforms.splice(index, 1);
      this.#scheduleRender();
    };
  }

  /** Current position and size on screen. */
  screenBBox(): ScreenBBox {
    return screenBBox(this.node);
  }

  /** Removes all transforms, restores the original markup state in the next reset phase and removes listeners. */
  override destroy(): void {
    this.#transforms = [];
    this.#state.clear();
    this.#unscheduleRender?.();
    this.#scheduler.scheduleReset(() => {
      this.#state.apply();
    });
    this.emit('destroy', this);
    this.dom.destroy();
    super.destroy();
  }

  #scheduleRender(): void {
    this.#unscheduleRender?.();
    this.#unscheduleRender = this.#scheduler.scheduleRender(() => {
      this.#render();
    });
  }

  #render(): void {
    this.#unscheduleRender = undefined;
    const ordered = [...this.#transforms].sort((left, right) => right.priority - left.priority);
    for (const { fn } of ordered) fn(this.#state);
    this.#state.apply();
    this.emit('render', this);
    log.debug('Rendered element', this.id);
  }
}
