import type { VariableConfig, VariableType, VariableValue } from '@cuttleskin/config';

function parseNumber(value: string): number | null {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Converts external input into the variable's type; `null` if it cannot be represented. */
export function convertValue(value: unknown, type: VariableType): VariableValue | null {
  switch (type) {
    case 'number':
      if (typeof value === 'number') return Number.isFinite(value) ? value : null;
      if (typeof value === 'string') return parseNumber(value);
      if (typeof value === 'boolean') return value ? 1 : 0;
      return null;
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value > 0;
      if (typeof value === 'string') {
        const number = parseNumber(value);
        return number === null ? value.trim().toLowerCase() === 'true' : number > 0;
      }
      return null;
    case 'text':
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      return null;
  }
}

/** Clamps number values into the configured domain. */
export function sanitizeValue(
  value: VariableValue | null,
  config: VariableConfig,
): VariableValue | null {
  if (config.type !== 'number' || typeof value !== 'number') return value;
  return Math.min(Math.max(value, config.minimum), config.maximum);
}

/** Display text of a value; numbers are rounded to integers. */
export function formatValue(value: VariableValue | null): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(Math.round(value));
  return String(value);
}

/** Value used when no `defaultValue` is configured. */
export function domainDefault(config: VariableConfig): VariableValue {
  switch (config.type) {
    case 'number':
      return config.minimum;
    case 'boolean':
      return false;
    case 'text':
      return '';
  }
}
