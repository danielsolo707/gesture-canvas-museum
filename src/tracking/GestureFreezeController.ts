import { GestureType, EdgeProximityInfo } from '../core/types';
import { FREEZE } from '../core/constants';
import { IntegrityResult } from './HandIntegrityValidator';

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

  private consecutiveStable = 0;
  private unfreezeBlendCounter = 0;

  constructor(config?: {
    maxFreezeMs?: number;
    freezeIntegrityThreshold?: number;
    freezeEdgeThreshold?: number;
    unfreezeIntegrity?: number;
    unfreezeEdge?: number;
    unfreezeConsecutive?: number;
    transitionBlendFrames?: number;
  }) {
    this.maxFreezeMs = config?.maxFreezeMs ?? FREEZE.MAX_FREEZE_MS;
    this.freezeIntegrityThreshold = config?.freezeIntegrityThreshold ?? FREEZE.FREEZE_INTEGRITY_THRESHOLD;
    this.freezeEdgeThreshold = config?.freezeEdgeThreshold ?? FREEZE.FREEZE_EDGE_THRESHOLD;
    this.unfreezeIntegrity = config?.unfreezeIntegrity ?? FREEZE.UNFREEZE_INTEGRITY;
    this.unfreezeEdge = config?.unfreezeEdge ?? FREEZE.UNFREEZE_EDGE;
    this.unfreezeConsecutive = config?.unfreezeConsecutive ?? FREEZE.UNFREEZE_CONSECUTIVE_FRAMES;
    this.transitionBlendFrames = config?.transitionBlendFrames ?? FREEZE.TRANSITION_BLEND_FRAMES;

    this.state = this.createDefault();
  }

  update(
    gesture: GestureType,
    confidence: number,
    integrity: IntegrityResult,
    edgeProx: EdgeProximityInfo,
    now: number,
  ): FreezeState {
    const lowIntegrity = integrity.score < this.freezeIntegrityThreshold;
    const nearEdge = edgeProx.overall > this.freezeEdgeThreshold;
    const lowConfidence = confidence < 0.3;
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
        && confidence >= 0.35;

      if (canUnfreeze) {
        this.consecutiveStable++;
        if (this.consecutiveStable >= this.unfreezeConsecutive) {
          this.unfreezeBlendCounter = this.transitionBlendFrames;
          this.state.frozen = false;
          this.state.unfreezeReason = 'tracking_recovered';
          this.state.blendProgress = 0;
        }
      } else {
        this.consecutiveStable = 0;
      }

      if (this.state.frozen) {
        this.state.freezeDurationMs = elapsed;
      }

      return this.state;
    }

    if (gesture !== 'idle' && shouldFreeze) {
      this.state.frozen = true;
      this.state.lastStableGesture = gesture;
      this.state.lastStableConfidence = confidence;
      this.state.freezeStartTime = now;
      this.state.freezeDurationMs = 0;
      this.state.freezeCount++;
      this.state.blendProgress = 0;
      this.state.unfreezeReason = '';

      if (lowIntegrity) this.state.freezeReason = 'low_integrity';
      else if (nearEdge) this.state.freezeReason = 'edge_proximity';
      else if (lowConfidence) this.state.freezeReason = 'low_confidence';
      else this.state.freezeReason = 'unknown';

      this.consecutiveStable = 0;
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
    this.state.unfreezeReason = reason;
    this.state.blendProgress = 1;
    this.consecutiveStable = 0;
    this.unfreezeBlendCounter = 0;
  }

  reset(): void {
    this.state = this.createDefault();
    this.consecutiveStable = 0;
    this.unfreezeBlendCounter = 0;
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
    };
  }
}
