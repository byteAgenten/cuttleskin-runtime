import type { VariableValue } from '@cuttleskin/config';
import type { AttributeName, AttributeValues } from '../element/attributes';

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
