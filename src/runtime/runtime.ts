import type {
  ElementConfig,
  GraphicConfig,
  Settings,
  TransformationConfig,
  VariableConfig,
} from '@cuttleskin/config';
import type { AssetResolver } from '../util/assets';
import { createLogger } from '../util/logger';
import type { EventSink } from '../util/observable';
import { RuntimeElement } from './element/element';
import type { TaskScheduler } from './scheduling';
import { Transformation, type TransformationContext } from './transformation/transformation';
import { Variable } from './variable/variable';

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

const EMPTY_CONFIG: GraphicConfig = Object.freeze({ variables: [], transformations: [] });

const log = createLogger('cuttleskin.runtime');

/**
 * Builds variables, elements and transformations from a graphic configuration and manages their lifecycle.
 * Entries that fail to initialize (e.g. missing SVG element) are logged and skipped.
 */
export class Runtime {
  readonly #context: RuntimeContext;
  #config: GraphicConfig = EMPTY_CONFIG;
  #variables = new Map<string, Variable>();
  #elements = new Map<string, RuntimeElement>();
  #transformations: Transformation[] = [];

  constructor(context: RuntimeContext) {
    this.#context = context;
  }

  /** The currently loaded configuration. */
  get config(): GraphicConfig {
    return this.#config;
  }

  get variables(): ReadonlyMap<string, Variable> {
    return this.#variables;
  }

  get transformations(): readonly Transformation[] {
    return this.#transformations;
  }

  /** Replaces the current configuration; the previous one is destroyed and its DOM changes restored. */
  load(config: GraphicConfig): void {
    this.#clear();
    this.#config = config;

    for (const element of config.elements ?? []) this.#createElement(element);
    for (const variable of config.variables) this.#createVariable(variable);
    const context = this.#transformationContext();
    for (const transformation of config.transformations) {
      this.#createTransformation(transformation, context);
    }
    for (const transformation of this.#transformations) transformation.schedule();

    log.debug(
      `Loaded ${String(this.#variables.size)} variables, ${String(this.#transformations.length)} transformations`,
    );
  }

  getVariable(name: string): Variable | undefined {
    return this.#variables.get(name);
  }

  /** Sets a variable value; logs a warning if the variable does not exist. */
  setValue(name: string, value: unknown, formattedValue?: string): void {
    const variable = this.#variables.get(name);
    if (!variable) {
      log.warn(`Variable does not exist: ${name}`);
      return;
    }
    variable.setValue(value, formattedValue);
  }

  getValue(name: string): Variable['value'] | undefined {
    return this.#variables.get(name)?.value;
  }

  /**
   * Runtime wrapper for an element of the document, created on first access.
   * Elements with an ID are cached; `undefined` if no such element exists.
   */
  getElement(elementOrId: string | SVGGraphicsElement): RuntimeElement | undefined {
    const id = typeof elementOrId === 'string' ? elementOrId : elementOrId.id;
    const cached = id ? this.#elements.get(id) : undefined;
    if (cached) return cached;

    const node =
      typeof elementOrId === 'string'
        ? this.#context.document.getElement(elementOrId)
        : elementOrId;
    if (!node) return undefined;

    const element = this.#newElement(node);
    if (id) this.#elements.set(id, element);
    return element;
  }

  destroy(): void {
    this.#clear();
    this.#config = EMPTY_CONFIG;
  }

  #clear(): void {
    for (const transformation of this.#transformations) transformation.destroy();
    for (const variable of this.#variables.values()) variable.destroy();
    for (const element of this.#elements.values()) element.destroy();
    this.#transformations = [];
    this.#variables = new Map();
    this.#elements = new Map();
  }

  #newElement(node: SVGGraphicsElement, config?: ElementConfig): RuntimeElement {
    const { scheduler, assets, events } = this.#context;
    return new RuntimeElement(
      node,
      events ? { scheduler, assets, events } : { scheduler, assets },
      config,
    );
  }

  #createElement(config: ElementConfig): void {
    const node = this.#context.document.getElement(config.id);
    if (!node) {
      log.error(`Error initializing element: ${config.id}`, 'Element does not exist');
      return;
    }
    this.#elements.set(config.id, this.#newElement(node, config));
  }

  #createVariable(config: VariableConfig): void {
    this.#variables.set(config.name, new Variable(config, this.#context.events));
  }

  #createTransformation(config: TransformationConfig, context: TransformationContext): void {
    try {
      this.#transformations.push(new Transformation(config, context));
    } catch (error) {
      log.error(
        `Error initializing transformation: ${config.name ?? `${config.type}_${config.element}`}`,
        error,
      );
    }
  }

  #transformationContext(): TransformationContext {
    const { scheduler, settings, events } = this.#context;
    const lookups = {
      getVariable: (name: string) => this.getVariable(name),
      getElement: (id: string) => this.getElement(id),
    };
    return events
      ? { scheduler, settings, events, ...lookups }
      : { scheduler, settings, ...lookups };
  }
}
