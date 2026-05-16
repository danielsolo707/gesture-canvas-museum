import { useState, useEffect } from 'react';
import { globalEventBus } from '../core/EventBus';

export function usePerformance() {
  const [fps, setFps] = useState(0);
  const [showHud, setShowHud] = useState(false);

  useEffect(() => {
    const unsub = globalEventBus.on('fps_update', (f: number) => {
      setFps(f);
    });
    return () => unsub();
  }, []);

  const toggleHud = () => setShowHud((s) => !s);

  return { fps, showHud, toggleHud };
}
