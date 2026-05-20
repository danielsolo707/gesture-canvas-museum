import { SAFE_ZONE } from '../core/constants';

export interface SafeZoneResult {
  stabilizedX: number;
  stabilizedY: number;
  rawX: number;
  rawY: number;
  dampingApplied: boolean;
  isInSafeZone: boolean;
  edgeFalloff: { x: number; y: number };
}

export class SafeInteractionZoneMapper {
  private readonly innerXMin: number;
  private readonly innerXMax: number;
  private readonly innerYMin: number;
  private readonly innerYMax: number;
  private readonly compressionStrength: number;
  private readonly bottomCompression: number;

  constructor(config?: {
    innerXMin?: number;
    innerXMax?: number;
    innerYMin?: number;
    innerYMax?: number;
    compressionStrength?: number;
    bottomCompression?: number;
  }) {
    this.innerXMin = config?.innerXMin ?? SAFE_ZONE.INNER_X_MIN;
    this.innerXMax = config?.innerXMax ?? SAFE_ZONE.INNER_X_MAX;
    this.innerYMin = config?.innerYMin ?? SAFE_ZONE.INNER_Y_MIN;
    this.innerYMax = config?.innerYMax ?? SAFE_ZONE.INNER_Y_MAX;
    this.compressionStrength = config?.compressionStrength ?? SAFE_ZONE.COMPRESSION_STRENGTH;
    this.bottomCompression = config?.bottomCompression ?? SAFE_ZONE.BOTTOM_COMPRESSION;
  }

  map(rawX: number, rawY: number): SafeZoneResult {
    const clampedRawX = Math.max(0, Math.min(1, rawX));
    const clampedRawY = Math.max(0, Math.min(1, rawY));
    const isInSafeZone = rawX >= this.innerXMin && rawX <= this.innerXMax
      && rawY >= this.innerYMin && rawY <= this.innerYMax;

    const stabilizedX = this.sigmoidCompress(clampedRawX, this.innerXMin, this.innerXMax, this.compressionStrength);
    const stabilizedY = this.sigmoidCompress(clampedRawY, this.innerYMin, this.innerYMax, this.bottomCompression);

    const edgeFalloff = {
      x: this.computeEdgeFalloff(clampedRawX, this.innerXMin, this.innerXMax),
      y: this.computeEdgeFalloff(clampedRawY, this.innerYMin, this.innerYMax),
    };

    const dampingApplied = stabilizedX !== rawX || stabilizedY !== rawY;

    return {
      stabilizedX, stabilizedY, rawX: clampedRawX, rawY: clampedRawY,
      dampingApplied, isInSafeZone, edgeFalloff,
    };
  }

  private sigmoidCompress(value: number, innerMin: number, innerMax: number, strength: number): number {
    if (value >= innerMin && value <= innerMax) {
      return value;
    }

    if (value < innerMin) {
      const t = (innerMin - value) / innerMin;
      const compression = this.smoothstep(t) * strength;
      return Math.max(0, innerMin - t * innerMin * compression);
    }

    const outerRight = 1 - innerMax;
    const t = (value - innerMax) / outerRight;
    const compression = this.smoothstep(t) * strength;
    return Math.min(1, innerMax + t * outerRight * (1 - compression));
  }

  private smoothstep(t: number): number {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  private computeEdgeFalloff(value: number, innerMin: number, innerMax: number): number {
    if (value < innerMin) {
      return 1 - Math.max(0, Math.min(1, (innerMin - value) / innerMin));
    }
    if (value > innerMax) {
      return 1 - Math.max(0, Math.min(1, (value - innerMax) / (1 - innerMax)));
    }
    return 1;
  }
}
