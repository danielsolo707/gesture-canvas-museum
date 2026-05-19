import { GestureType, GestureEvent, HandSnapshot, Handedness } from '../core/types';
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

  constructor() {
    this.classifier = new GestureClassifier();
  }

  initialize(): void {
    this.classifier.initialize();
  }

  recognize(hands: HandSnapshot[], now: number): RecognizeResult {
    const pipelineResult = this.classifier.process(hands, now);

    const handStates = new Map<Handedness, HandGestureState>();
    for (const [hand, state] of pipelineResult.handStates) {
      handStates.set(hand, {
        type: state.gesture,
        confidence: state.confidence,
        intentScore: state.intentScore,
      });
    }

    return {
      events: pipelineResult.events,
      handStates,
      pipelineDebug: pipelineResult.debug,
    };
  }

  getCurrentGesture(): GestureType {
    return 'idle';
  }

  getClassifier(): GestureClassifier {
    return this.classifier;
  }

  getCalibrationModule() {
    return this.classifier.getCalibrationModule();
  }

  destroy(): void {
    this.classifier.destroy();
  }
}
