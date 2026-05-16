import { useStore } from '../../store/useStore';
import { EngineState } from '../../core/types';

const STATES: { key: EngineState; label: string }[] = [
  { key: 'initializing', label: 'Initializing camera...' },
  { key: 'error', label: 'Starting in fallback mode...' },
  { key: 'uninitialized', label: 'Loading...' },
  { key: 'paused', label: 'Paused' },
];

export function StartupScreen() {
  const engineState: EngineState = useStore((s) => s.engineState);

  if (engineState === 'running') return null;

  const status = STATES.find((s) => s.key === engineState)?.label ?? 'Loading...';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f',
        zIndex: 300,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          border: '3px solid rgba(77, 171, 247, 0.2)',
          borderTopColor: '#4dabf7',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          marginBottom: 24,
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <h1 style={{ fontSize: 24, fontWeight: 300, letterSpacing: '2px', textTransform: 'uppercase', color: '#e0e0e0', marginBottom: 8 }}>
        Gesture Canvas
      </h1>
      <p style={{ color: '#868e96', fontSize: 13 }}>{status}</p>
    </div>
  );
}
