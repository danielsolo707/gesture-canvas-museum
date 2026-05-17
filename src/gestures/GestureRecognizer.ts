import { GestureType, GestureEvent, HandSnapshot, Handedness } from '../core/types';
import { GESTURE } from '../core/constants';
import { GestureResult, GestureDetector } from './types';
import { GestureFSM } from './GestureFSM';
import { GestureDebouncer } from './GestureDebouncer';
import { DrawingDetector } from './detectors/DrawingDetector';
import { EraserDetector } from './detectors/EraserDetector';
import { ColorSelectDetector } from './detectors/ColorSelectDetector';
import { ClearCanvasDetector } from './detectors/ClearCanvasDetector';
import { computeHandShape } from './detectors/utils';

export interface HandGestureState {
  type: GestureType | null;
  confidence: number;
}

export interface RecognizeResult {
  events: GestureEvent[];
  handStates: Map<Handedness, HandGestureState>;
}

export class GestureRecognizer {
  private detectors: GestureDetector[] = [];
  private fsm: GestureFSM;
  private debouncer: GestureDebouncer;
  private gestureCooldowns: Map<string, number> = new Map();

  private latched: Map<Handedness, { type: GestureType; since: number }> = new Map();

  constructor() {
    this.fsm = new GestureFSM();
    this.debouncer = new GestureDebouncer(
      GESTURE.ACTIVATE_FRAMES,
      GESTURE.DEACTIVATE_FRAMES,
      GESTURE.COOLDOWN_MS,
    );
  }

  initialize(): void {
    this.detectors = [
      new DrawingDetector(),
      new EraserDetector(),
      new ColorSelectDetector(),
      new ClearCanvasDetector(),
    ];
  }

  recognize(hands: HandSnapshot[], now: number): RecognizeResult {
    const events: GestureEvent[] = [];
    const handStates = new Map<Handedness, HandGestureState>();

    for (const hand of hands) {
      const shape = computeHandShape(hand.landmarks);

      let bestResult: GestureResult | null = null;
      let bestConfidence = -1;

      for (const detector of this.detectors) {
        const result = detector.detect(hand.landmarks, hand.handedness, shape);
        if (result && result.confidence > bestConfidence) {
          bestResult = result;
          bestConfidence = result.confidence;
        }
      }

      const detectedType = bestResult?.type ?? null;

      const { activeGesture, changed } = this.debouncer.update(
        hand.handedness,
        detectedType,
        now,
      );

      if (changed && activeGesture) {
        const cooldownKey = `${hand.handedness}:${activeGesture}`;
        const lastFired = this.gestureCooldowns.get(cooldownKey) ?? 0;
        if (now - lastFired >= GESTURE.COOLDOWN_MS) {
          const newState = this.fsm.transition(activeGesture, now);
          if (newState === activeGesture) {
            this.latched.set(hand.handedness, { type: activeGesture, since: now });
            events.push({
              type: activeGesture,
              hand: hand.handedness,
              confidence: bestResult?.confidence ?? 0.5,
              timestamp: now,
              data: bestResult?.data,
            });
            this.gestureCooldowns.set(cooldownKey, now);
          }
        }
      }

      let finalType = activeGesture;

      if (activeGesture !== null) {
        this.latched.set(hand.handedness, { type: activeGesture, since: now });
      } else {
        const entry = this.latched.get(hand.handedness);
        if (entry && now - entry.since < GESTURE.GESTURE_LATCH_TIMEOUT_MS) {
          finalType = entry.type;
        }
      }

      handStates.set(hand.handedness, {
        type: finalType,
        confidence: finalType !== null ? Math.max(bestResult?.confidence ?? 0.4, 0.4) : 0,
      });
    }

    return { events, handStates };
  }

  getHandStates(): Map<Handedness, HandGestureState> {
    const result = new Map<Handedness, HandGestureState>();
    for (const hand of ['Left', 'Right'] as Handedness[]) {
      const gesture = this.debouncer.getActiveGesture(hand);
      result.set(hand, { type: gesture, confidence: gesture ? 0.5 : 0 });
    }
    return result;
  }

  getRawGestures(hands: HandSnapshot[]): Map<Handedness, GestureResult | null> {
    const results = new Map<Handedness, GestureResult | null>();
    for (const hand of hands) {
      let best: GestureResult | null = null;
      let bestConf = -1;
      for (const detector of this.detectors) {
        const result = detector.detect(hand.landmarks, hand.handedness);
        if (result && result.confidence > bestConf) {
          best = result;
          bestConf = result.confidence;
        }
      }
      results.set(hand.handedness, best);
    }
    return results;
  }

  getCurrentGesture(): GestureType {
    return this.fsm.getState();
  }

  destroy(): void {
    this.detectors.forEach((d) => d.reset());
    this.detectors.length = 0;
    this.fsm.destroy();
    this.debouncer.destroy();
    this.gestureCooldowns.clear();
    this.latched.clear();
  }
}
