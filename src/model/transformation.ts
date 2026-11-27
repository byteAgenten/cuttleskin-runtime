import type { TransformationConfig, TransformationType } from '@cuttleskin/config';
import { createFrames, type Frames } from './frames';
import type { VariableModel } from './variable';

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

export function createTransformationModel<V>(
  config: TransformationConfig<V>,
  variable: VariableModel,
): TransformationModel<V> {
  const frames = createFrames(variable.config, variable.domainEnds, config.frames);
  const configured = config.default;

  return Object.freeze({
    config,
    name: config.name ?? `${config.type}_${config.element}`,
    type: config.type,
    element: config.element,
    variable,
    frames,
    priority: config.priority ?? 0,
    defaultValue: (fallback: V) => configured ?? fallback,
  });
}
