import type { Frame, Frames } from '../model/frames';
import { assert } from '../util/assert';
import type { Interpolator } from '../util/interpolate';
import type { Translation } from './translation';

/** Configured frames below and above a variable value. */
interface Bounds<V> {
  readonly lower: Frame<V>;
  readonly upper: Frame<V>;
}

/** Configured frames enclosing `index`; falls back to the first/last frame of the series. */
function boundaries<V>(index: number, series: readonly Frame<V>[]): Bounds<V> {
  const first = series[0];
  const last = series.at(-1);
  assert(first && last, 'Need at least one frame');

  let lower: Frame<V> | undefined;
  let upper: Frame<V> | undefined;

  for (const frame of series) {
    // Only frames with a configured value delimit a transition
    if (!frame.exists) continue;
    if ((frame.index as number) > index) {
      upper = frame;
      break;
    }
    lower = frame;
  }

  return { lower: lower ?? first, upper: upper ?? last };
}

function progress<V>(index: number, { lower, upper }: Bounds<V>): number {
  const min = lower.index as number;
  const max = upper.index as number;
  const clamped = Math.min(Math.max(index, min), max);
  const t = (clamped - min) / (max - min);
  return Number.isFinite(t) ? t : 0;
}

/** Continuous interpolation between the frames enclosing the value (number variables). */
export function transition<V>(frames: Frames<V>, interpolate: Interpolator<V>): Translation<V> {
  return (index, fallback) => {
    if (typeof index !== 'number' || Number.isNaN(index)) return fallback;

    const bounds = boundaries(index, frames.series);

    // Without a lower value start from the fallback
    const lowerValue = bounds.lower.value ?? fallback;
    // Without an upper value hold the lower value, unless the upper frame is configured explicitly empty
    const upperValue = bounds.upper.value ?? (bounds.upper.exists ? fallback : lowerValue);

    return interpolate(lowerValue, upperValue, progress(index, bounds), bounds.lower.easing);
  };
}
