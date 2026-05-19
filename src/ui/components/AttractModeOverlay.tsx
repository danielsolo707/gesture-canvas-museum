import { useStore } from '../../store/useStore';

export function AttractModeOverlay() {
  const idleSeconds = useStore((s) => s.idleSeconds);
  const engineState = useStore((s) => s.engineState);
  const mode = useStore((s) => s.mode);
  const showTutorial = useStore((s) => s.showTutorial);

  const showAttract = idleSeconds >= 30 && engineState === 'running' && mode !== 'fallback' && !showTutorial;

  if (!showAttract) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 280,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,10,15,0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        pointerEvents: 'none',
        animation: 'fadeIn 1s ease forwards',
      }}
    >
      <div
        style={{
          fontSize: 64, marginBottom: 24,
          animation: 'float 3s ease-in-out infinite',
        }}
      >
        👋
      </div>
      <div
        style={{
          fontSize: 22, fontWeight: 300, color: '#e9ecef',
          letterSpacing: '1px', marginBottom: 8,
        }}
      >
        Wave your hand
      </div>
      <div
        style={{
          fontSize: 16, fontWeight: 300, color: '#868e96',
          direction: 'rtl',
        }}
      >
        دست خود را تکان دهید
      </div>
    </div>
  );
}
