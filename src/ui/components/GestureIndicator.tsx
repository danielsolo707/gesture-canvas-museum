import { useStore } from '../../store/useStore';

const GESTURE_LABELS: Record<string, string> = {
  idle: 'Waiting',
  drawing: 'Drawing',
  cursor: 'Cursor Mode',
  eraser: 'Eraser',
};

export function GestureIndicator() {
  const current = useStore((s) => s.currentGesture);

  const label = GESTURE_LABELS[current] ?? current;
  const className = `gesture-indicator ${current}`;

  if (current === 'idle') return null;

  return (
    <div className={className}>
      {label}
    </div>
  );
}
