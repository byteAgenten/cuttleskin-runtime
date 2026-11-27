import {
  RANGE_ENDS,
  type FramePosition,
  type VariableConfig,
  type VariableValue,
} from './graphic-config';

/** Whether the position is one of the ends `$min`/`$max` of a number variable's range. */
export function isRangeEnd(at: FramePosition): at is (typeof RANGE_ENDS)[keyof typeof RANGE_ENDS] {
  return at === RANGE_ENDS.min || at === RANGE_ENDS.max;
}

/**
 * Variable value at which a frame is located: `$min`/`$max` resolve to the range of a number
 * variable, all other positions are values of the variable already.
 */
export function resolveFramePosition(variable: VariableConfig, at: FramePosition): VariableValue {
  if (variable.type === 'number') {
    if (at === RANGE_ENDS.min) return variable.minimum;
    if (at === RANGE_ENDS.max) return variable.maximum;
  }
  return at;
}
