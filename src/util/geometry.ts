import type { AnchorName } from '@cuttleskin/config';

/** 2D coordinate. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Axis-aligned rectangle given by its top-left corner and size. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Named reference point on a box. */
export type BoxAnchor = AnchorName;

/** Resolves a named anchor of `box`; an explicit point is returned unchanged. */
export function boxPosition(box: Box, anchor: BoxAnchor | Point = 'center'): Point {
  if (typeof anchor !== 'string') return anchor;

  const { x, y, width, height } = box;
  const right = x + width;
  const bottom = y + height;
  const cx = x + width / 2;
  const cy = y + height / 2;

  switch (anchor) {
    case 'top-left':
      return { x, y };
    case 'top':
      return { x: cx, y };
    case 'top-right':
      return { x: right, y };
    case 'left':
      return { x, y: cy };
    case 'center':
      return { x: cx, y: cy };
    case 'right':
      return { x: right, y: cy };
    case 'bottom-left':
      return { x, y: bottom };
    case 'bottom':
      return { x: cx, y: bottom };
    case 'bottom-right':
      return { x: right, y: bottom };
  }
}

/**
 * Bounding box of all elements after their transforms, in the coordinate system of the nearest viewport
 * (`getCTM`). Returns `null` for an empty list.
 */
export function combinedBoundingBox(
  elements: Iterable<SVGGraphicsElement>,
  padding = 0,
): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const element of elements) {
    const bbox = element.getBBox();
    const matrix = element.getCTM() ?? new DOMMatrix();
    const corners = [
      new DOMPoint(bbox.x, bbox.y),
      new DOMPoint(bbox.x + bbox.width, bbox.y),
      new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height),
      new DOMPoint(bbox.x, bbox.y + bbox.height),
    ];
    for (const corner of corners) {
      const p = corner.matrixTransform(matrix);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  if (minX === Infinity) return null;

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + 2 * padding,
    height: maxY - minY + 2 * padding,
  };
}
