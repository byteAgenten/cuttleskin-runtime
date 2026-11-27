import type { VariableConfig, VariableValue } from '@cuttleskin/config';
import { createVariableModel, type VariableModel } from '../../model/variable';
import { Observable, type EventSink } from '../../util/observable';
import { convertValue, domainDefault, formatValue, sanitizeValue } from './value';

/** Events of a variable; bubbled to the parent as `variable.<event>`. */
export type VariableEvents = {
  change: [variable: Variable, value: VariableValue | null, formattedValue: string];
  destroy: [variable: Variable];
};

/** Runtime state of a configured variable: converts, clamps and formats values and notifies on change. */
export class Variable extends Observable<VariableEvents> {
  readonly model: VariableModel;
  #value: VariableValue | null = null;
  #formattedValue = '';

  constructor(config: VariableConfig, parent?: EventSink) {
    super(parent, 'variable');
    this.model = createVariableModel(config);
    this.reset();
  }

  get name(): string {
    return this.model.name;
  }

  /** Current value; `null` if the last input could not be converted. */
  get value(): VariableValue | null {
    return this.#value;
  }

  /** Display text of the current value. */
  get formattedValue(): string {
    return this.#formattedValue;
  }

  /**
   * Sets a new value. The input is converted to the variable type and clamped to the domain.
   * `formattedValue` overrides the generated display text.
   */
  setValue(value: unknown, formattedValue?: string): void {
    const config = this.model.config;
    this.#value = sanitizeValue(convertValue(value, config.type), config);
    this.#formattedValue = formattedValue ?? formatValue(this.#value);
    this.emit('change', this, this.#value, this.#formattedValue);
  }

  /** Restores the configured default value. */
  reset(): void {
    this.setValue(this.model.config.defaultValue ?? domainDefault(this.model.config));
  }

  override destroy(): void {
    this.emit('destroy', this);
    super.destroy();
  }
}
