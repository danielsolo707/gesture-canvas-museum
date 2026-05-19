import { GestureType, GestureEvent, HandSnapshot, Handedness, HandIntegrity, EdgeProximityInfo, GestureFreezeState } from '../core/types';
import { GestureClassifier, GesturePipelineResult } from '../model/GestureClassifier';

export interface HandGestureState {
  type: GestureType | null;
  confidence: number;
  intentScore?: number;
}

export interface RecognizeResult {
  events: GestureEvent[];
  handStates: Map<Handedness, HandGestureState>;
  pipelineDebug?: GesturePipelineResult['debug'];
}

export class GestureRecognizer {
  private classifier: GestureClassifier;
  private lastGesture: GestureType = 'idle';
  private lastConfidence = 0;

  constructor() {
    this.classifier = new GestureClassifier();
  }

  initialize(): void {
    this.classifier.initialize();
  }

  recognize(
    hands: HandSnapshot[],
    now: number,
    integrity?: HandIntegrity | null,
    edgeProx?: EdgeProximityInfo | null,
    freezeState?: GestureFreezeState | null,
  ): RecognizeResult {
    const pipelineResult = this.classifier.process(hands, now, integrity, edgeProx, freezeState);

    const handStates = new Map<Handedness, HandGestureState>();
    for (const [hand, state] of pipelineResult.handStates) {
      handStates.set(hand, {
        type: state.gesture,
        confidence: state.confidence,
        intentScore: state.intentScore,
      });
      if (state.confidence > this.lastConfidence) {
        this.lastGesture = state.gesture;
        this.lastConfidence = state.confidence;
      }
    }

    return {
      events: pipelineResult.events,
      handStates,
      pipelineDebug: pipelineResult.debug,
    };
  }

  getCurrentGesture(): GestureType {
    return this.lastGesture;
  }

  destroy(): void {
    this.classifier.destroy();
  }
}
