export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Logger = Readonly<Record<LogLevel, (...args: unknown[]) => void>>;

const enabledLevels = new Set<LogLevel>(['warn', 'error']);

export function setLogLevel(level: LogLevel, enabled: boolean): void {
  if (enabled) enabledLevels.add(level);
  else enabledLevels.delete(level);
}

export function isLogLevelEnabled(level: LogLevel): boolean {
  return enabledLevels.has(level);
}

export function createLogger(name: string): Logger {
  const prefix = `[${name}]`;
  const log =
    (level: LogLevel) =>
    (...args: unknown[]): void => {
      if (enabledLevels.has(level)) console[level](prefix, ...args);
    };
  return Object.freeze({
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
  });
}
