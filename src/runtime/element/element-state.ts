import type { AssetResolver } from '../../util/assets';
import {
  createAccessor,
  type Accessor,
  type AttributeName,
  type AttributeTypes,
  type AttributeValues,
} from './attributes';

/**
 * Buffered attribute access for one element.
 * - Default values: effective values before any modification, read once and cached
 * - Modifications are collected and written to the DOM in `apply()`
 * - Attributes modified earlier but not in the current frame are restored to their original markup state
 */
export class ElementState {
  readonly #node: SVGGraphicsElement;
  readonly #assets: AssetResolver;
  readonly #accessors = new Map<AttributeName, Accessor<unknown>>();
  readonly #defaults = new Map<AttributeName, unknown>();
  readonly #modified = new Map<AttributeName, unknown>();
  /** Attributes currently differing from markup, with their restore functions. */
  readonly #restorers = new Map<AttributeName, () => void>();

  constructor(node: SVGGraphicsElement, assets: AssetResolver) {
    this.#node = node;
    this.#assets = assets;
  }

  getDefaultValue<K extends AttributeName>(attribute: K): AttributeTypes[K] {
    if (!this.#defaults.has(attribute)) {
      this.#defaults.set(attribute, this.#accessor(attribute).read());
    }
    return this.#defaults.get(attribute) as AttributeTypes[K];
  }

  getDefaultValues<A extends AttributeName>(attributes: readonly A[]): AttributeValues<A> {
    return Object.fromEntries(
      attributes.map((attribute) => [attribute, this.getDefaultValue(attribute)]),
    ) as AttributeValues<A>;
  }

  /** Value modified in the current frame, otherwise the default value. */
  getValue<K extends AttributeName>(attribute: K): AttributeTypes[K] {
    return this.#modified.has(attribute)
      ? (this.#modified.get(attribute) as AttributeTypes[K])
      : this.getDefaultValue(attribute);
  }

  getValues<A extends AttributeName>(attributes: readonly A[]): AttributeValues<A> {
    return Object.fromEntries(
      attributes.map((attribute) => [attribute, this.getValue(attribute)]),
    ) as AttributeValues<A>;
  }

  setValue<K extends AttributeName>(attribute: K, value: AttributeTypes[K]): void {
    // Make sure the default is read before the DOM is modified
    this.getDefaultValue(attribute);
    if (!this.#restorers.has(attribute)) {
      this.#restorers.set(attribute, this.#accessor(attribute).capture());
    }
    this.#modified.set(attribute, value);
  }

  setValues<A extends AttributeName>(values: Partial<AttributeValues<A>>): void {
    const entries = Object.entries(values) as [A, AttributeTypes[A] | undefined][];
    for (const [attribute, value] of entries) {
      if (value !== undefined) this.setValue(attribute, value);
    }
  }

  /** Writes modifications to the DOM, restores attributes that are no longer modified and starts a new frame. */
  apply(): void {
    for (const [attribute, restore] of this.#restorers) {
      if (this.#modified.has(attribute)) {
        this.#accessor(attribute).write(this.#modified.get(attribute));
      } else {
        restore();
        this.#restorers.delete(attribute);
      }
    }
    this.#modified.clear();
  }

  /** Discards modifications of the current frame. */
  clear(): void {
    this.#modified.clear();
  }

  #accessor(attribute: AttributeName): Accessor<unknown> {
    let accessor = this.#accessors.get(attribute);
    if (!accessor) {
      accessor = createAccessor(this.#node, attribute, this.#assets);
      this.#accessors.set(attribute, accessor);
    }
    return accessor;
  }
}
