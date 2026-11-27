/**
 * Schema of the graphic configuration (`cuttleskin.config.json`) shared by editor and runtime.
 */
import type { Settings } from './settings';

export const EASING_NAMES = [
  'step',
  'linear',
  'easein',
  'easeout',
  'easeinout',
  'backin',
  'backout',
  'elastic',
  'bounce',
  'easeoutqart',
] as const;

export type EasingName = (typeof EASING_NAMES)[number];

export const VARIABLE_TYPES = ['number', 'boolean', 'text'] as const;

export type VariableType = (typeof VARIABLE_TYPES)[number];

/** Maps each variable type to the JavaScript type of its values. */
export interface VariableValueByType {
  number: number;
  boolean: boolean;
  text: string;
}

export type VariableValue = VariableValueByType[VariableType];

/** Reserved frame names generated from the variable domain. */
/** Positions at the ends of a number variable's range; frames there follow range changes. */
export const RANGE_ENDS = {
  min: '$min',
  max: '$max',
} as const;

export type RangeEnd = (typeof RANGE_ENDS)[keyof typeof RANGE_ENDS];

/**
 * Position of a frame on the variable's domain: a number within the range or `$min`/`$max` for
 * number variables (see `RangeEnd`), `false`/`true` for boolean variables, the text for text
 * variables.
 */
export type FramePosition = VariableValue;

/** Properties shared by all variable configurations. */
interface VariableConfigBase<T extends VariableType> {
  readonly name: string;
  readonly type: T;
  readonly defaultValue?: VariableValueByType[T];
}

/** Numeric variable; values are clamped to [minimum, maximum], which also define the `$min`/`$max` frames. */
export interface NumberVariableConfig extends VariableConfigBase<'number'> {
  readonly minimum: number;
  readonly maximum: number;
}

export type BooleanVariableConfig = VariableConfigBase<'boolean'>;

export type TextVariableConfig = VariableConfigBase<'text'>;

export type VariableConfig = NumberVariableConfig | BooleanVariableConfig | TextVariableConfig;

/**
 * Value a transformation takes at a position of its variable. Between the frames of a number
 * variable the runtime interpolates; boolean and text variables switch to the frame located
 * exactly at the value.
 */
export interface FrameConfig<V = unknown> {
  /** Position on the variable's domain; unique within the transformation. */
  readonly at: FramePosition;
  /** `null` marks a frame that is configured but explicitly empty (falls back to the default value). */
  readonly value: V | null;
  /** Easing of the curve from this frame towards the next frame (over the variable's range). */
  readonly easing?: EasingName;
  /** Optional description, e.g. what a threshold means; not used by the runtime. */
  readonly label?: string;
}

/** Animation applied when a transformation changes its value at runtime. */
export interface TransitionConfig {
  /** Duration in milliseconds. */
  readonly duration: number;
  readonly easing: EasingName;
}

export const TRANSFORMATION_TYPES = [
  'translate',
  'rotate',
  'scale',
  'text',
  'image-url',
  'opacity',
  'fill-color',
  'stroke-color',
  'stroke-width',
  'motion-path',
] as const;

export type TransformationType = (typeof TRANSFORMATION_TYPES)[number];

export const ANCHOR_NAMES = [
  'center',
  'top-left',
  'top',
  'top-right',
  'left',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const;

/** Named reference point on an element's bounding box. */
export type AnchorName = (typeof ANCHOR_NAMES)[number];

/** Reference point as anchor name or explicit coordinate in the element's user space. */
export type Anchor = AnchorName | { readonly x: number; readonly y: number };

/** Binds a variable to a visual property (rotation, color, ...) of an SVG element. */
export interface TransformationConfig<V = unknown> {
  readonly name?: string;
  readonly type: TransformationType;
  /** ID of the SVG element. */
  readonly element: string;
  /** Name of the driving variable. */
  readonly variable: string;
  /** Values at positions of the variable, each position at most once. */
  readonly frames: readonly FrameConfig<V>[];
  /** Value wherever no frame applies, e.g. text values without a frame; default: drawn state. */
  readonly default?: V;
  /** Higher priorities are applied first; default 0. */
  readonly priority?: number;
  readonly transition?: TransitionConfig;
  /** Use the formatted variable value directly instead of frames (`text`, `image-url`). */
  readonly bind?: boolean;
  /**
   * Origin like CSS `transform-origin`: pivot for `rotate`, center of `scale`, point of the
   * element placed on the path for `motion-path`; default `center`.
   */
  readonly origin?: Anchor;
  /** ID of the path (or other shape) followed by `motion-path`; frame values are percentages of its length. */
  readonly path?: string;
  /**
   * `motion-path` only: rotates the element along the direction of the path. The element is
   * drawn facing right (positive x axis); default `false`.
   */
  readonly orient?: boolean;
  /** Further type specific options. */
  readonly [option: string]: unknown;
}

/** Runtime options of an SVG element independent of transformations. */
export interface ElementConfig {
  /** ID of the SVG element. */
  readonly id: string;
  /**
   * Name under which the element reports its events, e.g. `doorFrontLeft`. It decouples the
   * application from the SVG: the application reacts to the name, the ID may change with the
   * drawing. Defaults to the ID.
   */
  readonly name?: string;
  /** DOM events forwarded to the graphic as `element.<event>`. */
  readonly events?: readonly string[];
}

/** Root of `cuttleskin.config.json`. */
export interface GraphicConfig {
  readonly variables: readonly VariableConfig[];
  readonly transformations: readonly TransformationConfig[];
  readonly elements?: readonly ElementConfig[];
  /** Settings overrides stored with the graphic. */
  readonly settings?: Partial<Settings>;
}
