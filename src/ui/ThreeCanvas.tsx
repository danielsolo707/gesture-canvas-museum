import { useEffect, useRef, useCallback } from 'react';
import { Engine } from '../core/Engine';
import { useEngine } from '../hooks/useEngine';

interface ThreeCanvasProps {
  onEngineReady?: (engine: Engine) => void;
}

export function ThreeCanvas({ onEngineReady }: ThreeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { initialize, getEngine } = useEngine();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cleanup: (() => void) | undefined;

    const init = async () => {
      cleanup = await initialize(canvas);
      const engine = getEngine();
      if (engine && onEngineReady) {
        onEngineReady(engine);
      }
    };

    init();

    return () => {
      cleanup?.();
    };
  }, [initialize, getEngine, onEngineReady]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        cursor: 'crosshair',
      }}
    />
  );
}
