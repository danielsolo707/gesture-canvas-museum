import { useStore } from '../../store/useStore';

export function HandStatus() {
  const hands = useStore((s) => s.hands);
  const engineState = useStore((s) => s.engineState);
  const mode = useStore((s) => s.mode);

  const leftCount = hands.filter((hand) => hand.handedness === 'Left').length;
  const rightCount = hands.filter((hand) => hand.handedness === 'Right').length;
  const labels = [
    leftCount > 0 ? `Left${leftCount > 1 ? ` x${leftCount}` : ''}` : '',
    rightCount > 0 ? `Right${rightCount > 1 ? ` x${rightCount}` : ''}` : '',
  ].filter(Boolean);
  const isCameraRunning = engineState === 'running' && mode === 'camera';

  if (!isCameraRunning && hands.length === 0) return null;

  return (
    <div className={`hand-status${hands.length === 0 ? ' empty' : ''}`}>
      <span>{hands.length} hand{hands.length > 1 ? 's' : ''}</span>
      <strong>{labels.length > 0 ? labels.join(' + ') : 'No landmarks'}</strong>
    </div>
  );
}
