import {
  ANCHOR_NAMES,
  EASING_NAMES,
  RANGE_ENDS,
  TRANSFORMATION_TYPES,
  VARIABLE_TYPES,
  type Anchor,
  type BooleanVariableConfig,
  type ElementConfig,
  type FrameConfig,
  type FramePosition,
  type GraphicConfig,
  type NumberVariableConfig,
  type TextVariableConfig,
  type TransformationConfig,
  type TransformationType,
  type TransitionConfig,
  type VariableConfig,
  type VariableType,
  type VariableValue,
} from '../graphic-config';
import { resolveFramePosition } from '../frame-position';
import { IMAGE_RENDERINGS, MODES, type Settings } from '../settings';
import {
  ConfigError,
  INVALID,
  IssueCollector,
  joinPath,
  type ConfigIssue,
  type Invalid,
} from './issues';
import {
  boolean,
  expectedType,
  finiteNumber,
  list,
  nonEmptyString,
  oneOf,
  optional,
  point,
  record,
  string,
  type UnknownRecord,
} from './primitives';
import { upgradeGraphicConfig } from './upgrade-graphic-config';

/** Result of lenient parsing: all valid entries plus the issues of the dropped ones. */
export interface ParseResult {
  readonly config: GraphicConfig;
  readonly issues: readonly ConfigIssue[];
}

type Parser<T> = (value: unknown, path: string, issues: IssueCollector) => T | Invalid;

const VARIABLE_VALUE_PARSERS: { readonly [T in VariableType]: Parser<VariableValue> } = {
  number: finiteNumber,
  boolean,
  text: string,
};

const FRAME_VALUE_PARSERS: { readonly [T in TransformationType]: Parser<unknown> } = {
  translate: point,
  scale: point,
  rotate: finiteNumber,
  'stroke-width': finiteNumber,
  opacity: (value, path, issues) => {
    const result = finiteNumber(value, path, issues);
    if (result === INVALID) return INVALID;
    return result >= 0 && result <= 1
      ? result
      : issues.add(path, 'Opacity must be between 0 and 1', 'config.opacityRange');
  },
  'fill-color': nonEmptyString,
  'stroke-color': nonEmptyString,
  text: string,
  'image-url': string,
  'motion-path': (value, path, issues) => {
    const result = finiteNumber(value, path, issues);
    if (result === INVALID) return INVALID;
    return result >= 0 && result <= 100
      ? result
      : issues.add(
          path,
          'Path position must be between 0 and 100 (percent)',
          'config.pathPositionRange',
        );
  },
};

/**
 * Position (`at`) of a frame: a number within the range or `$min`/`$max` for number variables,
 * `false`/`true` for boolean variables, any text for text variables.
 */
function parseFramePosition(
  value: unknown,
  path: string,
  issues: IssueCollector,
  variable: VariableConfig,
): FramePosition | Invalid {
  if (value === undefined || value === null) {
    return issues.add(path, 'Missing frame position', 'config.missingFramePosition');
  }
  if (variable.type === 'number') {
    if (value === RANGE_ENDS.min || value === RANGE_ENDS.max) return value;
    if (typeof value !== 'number') {
      return issues.add(
        path,
        `Expected a number, ${RANGE_ENDS.min} or ${RANGE_ENDS.max}`,
        'config.expectedFramePosition',
        { min: RANGE_ENDS.min, max: RANGE_ENDS.max },
      );
    }
    const at = finiteNumber(value, path, issues);
    if (at === INVALID) return INVALID;
    if (at < variable.minimum || at > variable.maximum) {
      return issues.add(
        path,
        `Position must be between ${String(variable.minimum)} and ${String(variable.maximum)}`,
        'config.positionRange',
        { minimum: variable.minimum, maximum: variable.maximum },
      );
    }
    return at;
  }
  return VARIABLE_VALUE_PARSERS[variable.type](value, path, issues);
}

function parseVariable(
  value: unknown,
  path: string,
  issues: IssueCollector,
  names: Set<string>,
): VariableConfig | Invalid {
  const input = record(value, path, issues);
  if (input === INVALID) return INVALID;

  const name = nonEmptyString(input.name, joinPath(path, 'name'), issues);
  const type = oneOf(VARIABLE_TYPES, input.type, joinPath(path, 'type'), issues);
  if (name === INVALID || type === INVALID) return INVALID;
  if (names.has(name))
    return issues.add(
      joinPath(path, 'name'),
      `Duplicate variable name: ${name}`,
      'config.duplicateVariable',
      { name },
    );

  const parseValue = VARIABLE_VALUE_PARSERS[type];
  const defaultValue = optional(input.defaultValue, (v) =>
    parseValue(v, joinPath(path, 'defaultValue'), issues),
  );
  if (defaultValue === INVALID) return INVALID;

  // Values were validated with the parser of `type`, so the casts below are safe
  const common = {
    name,
    ...(defaultValue === undefined ? {} : { defaultValue }),
  };

  let result: VariableConfig;
  if (type === 'number') {
    const minimum = finiteNumber(input.minimum, joinPath(path, 'minimum'), issues);
    const maximum = finiteNumber(input.maximum, joinPath(path, 'maximum'), issues);
    if (minimum === INVALID || maximum === INVALID) return INVALID;
    if (minimum > maximum) {
      return issues.add(
        joinPath(path, 'maximum'),
        'Maximum must not be less than minimum',
        'config.maximumBelowMinimum',
      );
    }
    result = { ...common, type, minimum, maximum } as NumberVariableConfig;
  } else {
    result = { ...common, type } as BooleanVariableConfig | TextVariableConfig;
  }

  names.add(name);
  return result;
}

function parseFrames(
  value: unknown,
  path: string,
  issues: IssueCollector,
  type: TransformationType,
  variable: VariableConfig,
): FrameConfig[] | Invalid {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return expectedType(issues, path, 'array', value);

  const parseValue = FRAME_VALUE_PARSERS[type];
  const result: FrameConfig[] = [];
  // Index of the frame at each resolved position; two frames at one position would compete
  const taken = new Map<VariableValue, number>();
  let valid = true;

  for (const [index, entry] of (value as unknown[]).entries()) {
    const framePath = joinPath(path, String(index));
    const frame = record(entry, framePath, issues);
    if (frame === INVALID) {
      valid = false;
      continue;
    }
    const at = parseFramePosition(frame.at, joinPath(framePath, 'at'), issues, variable);
    const parsedValue =
      frame.value === null ? null : parseValue(frame.value, joinPath(framePath, 'value'), issues);
    const easing = optional(frame.easing, (v) =>
      oneOf(EASING_NAMES, v, joinPath(framePath, 'easing'), issues),
    );
    const label = optional(frame.label, (v) => string(v, joinPath(framePath, 'label'), issues));
    if (at === INVALID || parsedValue === INVALID || easing === INVALID || label === INVALID) {
      valid = false;
      continue;
    }
    const position = resolveFramePosition(variable, at);
    const other = taken.get(position);
    if (other !== undefined) {
      issues.add(
        joinPath(framePath, 'at'),
        `Frame ${String(other)} is already at this position`,
        'config.framePositionTaken',
        { frame: other },
      );
      valid = false;
      continue;
    }
    taken.set(position, index);
    result.push({
      at,
      value: parsedValue,
      ...(easing === undefined ? {} : { easing }),
      ...(label === undefined || label === '' ? {} : { label }),
    });
  }

  return valid ? result : INVALID;
}

function parseTransition(
  value: unknown,
  path: string,
  issues: IssueCollector,
): TransitionConfig | Invalid {
  const input = record(value, path, issues);
  if (input === INVALID) return INVALID;
  const duration = finiteNumber(input.duration, joinPath(path, 'duration'), issues);
  const easing = oneOf(EASING_NAMES, input.easing ?? 'linear', joinPath(path, 'easing'), issues);
  if (duration === INVALID || easing === INVALID) return INVALID;
  if (duration < 0) {
    return issues.add(
      joinPath(path, 'duration'),
      'Duration must not be negative',
      'config.negativeDuration',
    );
  }
  return { duration, easing };
}

function parseAnchor(value: unknown, path: string, issues: IssueCollector): Anchor | Invalid {
  return typeof value === 'string'
    ? oneOf(ANCHOR_NAMES, value, path, issues)
    : point(value, path, issues);
}

/** Accepts `true` and the legacy editor export value `"value"`. */
function parseBind(value: unknown, path: string, issues: IssueCollector): boolean | Invalid {
  if (value === 'value') return true;
  return boolean(value, path, issues);
}

/** `path` is required for `motion-path` and not used by other types. */
function parsePathOption(
  type: TransformationType,
  value: unknown,
  path: string,
  issues: IssueCollector,
): string | undefined | Invalid {
  if (type !== 'motion-path') return undefined;
  if (value === undefined || value === null) {
    return issues.add(path, 'Missing path element for motion-path', 'config.missingMotionPath');
  }
  return nonEmptyString(value, path, issues);
}

function parseTransformation(
  value: unknown,
  path: string,
  issues: IssueCollector,
  variables: ReadonlyMap<string, VariableConfig>,
): TransformationConfig | Invalid {
  const input = record(value, path, issues);
  if (input === INVALID) return INVALID;

  const type = oneOf(TRANSFORMATION_TYPES, input.type, joinPath(path, 'type'), issues);
  const element = nonEmptyString(input.element, joinPath(path, 'element'), issues);
  const variableName = nonEmptyString(input.variable, joinPath(path, 'variable'), issues);
  if (type === INVALID || element === INVALID || variableName === INVALID) return INVALID;

  const variable = variables.get(variableName);
  if (!variable) {
    return issues.add(
      joinPath(path, 'variable'),
      `Unknown variable: ${variableName}`,
      'config.unknownVariable',
      { name: variableName },
    );
  }

  const at = (key: string): string => joinPath(path, key);
  const name = optional(input.name, (v) => nonEmptyString(v, at('name'), issues));
  const frames = parseFrames(input.frames, at('frames'), issues, type, variable);
  const fallback = optional(input.default, (v) =>
    FRAME_VALUE_PARSERS[type](v, at('default'), issues),
  );
  const priority = optional(input.priority, (v) => finiteNumber(v, at('priority'), issues));
  const transition = optional(input.transition, (v) =>
    parseTransition(v, at('transition'), issues),
  );
  const bind = optional(input.bind, (v) => parseBind(v, at('bind'), issues));
  const origin = optional(input.origin, (v) => parseAnchor(v, at('origin'), issues));
  const pathId = parsePathOption(type, input.path, at('path'), issues);
  // `orient` only applies to `motion-path`; other types ignore it like unknown options
  const orient =
    type === 'motion-path'
      ? optional(input.orient, (v) => boolean(v, at('orient'), issues))
      : undefined;

  if (
    name === INVALID ||
    frames === INVALID ||
    fallback === INVALID ||
    priority === INVALID ||
    transition === INVALID ||
    bind === INVALID ||
    origin === INVALID ||
    pathId === INVALID ||
    orient === INVALID
  ) {
    return INVALID;
  }

  return {
    type,
    element,
    variable: variableName,
    frames,
    ...(fallback === undefined ? {} : { default: fallback }),
    ...(name === undefined ? {} : { name }),
    ...(priority === undefined ? {} : { priority }),
    ...(transition === undefined ? {} : { transition }),
    ...(bind === true ? { bind } : {}),
    ...(origin === undefined ? {} : { origin }),
    ...(pathId === undefined ? {} : { path: pathId }),
    ...(orient === true ? { orient } : {}),
  };
}

function parseElement(
  value: unknown,
  path: string,
  issues: IssueCollector,
  ids: Set<string>,
): ElementConfig | Invalid {
  const input = record(value, path, issues);
  if (input === INVALID) return INVALID;

  const id = nonEmptyString(input.id, joinPath(path, 'id'), issues);
  if (id === INVALID) return INVALID;
  if (ids.has(id)) {
    return issues.add(joinPath(path, 'id'), `Duplicate element id: ${id}`, 'config.duplicateId', {
      id,
    });
  }

  const name = optional(input.name, (v) => nonEmptyString(v, joinPath(path, 'name'), issues));
  if (name === INVALID) return INVALID;

  const eventsPath = joinPath(path, 'events');
  const before = issues.issues.length;
  const events = list(input.events, eventsPath, issues, (v, p) => nonEmptyString(v, p, issues));
  if (issues.issues.length > before) return INVALID;

  ids.add(id);
  return {
    id,
    ...(name === undefined ? {} : { name }),
    ...(events.length ? { events } : {}),
  };
}

function parseSettings(
  value: unknown,
  path: string,
  issues: IssueCollector,
): Partial<Settings> | Invalid {
  const input = record(value, path, issues);
  if (input === INVALID) return INVALID;
  const mode = optional(input.mode, (v) => oneOf(MODES, v, joinPath(path, 'mode'), issues));
  const imageRendering = optional(input.imageRendering, (v) =>
    oneOf(IMAGE_RENDERINGS, v, joinPath(path, 'imageRendering'), issues),
  );
  if (mode === INVALID || imageRendering === INVALID) return INVALID;
  return {
    ...(mode === undefined ? {} : { mode }),
    ...(imageRendering === undefined ? {} : { imageRendering }),
  };
}

const EMPTY_CONFIG: GraphicConfig = Object.freeze({ variables: [], transformations: [] });

/**
 * Validates a graphic configuration (already parsed JSON) and normalizes legacy editor output.
 * Invalid variables, transformations and elements are dropped as a whole and reported in `issues`;
 * transformations referencing a dropped or unknown variable are dropped as well.
 */
export function parseGraphicConfig(input: unknown): ParseResult {
  const issues = new IssueCollector();
  const root: UnknownRecord | Invalid = record(upgradeGraphicConfig(input), '', issues);
  if (root === INVALID) return { config: EMPTY_CONFIG, issues: issues.issues };

  const variableNames = new Set<string>();
  const variables = list(root.variables, 'variables', issues, (v, p) =>
    parseVariable(v, p, issues, variableNames),
  );
  const variablesByName = new Map(variables.map((variable) => [variable.name, variable]));
  const transformations = list(root.transformations, 'transformations', issues, (v, p) =>
    parseTransformation(v, p, issues, variablesByName),
  );
  const elementIds = new Set<string>();
  const elements = list(root.elements, 'elements', issues, (v, p) =>
    parseElement(v, p, issues, elementIds),
  );
  const settings = optional(root.settings, (v) => parseSettings(v, 'settings', issues));

  const config: GraphicConfig = {
    variables,
    transformations,
    ...(elements.length ? { elements } : {}),
    ...(settings === undefined || settings === INVALID ? {} : { settings }),
  };
  return { config, issues: issues.issues };
}

/** Parses JSON text; syntax errors are reported as an issue with an empty configuration. */
export function parseGraphicConfigJson(text: string): ParseResult {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      config: EMPTY_CONFIG,
      issues: [
        {
          path: '',
          message: `Invalid JSON: ${message}`,
          code: 'config.invalidJson',
          params: { message },
        },
      ],
    };
  }
  return parseGraphicConfig(input);
}

/** Like `parseGraphicConfig`, but throws a `ConfigError` if there is any issue. */
export function parseGraphicConfigStrict(input: unknown): GraphicConfig {
  const { config, issues } = parseGraphicConfig(input);
  if (issues.length) throw new ConfigError(issues);
  return config;
}
