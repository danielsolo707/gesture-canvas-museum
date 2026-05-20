import { useStore } from '../../store/useStore';

function CameraIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7l-7 5-7-5v10l7-5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

export function WebcamStatus() {
  const engineState = useStore((s) => s.engineState);
  const mode = useStore((s) => s.mode);
  const webcamReady = useStore((s) => s.webcamReady);
  const webcamError = useStore((s) => s.webcamError);
  const showDebug = useStore((s) => s.showDebug);

  let dotClass = 'webcam-dot inactive';
  let label = 'Initializing...';
  let dotColor = '#495057';

  if (engineState === 'running' && mode === 'fallback') {
    dotClass = 'webcam-dot inactive';
    label = 'Fallback Mode';
    dotColor = '#495057';
  } else if (engineState === 'running' && webcamReady) {
    dotClass = 'webcam-dot';
    label = 'Camera Active';
    dotColor = '#4dabf7';
  } else if (engineState === 'error' || webcamError) {
    dotClass = 'webcam-dot error';
    label = webcamError ?? 'Camera Error';
    dotColor = '#ff6b6b';
  } else if (engineState === 'paused') {
    dotClass = 'webcam-dot inactive';
    label = 'Paused';
    dotColor = '#495057';
  }

  return (
    <div className="webcam-status" style={{
      position: 'fixed', top: showDebug ? 20 : 10, right: showDebug ? 20 : 12,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 14px',
      background: 'rgba(10,10,15,0.75)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      borderRadius: 100,
      fontSize: 12, color: '#e9ecef',
      pointerEvents: 'auto', zIndex: 200,
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <CameraIcon />
      <span className={dotClass} style={{
        width: 6, height: 6, borderRadius: '50%',
        background: dotColor,
        animation: dotClass === 'webcam-dot' ? 'pulse 2s infinite' : 'none',
        flexShrink: 0,
      }} />
      <span>{label}</span>
    </div>
  );
}
