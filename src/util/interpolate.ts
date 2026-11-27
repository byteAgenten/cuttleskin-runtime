import { formatColor, interpolateColor, parseColor } from './color';
import type { Easing } from './easing';
import type { Point } from './geometry';

/** Interpolates between two values; `t` in [0, 1] is passed through `easing` first. */
export type Interpolator<V> = (from: V, to: V, t: number, easing?: Easing) => V;

function ease(t: number, easing?: Easing): number {
  return easing ? easing(t) : t;
}

export const interpolateNumber: Interpolator<number> = (from, to, t, easing) =>
  from + (to - from) * ease(t, easing);

export const interpolatePoint: Interpolator<Point> = (from, to, t, easing) => {
  const f = ease(t, easing);
  return { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f };
};

/**
 * Interpolates CSS color strings; intermediate results are hex/rgba strings or `none`.
 * The bounds are returned unchanged, so non-color paints such as `url(#gradient)` survive.
 */
export const interpolateCssColor: Interpolator<string> = (from, to, t, easing) => {
  const f = ease(t, easing);
  if (f === 0) return from;
  if (f === 1) return to;
  return formatColor(interpolateColor(parseColor(from), parseColor(to), f));
};

/** Discrete values (text, urls) keep the start value until the end is reached. */
export const interpolateDiscrete = <V>(from: V, to: V, t: number, easing?: Easing): V =>
  ease(t, easing) < 1 ? from : to;
