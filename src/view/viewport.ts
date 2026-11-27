import type { ViewSize } from '../document/document';
import type { Box, Point } from '../util/geometry';

export const MIN_ZOOM_LEVEL = 0.01;
export const MAX_ZOOM_LEVEL = 99.99;

function clampZoom(level: number): number {
  return Math.min(Math.max(level, MIN_ZOOM_LEVEL), MAX_ZOOM_LEVEL);
}

/** Mutable fields of a viewport. */
export interface ViewportState {
  /** Visible area (SVG `viewBox`) in content coordinates. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Screen pixels per content unit. */
  readonly zoomLevel: number;
  /** Size of the container in pixels. */
  readonly viewSize: ViewSize;
  /** Bounds of the content in content coordinates. */
  readonly contentBounds: Box;
}

const INITIAL_STATE: ViewportState = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  zoomLevel: 1,
  viewSize: { width: 0, height: 0 },
  contentBounds: { x: 0, y: 0, width: 0, height: 0 },
};

/** Immutable visible area of the content; all operations return a new viewport. */
export class Viewport implements ViewportState {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly zoomLevel: number;
  readonly viewSize: ViewSize;
  readonly contentBounds: Box;

  constructor(state: ViewportState = INITIAL_STATE) {
    this.x = state.x;
    this.y = state.y;
    this.width = state.width;
    this.height = state.height;
    this.zoomLevel = state.zoomLevel;
    this.viewSize = state.viewSize;
    this.contentBounds = state.contentBounds;
    Object.freeze(this);
  }

  /** Center of the content bounds. */
  get contentCenter(): Point {
    const { x, y, width, height } = this.contentBounds;
    return { x: x + width / 2, y: y + height / 2 };
  }

  /** Center of the visible area. */
  get center(): Point {
    return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
  }

  /** `viewBox` attribute value. */
  get viewBox(): string {
    return [this.x, this.y, this.width, this.height].join(' ');
  }

  with(changes: Partial<ViewportState>): Viewport {
    const { x, y, width, height, zoomLevel, viewSize, contentBounds } = this;
    return new Viewport({ x, y, width, height, zoomLevel, viewSize, contentBounds, ...changes });
  }

  /** Adapts the visible area to the view size, keeping the zoom level and the top-left corner. */
  resize(): Viewport {
    return this.with({
      width: this.viewSize.width / this.zoomLevel,
      height: this.viewSize.height / this.zoomLevel,
    });
  }

  moveBy(dx: number, dy: number): Viewport {
    return this.with({ x: this.x + dx, y: this.y + dy });
  }

  centerAt(x: number, y: number): Viewport {
    return this.with({ x: x - this.width / 2, y: y - this.height / 2 });
  }

  /** Zooms so that `target` (content coordinates, default: center) stays at the same screen position. */
  zoomTo(zoomLevel: number, target: Point = this.center): Viewport {
    const level = clampZoom(zoomLevel);
    const width = this.viewSize.width / level;
    const height = this.viewSize.height / level;
    const ratioX = this.width ? (target.x - this.x) / this.width : 0.5;
    const ratioY = this.height ? (target.y - this.y) / this.height : 0.5;

    return this.with({
      zoomLevel: level,
      x: this.x - (width - this.width) * ratioX,
      y: this.y - (height - this.height) * ratioY,
      width,
      height,
    });
  }

  zoomIn(factor: number, target?: Point): Viewport {
    return this.zoomTo(this.zoomLevel * factor, target);
  }

  zoomOut(factor: number, target?: Point): Viewport {
    return this.zoomTo(this.zoomLevel / factor, target);
  }

  /** Shows the whole content, centered, with `padding` content units on each side. */
  zoomToFit(padding = 0): Viewport {
    const { width, height } = this.contentBounds;
    const level = Math.min(
      this.viewSize.width / (width + 2 * padding),
      this.viewSize.height / (height + 2 * padding),
    );
    const center = this.contentCenter;
    return this.zoomTo(level).centerAt(center.x, center.y);
  }

  /** Zoom level 1, centered on the content. */
  zoomToOriginal(): Viewport {
    const center = this.contentCenter;
    return this.zoomTo(1).centerAt(center.x, center.y);
  }

  /** Shows `bounds` completely and centered, keeping the aspect ratio of the view. */
  setBounds(bounds: Box): Viewport {
    const level = clampZoom(
      Math.min(this.viewSize.width / bounds.width, this.viewSize.height / bounds.height),
    );
    const width = this.viewSize.width / level;
    const height = this.viewSize.height / level;
    return this.with({
      zoomLevel: level,
      x: bounds.x - (width - bounds.width) / 2,
      y: bounds.y - (height - bounds.height) / 2,
      width,
      height,
    });
  }

  /** Keeps the center of the visible area within the content bounds. */
  sanitize(): Viewport {
    const { x, y, width, height } = this.contentBounds;
    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;
    return this.with({
      x: Math.min(Math.max(this.x, x - halfWidth), x + width - halfWidth),
      y: Math.min(Math.max(this.y, y - halfHeight), y + height - halfHeight),
    });
  }

  /** Converts a distance in content units to pixels. */
  toPx(point: Point): Point {
    return { x: point.x * this.zoomLevel, y: point.y * this.zoomLevel };
  }

  /** Converts a distance in pixels to content units. */
  fromPx(point: Point): Point {
    return { x: point.x / this.zoomLevel, y: point.y / this.zoomLevel };
  }

  /** Content coordinate at a position relative to the container's top-left corner (pixels). */
  toContent(offset: Point): Point {
    return { x: this.x + offset.x / this.zoomLevel, y: this.y + offset.y / this.zoomLevel };
  }
}
