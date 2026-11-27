import {
  resolveFramePosition,
  type FrameConfig,
  type VariableConfig,
  type VariableValue,
} from '@cuttleskin/config';
import { resolveEasing, type Easing } from '../util/easing';

/** Position on the variable's domain combined with the value a transformation configures there. */
export interface Frame<V> {
  /** Variable value at which this frame is located. */
  readonly index: VariableValue;
  /** Whether the transformation configures a value for this frame. */
  readonly exists: boolean;
  readonly value: V | null;
  /** Easing from this frame towards the next one. */
  readonly easing: Easing;
}

/** All frames of a transformation, as ordered series and as lookup by variable value. */
export interface Frames<V> {
  /** All frames; sorted by index for number variables. */
  readonly series: readonly Frame<V>[];
  /** Frames keyed by their variable value. */
  readonly byIndex: ReadonlyMap<VariableValue, Frame<V>>;
}

/**
 * Frames of a transformation: its configured frames plus the ends of the domain (minimum and
 * maximum, false and true) without a value where the transformation configures none. The ends
 * keep interpolation and lookup defined over the whole domain.
 */
export function createFrames<V>(
  variable: VariableConfig,
  domainEnds: readonly VariableValue[],
  configs: readonly FrameConfig<V>[],
): Frames<V> {
  const byIndex = new Map<VariableValue, Frame<V>>();
  for (const index of domainEnds) {
    byIndex.set(index, { index, exists: false, value: null, easing: resolveEasing(undefined) });
  }
  for (const config of configs) {
    const index = resolveFramePosition(variable, config.at);
    byIndex.set(index, {
      index,
      exists: true,
      value: config.value,
      easing: resolveEasing(config.easing),
    });
  }

  const series = Array.from(byIndex.values());
  if (variable.type === 'number') {
    series.sort((left, right) => (left.index as number) - (right.index as number));
  }
  return { series, byIndex };
}
