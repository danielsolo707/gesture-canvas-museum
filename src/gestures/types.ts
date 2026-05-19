import { GestureType, Handedness } from '../core/types';

export interface GestureResult {
  type: GestureType;
  hand: Handedness;
  confidence: number;
  data?: Record<string, unknown>;
}

export interface GesturePipelineInput {
  hands: Array<{
    landmarks: Float32Array;
    handedness: Handedness;
    confidence: number;
  }>;
  timestamp: number;
}
