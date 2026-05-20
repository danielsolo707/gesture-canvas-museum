import { useStore } from '../../store/useStore';

const GESTURE_LABELS: Record<string, { en: string; fa: string }> = {
  drawing: { en: 'Drawing', fa: 'نقاشی' },
  cursor: { en: 'Menu Mode', fa: 'منو' },
  eraser: { en: 'Eraser', fa: 'پاک‌کن' },
};

export function GestureIndicator() {
  const current = useStore((s) => s.currentGesture);
  const isErasing = useStore((s) => s.isErasing);
  const showDebug = useStore((s) => s.showDebug);

  const gestureKey = isErasing && current === 'drawing' ? 'eraser' : current;
  const label = GESTURE_LABELS[gestureKey];
  const className = `gesture-indicator ${current}`;

  if (!label) return null;

  return (
    <div className={className} style={{
      position: 'fixed', top: showDebug ? 20 : 10, left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 20px',
      borderRadius: 100,
      fontSize: 13, fontWeight: 600,
      letterSpacing: '0.5px',
      pointerEvents: 'none', zIndex: 200,
      background: 'rgba(10,10,15,0.75)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.1)',
      color: current === 'drawing' ? '#4dabf7'
           : current === 'eraser' ? '#ffa94d'
           : current === 'cursor' ? '#ffd43b'
           : '#e9ecef',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span>{label.en}</span>
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, direction: 'rtl' }}>
        {label.fa}
      </span>
    </div>
  );
}
