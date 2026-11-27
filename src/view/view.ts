import type { GraphicDocument } from '../document/document';
import { animate, type Animation } from '../util/animate';
import { EASINGS, type Easing } from '../util/easing';
import { combinedBoundingBox, type Point } from '../util/geometry';
import { Observable, type EventSink } from '../util/observable';
import { PointerControl } from './pointer-control';
import { Viewport } from './viewport';

/** Events of the view; bubbled to the parent as `view.<event>`. */
export type ViewEvents = {
  zoomChange: [zoomLevel: number];
  viewportChange: [viewport: Viewport];
};

/** Animation of a viewport change; `true` uses the defaults. */
export type ViewAnimation = boolean | { readonly duration?: number; readonly easing?: Easing };

const DEFAULT_DURATION = 400;

/**
 * Visible area of the graphic: zooming, panning and fitting the content into the container.
 * Viewport changes are written to the content layer's `viewBox` once per animation frame.
 */
export class View extends Observable<ViewEvents> {
  readonly #document: GraphicDocument;
  readonly #pointer: PointerControl;
  readonly #resizeObserver: ResizeObserver;
  readonly #unsubscribe: () => void;
  #viewport = new Viewport();
  #applied: Viewport | undefined;
  #animation: Animation | undefined;
  #frameId: number | undefined;

  constructor(document: GraphicDocument, parent?: EventSink) {
    super(parent, 'view');
    this.#document = document;
    this.#pointer = new PointerControl(this, document.container);
    this.#unsubscribe = document.on('contentChange', () => {
      this.resize();
    });
    this.#resizeObserver = new ResizeObserver(() => {
      // The observer also reports the initial size; only react to actual changes
      const { width, height } = this.#document.viewSize();
      const current = this.#viewport.viewSize;
      if (width !== current.width || height !== current.height) this.resize();
    });
    this.#resizeObserver.observe(document.container);
    this.resize();
  }

  get viewport(): Viewport {
    return this.#viewport;
  }

  get zoomLevel(): number {
    return this.#viewport.zoomLevel;
  }

  /**
   * Re-reads container size and content bounds. Called automatically on content and size changes.
   * When the content bounds change, the visible area starts at the content's top-left corner.
   */
  resize(): void {
    const viewSize = this.#document.viewSize();
    const contentBounds = this.#document.contentBounds();
    const previous = this.#viewport.contentBounds;
    const contentMoved =
      previous.x !== contentBounds.x ||
      previous.y !== contentBounds.y ||
      previous.width !== contentBounds.width ||
      previous.height !== contentBounds.height;

    this.#document.contentLayer.setAttribute('width', String(viewSize.width));
    this.#document.contentLayer.setAttribute('height', String(viewSize.height));
    this.setViewport(
      this.#viewport
        .with({
          viewSize,
          contentBounds,
          ...(contentMoved ? { x: contentBounds.x, y: contentBounds.y } : {}),
        })
        .resize(),
    );
  }

  /** Shows `viewport`, restricted to the content bounds, optionally animated. */
  setViewport(viewport: Viewport, animation: ViewAnimation = false): void {
    this.#animation?.stop();
    this.#animation = undefined;
    const target = viewport.sanitize();

    if (!animation) {
      this.#viewport = target;
      this.#scheduleApply();
      return;
    }

    const { duration = DEFAULT_DURATION, easing = EASINGS.easeinout } =
      animation === true ? {} : animation;
    const from = this.#viewport;
    this.#animation = animate({
      duration,
      easing,
      onUpdate: (t) => {
        this.#viewport = target.with({
          x: from.x + (target.x - from.x) * t,
          y: from.y + (target.y - from.y) * t,
          width: from.width + (target.width - from.width) * t,
          height: from.height + (target.height - from.height) * t,
        });
        this.#scheduleApply();
      },
    });
  }

  zoomTo(zoomLevel: number, target?: Point, animation?: ViewAnimation): void {
    this.setViewport(this.#viewport.zoomTo(zoomLevel, target), animation);
  }

  zoomIn(factor: number, target?: Point, animation?: ViewAnimation): void {
    this.setViewport(this.#viewport.zoomIn(factor, target), animation);
  }

  zoomOut(factor: number, target?: Point, animation?: ViewAnimation): void {
    this.setViewport(this.#viewport.zoomOut(factor, target), animation);
  }

  zoomToFit(padding?: number, animation?: ViewAnimation): void {
    this.setViewport(this.#viewport.zoomToFit(padding), animation);
  }

  zoomToOriginal(animation?: ViewAnimation): void {
    this.setViewport(this.#viewport.zoomToOriginal(), animation);
  }

  /** Shows the given elements completely; does nothing for an empty list. */
  zoomToElements(
    elements: Iterable<SVGGraphicsElement>,
    padding?: number,
    animation?: ViewAnimation,
  ): void {
    const bounds = combinedBoundingBox(elements, padding);
    if (bounds) this.setViewport(this.#viewport.setBounds(bounds), animation);
  }

  moveBy(dx: number, dy: number, animation?: ViewAnimation): void {
    this.setViewport(this.#viewport.moveBy(dx, dy), animation);
  }

  centerAt(x: number, y: number, animation?: ViewAnimation): void {
    this.setViewport(this.#viewport.centerAt(x, y), animation);
  }

  /** Enables panning (drag) and zooming (wheel, pinch) with mouse, touch and pen. */
  enablePointer(pan: boolean, zoom: boolean): void {
    this.#pointer.enable(pan, zoom);
  }

  override destroy(): void {
    this.#animation?.stop();
    if (this.#frameId !== undefined) cancelAnimationFrame(this.#frameId);
    this.#resizeObserver.disconnect();
    this.#unsubscribe();
    this.#pointer.enable(false, false);
    super.destroy();
  }

  #scheduleApply(): void {
    if (this.#frameId !== undefined) return;
    this.#frameId = requestAnimationFrame(() => {
      this.#frameId = undefined;
      this.#apply();
    });
  }

  #apply(): void {
    const viewport = this.#viewport;
    this.#document.contentLayer.setAttribute('viewBox', viewport.viewBox);
    if (this.#applied?.zoomLevel !== viewport.zoomLevel) {
      this.emit('zoomChange', viewport.zoomLevel);
    }
    this.#applied = viewport;
    this.emit('viewportChange', viewport);
  }
}
