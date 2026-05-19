import { useStore } from '../../store/useStore';

export function FingertipCursor() {
  const cursorX = useStore((s) => s.cursorX);
  const cursorY = useStore((s) => s.cursorY);
  const cursorState = useStore((s) => s.cursorState);
  const currentGesture = useStore((s) => s.currentGesture);

  if (cursorX === null || cursorY === null || !cursorState?.visible) return null;

  const isDrawing = currentGesture === 'drawing';
  const isErasing = currentGesture === 'eraser';

  let size = 10;
  let bg = 'rgba(255,255,255,0.85)';
  let shadow = '0 0 8px rgba(255,255,255,0.3)';
  let border = 'none';

  if (isDrawing) {
    size = 8;
    bg = 'rgba(255,255,255,0.95)';
    shadow = '0 0 12px rgba(77,171,247,0.6)';
  } else if (isErasing) {
    size = 20;
    bg = 'rgba(255,80,80,0.15)';
    shadow = '0 0 16px rgba(255,80,80,0.4)';
    border = '2px solid rgba(255,80,80,0.6)';
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: `${cursorX * 100}%`,
        top: `${cursorY * 100}%`,
        pointerEvents: 'none',
        zIndex: 270,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: bg,
          boxShadow: shadow,
          border,
        }}
      />
    </div>
  );
}
