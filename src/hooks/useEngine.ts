import { useEffect, useRef, useCallback } from 'react';
import { Engine, EngineConfig } from '../core/Engine';
import { globalEventBus } from '../core/EventBus';
import { useStore } from '../store/useStore';
import { EngineState, StrokeData, GestureEvent, HandSnapshot } from '../core/types';

export function useEngine() {
  const engineRef = useRef<Engine | null>(null);
  const lastHandUpdateRef = useRef<number>(0);
  const staleIntervalRef = useRef<number | null>(null);

  const initialize = useCallback(async (canvas: HTMLCanvasElement) => {
    if (engineRef.current) return;

    lastHandUpdateRef.current = Date.now();

    const config: EngineConfig = { canvas, mode: 'camera' };
    const engine = new Engine(config);
    engineRef.current = engine;

    const unsubState = globalEventBus.on('engine_state', (state: EngineState) => {
      useStore.getState().setEngineState(state);
    });

    const unsubStroke = globalEventBus.on('stroke_added', (stroke: StrokeData) => {
      useStore.getState().addStroke(stroke);
    });

    const unsubStrokeErased = globalEventBus.on('stroke_erased', ({ strokeId }) => {
      useStore.getState().removeStroke(strokeId);
    });

    const unsubClear = globalEventBus.on('clear_canvas', () => {
      useStore.getState().clearAllStrokes();
    });

    const unsubHands = globalEventBus.on('hand_update', ({ hands }: { hands: HandSnapshot[] }) => {
      lastHandUpdateRef.current = Date.now();
      useStore.getState().setHands(
        hands.map((hand) => ({
          handedness: hand.handedness,
          landmarks: hand.landmarks,
          confidence: hand.confidence,
        })),
      );
      if (hands.length === 0) {
        useStore.getState().setGesture('idle', 'Left', 0);
        useStore.getState().setGesture('idle', 'Right', 0);
      }
      useStore.getState().setWebcamReady(true);
    });

    const unsubGesture = globalEventBus.on('gesture', (event: GestureEvent) => {
      useStore.getState().setGesture(event.type, event.hand as 'Left' | 'Right', event.confidence);
    });

    if (staleIntervalRef.current === null) {
      staleIntervalRef.current = window.setInterval(() => {
        const now = Date.now();
        if (now - lastHandUpdateRef.current < 900) return;

        const state = useStore.getState();
        if (state.hands.length === 0 && state.currentGesture === 'idle') return;

        useStore.getState().setHands([]);
        useStore.getState().setGesture('idle', 'Left', 0);
        useStore.getState().setGesture('idle', 'Right', 0);
      }, 300);
    }

    await engine.start();

    return () => {
      unsubState();
      unsubStroke();
      unsubStrokeErased();
      unsubClear();
      unsubHands();
      unsubGesture();
      if (staleIntervalRef.current !== null) {
        window.clearInterval(staleIntervalRef.current);
        staleIntervalRef.current = null;
      }
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
