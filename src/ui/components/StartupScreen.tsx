import { useStore } from '../../store/useStore';
import { EngineState } from '../../core/types';

const STATES: { key: EngineState; label: string; fa: string }[] = [
  { key: 'initializing', label: 'Initializing camera...', fa: 'در حال راه‌اندازی دوربین...' },
  { key: 'error', label: 'Starting in fallback mode...', fa: 'حالت جایگزین...' },
  { key: 'uninitialized', label: 'Loading...', fa: 'در حال بارگذاری...' },
  { key: 'paused', label: 'Paused', fa: 'متوقف شده' },
];

export function StartupScreen() {
  const engineState: EngineState = useStore((s) => s.engineState);

  if (engineState === 'running') return null;

  const status = STATES.find((s) => s.key === engineState);

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
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 24 }}>
        <circle cx="24" cy="24" r="22" stroke="rgba(77,171,247,0.2)" strokeWidth="2" />
        <path d="M16 28 C16 20, 24 14, 32 20" stroke="#4dabf7" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="20" cy="22" r="2.5" fill="#4dabf7" opacity="0.6" />
        <circle cx="28" cy="22" r="2.5" fill="#4dabf7" opacity="0.6" />
        <path d="M22 26 L24 28 L26 26" stroke="#4dabf7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <div
        style={{
          width: 48,
          height: 48,
          border: '3px solid rgba(77, 171, 247, 0.2)',
          borderTopColor: '#4dabf7',
          borderRadius: '50%',
          marginBottom: 24,
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <h1 style={{ fontSize: 24, fontWeight: 300, letterSpacing: '2px', textTransform: 'uppercase', color: '#e0e0e0', marginBottom: 4 }}>
        Gesture Canvas
      </h1>
      <p style={{ color: '#6c757d', fontSize: 12, marginBottom: 16, direction: 'rtl' }}>
        موزه نقاشی حرکتی
      </p>
      {status && (
        <p style={{ color: '#868e96', fontSize: 13 }}>{status.label}</p>
      )}
    </div>
  );
}
