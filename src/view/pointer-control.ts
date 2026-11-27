import { EASINGS } from '../util/easing';
import type { Point } from '../util/geometry';
import type { View } from './view';

const WHEEL_ZOOM_FACTOR = 0.001;
const WHEEL_ZOOM_MAX_STEP = 1.25;
const WHEEL_ZOOM_MIN_STEP = 0.8;
/** Trackpad pinch gestures arrive as wheel events with `ctrlKey` and small deltas. */
const TRACKPAD_PINCH_BOOST = 5;

/** A drag released within this time (ms) after the last move keeps gliding. */
const FLING_THRESHOLD = 100;
const FLING_FACTOR = 5;
const FLING_DURATION = 600;

interface Pinch {
  readonly startDistance: number;
  readonly startZoom: number;
  /** Content coordinate kept under the fingers. */
  readonly target: Point;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Pan and zoom interaction for a view, based on Pointer Events (mouse, touch and pen):
 * - Drag with one pointer pans, with a short glide after a fast release
 * - Two pointers pinch-zoom around their center
 * - Mouse wheel and trackpad pinch zoom around the pointer position
 */
export class PointerControl {
  readonly #view: View;
  readonly #container: HTMLElement;
  readonly #pointers = new Map<number, Point>();
  #pan = false;
  #zoom = false;
  #pinch: Pinch | undefined;
  #lastMove: { readonly time: number; readonly delta: Point } | undefined;

  constructor(view: View, container: HTMLElement) {
    this.#view = view;
    this.#container = container;
  }

  enable(pan: boolean, zoom: boolean): void {
    this.#detach();
    this.#pan = pan;
    this.#zoom = zoom;
    if (!pan && !zoom) return;

    this.#container.addEventListener('pointerdown', this.#onPointerDown);
    if (zoom) this.#container.addEventListener('wheel', this.#onWheel, { passive: false });
    // Gestures are handled here instead of by the browser
    this.#container.style.touchAction = 'none';
  }

  #detach(): void {
    this.#container.removeEventListener('pointerdown', this.#onPointerDown);
    this.#container.removeEventListener('wheel', this.#onWheel);
    this.#stopTracking();
    this.#container.style.removeProperty('touch-action');
  }

  #stopTracking(): void {
    window.removeEventListener('pointermove', this.#onPointerMove);
    window.removeEventListener('pointerup', this.#onPointerUp);
    window.removeEventListener('pointercancel', this.#onPointerUp);
    this.#pointers.clear();
    this.#pinch = undefined;
    this.#lastMove = undefined;
  }

  /** Content coordinate under a viewport (client) position. */
  #contentAt(client: Point): Point {
    const rect = this.#container.getBoundingClientRect();
    return this.#view.viewport.toContent({ x: client.x - rect.left, y: client.y - rect.top });
  }

  #startPinch(): void {
    const [a, b] = [...this.#pointers.values()];
    if (!a || !b) return;
    this.#pinch = {
      startDistance: distance(a, b),
      startZoom: this.#view.zoomLevel,
      target: this.#contentAt({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
    };
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (this.#pointers.size === 0) {
      window.addEventListener('pointermove', this.#onPointerMove);
      window.addEventListener('pointerup', this.#onPointerUp);
      window.addEventListener('pointercancel', this.#onPointerUp);
    }
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.#lastMove = undefined;
    if (this.#pointers.size === 2 && this.#zoom) this.#startPinch();
  };

  readonly #onPointerMove = (event: PointerEvent): void => {
    const previous = this.#pointers.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    this.#pointers.set(event.pointerId, current);

    if (this.#pinch) {
      const [a, b] = [...this.#pointers.values()];
      if (!a || !b) return;
      const { startDistance, startZoom, target } = this.#pinch;
      this.#view.zoomTo((startZoom * distance(a, b)) / startDistance, target);
      event.preventDefault();
      return;
    }

    if (this.#pan && this.#pointers.size === 1) {
      const delta = { x: current.x - previous.x, y: current.y - previous.y };
      this.#lastMove = { time: performance.now(), delta };
      const move = this.#view.viewport.fromPx({ x: -delta.x, y: -delta.y });
      this.#view.moveBy(move.x, move.y);
      event.preventDefault();
    }
  };

  readonly #onPointerUp = (event: PointerEvent): void => {
    if (!this.#pointers.delete(event.pointerId)) return;

    if (this.#pinch) {
      // Continue panning with the remaining pointer
      this.#pinch = undefined;
      this.#lastMove = undefined;
      return;
    }

    if (this.#pointers.size === 0) {
      this.#fling();
      this.#stopTracking();
    }
  };

  #fling(): void {
    const last = this.#lastMove;
    if (!last || performance.now() - last.time >= FLING_THRESHOLD) return;
    const viewport = this.#view.viewport;
    const move = viewport.fromPx({
      x: -last.delta.x * FLING_FACTOR,
      y: -last.delta.y * FLING_FACTOR,
    });
    this.#view.setViewport(viewport.moveBy(move.x, move.y), {
      easing: EASINGS.easeoutqart,
      duration: FLING_DURATION,
    });
  }

  readonly #onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const delta = event.ctrlKey ? event.deltaY * TRACKPAD_PINCH_BOOST : event.deltaY;
    const step = Math.min(
      Math.max(1 - delta * WHEEL_ZOOM_FACTOR, WHEEL_ZOOM_MIN_STEP),
      WHEEL_ZOOM_MAX_STEP,
    );
    this.#view.zoomTo(
      this.#view.zoomLevel * step,
      this.#contentAt({ x: event.clientX, y: event.clientY }),
    );
  };
}
