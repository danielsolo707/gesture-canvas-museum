import { GestureType, EdgeProximityInfo, HandIntegrity } from '../core/types';
import { FREEZE } from '../core/constants';

export interface FreezeState {
  frozen: boolean;
  lastStableGesture: GestureType;
  lastStableConfidence: number;
  freezeStartTime: number;
  freezeDurationMs: number;
  freezeCount: number;
  blendProgress: number;
  unfreezeReason: string;
  freezeReason: string;
  freezeGraceActive: boolean;
  recoveryMode: 'none' | 'frozen' | 'grace' | 'reentry' | 'hard_reset';
  handReentry: boolean;
  handAbsenceMs: number;
  authorityOwner: 'none' | 'tracking' | 'freeze' | 'prediction';
}

export class GestureFreezeController {
  private state: FreezeState;
  private readonly maxFreezeMs: number;
  private readonly freezeIntegrityThreshold: number;
  private readonly freezeEdgeThreshold: number;
  private readonly unfreezeIntegrity: number;
  private readonly unfreezeEdge: number;
  private readonly unfreezeConsecutive: number;
  private readonly transitionBlendFrames: number;
  private readonly shortLossGraceMs: number;
  private readonly hardResetAbsenceMs: number;
  private readonly reentryStabilizeFrames: number;

  private consecutiveStable = 0;
  private unfreezeBlendCounter = 0;
  private lastSeenTime = 0;
  private absenceStartTime: number | null = null;
  private wasMissing = false;
  private reentryFrames = 0;

  constructor(config?: {
    maxFreezeMs?: number;
    freezeIntegrityThreshold?: number;
    freezeEdgeThreshold?: number;
    unfreezeIntegrity?: number;
    unfreezeEdge?: number;
    unfreezeConsecutive?: number;
    transitionBlendFrames?: number;
    shortLossGraceMs?: number;
    hardResetAbsenceMs?: number;
    reentryStabilizeFrames?: number;
  }) {
    this.maxFreezeMs = config?.maxFreezeMs ?? FREEZE.MAX_FREEZE_MS;
    this.freezeIntegrityThreshold = config?.freezeIntegrityThreshold ?? FREEZE.FREEZE_INTEGRITY_THRESHOLD;
    this.freezeEdgeThreshold = config?.freezeEdgeThreshold ?? FREEZE.FREEZE_EDGE_THRESHOLD;
    this.unfreezeIntegrity = config?.unfreezeIntegrity ?? FREEZE.UNFREEZE_INTEGRITY;
    this.unfreezeEdge = config?.unfreezeEdge ?? FREEZE.UNFREEZE_EDGE;
    this.unfreezeConsecutive = config?.unfreezeConsecutive ?? FREEZE.UNFREEZE_CONSECUTIVE_FRAMES;
    this.transitionBlendFrames = config?.transitionBlendFrames ?? FREEZE.TRANSITION_BLEND_FRAMES;
    this.shortLossGraceMs = config?.shortLossGraceMs ?? FREEZE.SHORT_LOSS_GRACE_MS;
    this.hardResetAbsenceMs = config?.hardResetAbsenceMs ?? FREEZE.HARD_RESET_ABSENCE_MS;
    this.reentryStabilizeFrames = config?.reentryStabilizeFrames ?? FREEZE.REENTRY_STABILIZE_FRAMES;

    this.state = this.createDefault();
  }

  onTrackingLost(now: number): FreezeState {
    if (this.absenceStartTime === null) {
      this.absenceStartTime = now;
      this.wasMissing = true;
      this.reentryFrames = 0;
    }

    const absenceMs = now - this.absenceStartTime;
    this.state.handAbsenceMs = absenceMs;

    const hasRecoverableContext = this.state.lastStableGesture !== 'idle' && this.state.lastStableConfidence >= 0.3;
    if (hasRecoverableContext && absenceMs <= this.shortLossGraceMs) {
      this.state.freezeGraceActive = true;
      this.state.frozen = true;
      this.state.recoveryMode = 'grace';
      this.state.authorityOwner = 'prediction';
      this.state.freezeReason = 'tracking_loss_grace';
      if (this.state.freezeStartTime <= 0) {
        this.state.freezeStartTime = now;
        this.state.freezeCount++;
      }
      this.state.freezeDurationMs = now - this.state.freezeStartTime;
      return this.state;
    }

    if (absenceMs > this.hardResetAbsenceMs) {
      this.state.frozen = false;
      this.state.freezeGraceActive = false;
      this.state.recoveryMode = 'hard_reset';
      this.state.authorityOwner = 'none';
      this.state.unfreezeReason = 'hard_absence';
      this.state.freezeDurationMs = 0;
      return this.state;
    }

    this.state.recoveryMode = this.state.frozen ? 'frozen' : 'none';
    this.state.authorityOwner = this.state.frozen ? 'freeze' : 'none';
    return this.state;
  }

  onHandVisible(now: number): FreezeState {
    const wasMissing = this.wasMissing;
    this.wasMissing = false;
    if (this.absenceStartTime !== null) {
      this.state.handAbsenceMs = now - this.absenceStartTime;
    } else {
      this.state.handAbsenceMs = 0;
    }
    this.absenceStartTime = null;
    this.lastSeenTime = now;

    if (wasMissing) {
      this.state.handReentry = true;
      this.reentryFrames = this.reentryStabilizeFrames;
      this.state.recoveryMode = 'reentry';
    }

    return this.state;
  }

  registerStableGesture(gesture: GestureType, confidence: number, now: number): void {
    if (gesture === 'idle') return;
    if (confidence < 0.35) return;

    if (!this.state.frozen || this.state.lastStableGesture === 'idle') {
      this.state.lastStableGesture = gesture;
      this.state.lastStableConfidence = confidence;
      if (this.state.freezeStartTime <= 0) {
        this.state.freezeStartTime = now;
      }
      return;
    }

    if (gesture === this.state.lastStableGesture && confidence >= this.state.lastStableConfidence * 0.85) {
      this.state.lastStableConfidence = Math.max(this.state.lastStableConfidence, confidence);
    }
  }

  isInReentryStabilization(): boolean {
    return this.reentryFrames > 0;
  }

  update(
    gesture: GestureType,
    confidence: number,
    integrity: HandIntegrity,
    edgeProx: EdgeProximityInfo,
    now: number,
  ): FreezeState {
    this.state.handReentry = false;
    if (this.reentryFrames > 0) {
      this.reentryFrames--;
      this.state.recoveryMode = 'reentry';
    }

    const lowIntegrity = integrity.score < this.freezeIntegrityThreshold;
    const nearEdge = edgeProx.overall > this.freezeEdgeThreshold;
    const lowConfidence = confidence < 0.3;
    const conservativeEdge = edgeProx.overall > 0.72;
    const shouldHoldDuringReentry = this.reentryFrames > 0 && this.state.lastStableGesture !== 'idle';
    const shouldFreeze = lowIntegrity || nearEdge || lowConfidence;

    if (this.state.frozen) {
      const elapsed = now - this.state.freezeStartTime;

      if (elapsed > this.maxFreezeMs) {
        this.forceUnfreeze('max_duration');
        this.consecutiveStable = 0;
        return this.state;
      }

      const canUnfreeze = integrity.score >= this.unfreezeIntegrity
        && edgeProx.overall <= this.unfreezeEdge
        && confidence >= 0.35
        && !shouldHoldDuringReentry
        && !conservativeEdge;

      if (canUnfreeze) {
        this.consecutiveStable++;
        if (this.consecutiveStable >= this.unfreezeConsecutive) {
          this.unfreezeBlendCounter = this.transitionBlendFrames;
          this.state.frozen = false;
          this.state.freezeGraceActive = false;
          this.state.unfreezeReason = 'tracking_recovered';
          this.state.blendProgress = 0;
          this.state.recoveryMode = 'none';
          this.state.authorityOwner = 'tracking';
        }
      } else {
        this.consecutiveStable = 0;
      }

      if (this.state.frozen) {
        this.state.freezeDurationMs = elapsed;
      }

      return this.state;
    }

    if ((gesture !== 'idle' && shouldFreeze) || shouldHoldDuringReentry) {
      this.state.frozen = true;
      if (gesture !== 'idle') {
        this.state.lastStableGesture = gesture;
        this.state.lastStableConfidence = confidence;
      }
      this.state.freezeStartTime = now;
      this.state.freezeDurationMs = 0;
      this.state.freezeCount++;
      this.state.blendProgress = 0;
      this.state.unfreezeReason = '';
      this.state.freezeGraceActive = false;
      this.state.recoveryMode = shouldHoldDuringReentry ? 'reentry' : 'frozen';
      this.state.authorityOwner = 'freeze';

      if (shouldHoldDuringReentry) this.state.freezeReason = 'reentry_stabilization';
      else if (lowIntegrity) this.state.freezeReason = 'low_integrity';
      else if (nearEdge) this.state.freezeReason = 'edge_proximity';
      else if (lowConfidence) this.state.freezeReason = 'low_confidence';
      else this.state.freezeReason = 'unknown';

      this.consecutiveStable = 0;
    }

    if (!this.state.frozen) {
      this.state.authorityOwner = 'tracking';
      if (this.state.recoveryMode !== 'reentry') {
        this.state.recoveryMode = 'none';
      }
      this.state.freezeGraceActive = false;
    }

    return this.state;
  }

  getState(): FreezeState {
    return this.state;
  }

  isFrozen(): boolean {
    return this.state.frozen;
  }

  getLastStableGesture(): GestureType {
    return this.state.lastStableGesture;
  }

  getBlendFactor(): number {
    if (this.state.blendProgress >= 1) return 1;
    if (!this.state.frozen && this.unfreezeBlendCounter > 0) {
      return 1 - (this.unfreezeBlendCounter / this.transitionBlendFrames);
    }
    return this.state.frozen ? 0 : 1;
  }

  advanceUnfreezeBlend(): void {
    if (this.unfreezeBlendCounter > 0) {
      this.unfreezeBlendCounter--;
    }
    if (!this.state.frozen && this.state.blendProgress < 1) {
      this.state.blendProgress = Math.min(1, this.state.blendProgress + (1 / this.transitionBlendFrames));
    }
  }

  forceUnfreeze(reason = 'forced'): void {
    this.state.frozen = false;
    this.state.freezeGraceActive = false;
    this.state.unfreezeReason = reason;
    this.state.blendProgress = 1;
    this.state.recoveryMode = 'none';
    this.state.authorityOwner = 'tracking';
    this.consecutiveStable = 0;
    this.unfreezeBlendCounter = 0;
  }

  reset(): void {
    this.state = this.createDefault();
    this.consecutiveStable = 0;
    this.unfreezeBlendCounter = 0;
    this.lastSeenTime = 0;
    this.absenceStartTime = null;
    this.wasMissing = false;
    this.reentryFrames = 0;
  }

  private createDefault(): FreezeState {
    return {
      frozen: false,
      lastStableGesture: 'idle',
      lastStableConfidence: 0,
      freezeStartTime: 0,
      freezeDurationMs: 0,
      freezeCount: 0,
      blendProgress: 1,
      unfreezeReason: '',
      freezeReason: '',
      freezeGraceActive: false,
      recoveryMode: 'none',
      handReentry: false,
      handAbsenceMs: 0,
      authorityOwner: 'none',
    };
  }
}
