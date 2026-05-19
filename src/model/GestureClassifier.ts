import { NormalizedHand, LandmarkNormalizer } from '../tracking/LandmarkNormalizer';
import { FeatureExtractor } from '../features/FeatureExtractor';
import { HandFeatures } from '../features/types';
import { OcclusionRecovery } from './OcclusionRecovery';
import { IntentLayer } from './IntentLayer';
import { AdaptiveThresholds } from './AdaptiveThresholds';
import { CalibrationModule } from './CalibrationModule';
import { Handedness, GestureType, GestureEvent, HandSnapshot } from '../core/types';
import { OCCLUSION, INTENT, ADAPTIVE, CALIBRATION, GESTURE } from '../core/constants';
import { globalEventBus } from '../core/EventBus';
import { logger } from '../utils/logging';

export interface GesturePipelineResult {
  events: GestureEvent[];
  handStates: Map<Handedness, { gesture: GestureType; confidence: number; stableCount: number; intentScore: number }>;
  debug: {
    features: HandFeatures | null;
    motionSpeed: number;
    trackingStability: number;
    intentScore: number;
    dynamicThreshold: number;
    occlusionRecovered: boolean;
  };
}

export class GestureClassifier {
  private normalizer: LandmarkNormalizer;
  private featureExtractor: FeatureExtractor;
  private motionPredictors = new Map<Handedness, { x: number; y: number; prevX: number; prevY: number; speed: number; lastTime: number }>();
  private stateMachine: Map<Handedness, {
    current: GestureType;
    confidence: number;
    activationCount: number;
    deactivationCount: number;
    stableCount: number;
    lastChange: GestureType;
  }>;
  private occlusionRecovery: OcclusionRecovery;
  private intentLayer: IntentLayer;
  private adaptiveThresholds: AdaptiveThresholds;
  private gestureCooldowns = new Map<string, number>();
  private calibrationModule: CalibrationModule;
  private initialized = false;

  constructor() {
    this.normalizer = new LandmarkNormalizer(false);
    this.featureExtractor = new FeatureExtractor();
    this.stateMachine = new Map();
    this.calibrationModule = new CalibrationModule(globalEventBus);
    this.occlusionRecovery = new OcclusionRecovery(
      OCCLUSION.POSE_MEMORY_SIZE,
      OCCLUSION.MAX_EXTRAPOLATION_MS,
      OCCLUSION.CONFIDENCE_DECAY_RATE,
    );
    this.intentLayer = new IntentLayer({
      activationFrames: INTENT.ACTIVATION_FRAMES,
      deactivationFrames: INTENT.DEACTIVATION_FRAMES,
      activationThreshold: INTENT.ACTIVATION_THRESHOLD,
      intentMemoryFrames: INTENT.INTENT_MEMORY_FRAMES,
    });
    this.adaptiveThresholds = new AdaptiveThresholds({
      historySize: ADAPTIVE.HISTORY_SIZE,
      baseConfidenceThreshold: ADAPTIVE.BASE_CONFIDENCE_THRESHOLD,
      speedAdaptationRate: ADAPTIVE.SPEED_ADAPTATION_RATE,
      stabilityAdaptationRate: ADAPTIVE.STABILITY_ADAPTATION_RATE,
      fastMotionThreshold: ADAPTIVE.FAST_MOTION_THRESHOLD,
      slowMotionThreshold: ADAPTIVE.SLOW_MOTION_THRESHOLD,
    });
  }

  initialize(): void {
    if (this.initialized) return;
    this.featureExtractor.reset();
    this.stateMachine.clear();
    this.motionPredictors.clear();
    this.occlusionRecovery.reset();
    this.intentLayer.reset();
    this.adaptiveThresholds.reset();
    this.gestureCooldowns.clear();
    this.normalizer.setCalibration(null);
    this.initialized = true;
  }

  process(hands: HandSnapshot[], now: number): GesturePipelineResult {
    const events: GestureEvent[] = [];
    const handStates = new Map<Handedness, { gesture: GestureType; confidence: number; stableCount: number; intentScore: number }>();
    let debugFeatures: HandFeatures | null = null;
    let debugMotionSpeed = 0;
    let debugTrackingStability = 0;
    let debugIntentScore = 0;
    let debugDynamicThreshold = 0;
    let debugOcclusionRecovered = false;

    for (const hand of hands) {
      const rawLandmarks = hand.landmarks;

      const occlusionResult = this.occlusionRecovery.recover(
        hand.handedness, rawLandmarks, hand.confidence, now,
      );
      debugOcclusionRecovered = occlusionResult.recovered;

      if (!occlusionResult.recovered) {
        this.occlusionRecovery.recordPose(
          hand.handedness, occlusionResult.landmarks, occlusionResult.confidence, now,
        );
      }

      const norm = this.normalizer.normalize(
        occlusionResult.landmarks, hand.handedness, occlusionResult.confidence, now,
      );

      const features = this.featureExtractor.extract(norm, now);
      debugFeatures = features;

      const speed = features.speed;
      debugMotionSpeed = speed;

      this.adaptiveThresholds.updateMotionSpeed(hand.handedness, speed, now);
      const stability = this.occlusionRecovery.getTrackingStability(hand.handedness);
      this.adaptiveThresholds.updateTrackingStability(hand.handedness, stability);
      debugTrackingStability = stability;

      const heuristicGesture = this.heuristicDetect(features, speed);
      const heuristicConfidence = heuristicGesture ? this.computeConfidence(heuristicGesture, features, speed) : 0;

      const selectedGesture = heuristicGesture ?? 'idle';
      const selectedConfidence = heuristicConfidence;

      const dynamicThreshold = this.adaptiveThresholds.getThreshold(
        hand.handedness, selectedGesture,
      );
      debugDynamicThreshold = dynamicThreshold;

      this.adaptiveThresholds.updateConfidence(hand.handedness, selectedConfidence);

      const finalGesture = selectedGesture;
      const finalConfidence = selectedConfidence;
      debugIntentScore = selectedConfidence;

      const sm = this.getOrCreateState(hand.handedness);
      const gestureChanged = sm.current !== finalGesture;
      this.updateStateMachine(sm, finalGesture, finalConfidence, now);

      const cooldownKey = `${hand.handedness}:${finalGesture}`;
      const lastFired = this.gestureCooldowns.get(cooldownKey) ?? 0;
      let shouldEmitEvent = false;

      if (sm.current === finalGesture && sm.current !== sm.lastChange) {
        sm.lastChange = sm.current;
      }
      if (finalGesture !== 'idle' && gestureChanged) {
        if (now - lastFired >= GESTURE.COOLDOWN_MS) {
          shouldEmitEvent = true;
          this.gestureCooldowns.set(cooldownKey, now);
        }
      }

      handStates.set(hand.handedness, {
        gesture: finalGesture,
        confidence: finalConfidence,
        stableCount: sm.stableCount,
        intentScore: debugIntentScore,
      });

      if (shouldEmitEvent) {
        events.push({
          type: finalGesture,
          hand: hand.handedness,
          confidence: finalConfidence,
          timestamp: now,
          data: { dynamicThreshold, trackingStability: stability },
        });
      }
    }

    return {
      events,
      handStates,
      debug: {
        features: debugFeatures,
        motionSpeed: debugMotionSpeed,
        trackingStability: debugTrackingStability,
        intentScore: debugIntentScore,
        dynamicThreshold: debugDynamicThreshold,
        occlusionRecovered: debugOcclusionRecovered,
      },
    };
  }

  private getOrCreateState(hand: Handedness): {
    current: GestureType;
    confidence: number;
    activationCount: number;
    deactivationCount: number;
    stableCount: number;
    lastChange: GestureType;
  } {
    let sm = this.stateMachine.get(hand);
    if (!sm) {
      sm = { current: 'idle', confidence: 0, activationCount: 0, deactivationCount: 0, stableCount: 0, lastChange: 'idle' };
      this.stateMachine.set(hand, sm);
    }
    return sm;
  }

  private updateStateMachine(
    sm: { current: GestureType; confidence: number; activationCount: number; deactivationCount: number; stableCount: number; lastChange: GestureType },
    detected: GestureType,
    confidence: number,
    now: number,
  ): void {
    if (detected === sm.current) {
      sm.stableCount = Math.min(sm.stableCount + 1, 60);
      sm.confidence = sm.confidence + 0.3 * (confidence - sm.confidence);
      sm.activationCount = 0;
      sm.deactivationCount = 0;
    } else {
      if (confidence >= 0.5) {
        sm.activationCount++;
        sm.deactivationCount = 0;
        if (sm.activationCount >= GESTURE.ACTIVATE_FRAMES) {
          sm.current = detected;
          sm.confidence = confidence;
          sm.stableCount = 1;
          sm.activationCount = 0;
          sm.deactivationCount = 0;
        }
      } else {
        sm.deactivationCount++;
        sm.activationCount = 0;
        if (sm.deactivationCount >= GESTURE.DEACTIVATE_FRAMES && sm.current !== 'idle') {
          sm.current = 'idle';
          sm.confidence = 0;
          sm.stableCount = 0;
          sm.activationCount = 0;
          sm.deactivationCount = 0;
        }
      }
    }
  }

  private heuristicDetect(features: HandFeatures, _motionSpeed: number): GestureType | null {
    const o = features.fingerOpenness;

    // 1. Drawing: index finger only extended, ALL other fingers (including thumb) curled
    if (o.index >= 0.35) {
      const othersMax = Math.max(o.thumb, o.middle, o.ring, o.pinky);
      if (o.index - othersMax >= 0.25) {
        return 'drawing';
      }
    }

    // 2. Cursor: index + middle extended, ring + pinky curled
    if (o.index >= 0.30 && o.middle >= 0.30) {
      const curledMax = Math.max(o.ring, o.pinky);
      if (o.middle - curledMax >= 0.20) {
        return 'cursor';
      }
    }

    // 3. Eraser: all 5 fingers clearly open
    const minOpen = Math.min(o.thumb, o.index, o.middle, o.ring, o.pinky);
    const maxOpen = Math.max(o.thumb, o.index, o.middle, o.ring, o.pinky);
    if (minOpen >= 0.35 && maxOpen > 0 && (minOpen / maxOpen) >= 0.40) {
      return 'eraser';
    }

    return null;
  }

  private computeConfidence(gesture: GestureType, features: HandFeatures, speed: number): number {
    const o = features.fingerOpenness;
    let base = 0.5;

    switch (gesture) {
      case 'drawing': {
        const idxScore = Math.min(o.index / 0.5, 1);
        const curlPenalty = (o.middle + o.ring + o.pinky) / 3;
        base = 0.55 + idxScore * 0.3 - curlPenalty * 0.2;
        base += Math.min(speed * 0.3, 0.1);
        break;
      }
      case 'cursor': {
        const peaceScore = Math.min((o.index + o.middle) / 0.8, 1);
        base = 0.55 + peaceScore * 0.35;
        break;
      }
      case 'eraser': {
        const palmScore = (o.index + o.middle + o.ring + o.pinky) / 4;
        base = 0.55 + palmScore * 0.35;
        break;
      }
    }

    return Math.max(0.1, Math.min(0.95, base));
  }

  private isOpenPalm(features: HandFeatures): boolean {
    return features.fingerOpenness.thumb >= 0.25
      && features.fingerOpenness.index >= 0.25
      && features.fingerOpenness.middle >= 0.25
      && features.fingerOpenness.ring >= 0.25
      && features.fingerOpenness.pinky >= 0.25;
  }

  getOcclusionRecovery(): OcclusionRecovery { return this.occlusionRecovery; }
  getIntentLayer(): IntentLayer { return this.intentLayer; }
  getAdaptiveThresholds(): AdaptiveThresholds { return this.adaptiveThresholds; }
  getFeatureExtractor(): FeatureExtractor { return this.featureExtractor; }
  getCalibrationModule(): CalibrationModule { return this.calibrationModule; }

  destroy(): void {
    this.featureExtractor.reset();
    this.stateMachine.clear();
    this.motionPredictors.clear();
    this.occlusionRecovery.destroy();
    this.intentLayer.destroy();
    this.adaptiveThresholds.destroy();
    this.gestureCooldowns.clear();
    this.normalizer.setCalibration(null);
    this.initialized = false;
  }
}
