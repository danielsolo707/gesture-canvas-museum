import { GestureType, Handedness } from '../core/types';

export interface IntentConfig {
  activationFrames: number;
  deactivationFrames: number;
  activationThreshold: number;
  deactivationThreshold: number;
  intentMemoryFrames: number;
  maxIntentSwitchMs: number;
}

const DEFAULT_INTENT_CONFIG: IntentConfig = {
  activationFrames: 5,
  deactivationFrames: 8,
  activationThreshold: 0.50,
  deactivationThreshold: 0.25,
  intentMemoryFrames: 20,
  maxIntentSwitchMs: 2000,
};

interface IntentState {
  gesture: GestureType;
  score: number;
  activationCount: number;
  deactivationCount: number;
  sustained: boolean;
}

interface IntentEntry {
  gesture: GestureType;
  confidence: number;
  timestamp: number;
}

export class IntentLayer {
  private config: IntentConfig;
  private intents = new Map<Handedness, Map<GestureType, IntentState>>();
  private history = new Map<Handedness, IntentEntry[]>();
  private currentIntent = new Map<Handedness, GestureType>();

  constructor(config?: Partial<IntentConfig>) {
    this.config = { ...DEFAULT_INTENT_CONFIG, ...config };
  }

  update(
    hand: Handedness,
    detectedGesture: GestureType,
    rawConfidence: number,
    now: number,
    motionSpeed: number,
    trackingStability: number,
  ): { gesture: GestureType; confidence: number; changed: boolean } {
    this.addToHistory(hand, detectedGesture, rawConfidence, now);
    const entry = this.getOrCreateIntent(hand, detectedGesture);

    const dynamicThreshold = this.computeDynamicThreshold(detectedGesture, motionSpeed, trackingStability);
    const prevIntent = this.currentIntent.get(hand) ?? 'idle';

    if (detectedGesture === prevIntent) {
      entry.activationCount = Math.min(entry.activationCount + 1, 30);
      entry.deactivationCount = 0;
      entry.score = Math.min(entry.score + 0.1, 1);
      entry.sustained = true;
    } else {
      if (rawConfidence >= dynamicThreshold && this.checkTemporalConsistency(hand, detectedGesture, motionSpeed)) {
        entry.activationCount++;
        entry.deactivationCount = 0;
        if (entry.activationCount >= this.config.activationFrames) {
          entry.score = Math.min(entry.score + 0.15, 1);
          entry.sustained = true;
          this.currentIntent.set(hand, detectedGesture);
          return { gesture: detectedGesture, confidence: Math.min(rawConfidence * entry.score * 1.2, 1), changed: true };
        }
      } else {
        entry.activationCount = Math.max(entry.activationCount - 1, 0);
        entry.deactivationCount++;

        const prevEntry = this.getOrCreateIntent(hand, prevIntent);
        if (entry.deactivationCount >= this.config.deactivationFrames && prevEntry.sustained) {
          prevEntry.deactivationCount = 0;
          prevEntry.sustained = false;
          prevEntry.score = Math.max(prevEntry.score - 0.2, 0);
          this.currentIntent.set(hand, 'idle');
          return { gesture: 'idle', confidence: 0, changed: true };
        }
      }
    }

    if (prevIntent === detectedGesture) {
      return { gesture: detectedGesture, confidence: entry.score * rawConfidence, changed: false };
    }

    const currentEntry = this.getOrCreateIntent(hand, prevIntent);
    if (currentEntry.sustained) {
      return { gesture: prevIntent, confidence: currentEntry.score * 0.7, changed: false };
    }

    return { gesture: 'idle', confidence: 0, changed: false };
  }

  private computeDynamicThreshold(
    gesture: GestureType,
    motionSpeed: number,
    trackingStability: number,
  ): number {
    let threshold = this.config.activationThreshold;

    if (gesture === 'drawing') {
      threshold -= Math.min(motionSpeed * 0.05, 0.1);
    }

    threshold += (1 - trackingStability) * 0.15;

    return Math.max(0.2, Math.min(threshold, 0.85));
  }

  private checkTemporalConsistency(hand: Handedness, gesture: GestureType, _motionSpeed: number): boolean {
    const history = this.history.get(hand);
    if (!history || history.length < 3) return true;

    const recent = history.slice(-this.config.intentMemoryFrames);
    const gestureCounts = new Map<GestureType, number>();
    for (const entry of recent) {
      gestureCounts.set(entry.gesture, (gestureCounts.get(entry.gesture) ?? 0) + 1);
    }

    const currentCount = gestureCounts.get(gesture) ?? 0;
    const dominance = currentCount / recent.length;

    return dominance >= 0.15;
  }

  private addToHistory(hand: Handedness, gesture: GestureType, confidence: number, now: number): void {
    let history = this.history.get(hand);
    if (!history) {
      history = [];
      this.history.set(hand, history);
    }

    history.push({ gesture, confidence, timestamp: now });
    if (history.length > this.config.intentMemoryFrames * 2) {
      history.splice(0, history.length - this.config.intentMemoryFrames * 2);
    }
  }

  private getOrCreateIntent(hand: Handedness, gesture: GestureType): IntentState {
    let handIntents = this.intents.get(hand);
    if (!handIntents) {
      handIntents = new Map();
      this.intents.set(hand, handIntents);
      for (const g of ['idle', 'drawing', 'cursor', 'eraser'] as GestureType[]) {
        handIntents.set(g, { gesture: g, score: 0, activationCount: 0, deactivationCount: 0, sustained: false });
      }
    }
    let entry = handIntents.get(gesture);
    if (!entry) {
      entry = { gesture, score: 0, activationCount: 0, deactivationCount: 0, sustained: false };
      handIntents.set(gesture, entry);
    }
    return entry;
  }

  getCurrentIntent(hand: Handedness): GestureType {
    return this.currentIntent.get(hand) ?? 'idle';
  }

  getIntentScore(hand: Handedness): number {
    const gesture = this.getCurrentIntent(hand);
    const intents = this.intents.get(hand);
    return intents?.get(gesture)?.score ?? 0;
  }

  reset(hand?: Handedness): void {
    if (hand) {
      this.intents.delete(hand);
      this.history.delete(hand);
      this.currentIntent.delete(hand);
    } else {
      this.intents.clear();
      this.history.clear();
      this.currentIntent.clear();
    }
  }

  destroy(): void {
    this.reset();
  }
}
