import type { VariableValue } from '@cuttleskin/config';

/** Translates a variable value into a transformation value; `fallback` is used where no frame value applies. */
export type Translation<V> = (index: VariableValue | null | undefined, fallback: V) => V;
