import { useStore } from '../../store/useStore';

export function FallbackControls() {
  const mode = useStore((s) => s.mode);

  if (mode !== 'fallback') return null;

  return (
    <div className="fallback-controls">
      <span>Left Click: Draw</span>
      <span>·</span>
      <span>C: Cycle Color</span>
      <span>·</span>
      <span>X: Clear</span>
      <span>·</span>
      <span>Ctrl+Z: Undo</span>
    </div>
  );
}
