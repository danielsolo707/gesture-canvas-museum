import { useStore } from '../../store/useStore';

export function FingertipCursor() {
  const cursorX = useStore((s) => s.cursorX);
  const cursorY = useStore((s) => s.cursorY);
  const cursorState = useStore((s) => s.cursorState);
  const currentGesture = useStore((s) => s.currentGesture);

  if (cursorX === null || cursorY === null || !cursorState?.visible) return null;

  const isDrawing = currentGesture === 'drawing';
  const isErasing = currentGesture === 'eraser';

  if (isDrawing) {
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
            width: 18, height: 18, borderRadius: '50%',
            background: 'transparent',
            border: '2px solid rgba(77,171,247,0.5)',
            boxShadow: '0 0 14px rgba(77,171,247,0.6), inset 0 0 8px rgba(77,171,247,0.2)',
          }}
        />
        <div
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 6, height: 6, borderRadius: '50%',
            background: '#4dabf7',
            boxShadow: '0 0 8px rgba(77,171,247,0.8)',
          }}
        />
      </div>
    );
  }

  if (isErasing) {
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
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(255,80,80,0.08)',
            border: '2px solid rgba(255,80,80,0.6)',
            boxShadow: '0 0 18px rgba(255,80,80,0.4), inset 0 0 8px rgba(255,80,80,0.1)',
          }}
        />
      </div>
    );
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
          width: 8, height: 8, borderRadius: '50%',
          background: 'rgba(255,255,255,0.85)',
          boxShadow: '0 0 6px rgba(255,255,255,0.3)',
        }}
      />
    </div>
  );
}
