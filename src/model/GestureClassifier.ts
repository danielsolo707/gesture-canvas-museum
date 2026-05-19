import { NormalizedHand, LandmarkNormalizer } from '../tracking/LandmarkNormalizer';
import { FeatureExtractor } from '../features/FeatureExtractor';
import { HandFeatures } from '../features/types';
import { OcclusionRecovery } from './OcclusionRecovery';
import { AdaptiveThresholds } from './AdaptiveThresholds';
import { ConfidenceTracker } from '../tracking/ConfidenceTracker';
import { Handedness, GestureType, GestureEvent, HandSnapshot, HandIntegrity, EdgeProximityInfo, GestureFreezeState } from '../core/types';
import { OCCLUSION, ADAPTIVE, GESTURE, CONFIDENCE } from '../core/constants';
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
    smoothedConfidence: number;
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
  private adaptiveThresholds: AdaptiveThresholds;
  private confidenceTracker: ConfidenceTracker;
  private gestureCooldowns = new Map<string, number>();
  private initialized = false;

  constructor() {
    this.normalizer = new LandmarkNormalizer(false);
    this.featureExtractor = new FeatureExtractor();
    this.stateMachine = new Map();
    this.occlusionRecovery = new OcclusionRecovery(
      OCCLUSION.POSE_MEMORY_SIZE,
      OCCLUSION.MAX_EXTRAPOLATION_MS,
      OCCLUSION.CONFIDENCE_DECAY_RATE,
    );
    this.adaptiveThresholds = new AdaptiveThresholds({
      historySize: ADAPTIVE.HISTORY_SIZE,
      baseConfidenceThreshold: ADAPTIVE.BASE_CONFIDENCE_THRESHOLD,
      speedAdaptationRate: ADAPTIVE.SPEED_ADAPTATION_RATE,
      stabilityAdaptationRate: ADAPTIVE.STABILITY_ADAPTATION_RATE,
      fastMotionThreshold: ADAPTIVE.FAST_MOTION_THRESHOLD,
      slowMotionThreshold: ADAPTIVE.SLOW_MOTION_THRESHOLD,
    });
    this.confidenceTracker = new ConfidenceTracker();
  }

  initialize(): void {
    if (this.initialized) return;
    this.featureExtractor.reset();
    this.stateMachine.clear();
    this.motionPredictors.clear();
    this.occlusionRecovery.reset();
    this.adaptiveThresholds.reset();
    this.confidenceTracker.reset();
    this.gestureCooldowns.clear();
    this.initialized = true;
  }

  process(
    hands: HandSnapshot[],
    now: number,
    integrity?: HandIntegrity | null,
    edgeProx?: EdgeProximityInfo | null,
    freezeState?: GestureFreezeState | null,
  ): GesturePipelineResult {
    const events: GestureEvent[] = [];
    const handStates = new Map<Handedness, { gesture: GestureType; confidence: number; stableCount: number; intentScore: number }>();
    let debugFeatures: HandFeatures | null = null;
    let debugMotionSpeed = 0;
    let debugTrackingStability = 0;
    let debugIntentScore = 0;
    let debugDynamicThreshold = 0;
    let debugOcclusionRecovered = false;
    let debugSmoothedConfidence = 0;

    for (const hand of hands) {
      const rawLandmarks = hand.landmarks;

      // Step 1: Occlusion recovery
      const occlusionResult = this.occlusionRecovery.recover(
        hand.handedness, rawLandmarks, hand.confidence, now,
      );
      debugOcclusionRecovered = occlusionResult.recovered;

      if (!occlusionResult.recovered) {
        this.occlusionRecovery.recordPose(
          hand.handedness, occlusionResult.landmarks, occlusionResult.confidence, now,
        );
      }

      // Step 2: Normalize landmarks
      const norm = this.normalizer.normalize(
        occlusionResult.landmarks, hand.handedness, occlusionResult.confidence, now,
      );

      // Step 3: Extract features
      const features = this.featureExtractor.extract(norm, now);
      debugFeatures = features;
      const speed = features.speed;
      debugMotionSpeed = speed;

      this.adaptiveThresholds.updateMotionSpeed(hand.handedness, speed, now);
      const stability = this.occlusionRecovery.getTrackingStability(hand.handedness);
      this.adaptiveThresholds.updateTrackingStability(hand.handedness, stability);
      debugTrackingStability = stability;

      // Step 4: Confidence gating
      const smoothedConfidence = this.confidenceTracker.update(
        hand.handedness, hand.confidence, now,
      );
      debugSmoothedConfidence = smoothedConfidence;

      const edgeDamping = edgeProx?.dampingFactor ?? 1;
      const integrityScore = integrity?.score ?? 1;
      const rawGestureScore = this.getBestGestureScore(
        integrity ?? { score: 0, wristVisible: false, palmIntact: false, individualFingers: { thumb: false, index: false, middle: false, ring: false, pinky: false }, requiredGroups: { drawing: false, cursor: false, eraser: false }, edgeFlags: { anyEdge: false, leftEdge: false, rightEdge: false, topEdge: false, bottomEdge: false }, missingLandmarkCount: 21 },
        hand.handedness, features,
      );
      const gestureSpecificScore = Math.max(0.3, rawGestureScore);

      const effectiveConfidence = smoothedConfidence * (0.3 + 0.7 * gestureSpecificScore);
      const confidenceGate = effectiveConfidence >= CONFIDENCE.GATE_THRESHOLD;

      // Step 5: Heuristic detection with edge-aware thresholds
      let heuristicGesture: GestureType | null = null;
      let heuristicConfidence = 0;

      if (confidenceGate) {
        heuristicGesture = this.edgeAwareHeuristicDetect(
          features, speed, integrity, edgeProx, freezeState,
        );
        if (heuristicGesture) {
          const rawConf = this.computeConfidence(heuristicGesture, features, speed);
          heuristicConfidence = rawConf * (0.5 + 0.5 * edgeDamping);
        }
      }

      // Step 6: Apply freeze state
      const gestureOverride = freezeState?.frozen ? freezeState.lastStableGesture : null;
      const selectedGesture = gestureOverride ?? heuristicGesture ?? 'idle';
      const selectedConfidence = gestureOverride
        ? Math.max(freezeState!.blendProgress * 0.5, heuristicConfidence * 0.3)
        : heuristicConfidence;

      const dynamicThreshold = this.adaptiveThresholds.getThreshold(
        hand.handedness, selectedGesture,
      );
      debugDynamicThreshold = dynamicThreshold;

      this.adaptiveThresholds.updateConfidence(hand.handedness, selectedConfidence);
      debugIntentScore = selectedConfidence;

      // Step 7: Rely on state machine for persistence (3-frame activate / 2-frame deactivate)
      const sm = this.getOrCreateState(hand.handedness);
      const finalGesture = selectedGesture;
      const finalConfidence = selectedConfidence;

      const gestureChanged = sm.current !== finalGesture;

      // Step 8: Extra activation frames near edges or low integrity
      const edgePenalty = 0;
      const integrityPenalty = integrityScore < 0.6 ? 3 : 0;
      const confidencePenalty = smoothedConfidence < 0.5 ? 1 : 0;
      const extraFrames = edgePenalty + integrityPenalty + confidencePenalty;

      this.updateStateMachine(sm, finalGesture, finalConfidence, now, extraFrames);

      // Step 9: Event emission with edge-aware cooldown
      const cooldownKey = `${hand.handedness}:${finalGesture}`;
      const lastFired = this.gestureCooldowns.get(cooldownKey) ?? 0;
      let shouldEmitEvent = false;

      if (sm.current === finalGesture && sm.current !== sm.lastChange) {
        sm.lastChange = sm.current;
      }
      if (finalGesture !== 'idle' && gestureChanged && !freezeState?.frozen) {
        const effectiveCooldown = GESTURE.COOLDOWN_MS
          + (integrityScore < 0.6 ? 150 : 0)
          + (smoothedConfidence < 0.5 ? 80 : 0);
        if (now - lastFired >= effectiveCooldown) {
          shouldEmitEvent = true;
          this.gestureCooldowns.set(cooldownKey, now);
        }
      }

      handStates.set(hand.handedness, {
        gesture: sm.current,
        confidence: sm.confidence,
        stableCount: sm.stableCount,
        intentScore: debugIntentScore,
      });

      if (shouldEmitEvent) {
        events.push({
          type: sm.current,
          hand: hand.handedness,
          confidence: sm.confidence,
          timestamp: now,
          data: { dynamicThreshold, trackingStability: stability, smoothedConfidence },
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
        smoothedConfidence: debugSmoothedConfidence,
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
    extraFrames = 0,
  ): void {
    if (detected === sm.current) {
      sm.stableCount = Math.min(sm.stableCount + 1, 60);
      sm.confidence = sm.confidence + 0.3 * (confidence - sm.confidence);
      sm.activationCount = 0;
      if (confidence >= 0.5) {
        sm.deactivationCount = 0;
      }
    } else {
      const effectiveActivate = GESTURE.ACTIVATE_FRAMES + extraFrames;
      const effectiveDeactivate = GESTURE.DEACTIVATE_FRAMES;

      if (confidence >= 0.35) {
        sm.activationCount++;
        sm.deactivationCount = 0;
        if (sm.activationCount >= effectiveActivate) {
          sm.current = detected;
          sm.confidence = confidence;
          sm.stableCount = 1;
          sm.activationCount = 0;
          sm.deactivationCount = 0;
        }
      } else {
        sm.deactivationCount++;
        sm.activationCount = 0;
        if (sm.deactivationCount >= effectiveDeactivate && sm.current !== 'idle') {
          sm.current = 'idle';
          sm.confidence = 0;
          sm.stableCount = 0;
          sm.activationCount = 0;
          sm.deactivationCount = 0;
        }
      }
    }
  }

  edgeAwareHeuristicDetect(
    features: HandFeatures,
    motionSpeed: number,
    integrity: HandIntegrity | null | undefined,
    edgeProx: EdgeProximityInfo | null | undefined,
    freezeState: GestureFreezeState | null | undefined,
  ): GestureType | null {
    if (freezeState?.frozen) return null;

    const o = features.fingerOpenness;
    const edgeDamping = edgeProx?.dampingFactor ?? 1;
    const integrityScore = integrity?.score ?? 1;

    const minEdgeConf = edgeProx
      ? Math.min(
          edgeProx.perEdgeConfidence?.left ?? 1,
          edgeProx.perEdgeConfidence?.right ?? 1,
          edgeProx.perEdgeConfidence?.top ?? 1,
          edgeProx.perEdgeConfidence?.bottom ?? 1,
        )
      : 1;

    const edgePremium = 0;

    const drawingOpennessThreshold = 0.35 + edgePremium * 0.15;
    const drawingDominanceThreshold = 0.25 + edgePremium * 0.10;
    const cursorOpennessThreshold = 0.30 + edgePremium * 0.12;
    const cursorDominanceThreshold = 0.20 + edgePremium * 0.08;
    const eraserMinOpenness = 0.35 + edgePremium * 0.15;
    const eraserRatioThreshold = 0.40 + edgePremium * 0.12;

    if (integrityScore < 0.3) return null;

    if (o.index >= drawingOpennessThreshold) {
      const othersMax = Math.max(o.thumb, o.middle, o.ring, o.pinky);
      if (o.index - othersMax >= drawingDominanceThreshold) {
        if (!integrity || integrity.requiredGroups.drawing) return 'drawing';
      }
    }

    if (o.index >= cursorOpennessThreshold && o.middle >= cursorOpennessThreshold) {
      const curledMax = Math.max(o.ring, o.pinky);
      if (o.middle - curledMax >= cursorDominanceThreshold) {
        if (!integrity || integrity.requiredGroups.cursor) return 'cursor';
      }
    }

    const minOpen = Math.min(o.thumb, o.index, o.middle, o.ring, o.pinky);
    const maxOpen = Math.max(o.thumb, o.index, o.middle, o.ring, o.pinky);
    if (minOpen >= eraserMinOpenness && maxOpen > 0 && (minOpen / maxOpen) >= eraserRatioThreshold) {
      if (edgePremium > 0.3 && integrityScore < 0.7) return null;
      if (!integrity || integrity.requiredGroups.eraser) return 'eraser';
    }

    return null;
  }

  private getBestGestureScore(
    integrity: HandIntegrity,
    _hand: Handedness,
    _features: HandFeatures,
  ): number {
    const fingerCount = Object.values(integrity.individualFingers).filter(Boolean).length;
    if (fingerCount >= 4 && integrity.wristVisible) return 1;
    if (fingerCount >= 2 && integrity.wristVisible) return 0.8;
    if (fingerCount >= 1) return 0.5;
    return 0.2;
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
  getAdaptiveThresholds(): AdaptiveThresholds { return this.adaptiveThresholds; }
  getFeatureExtractor(): FeatureExtractor { return this.featureExtractor; }
  getConfidenceTracker(): ConfidenceTracker { return this.confidenceTracker; }

  destroy(): void {
    this.featureExtractor.reset();
    this.stateMachine.clear();
    this.motionPredictors.clear();
    this.occlusionRecovery.destroy();
    this.adaptiveThresholds.destroy();
    this.confidenceTracker.reset();
    this.gestureCooldowns.clear();
    this.initialized = false;
  }
}
