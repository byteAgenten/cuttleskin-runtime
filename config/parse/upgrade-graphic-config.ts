import { isRecord, type UnknownRecord } from './primitives';

/** Positions of the former reserved frame names. */
const RESERVED_POSITIONS: Readonly<Record<string, unknown>> = {
  $min: '$min',
  $max: '$max',
  $false: false,
  $true: true,
};

/** Copy of `record` without the property `key`. */
function withoutKey(record: UnknownRecord, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

/**
 * Converts one frame of the former object format (`name -> { at?, value, transition? }`) into
 * an entry of the frame list. `keyFrames` are the named positions of the variable in the oldest
 * format. Names that only repeat the position are dropped, other names are kept as `label`.
 */
function upgradeFrame(
  name: string,
  frame: UnknownRecord,
  keyFrames: UnknownRecord,
): Record<string, unknown> {
  const at = Object.hasOwn(RESERVED_POSITIONS, name)
    ? RESERVED_POSITIONS[name]
    : 'at' in frame
      ? frame.at
      : Object.hasOwn(keyFrames, name)
        ? keyFrames[name]
        : name.startsWith('$')
          ? name
          : undefined;
  const label = name.startsWith('$') || name === String(at) ? undefined : name;
  const easing = frame.easing ?? frame.transition;
  return {
    ...(at === undefined ? {} : { at }),
    value: frame.value,
    ...(easing === undefined || easing === null ? {} : { easing }),
    ...(label === undefined ? {} : { label }),
  };
}

function upgradeTransformation(
  transformation: unknown,
  keyFramesByVariable: ReadonlyMap<string, UnknownRecord>,
): unknown {
  if (!isRecord(transformation) || !isRecord(transformation.frames)) return transformation;
  const keyFrames =
    (typeof transformation.variable === 'string'
      ? keyFramesByVariable.get(transformation.variable)
      : undefined) ?? {};

  let fallback: unknown;
  const frames: Record<string, unknown>[] = [];
  for (const [name, frame] of Object.entries(transformation.frames)) {
    if (!isRecord(frame)) {
      frames.push({ at: name, value: frame });
    } else if (name === '$default') {
      fallback = frame.value;
    } else {
      frames.push(upgradeFrame(name, frame, keyFrames));
    }
  }

  const rest = withoutKey(transformation, 'frames');
  const keepDefault = 'default' in rest || fallback === undefined || fallback === null;
  return { ...rest, frames, ...(keepDefault ? {} : { default: fallback }) };
}

/**
 * Converts configurations of former formats into the current one, in which every transformation
 * lists its frames with their position (`frames: [{ at, value }]`):
 *
 * - Frames as object keyed by name: `$min`/`$max` and `$false`/`$true` become positions, other
 *   frames keep their `at`, `$default` becomes the transformation's `default`, the frame option
 *   `transition` becomes `easing`.
 * - Named key frames of variables (`variables[].keyFrames`): referenced frames get the position
 *   of their key frame; the `keyFrames` are removed.
 *
 * Returns the input unchanged if there is nothing to convert, otherwise a converted copy; the
 * input is never modified.
 */
export function upgradeGraphicConfig(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const variables = Array.isArray(input.variables) ? (input.variables as unknown[]) : [];
  const transformations = Array.isArray(input.transformations)
    ? (input.transformations as unknown[])
    : [];

  const keyFramesByVariable = new Map<string, UnknownRecord>();
  for (const variable of variables) {
    if (isRecord(variable) && 'keyFrames' in variable && typeof variable.name === 'string') {
      keyFramesByVariable.set(
        variable.name,
        isRecord(variable.keyFrames) ? variable.keyFrames : {},
      );
    }
  }
  const formerFrames = transformations.some(
    (transformation) => isRecord(transformation) && isRecord(transformation.frames),
  );
  if (keyFramesByVariable.size === 0 && !formerFrames) return input;

  return {
    ...input,
    ...(Array.isArray(input.variables)
      ? {
          variables: variables.map((variable) => {
            if (!isRecord(variable) || !('keyFrames' in variable)) return variable;
            return withoutKey(variable, 'keyFrames');
          }),
        }
      : {}),
    ...(Array.isArray(input.transformations)
      ? {
          transformations: transformations.map((transformation) =>
            upgradeTransformation(transformation, keyFramesByVariable),
          ),
        }
      : {}),
  };
}
