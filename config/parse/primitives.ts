import { INVALID, joinPath, type Invalid, type IssueCollector } from './issues';

export type UnknownRecord = Readonly<Record<string, unknown>>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export function record(
  value: unknown,
  path: string,
  issues: IssueCollector,
): UnknownRecord | Invalid {
  return isRecord(value) ? value : expectedType(issues, path, 'object', value);
}

/** Records a value of the wrong type; `expected` is a type name like `object` or `number`. */
export function expectedType(
  issues: IssueCollector,
  path: string,
  expected: string,
  value: unknown,
): Invalid {
  const actual = describe(value);
  return issues.add(path, `Expected ${expected}, got ${actual}`, 'config.expectedType', {
    expected,
    actual,
  });
}

export function string(value: unknown, path: string, issues: IssueCollector): string | Invalid {
  return typeof value === 'string' ? value : expectedType(issues, path, 'string', value);
}

export function nonEmptyString(
  value: unknown,
  path: string,
  issues: IssueCollector,
): string | Invalid {
  const result = string(value, path, issues);
  if (result === INVALID) return INVALID;
  return result.trim() ? result : issues.add(path, 'Must not be empty', 'config.empty');
}

export function finiteNumber(
  value: unknown,
  path: string,
  issues: IssueCollector,
): number | Invalid {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : expectedType(issues, path, 'finite number', value);
}

export function boolean(value: unknown, path: string, issues: IssueCollector): boolean | Invalid {
  return typeof value === 'boolean' ? value : expectedType(issues, path, 'boolean', value);
}

export function oneOf<T extends string>(
  allowed: readonly T[],
  value: unknown,
  path: string,
  issues: IssueCollector,
): T | Invalid {
  if ((allowed as readonly unknown[]).includes(value)) return value as T;
  const actual = typeof value === 'string' ? JSON.stringify(value) : describe(value);
  const options = allowed.join(', ');
  return issues.add(path, `Expected one of ${options}, got ${actual}`, 'config.expectedOneOf', {
    options,
    actual,
  });
}

export function point(
  value: unknown,
  path: string,
  issues: IssueCollector,
): { x: number; y: number } | Invalid {
  const input = record(value, path, issues);
  if (input === INVALID) return INVALID;
  const x = finiteNumber(input.x, joinPath(path, 'x'), issues);
  const y = finiteNumber(input.y, joinPath(path, 'y'), issues);
  return x === INVALID || y === INVALID ? INVALID : { x, y };
}

/** Validates each item; invalid items are dropped (their issues are recorded). */
export function list<T>(
  value: unknown,
  path: string,
  issues: IssueCollector,
  item: (value: unknown, path: string) => T | Invalid,
): T[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    expectedType(issues, path, 'array', value);
    return [];
  }
  const result: T[] = [];
  value.forEach((entry: unknown, index) => {
    const parsed = item(entry, joinPath(path, index));
    if (parsed !== INVALID) result.push(parsed);
  });
  return result;
}

/** Runs `parse` for a present value; `undefined` and `null` count as absent. */
export function optional<T>(
  value: unknown,
  parse: (value: unknown) => T | Invalid,
): T | undefined | Invalid {
  return value === undefined || value === null ? undefined : parse(value);
}
