import { useStore } from '../../store/useStore';

export function WebcamStatus() {
  const engineState = useStore((s) => s.engineState);
  const mode = useStore((s) => s.mode);
  const webcamReady = useStore((s) => s.webcamReady);
  const webcamError = useStore((s) => s.webcamError);

  let dotClass = 'webcam-dot inactive';
  let label = 'Initializing...';

  if (engineState === 'running' && mode === 'fallback') {
    dotClass = 'webcam-dot inactive';
    label = 'Fallback Mode';
  } else if (engineState === 'running' && webcamReady) {
    dotClass = 'webcam-dot';
    label = 'Camera Active';
  } else if (engineState === 'error' || webcamError) {
    dotClass = 'webcam-dot error';
    label = webcamError ?? 'Camera Error';
  } else if (engineState === 'paused') {
    dotClass = 'webcam-dot inactive';
    label = 'Paused';
  }

  return (
    <div className="webcam-status">
      <span className={dotClass} />
      <span>{label}</span>
    </div>
  );
}
