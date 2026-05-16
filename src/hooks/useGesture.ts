import { useStore } from '../store/useStore';

export function useGesture() {
  const current = useStore((s) => s.currentGesture);
  const previous = useStore((s) => s.previousGesture);
  const leftHand = useStore((s) => s.leftHandGesture);
  const rightHand = useStore((s) => s.rightHandGesture);
  const confidence = useStore((s) => s.gestureConfidence);
  const clearProgress = useStore((s) => s.clearProgress);

  return { current, previous, leftHand, rightHand, confidence, clearProgress };
}
