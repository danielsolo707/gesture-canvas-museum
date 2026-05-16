import { useStore } from '../store/useStore';

export function useDrawing() {
  const strokes = useStore((s) => s.strokes);
  const strokeCount = useStore((s) => s.strokeCount);
  const isDrawing = useStore((s) => s.isDrawing);

  return { strokes, strokeCount, isDrawing };
}
