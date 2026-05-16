import { useStore } from '../../store/useStore';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ClearProgressRing() {
  const clearProgress = useStore((s) => s.clearProgress);
  const current = useStore((s) => s.currentGesture);

  if (current !== 'clear_canvas' || clearProgress <= 0 || clearProgress >= 1) {
    return null;
  }

  const offset = CIRCUMFERENCE * (1 - clearProgress);

  return (
    <div className="clear-progress-ring">
      <svg viewBox="0 0 120 120">
        <circle className="bg-circle" cx="60" cy="60" r={RADIUS} />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
    </div>
  );
}
