import { GestureType, GestureEvent, HandSnapshot, Handedness } from '../core/types';
import { GESTURE } from '../core/constants';
import { GestureResult, GestureDetector } from './types';
import { GestureFSM } from './GestureFSM';
import { GestureDebouncer } from './GestureDebouncer';
import { DrawingDetector } from './detectors/DrawingDetector';
import { ColorSelectDetector } from './detectors/ColorSelectDetector';
import { StopDrawingDetector } from './detectors/StopDrawingDetector';
import { ClearCanvasDetector } from './detectors/ClearCanvasDetector';
import { EraserDetector } from './detectors/EraserDetector';
import { DualHandDetector } from './detectors/DualHandDetector';

type GestureHand = 'Left' | 'Right' | 'Both';

export class GestureRecognizer {
  private detectors: GestureDetector[] = [];
  private fsm: GestureFSM;
  private debouncer: GestureDebouncer;
  private clearHoldTimers: Map<string, { start: number; fired: boolean }> = new Map();
  private gestureCooldowns: Map<string, number> = new Map();

  constructor() {
    this.fsm = new GestureFSM();
    this.debouncer = new GestureDebouncer(
      GESTURE.DEBOUNCE_FRAMES,
      GESTURE.COOLDOWN_MS,
    );
  }

  initialize(): void {
    this.detectors = [
      new DrawingDetector(),
      new StopDrawingDetector(),
      new ColorSelectDetector(),
      new EraserDetector(),
      new DualHandDetector(),
      new ClearCanvasDetector(),
    ];
  }

  recognize(hands: HandSnapshot[], now: number): GestureEvent[] {
    const events: GestureEvent[] = [];
    const detectedGestures: Map<Handedness, GestureResult | null> = new Map();

    for (const hand of hands) {
      let bestResult: GestureResult | null = null;
      let bestConfidence = 0;

      for (const detector of this.detectors) {
        const result = detector.detect(hand.landmarks, hand.handedness);
        if (result && result.confidence > bestConfidence) {
          bestResult = result;
          bestConfidence = result.confidence;
        }
      }

      detectedGestures.set(hand.handedness, bestResult);

      if (!bestResult) {
        this.clearHoldTimers.delete(hand.handedness);
        continue;
      }

      if (bestResult.type === 'clear_canvas') {
        this.processClearHold(hand.handedness, now, events);
      } else {
        this.clearHoldTimers.delete(hand.handedness);

        const triggered = this.debouncer.shouldTrigger(
          bestResult.type,
          hand.handedness,
          true,
          now,
        );

        if (triggered) {
          const cooldownKey = `${hand.handedness}:${bestResult.type}`;
          const lastFired = this.gestureCooldowns.get(cooldownKey) ?? 0;
          if (now - lastFired < GESTURE.COOLDOWN_MS) continue;

          const newState = this.fsm.transition(bestResult.type, now);
          if (newState === bestResult.type) {
            events.push({
              type: bestResult.type,
              hand: hand.handedness,
              confidence: bestResult.confidence,
              timestamp: now,
              data: bestResult.data,
            });
            this.gestureCooldowns.set(cooldownKey, now);
          }
        }
      }
    }

    this.checkDualHand(detectedGestures, now, events);
    return events;
  }

  private processClearHold(hand: Handedness, now: number, events: GestureEvent[]): void {
    let timer = this.clearHoldTimers.get(hand);
    if (!timer) {
      timer = { start: now, fired: false };
      this.clearHoldTimers.set(hand, timer);
    }

    if (timer.fired) return;

    const elapsed = now - timer.start;
    const progress = Math.min(elapsed / GESTURE.CLEAR_HOLD_MS, 1);

    if (progress >= 1) {
      timer.fired = true;
      events.push({ type: 'clear_canvas', hand, confidence: 1, timestamp: now });
    } else {
      events.push({ type: 'clear_canvas', hand, confidence: progress, timestamp: now, data: { progress } });
    }
  }

  private checkDualHand(
    detected: Map<Handedness, GestureResult | null>,
    now: number,
    events: GestureEvent[],
  ): void {
    if (detected.size < 2) return;
    const left = detected.get('Left');
    const right = detected.get('Right');
    if (left?.type === 'drawing' && right?.type === 'drawing') {
      const triggered = this.debouncer.shouldTrigger('dual_hand', 'both', true, now);
      if (triggered) {
        events.push({
          type: 'dual_hand',
          hand: 'Both' as GestureHand as Handedness,
          confidence: Math.min(left.confidence, right.confidence),
          timestamp: now,
        });
      }
    }
  }

  getCurrentGesture(): GestureType {
    return this.fsm.getState();
  }

  destroy(): void {
    this.detectors.forEach((d) => d.reset());
    this.detectors.length = 0;
    this.fsm.destroy();
    this.debouncer.destroy();
    this.clearHoldTimers.clear();
    this.gestureCooldowns.clear();
  }
}
