import { logger } from './logging';

let fullscreenBefore = false;

export function requestFullscreen(): void {
  const el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {
      // User gesture required; called from user interaction
    });
  }
}

export function exitFullscreen(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

export function isFullscreen(): boolean {
  return !!document.fullscreenElement;
}

export function preventContextMenu(): () => void {
  const handler = (e: MouseEvent) => e.preventDefault();
  document.addEventListener('contextmenu', handler);
  return () => document.removeEventListener('contextmenu', handler);
}

export function preventKeyboardShortcuts(allowKeys?: string[]): () => void {
  const allowed = new Set(allowKeys ?? []);

  const handler = (e: KeyboardEvent) => {
    if (
      e.ctrlKey || e.metaKey || e.altKey ||
      e.key === 'F11' || e.key === 'F5' || e.key === 'F3'
    ) {
      if (!allowed.has(e.code)) {
        e.preventDefault();
      }
    }
  };

  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}

export function lockOrientation(): void {
  if ('orientation' in screen && 'lock' in (screen as any).orientation) {
    (screen as any).orientation.lock('landscape').catch(() => {});
  }
}

export function setupUnloadGuard(): void {
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', handler);
  // Don't return cleanup — this should persist for kiosk mode
}

export function autoRecover(fn: () => void, intervalMs = 5000): () => void {
  let lastFrame = performance.now();

  const check = () => {
    const now = performance.now();
    if (now - lastFrame > intervalMs * 2) {
      logger.warn('Frame timeout detected, attempting recovery');
      fn();
    }
    lastFrame = now;
  };

  const id = setInterval(check, intervalMs);
  return () => clearInterval(id);
}

export function enableKioskMode(): () => void {
  logger.info('Kiosk mode enabled');
  requestFullscreen();
  const cleanups = [
    preventContextMenu(),
    preventKeyboardShortcuts(['KeyC', 'KeyX', 'KeyZ']),
  ];
  lockOrientation();
  return () => cleanups.forEach((c) => c());
}
