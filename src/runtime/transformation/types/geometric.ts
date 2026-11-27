import type { TransformationModel } from '../../../model/transformation';
import { createTranslation } from '../../../translation/factory';
import { boxPosition, type Point } from '../../../util/geometry';
import { interpolateNumber, interpolatePoint } from '../../../util/interpolate';
import { totalMatrix, type TransformValue } from '../../element/attributes';
import type { TransformType } from '../transform-type';

/**
 * Applies `matrix`, given in the coordinate system of the nearest `<svg>`, on top of the current transform.
 * The element's local transform becomes `local * total^-1 * matrix * total`.
 */
function applyInSvgSpace(transform: TransformValue, matrix: DOMMatrixReadOnly): TransformValue {
  return {
    local: transform.local
      .multiply(transform.total.inverse())
      .multiply(matrix)
      .multiply(transform.total),
    total: matrix.multiply(transform.total),
  };
}

/** Moves the element by a point value in `<svg>` coordinates. */
export function translate(model: TransformationModel<Point>): TransformType<Point, 'transform'> {
  const translation = createTranslation(model.variable.type, model.frames, interpolatePoint);
  return {
    attributes: ['transform'],
    calculate: (value) => translation(value, model.defaultValue({ x: 0, y: 0 })),
    interpolate: interpolatePoint,
    apply: (offset, { transform }) => ({
      transform: applyInSvgSpace(transform, new DOMMatrix().translate(offset.x, offset.y)),
    }),
  };
}

/** Rotates the element by an angle in degrees around `origin` (anchor of its bounding box). */
export function rotate(
  model: TransformationModel<number>,
): TransformType<number, 'transform' | 'bbox'> {
  const translation = createTranslation(model.variable.type, model.frames, interpolateNumber);
  return {
    attributes: ['transform', 'bbox'],
    calculate: (value) => translation(value, model.defaultValue(0)),
    interpolate: interpolateNumber,
    apply: (angle, { transform, bbox }) => {
      // Pivot in the element's user space, mapped into <svg> coordinates
      const origin = boxPosition(bbox, model.config.origin);
      const pivot = new DOMPoint(origin.x, origin.y).matrixTransform(transform.total);
      const rotation = new DOMMatrix()
        .translate(pivot.x, pivot.y)
        .rotate(angle)
        .translate(-pivot.x, -pivot.y);
      return { transform: applyInSvgSpace(transform, rotation) };
    },
  };
}

/** Scales the element by a point factor around `origin` in its own user space. */
export function scale(
  model: TransformationModel<Point>,
): TransformType<Point, 'transform' | 'bbox'> {
  const translation = createTranslation(model.variable.type, model.frames, interpolatePoint);
  return {
    attributes: ['transform', 'bbox'],
    calculate: (value) => translation(value, model.defaultValue({ x: 1, y: 1 })),
    interpolate: interpolatePoint,
    apply: (factor, { transform, bbox }) => {
      const pivot = boxPosition(bbox, model.config.origin);
      const scaling = new DOMMatrix()
        .translate(pivot.x, pivot.y)
        .scale(factor.x, factor.y)
        .translate(-pivot.x, -pivot.y);
      return {
        transform: {
          local: transform.local.multiply(scaling),
          total: transform.total.multiply(scaling),
        },
      };
    },
  };
}

/** Position on a path and its direction there. */
export interface PathPose extends Point {
  /** Direction of the path in degrees, clockwise from the positive x axis (`<svg>` coordinates). */
  readonly angle: number;
}

/**
 * Position and direction on a path, given as percentage of its length, in `<svg>` coordinates.
 * The direction is the chord between two points just before and after the position, so it is the
 * mean direction exactly at a corner; at the ends only the inner side is used.
 */
export function pathPose(path: SVGGeometryElement, percent: number): PathPose {
  const length = path.getTotalLength();
  const at = (Math.min(Math.max(percent, 0), 100) / 100) * length;
  const matrix = totalMatrix(path);
  const point = (distance: number): DOMPoint => {
    const local = path.getPointAtLength(Math.min(Math.max(distance, 0), length));
    return new DOMPoint(local.x, local.y).matrixTransform(matrix);
  };
  const { x, y } = point(at);
  const delta = Math.max(length * 1e-4, 1e-3);
  const before = point(at - delta);
  const after = point(at + delta);
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const angle = dx === 0 && dy === 0 ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI;
  return { x, y, angle };
}

/** Position on a path, given as percentage of its length, in `<svg>` coordinates. */
export function pointOnPath(path: SVGGeometryElement, percent: number): Point {
  const { x, y } = pathPose(path, percent);
  return { x, y };
}

/**
 * Moves the element along `path` so that its `origin` anchor lies on the path; the value is the position
 * in percent of the path length (0–100). Overrides the position reached by higher-priority transforms.
 * With `orient`, the element is also rotated around the anchor by the direction of the path; it is
 * drawn facing right (positive x axis), and a rotation it already has is kept on top.
 */
export function motionPath(
  model: TransformationModel<number>,
  path: SVGGeometryElement,
): TransformType<number, 'transform' | 'bbox'> {
  const translation = createTranslation(model.variable.type, model.frames, interpolateNumber);
  const orient = model.config.orient === true;
  return {
    attributes: ['transform', 'bbox'],
    calculate: (value) => translation(value, model.defaultValue(0)),
    interpolate: interpolateNumber,
    apply: (percent, { transform, bbox }) => {
      const target = pathPose(path, percent);
      const anchor = boxPosition(bbox, model.config.origin);
      const current = new DOMPoint(anchor.x, anchor.y).matrixTransform(transform.total);
      let matrix = new DOMMatrix().translate(target.x - current.x, target.y - current.y);
      if (orient) {
        // Rotate around the point on the path after moving the anchor there
        matrix = new DOMMatrix()
          .translate(target.x, target.y)
          .rotate(target.angle)
          .translate(-target.x, -target.y)
          .multiply(matrix);
      }
      return { transform: applyInSvgSpace(transform, matrix) };
    },
  };
}
