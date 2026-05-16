export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL = LogLevel.INFO;

const PREFIX = '[GestureCanvas]';
const MAX_LOGS = 200;

export interface DebugLogEntry {
  level: keyof typeof LogLevel;
  message: string;
  time: string;
  data?: unknown[];
}

declare global {
  interface Window {
    __GESTURE_DEBUG_LOGS?: DebugLogEntry[];
  }
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  if (level < LOG_LEVEL) return;

  const fn = level >= LogLevel.ERROR ? console.error
    : level >= LogLevel.WARN ? console.warn
    : level >= LogLevel.INFO ? console.info
    : console.debug;

  fn(`${PREFIX} ${message}`, ...args);

  if (typeof window !== 'undefined') {
    const entry: DebugLogEntry = {
      level: LogLevel[level] as keyof typeof LogLevel,
      message,
      time: new Date().toLocaleTimeString(),
      data: args.length > 0 ? args : undefined,
    };
    window.__GESTURE_DEBUG_LOGS = [...(window.__GESTURE_DEBUG_LOGS ?? []), entry].slice(-MAX_LOGS);
    window.dispatchEvent(new CustomEvent<DebugLogEntry>('gesture-debug-log', { detail: entry }));
  }
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => log(LogLevel.DEBUG, msg, ...args),
  info: (msg: string, ...args: unknown[]) => log(LogLevel.INFO, msg, ...args),
  warn: (msg: string, ...args: unknown[]) => log(LogLevel.WARN, msg, ...args),
  error: (msg: string, ...args: unknown[]) => log(LogLevel.ERROR, msg, ...args),
};
