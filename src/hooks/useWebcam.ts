import { useStore } from '../store/useStore';

export function useWebcam() {
  const webcamReady = useStore((s) => s.webcamReady);
  const webcamError = useStore((s) => s.webcamError);
  const engineState = useStore((s) => s.engineState);
  const mode = useStore((s) => s.mode);

  return { ready: webcamReady, error: webcamError, engineState, mode, isFallback: mode === 'fallback' };
}
