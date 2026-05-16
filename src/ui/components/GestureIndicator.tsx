import { useStore } from '../../store/useStore';

const GESTURE_LABELS: Record<string, string> = {
  idle: 'Waiting',
  drawing: 'Drawing',
  color_select: 'Color Select',
  clear_canvas: 'Clear Canvas',
  eraser: 'Eraser',
};

export function GestureIndicator() {
  const current = useStore((s) => s.currentGesture);
  const clearProgress = useStore((s) => s.clearProgress);

  const label = GESTURE_LABELS[current] ?? current;
  const className = `gesture-indicator ${current}`;

  if (current === 'idle') return null;

  return (
    <div className={className}>
      {label}
      {current === 'clear_canvas' && clearProgress > 0 && clearProgress < 1 && (
        <span style={{ marginLeft: 8, opacity: 0.7 }}>
          {Math.round(clearProgress * 100)}%
        </span>
      )}
    </div>
  );
}
