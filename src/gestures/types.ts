import { GestureType, Handedness, GestureHand } from '../core/types';

export interface GestureResult {
  type: GestureType;
  hand: Handedness;
  confidence: number;
  data?: Record<string, unknown>;
}

export interface GestureDetector {
  readonly name: string;
  detect(landmarks: Float32Array, handedness: Handedness): GestureResult | null;
  reset(): void;
}

export type FSMState = GestureType;
export type FSMEvent = GestureType;

export interface FSMTransition {
  from: FSMState;
  to: FSMState;
  condition: () => boolean;
  cooldownMs: number;
}

export interface DebounceState {
  counts: Map<string, number>;
  lastTriggered: Map<string, number>;
}

export interface GesturePipelineInput {
  hands: Array<{
    landmarks: Float32Array;
    handedness: Handedness;
    confidence: number;
  }>;
  timestamp: number;
}
