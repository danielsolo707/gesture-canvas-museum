import { KIOSK } from '../core/constants';
import { logger } from './logging';

export interface KioskConfig {
  idleResetMs: number;
  fullscreenEnabled: boolean;
  contextMenuBlocked: boolean;
  keyboardShortcutsBlocked: boolean;
  watchdogIntervalMs: number;
  maxCrashesBeforeReload: number;
}

type CrashCallback = (crashes: number) => void;

const DEFAULT_CONFIG: KioskConfig = {
  idleResetMs: KIOSK.IDLE_RESET_MS,
  fullscreenEnabled: KIOSK.FULLSCREEN_ENABLED,
  contextMenuBlocked: KIOSK.CONTEXT_MENU_BLOCKED,
  keyboardShortcutsBlocked: KIOSK.KEYBOARD_SHORTCUTS_BLOCKED,
  watchdogIntervalMs: KIOSK.WATCHDOG_INTERVAL_MS,
  maxCrashesBeforeReload: KIOSK.MAX_CRASHES_BEFORE_RELOAD,
};

export class KioskMode {
  private config: KioskConfig;
  private idleTimer: number | null = null;
  private watchdogTimer: number | null = null;
  private lastActivity = 0;
  private crashCount = 0;
  private onCrashCallback: CrashCallback | null = null;
  private enabled = false;

  constructor(config?: Partial<KioskConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  enable(resetCallback?: () => void, crashCallback?: CrashCallback): void {
    if (this.enabled) return;
    this.enabled = true;
    this.lastActivity = Date.now();

    if (crashCallback) this.onCrashCallback = crashCallback;

    if (this.config.contextMenuBlocked) {
      document.addEventListener('contextmenu', this.blockContextMenu);
    }

    if (this.config.keyboardShortcutsBlocked) {
      document.addEventListener('keydown', this.blockShortcuts);
    }

    if (this.config.fullscreenEnabled) {
      this.attemptFullscreen();
      document.addEventListener('fullscreenchange', this.onFullscreenChange);
    }

    this.idleTimer = window.setInterval(() => {
      const elapsed = Date.now() - this.lastActivity;
      if (elapsed > this.config.idleResetMs) {
        logger.info('Kiosk: idle reset triggered');
        this.lastActivity = Date.now();
        if (resetCallback) resetCallback();
      }
    }, 10000);

    this.watchdogTimer = window.setInterval(() => {
      if (this.config.fullscreenEnabled && !document.fullscreenElement) {
        this.attemptFullscreen();
      }
    }, this.config.watchdogIntervalMs);

    document.addEventListener('mousedown', this.recordActivity);
    document.addEventListener('touchstart', this.recordActivity);
    document.addEventListener('keydown', this.recordActivity);

    logger.info('Kiosk mode enabled');
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;

    document.removeEventListener('contextmenu', this.blockContextMenu);
    document.removeEventListener('keydown', this.blockShortcuts);
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    document.removeEventListener('mousedown', this.recordActivity);
    document.removeEventListener('touchstart', this.recordActivity);
    document.removeEventListener('keydown', this.recordActivity);

    if (this.idleTimer !== null) {
      window.clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.watchdogTimer !== null) {
      window.clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  recordActivity(): void {
    this.lastActivity = Date.now();
  }

  reportCrash(): void {
    this.crashCount++;
    if (this.onCrashCallback) {
      this.onCrashCallback(this.crashCount);
    }
    if (this.crashCount >= this.config.maxCrashesBeforeReload) {
      logger.warn(`Kiosk: ${this.crashCount} crashes, reloading page`);
      window.location.reload();
    }
  }

  private blockContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private blockShortcuts = (e: KeyboardEvent): void => {
    if (
      (e.ctrlKey && ['r', 'R', 'w', 'W', 't', 'T', 'n', 'N'].includes(e.key)) ||
      e.key === 'F11' ||
      e.key === 'Escape'
    ) {
      e.preventDefault();
    }
  };

  private attemptFullscreen(): void {
    try {
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen may not be available in all contexts.
    }
  }

  private onFullscreenChange = (): void => {
    if (!document.fullscreenElement) {
      this.attemptFullscreen();
    }
  };
}
