import type { Settings, TransformationConfig } from '@cuttleskin/config';
import { createTransformationModel, type TransformationModel } from '../../model/transformation';
import { assert } from '../../util/assert';
import { createLogger } from '../../util/logger';
import { Observable, type EventSink } from '../../util/observable';
import type { RuntimeElement } from '../element/element';
import type { TaskScheduler, Unschedule } from '../scheduling';
import type { Variable } from '../variable/variable';
import { createTransformType } from './factory';
import type { TransformType } from './transform-type';
import { discreteUpdater, transitionUpdater, type Updater } from './updater';

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

const log = createLogger('cuttleskin.transformation');

/** Shape followed by a `motion-path` transformation; throws if it does not exist or has no geometry. */
function resolvePath(
  config: TransformationConfig,
  context: TransformationContext,
): SVGGeometryElement | undefined {
  if (config.type !== 'motion-path' || config.path === undefined) return undefined;
  const node = context.getElement(config.path)?.node;
  assert(node, `Path element does not exist: ${config.path}`);
  assert(node instanceof SVGGeometryElement, `Element is not a path or shape: ${config.path}`);
  return node;
}

/**
 * Connects a variable with an element:
 * - On variable changes, computes the new value in the transform phase
 * - Applies the value (optionally animated) as transform function on the element
 */
export class Transformation extends Observable<TransformationEvents> {
  readonly model: TransformationModel;
  readonly #variable: Variable;
  readonly #element: RuntimeElement;
  readonly #type: TransformType<unknown>;
  readonly #updater: Updater<unknown>;
  readonly #scheduler: TaskScheduler;
  readonly #unobserve: () => void;
  #unschedule: Unschedule | undefined;
  #removeTransform: (() => void) | undefined;

  /** Throws if variable or element do not exist. */
  constructor(config: TransformationConfig, context: TransformationContext) {
    super(context.events, 'transformation');

    const variable = context.getVariable(config.variable);
    const element = context.getElement(config.element);
    assert(variable, `Variable does not exist: ${config.variable}`);
    assert(element, `Element does not exist: ${config.element}`);

    this.#variable = variable;
    this.#element = element;
    this.#scheduler = context.scheduler;
    this.model = createTransformationModel(config, variable.model);
    this.#type = createTransformType(this.model, context.settings, resolvePath(config, context));

    if (config.bind && !this.#type.fromText) {
      log.warn(`Transformation type does not support bind: ${config.type}`, this.model.name);
    }

    const apply = (value: unknown): void => {
      this.#apply(value);
    };
    const transition = config.transition;
    this.#updater =
      transition && Number.isFinite(transition.duration) && transition.duration > 0
        ? transitionUpdater(transition, (from, to, t) => this.#type.interpolate(from, to, t), apply)
        : discreteUpdater(apply);

    this.#unobserve = variable.on('change', () => {
      this.schedule();
    });
  }

  /** Schedules a recalculation in the next transform phase. */
  schedule(): void {
    this.#unschedule?.();
    this.#unschedule = this.#scheduler.scheduleTransform(() => {
      this.#update();
    }, this.model.priority);
  }

  override destroy(): void {
    this.#removeTransform?.();
    this.#updater.destroy();
    this.#unobserve();
    this.#unschedule?.();
    this.emit('destroy', this);
    super.destroy();
  }

  #update(): void {
    this.#unschedule = undefined;
    const type = this.#type;
    const value =
      this.model.config.bind && type.fromText
        ? type.fromText(this.#variable.formattedValue)
        : type.calculate(this.#variable.value, this.#element.getDefaultValues(type.attributes));

    this.#updater.update(value);
    this.emit('update', this);
  }

  #apply(value: unknown): void {
    const type = this.#type;
    this.#removeTransform?.();
    this.#removeTransform = this.#element.transform((state) => {
      state.setValues(type.apply(value, state.getValues(type.attributes)));
    }, this.model.priority);
  }
}
