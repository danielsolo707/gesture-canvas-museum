export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL = LogLevel.INFO;

const PREFIX = '[GestureCanvas]';

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  if (level < LOG_LEVEL) return;

  const fn = level >= LogLevel.ERROR ? console.error
    : level >= LogLevel.WARN ? console.warn
    : level >= LogLevel.INFO ? console.info
    : console.debug;

  fn(`${PREFIX} ${message}`, ...args);
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => log(LogLevel.DEBUG, msg, ...args),
  info: (msg: string, ...args: unknown[]) => log(LogLevel.INFO, msg, ...args),
  warn: (msg: string, ...args: unknown[]) => log(LogLevel.WARN, msg, ...args),
  error: (msg: string, ...args: unknown[]) => log(LogLevel.ERROR, msg, ...args),
};
