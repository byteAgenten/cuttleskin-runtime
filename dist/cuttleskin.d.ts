export declare const MODES: readonly ["embedded", "editor"];
/** Host environment the runtime is embedded in. */
export type Mode = (typeof MODES)[number];
export declare const IMAGE_RENDERINGS: readonly ["quality", "speed"];
/** `speed` renders images pixelated (nearest neighbour), `quality` uses the browser default. */
export type ImageRendering = (typeof IMAGE_RENDERINGS)[number];
/** Runtime options provided by the host when creating a graphic. */
export interface Settings {
  readonly mode: Mode;
  readonly imageRendering: ImageRendering;
}
export declare const DEFAULT_SETTINGS: Settings;
export declare function resolveSettings(overrides?: Partial<Settings>): Settings;
export declare const EASING_NAMES: readonly ["step", "linear", "easein", "easeout", "easeinout", "backin", "backout", "elastic", "bounce", "easeoutqart"];
export type EasingName = (typeof EASING_NAMES)[number];
export declare const VARIABLE_TYPES: readonly ["number", "boolean", "text"];
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
export declare const RANGE_ENDS: {
  readonly min: "$min";
  readonly max: "$max";
};
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
export declare const TRANSFORMATION_TYPES: readonly ["translate", "rotate", "scale", "text", "image-url", "opacity", "fill-color", "stroke-color", "stroke-width", "motion-path"];
export type TransformationType = (typeof TRANSFORMATION_TYPES)[number];
export declare const ANCHOR_NAMES: readonly ["center", "top-left", "top", "top-right", "left", "right", "bottom-left", "bottom", "bottom-right"];
/** Named reference point on an element's bounding box. */
export type AnchorName = (typeof ANCHOR_NAMES)[number];
/** Reference point as anchor name or explicit coordinate in the element's user space. */
export type Anchor = AnchorName | {
  readonly x: number;
  readonly y: number;
};
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
/** Whether the position is one of the ends `$min`/`$max` of a number variable's range. */
export declare function isRangeEnd(at: FramePosition): at is (typeof RANGE_ENDS)[keyof typeof RANGE_ENDS];
/**
 * Variable value at which a frame is located: `$min`/`$max` resolve to the range of a number
 * variable, all other positions are values of the variable already.
 */
export declare function resolveFramePosition(variable: VariableConfig, at: FramePosition): VariableValue;
/** Values inserted into the translated text of an issue. */
type IssueParams = Readonly<Record<string, string | number>>;
/** Problem found while parsing a configuration. */
interface ConfigIssue {
  /** Location in the input, e.g. `transformations[2].frames.$min.value`. */
  readonly path: string;
  /** English description. */
  readonly message: string;
  /**
   * Stable identifier of the kind of problem, e.g. `config.expectedType`, so that user
   * interfaces can show the issue in their own language with `params`.
   */
  readonly code: string;
  readonly params?: IssueParams;
}
/** Thrown by strict parsing when the configuration contains issues. */
export declare class ConfigError extends Error {
  readonly issues: readonly ConfigIssue[];
  constructor(issues: readonly ConfigIssue[]);
}
/** Result of lenient parsing: all valid entries plus the issues of the dropped ones. */
interface ParseResult {
  readonly config: GraphicConfig;
  readonly issues: readonly ConfigIssue[];
}
/**
 * Validates a graphic configuration (already parsed JSON) and normalizes legacy editor output.
 * Invalid variables, transformations and elements are dropped as a whole and reported in `issues`;
 * transformations referencing a dropped or unknown variable are dropped as well.
 */
export declare function parseGraphicConfig(input: unknown): ParseResult;
/** Parses JSON text; syntax errors are reported as an issue with an empty configuration. */
export declare function parseGraphicConfigJson(text: string): ParseResult;
/** Like `parseGraphicConfig`, but throws a `ConfigError` if there is any issue. */
export declare function parseGraphicConfigStrict(input: unknown): GraphicConfig;
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
export declare function upgradeGraphicConfig(input: unknown): unknown;
/** Maps linear progress `t` in [0, 1] to eased progress. */
export type Easing = (t: number) => number;
/** Curves match the former Snap.svg `mina` easings so existing graphics animate identically. */
export declare const EASINGS: Readonly<Record<EasingName, Easing>>;
export declare function isEasingName(name: unknown): name is EasingName;
/** Resolves an easing by name; unknown or missing names fall back to `linear`. */
export declare function resolveEasing(name: string | null | undefined): Easing;
/** Parameters of a single progress animation from 0 to 1. */
export interface AnimateOptions {
  /** Duration in milliseconds. Values <= 0 complete synchronously. */
  readonly duration: number;
  readonly easing?: Easing;
  /** Receives eased progress (may overshoot for back/elastic easings); the last update is always 1. */
  readonly onUpdate: (progress: number) => void;
  readonly onComplete?: () => void;
}
/** Handle of a running animation. */
export interface Animation {
  /** Stops the animation without a final update and without calling `onComplete`. */
  stop(): void;
  /** `false` once the animation has completed or was stopped. */
  readonly running: boolean;
}
export declare function animate(options: AnimateOptions): Animation;
export declare function assert(condition: unknown, message: string): asserts condition;
/** Translates between asset names stored in markup/config and the URLs they are served from. */
export interface AssetResolver {
  /** URL for an asset name; absolute URLs (`http:`, `data:`, ...) are returned unchanged. */
  resolve(nameOrUrl: string): string;
  /** Asset name (file name) of a URL. */
  nameOf(url: string): string;
}
export declare function assetName(url: string): string;
/**
 * Resolves asset names relative to `root` (e.g. `assets/`). Names listed in `urls` resolve to
 * their own URL instead, e.g. content-addressed URLs that do not end with the name.
 */
export declare function createAssetResolver(root?: string, urls?: Readonly<Record<string, string>>): AssetResolver;
/** sRGB color, channels 0-255, opacity 0-1. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly opacity: number;
}
/** `null` represents "no color" (`none` or an unparseable value). */
export type Color = Rgba | null;
/**
 * Parses any CSS color (hex, rgb(), hsl(), named colors, ...) using the browser's canvas color parser.
 * Returns `null` for `none` and invalid values.
 */
export declare function parseColor(value: string): Color;
/** Formats as `#rrggbb`, or `rgba(...)` when translucent; `null` becomes `none`. */
export declare function formatColor(color: Color): string;
/**
 * Linear RGB interpolation. A missing color fades in/out using the other color's channels with opacity 0.
 */
export declare function interpolateColor(from: Color, to: Color, t: number): Color;
/** Event name -> listener argument tuple. */
export type EventMap = Record<string, unknown[]>;
export type Listener<Args extends unknown[]> = (...args: Args) => void;
/** Receiver of bubbled events, usually the parent observable. */
export interface EventSink {
  bubble(event: string, args: readonly unknown[]): void;
}
/**
 * Event emitter with optional bubbling to a parent.
 * Events emitted here are re-dispatched on the parent as `<prefix>.<event>`,
 * so `graphic.on('element.click', ...)` captures clicks of all elements.
 */
export declare class Observable<Events extends EventMap = EventMap> implements EventSink {
  #private;
  constructor(parent?: EventSink, prefix?: string);
  /** Registers a listener and returns a function that removes it again. */
  on<K extends keyof Events & string>(event: K, listener: Listener<Events[K]>): () => void;
  off<K extends keyof Events & string>(event: K, listener: Listener<Events[K]>): void;
  emit<K extends keyof Events & string>(event: K, ...args: Events[K]): void;
  bubble(event: string, args: readonly unknown[]): void;
  listenerCount(event: keyof Events & string): number;
  destroy(): void;
}
/** Rendered bounds of an element in several screen coordinate systems. */
export interface ScreenBBox {
  /** Position relative to the outermost SVG element. */
  readonly x: number;
  readonly y: number;
  /** Size in screen pixels, including element and viewBox transforms. */
  readonly width: number;
  readonly height: number;
  /** Position relative to the browser viewport. */
  readonly clientX: number;
  readonly clientY: number;
  /** Position relative to the document. */
  readonly pageX: number;
  readonly pageY: number;
}
export declare function screenBBox(element: Element): ScreenBBox;
/** Every DOM event type maps to `(element, event, bbox)`. */
export type DomEventMap = Record<string, [element: Element, event: Event, bbox: ScreenBBox]>;
/**
 * Observable that forwards DOM events of an element.
 * Exactly one native listener is registered per event type, regardless of the number of subscribers,
 * and it is removed once the last subscriber is gone.
 */
export declare class DomObservable extends Observable<DomEventMap> {
  #private;
  constructor(element: Element, parent?: EventSink, prefix?: string);
  on(event: string, listener: Listener<DomEventMap[string]>): () => void;
  off(event: string, listener: Listener<DomEventMap[string]>): void;
  destroy(): void;
}
/** Loads a text resource (markup, configuration). Rejects on network errors and non-2xx responses. */
export declare function fetchText(url: string | URL, init?: RequestInit): Promise<string>;
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
export declare function boxPosition(box: Box, anchor?: BoxAnchor | Point): Point;
/**
 * Bounding box of all elements after their transforms, in the coordinate system of the nearest viewport
 * (`getCTM`). Returns `null` for an empty list.
 */
export declare function combinedBoundingBox(elements: Iterable<SVGGraphicsElement>, padding?: number): Box | null;
/** Interpolates between two values; `t` in [0, 1] is passed through `easing` first. */
export type Interpolator<V> = (from: V, to: V, t: number, easing?: Easing) => V;
export declare const interpolateNumber: Interpolator<number>;
export declare const interpolatePoint: Interpolator<Point>;
/**
 * Interpolates CSS color strings; intermediate results are hex/rgba strings or `none`.
 * The bounds are returned unchanged, so non-color paints such as `url(#gradient)` survive.
 */
export declare const interpolateCssColor: Interpolator<string>;
/** Discrete values (text, urls) keep the start value until the end is reached. */
export declare const interpolateDiscrete: <V>(from: V, to: V, t: number, easing?: Easing) => V;
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type Logger = Readonly<Record<LogLevel, (...args: unknown[]) => void>>;
export declare function setLogLevel(level: LogLevel, enabled: boolean): void;
export declare function isLogLevelEnabled(level: LogLevel): boolean;
export declare function createLogger(name: string): Logger;
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
export declare function createFrames<V>(variable: VariableConfig, domainEnds: readonly VariableValue[], configs: readonly FrameConfig<V>[]): Frames<V>;
/** Normalized, immutable view of a variable configuration. */
export interface VariableModel {
  readonly config: VariableConfig;
  readonly name: string;
  readonly type: VariableType;
  /** Ends of the domain (minimum and maximum, false and true); text has none. */
  readonly domainEnds: readonly VariableValue[];
}
export declare function createVariableModel(config: VariableConfig): VariableModel;
/** Normalized, immutable view of a transformation configuration, linked to its variable model. */
export interface TransformationModel<V = unknown> {
  readonly config: TransformationConfig<V>;
  /** Configured name, or `<type>_<element>`. */
  readonly name: string;
  readonly type: TransformationType;
  readonly element: string;
  readonly variable: VariableModel;
  readonly frames: Frames<V>;
  /** Higher priorities are applied first. */
  readonly priority: number;
  /** Configured `default` value, or `fallback` (usually the drawn state) if there is none. */
  defaultValue(fallback: V): V;
}
export declare function createTransformationModel<V>(config: TransformationConfig<V>, variable: VariableModel): TransformationModel<V>;
/** Translates a variable value into a transformation value; `fallback` is used where no frame value applies. */
export type Translation<V> = (index: VariableValue | null | undefined, fallback: V) => V;
export declare function createTranslation<V>(indexType: VariableType, frames: Frames<V>, interpolate: Interpolator<V>): Translation<V>;
/** Discrete lookup of the frame located exactly at the variable value (boolean and text variables). */
export declare function mapping<V>(frames: Frames<V>): Translation<V>;
/** Continuous interpolation between the frames enclosing the value (number variables). */
export declare function transition<V>(frames: Frames<V>, interpolate: Interpolator<V>): Translation<V>;
export type Task = () => void;
/** Removes a scheduled task before it runs. */
export type Unschedule = () => void;
/**
 * Frame scheduler with three phases executed in order once per animation frame:
 * reset (restore DOM), transform (compute values), render (write DOM).
 * Within a phase, higher priorities run first.
 */
export interface TaskScheduler {
  scheduleReset(task: Task, priority?: number): Unschedule;
  scheduleTransform(task: Task, priority?: number): Unschedule;
  scheduleRender(task: Task, priority?: number): Unschedule;
}
/** Lifecycle events of a frame; bubbled to the parent as `scheduler.<event>`. */
export type SchedulerEvents = {
  start: [];
  reset: [];
  transform: [];
  render: [];
  complete: [];
};
/**
 * Executes scheduled tasks once per animation frame in the phases reset, transform and render.
 * - Higher priorities run first; equal priorities keep their scheduling order
 * - Tasks scheduled while a frame runs are executed in the same frame if their phase has not passed yet,
 *   otherwise in the next frame
 * - A failing task is logged and does not affect other tasks
 */
export declare class Scheduler extends Observable<SchedulerEvents> implements TaskScheduler {
  #private;
  constructor(parent?: EventSink);
  scheduleReset(task: Task, priority?: number): Unschedule;
  scheduleTransform(task: Task, priority?: number): Unschedule;
  scheduleRender(task: Task, priority?: number): Unschedule;
  /** Number of tasks waiting for execution. */
  get pending(): number;
  /** Executes all pending tasks synchronously instead of waiting for the next animation frame. */
  flush(): void;
  destroy(): void;
}
/** Transform state of an element. */
export interface TransformValue {
  /** The element's own `transform`. */
  readonly local: DOMMatrixReadOnly;
  /** Transforms of all ancestors up to the nearest `<svg>` multiplied with `local`. */
  readonly total: DOMMatrixReadOnly;
}
/** Attributes a transformation can read and write, with their value types. */
export interface AttributeTypes {
  transform: TransformValue;
  /** Read-only: `getBBox()` in the element's user space. */
  bbox: Box;
  text: string;
  /** Asset name of an image; empty string removes the reference. */
  href: string;
  /** Computed paint (`rgb(...)`, `none`, `url(...)`). */
  fill: string;
  stroke: string;
  'stroke-width': number;
  opacity: number;
  display: string;
  visibility: string;
}
export type AttributeName = keyof AttributeTypes;
/** Typed subset of attribute values. */
export type AttributeValues<A extends AttributeName> = { readonly [K in A]: AttributeTypes[K]; };
/** Read/write access to one attribute of a DOM element. */
export interface Accessor<T> {
  /** Current effective value (computed styles, resolved transforms). */
  read(): T;
  write(value: T): void;
  /** Captures the original markup state and returns a function restoring it. */
  capture(): () => void;
}
/** Transforms of the node and its ancestors up to the nearest `<svg>`. */
export declare function totalMatrix(node: SVGGraphicsElement): DOMMatrix;
export declare function createAccessor<K extends AttributeName>(node: SVGGraphicsElement, attribute: K, assets: AssetResolver): Accessor<AttributeTypes[K]>;
/**
 * Buffered attribute access for one element.
 * - Default values: effective values before any modification, read once and cached
 * - Modifications are collected and written to the DOM in `apply()`
 * - Attributes modified earlier but not in the current frame are restored to their original markup state
 */
export declare class ElementState {
  #private;
  constructor(node: SVGGraphicsElement, assets: AssetResolver);
  getDefaultValue<K extends AttributeName>(attribute: K): AttributeTypes[K];
  getDefaultValues<A extends AttributeName>(attributes: readonly A[]): AttributeValues<A>;
  /** Value modified in the current frame, otherwise the default value. */
  getValue<K extends AttributeName>(attribute: K): AttributeTypes[K];
  getValues<A extends AttributeName>(attributes: readonly A[]): AttributeValues<A>;
  setValue<K extends AttributeName>(attribute: K, value: AttributeTypes[K]): void;
  setValues<A extends AttributeName>(values: Partial<AttributeValues<A>>): void;
  /** Writes modifications to the DOM, restores attributes that are no longer modified and starts a new frame. */
  apply(): void;
  /** Discards modifications of the current frame. */
  clear(): void;
}
/** Function modifying the element state for the next render. */
export type TransformFn = (state: ElementState) => void;
/** Runtime events of an element; bubbled to the parent as `element.<event>`. */
export type ElementEvents = {
  render: [element: RuntimeElement];
  destroy: [element: RuntimeElement];
};
/** Services an element depends on. */
export interface ElementContext {
  readonly scheduler: TaskScheduler;
  readonly assets: AssetResolver;
  /** Receives bubbled runtime and DOM events, usually the graphic. */
  readonly events?: EventSink;
}
/**
 * Runtime wrapper of an SVG element.
 * - Collects transform functions and renders them in priority order in the render phase
 * - Restores the original markup state when transforms are removed or the element is destroyed
 * - Forwards DOM events via `dom` (e.g. `element.dom.on('click', ...)`, bubbled as `element.click`)
 */
export declare class RuntimeElement extends Observable<ElementEvents> {
  #private;
  readonly node: SVGGraphicsElement;
  /** DOM events of the node. */
  readonly dom: DomObservable;
  constructor(node: SVGGraphicsElement, context: ElementContext, config?: ElementConfig);
  get id(): string;
  getDefaultValue<K extends AttributeName>(attribute: K): AttributeTypes[K];
  getDefaultValues<A extends AttributeName>(attributes: readonly A[]): AttributeValues<A>;
  /**
   * Adds a transform function executed on every render; higher priorities run first.
   * Returns a function that removes it again and re-renders the element.
   */
  transform(fn: TransformFn, priority?: number): () => void;
  /** Current position and size on screen. */
  screenBBox(): ScreenBBox;
  /** Removes all transforms, restores the original markup state in the next reset phase and removes listeners. */
  destroy(): void;
}
/** Events of a variable; bubbled to the parent as `variable.<event>`. */
export type VariableEvents = {
  change: [variable: Variable, value: VariableValue | null, formattedValue: string];
  destroy: [variable: Variable];
};
/** Runtime state of a configured variable: converts, clamps and formats values and notifies on change. */
export declare class Variable extends Observable<VariableEvents> {
  #private;
  readonly model: VariableModel;
  constructor(config: VariableConfig, parent?: EventSink);
  get name(): string;
  /** Current value; `null` if the last input could not be converted. */
  get value(): VariableValue | null;
  /** Display text of the current value. */
  get formattedValue(): string;
  /**
   * Sets a new value. The input is converted to the variable type and clamped to the domain.
   * `formattedValue` overrides the generated display text.
   */
  setValue(value: unknown, formattedValue?: string): void;
  /** Restores the configured default value. */
  reset(): void;
  destroy(): void;
}
/** Events of a transformation; bubbled to the parent as `transformation.<event>`. */
export type TransformationEvents = {
  update: [transformation: Transformation];
  destroy: [transformation: Transformation];
};
/** Services and lookups a transformation depends on. */
export interface TransformationContext {
  readonly scheduler: TaskScheduler;
  readonly settings: Settings;
  getVariable(name: string): Variable | undefined;
  getElement(id: string): RuntimeElement | undefined;
  /** Receives bubbled events, usually the graphic. */
  readonly events?: EventSink;
}
/**
 * Connects a variable with an element:
 * - On variable changes, computes the new value in the transform phase
 * - Applies the value (optionally animated) as transform function on the element
 */
export declare class Transformation extends Observable<TransformationEvents> {
  #private;
  readonly model: TransformationModel;
  /** Throws if variable or element do not exist. */
  constructor(config: TransformationConfig, context: TransformationContext);
  /** Schedules a recalculation in the next transform phase. */
  schedule(): void;
  destroy(): void;
}
/** Lookup of SVG elements by ID, implemented by `GraphicDocument`. */
export interface ElementSource {
  getElement(id: string): SVGGraphicsElement | null;
}
/** Services the runtime depends on. */
export interface RuntimeContext {
  readonly scheduler: TaskScheduler;
  readonly document: ElementSource;
  readonly assets: AssetResolver;
  /** Read whenever a configuration is loaded. */
  readonly settings: Settings;
  /** Receives bubbled events of variables, elements and transformations, usually the graphic. */
  readonly events?: EventSink;
}
/**
 * Builds variables, elements and transformations from a graphic configuration and manages their lifecycle.
 * Entries that fail to initialize (e.g. missing SVG element) are logged and skipped.
 */
export declare class Runtime {
  #private;
  constructor(context: RuntimeContext);
  /** The currently loaded configuration. */
  get config(): GraphicConfig;
  get variables(): ReadonlyMap<string, Variable>;
  get transformations(): readonly Transformation[];
  /** Replaces the current configuration; the previous one is destroyed and its DOM changes restored. */
  load(config: GraphicConfig): void;
  getVariable(name: string): Variable | undefined;
  /** Sets a variable value; logs a warning if the variable does not exist. */
  setValue(name: string, value: unknown, formattedValue?: string): void;
  getValue(name: string): Variable['value'] | undefined;
  /**
   * Runtime wrapper for an element of the document, created on first access.
   * Elements with an ID are cached; `undefined` if no such element exists.
   */
  getElement(elementOrId: string | SVGGraphicsElement): RuntimeElement | undefined;
  destroy(): void;
}
/**
 * Loads and validates a graphic configuration.
 * Rejects on network errors; JSON and schema problems are returned as `issues`.
 */
export declare function loadGraphicConfig(url: string | URL, init?: RequestInit): Promise<ParseResult>;
/** Events of the document; bubbled to the parent as `document.<event>`. */
export type DocumentEvents = {
  contentChange: [];
};
/** Content accepted by `load` and `append`: SVG markup or DOM nodes. */
export type DocumentContent = string | Node;
/** Size of the container in CSS pixels. */
export interface ViewSize {
  readonly width: number;
  readonly height: number;
}
/**
 * The SVG content of a graphic inside its container.
 * - Owns the content layer (`<svg>`) that view and runtime work on
 * - Loads markup, adapts nested SVGs and resolves image URLs against the asset root
 * - Provides content bounds (declared by the SVG or measured) and the container size
 */
export declare class GraphicDocument extends Observable<DocumentEvents> implements AssetResolver {
  #private;
  readonly container: HTMLElement;
  readonly contentLayer: SVGSVGElement;
  /** Removes all existing children of `container`. */
  constructor(container: HTMLElement, parent?: EventSink);
  /**
   * Replaces the content with an SVG document. Its `viewBox` or pixel size becomes the document bounds.
   * Throws if the content is not and does not contain an `<svg>` element.
   */
  load(content: DocumentContent): void;
  /** Adds content to the content layer or to `parent`. */
  append(content: DocumentContent, parent?: Element): void;
  remove(node: Node): void;
  clear(): void;
  /** First element in the content matching a CSS selector. */
  find(selector: string): Element | null;
  /** Graphics element with the given ID inside the content. */
  getElement(id: string): SVGGraphicsElement | null;
  /** Topmost content element at a viewport position. */
  elementAt(clientX: number, clientY: number): Element | null;
  /** Root for relative image URLs, e.g. `assets/`; a trailing slash is added if missing. */
  setAssetRoot(root: string): void;
  /**
   * URLs of individual images by file name; they take precedence over the asset root. Takes
   * effect for markup loaded afterwards and for all values set by transformations.
   */
  setAssetUrls(urls: Readonly<Record<string, string>>): void;
  resolve(nameOrUrl: string): string;
  nameOf(url: string): string;
  /** Overrides the bounds declared by the loaded SVG; `null` uses the measured content bounds. */
  setDocumentBounds(bounds: Box | null): void;
  /** Declared or explicitly set bounds, otherwise the bounding box of the content. */
  contentBounds(): Box;
  /** Inner size of the container. */
  viewSize(): ViewSize;
  destroy(): void;
}
export declare const MIN_ZOOM_LEVEL = 0.01;
export declare const MAX_ZOOM_LEVEL = 99.99;
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
/** Immutable visible area of the content; all operations return a new viewport. */
export declare class Viewport implements ViewportState {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly zoomLevel: number;
  readonly viewSize: ViewSize;
  readonly contentBounds: Box;
  constructor(state?: ViewportState);
  /** Center of the content bounds. */
  get contentCenter(): Point;
  /** Center of the visible area. */
  get center(): Point;
  /** `viewBox` attribute value. */
  get viewBox(): string;
  with(changes: Partial<ViewportState>): Viewport;
  /** Adapts the visible area to the view size, keeping the zoom level and the top-left corner. */
  resize(): Viewport;
  moveBy(dx: number, dy: number): Viewport;
  centerAt(x: number, y: number): Viewport;
  /** Zooms so that `target` (content coordinates, default: center) stays at the same screen position. */
  zoomTo(zoomLevel: number, target?: Point): Viewport;
  zoomIn(factor: number, target?: Point): Viewport;
  zoomOut(factor: number, target?: Point): Viewport;
  /** Shows the whole content, centered, with `padding` content units on each side. */
  zoomToFit(padding?: number): Viewport;
  /** Zoom level 1, centered on the content. */
  zoomToOriginal(): Viewport;
  /** Shows `bounds` completely and centered, keeping the aspect ratio of the view. */
  setBounds(bounds: Box): Viewport;
  /** Keeps the center of the visible area within the content bounds. */
  sanitize(): Viewport;
  /** Converts a distance in content units to pixels. */
  toPx(point: Point): Point;
  /** Converts a distance in pixels to content units. */
  fromPx(point: Point): Point;
  /** Content coordinate at a position relative to the container's top-left corner (pixels). */
  toContent(offset: Point): Point;
}
/** Events of the view; bubbled to the parent as `view.<event>`. */
export type ViewEvents = {
  zoomChange: [zoomLevel: number];
  viewportChange: [viewport: Viewport];
};
/** Animation of a viewport change; `true` uses the defaults. */
export type ViewAnimation = boolean | {
  readonly duration?: number;
  readonly easing?: Easing;
};
/**
 * Visible area of the graphic: zooming, panning and fitting the content into the container.
 * Viewport changes are written to the content layer's `viewBox` once per animation frame.
 */
export declare class View extends Observable<ViewEvents> {
  #private;
  constructor(document: GraphicDocument, parent?: EventSink);
  get viewport(): Viewport;
  get zoomLevel(): number;
  /**
   * Re-reads container size and content bounds. Called automatically on content and size changes.
   * When the content bounds change, the visible area starts at the content's top-left corner.
   */
  resize(): void;
  /** Shows `viewport`, restricted to the content bounds, optionally animated. */
  setViewport(viewport: Viewport, animation?: ViewAnimation): void;
  zoomTo(zoomLevel: number, target?: Point, animation?: ViewAnimation): void;
  zoomIn(factor: number, target?: Point, animation?: ViewAnimation): void;
  zoomOut(factor: number, target?: Point, animation?: ViewAnimation): void;
  zoomToFit(padding?: number, animation?: ViewAnimation): void;
  zoomToOriginal(animation?: ViewAnimation): void;
  /** Shows the given elements completely; does nothing for an empty list. */
  zoomToElements(elements: Iterable<SVGGraphicsElement>, padding?: number, animation?: ViewAnimation): void;
  moveBy(dx: number, dy: number, animation?: ViewAnimation): void;
  centerAt(x: number, y: number, animation?: ViewAnimation): void;
  /** Enables panning (drag) and zooming (wheel, pinch) with mouse, touch and pen. */
  enablePointer(pan: boolean, zoom: boolean): void;
  destroy(): void;
}
/**
 * Pan and zoom interaction for a view, based on Pointer Events (mouse, touch and pen):
 * - Drag with one pointer pans, with a short glide after a fast release
 * - Two pointers pinch-zoom around their center
 * - Mouse wheel and trackpad pinch zoom around the pointer position
 */
export declare class PointerControl {
  #private;
  constructor(view: View, container: HTMLElement);
  enable(pan: boolean, zoom: boolean): void;
}
/**
 * Own events of the graphic. All events of document, view, scheduler, variables, elements and
 * transformations bubble here as `<source>.<event>`, e.g. `variable.change` or `element.click`.
 */
export type GraphicEvents = EventMap & {
  ready: [];
  error: [error: unknown];
};
/**
 * An interactive SVG graphic in a container element: loads markup and configuration,
 * connects variables with the SVG and manages the visible area.
 */
export declare class Graphic extends Observable<GraphicEvents> {
  #private;
  readonly document: GraphicDocument;
  readonly scheduler: Scheduler;
  readonly view: View;
  readonly runtime: Runtime;
  /** Replaces the content of `container`. */
  constructor(container: HTMLElement, settings?: Partial<Settings>);
  get settings(): Settings;
  /** The loaded configuration. */
  get config(): GraphicConfig;
  /** Changes settings; `mode` takes effect with the next `load`. */
  setSettings(settings: Partial<Settings>): void;
  /** Root for relative image URLs in markup and configuration, e.g. `assets/`. */
  setAssetRoot(root: string): void;
  /**
   * URLs of individual images by file name, e.g. `{ "car.png": "/images/3f2a…" }`; they take
   * precedence over the asset root. Set before `load`, so that the markup uses them.
   */
  setAssetUrls(urls: Readonly<Record<string, string>>): void;
  /**
   * Loads SVG markup and configuration (JSON text or parsed JSON). Invalid configuration entries are
   * skipped and returned as issues. Emits `ready` on success; on failure emits `error` and throws.
   */
  load(markup: DocumentContent, config: unknown): readonly ConfigIssue[];
  /** Fetches markup and configuration in parallel and loads them; see `load`. */
  loadUrl(markupUrl: string | URL, configUrl: string | URL): Promise<readonly ConfigIssue[]>;
  /** Runtime element for an SVG element ID or node. */
  element(elementOrId: string | SVGGraphicsElement): RuntimeElement | undefined;
  variable(name: string): Variable | undefined;
  getValue(name: string): Variable['value'] | undefined;
  setValue(name: string, value: unknown, formattedValue?: string): void;
  /** Removes the graphic from its container and releases all listeners. */
  destroy(): void;
}
/** Creates a graphic in `container`. */
export declare function create(container: HTMLElement, settings?: Partial<Settings>): Graphic;
/** Converts external input into the variable's type; `null` if it cannot be represented. */
export declare function convertValue(value: unknown, type: VariableType): VariableValue | null;
/** Clamps number values into the configured domain. */
export declare function sanitizeValue(value: VariableValue | null, config: VariableConfig): VariableValue | null;
/** Display text of a value; numbers are rounded to integers. */
export declare function formatValue(value: VariableValue | null): string;
/** Value used when no `defaultValue` is configured. */
export declare function domainDefault(config: VariableConfig): VariableValue;
/**
 * Behaviour of one transformation type (rotate, fill-color, ...).
 * Methods use method syntax on purpose, so specific types are assignable to `TransformType<unknown>`.
 */
export interface TransformType<V, A extends AttributeName = AttributeName> {
  /** Attributes read in `calculate`/`apply` and written in `apply`. */
  readonly attributes: readonly A[];
  /** Transformation value for a variable value; `defaults` are the element's unmodified attribute values. */
  calculate(value: VariableValue | null, defaults: AttributeValues<A>): V;
  /** Intermediate value of an animated transition. */
  interpolate(from: V, to: V, t: number): V;
  /** Attribute changes for a transformation value, based on the attribute values of the current frame. */
  apply(value: V, current: AttributeValues<A>): Partial<AttributeValues<A>>;
  /** Converts a bound variable's display text into a value; only types supporting `bind` define it. */
  fromText?(text: string): V;
}
/**
 * Creates the behaviour for the model's transformation type.
 * Frame values are trusted to match the type; validating them is the job of the config parser.
 */
export declare function createTransformType(model: TransformationModel, settings: Settings,
/** Followed path of `motion-path`. */
path?: SVGGeometryElement): TransformType<unknown>;
/** Applies new transformation values, either immediately or animated. */
export interface Updater<V> {
  update(next: V): void;
  destroy(): void;
}
/** Applies every value immediately. */
export declare function discreteUpdater<V>(apply: (value: V) => void): Updater<V>;
/**
 * Animates from the currently displayed value to the next one. The first value is applied immediately;
 * a new value during a running animation starts from the intermediate value reached so far.
 */
export declare function transitionUpdater<V>(transition: TransitionConfig, interpolate: (from: V, to: V, t: number) => V, apply: (value: V) => void): Updater<V>;
export type { ConfigIssue, IssueParams, ParseResult };
//# sourceMappingURL=index.d.ts.map