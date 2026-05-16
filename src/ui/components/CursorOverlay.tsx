import { useStore } from '../../store/useStore';

export function CursorOverlay() {
  const x = useStore((s) => s.cursorX);
  const y = useStore((s) => s.cursorY);

  if (x === null || y === null) return null;

  return (
    <div
      className="cursor-overlay"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    >
      <div className="cursor-dot" />
    </div>
  );
}
