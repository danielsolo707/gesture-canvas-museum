import { useEffect, useRef, useCallback } from 'react';
import { Engine, EngineConfig } from '../core/Engine';
import { globalEventBus } from '../core/EventBus';
import { useStore } from '../store/useStore';
import { EngineState, StrokeData, GestureEvent } from '../core/types';

export function useEngine() {
  const engineRef = useRef<Engine | null>(null);

  const initialize = useCallback(async (canvas: HTMLCanvasElement) => {
    if (engineRef.current) return;

    const config: EngineConfig = { canvas, mode: 'camera' };
    const engine = new Engine(config);
    engineRef.current = engine;

    const unsubState = globalEventBus.on('engine_state', (state: EngineState) => {
      useStore.getState().setEngineState(state);
    });

    const unsubStroke = globalEventBus.on('stroke_added', (stroke: StrokeData) => {
      useStore.getState().addStroke(stroke);
    });

    const unsubGesture = globalEventBus.on('gesture', (event: GestureEvent) => {
      useStore.getState().setGesture(event.type, event.hand as 'Left' | 'Right', event.confidence);
    });

    await engine.start();

    return () => {
      unsubState();
      unsubStroke();
      unsubGesture();
    };
  }, []);

  const getEngine = useCallback((): Engine | null => {
    return engineRef.current;
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  return { initialize, getEngine, engineRef };
}
