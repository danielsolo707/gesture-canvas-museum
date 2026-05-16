import { useEffect, useRef, useCallback } from 'react';
import { Engine } from '../core/Engine';
import { StrokePoint } from '../core/types';
import { FALLBACK } from '../core/constants';
import { useStore } from '../store/useStore';
import { globalEventBus } from '../core/EventBus';
import { ColorEngine } from '../features/colors/ColorEngine';

export function useFallbackInput(engine: Engine | null) {
  const isDrawing = useRef(false);
  const isErasing = useRef(false);
  const colorEngine = useRef(new ColorEngine());

  const getCanvasPoint = useCallback((clientX: number, clientY: number): StrokePoint => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { x: 0, y: 0, z: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return { x, y: -y, z: 0 };
  }, []);

  useEffect(() => {
    if (!engine) return;

    const strokeEngine = engine.getStrokeEngine();

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === FALLBACK.DRAW_BUTTON) {
        const pt = getCanvasPoint(e.clientX, e.clientY);
        const state = useStore.getState();
        strokeEngine.startStroke('Right', pt, state.color, 3);
        isDrawing.current = true;
        useStore.getState().setIsDrawing(true);
        globalEventBus.emit('gesture', {
          type: 'drawing',
          hand: 'Right',
          confidence: 1,
          timestamp: Date.now(),
        });
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDrawing.current) {
        const pt = getCanvasPoint(e.clientX, e.clientY);
        strokeEngine.extendStroke('Right', pt);
      }
      if (isErasing.current) {
        const pt = getCanvasPoint(e.clientX, e.clientY);
        strokeEngine.eraseStrokesAtPoint(pt.x, pt.y, 0.05);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === FALLBACK.DRAW_BUTTON && isDrawing.current) {
        strokeEngine.endStroke('Right');
        isDrawing.current = false;
        useStore.getState().setIsDrawing(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === FALLBACK.COLOR_CYCLE_KEY) {
        colorEngine.current.nextColor();
      }
      if (e.code === FALLBACK.CLEAR_KEY) {
        strokeEngine.clearAll();
      }
      if (e.code === FALLBACK.UNDO_KEY && (e.ctrlKey || e.metaKey)) {
        strokeEngine.undo();
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [engine, getCanvasPoint]);
}
