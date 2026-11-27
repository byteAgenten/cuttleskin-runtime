/** Values inserted into the translated text of an issue. */
export type IssueParams = Readonly<Record<string, string | number>>;

/** Problem found while parsing a configuration. */
export interface ConfigIssue {
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
export class ConfigError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    const summary = issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n');
    super(`Invalid graphic configuration:\n${summary}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

/** Marker for a value that failed validation; the issue has already been recorded. */
export const INVALID: unique symbol = Symbol('invalid');
export type Invalid = typeof INVALID;

/** Collects issues and builds paths while walking the input. */
export class IssueCollector {
  readonly issues: ConfigIssue[] = [];

  add(path: string, message: string, code: string, params?: IssueParams): Invalid {
    this.issues.push({ path, message, code, ...(params ? { params } : {}) });
    return INVALID;
  }
}

export function joinPath(base: string, key: string | number): string {
  if (typeof key === 'number') return `${base}[${String(key)}]`;
  return base ? `${base}.${key}` : key;
}
