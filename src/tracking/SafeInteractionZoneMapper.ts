import { SAFE_ZONE, EDGE } from '../core/constants';

export interface SafeZoneResult {
  stabilizedX: number;
  stabilizedY: number;
  rawX: number;
  rawY: number;
  dampingApplied: boolean;
  isInSafeZone: boolean;
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
    if (rawX < 0 || rawX > 1 || rawY < 0 || rawY > 1) {
      return {
        stabilizedX: Math.max(0, Math.min(1, rawX)),
        stabilizedY: Math.max(0, Math.min(1, rawY)),
        rawX, rawY,
        dampingApplied: false,
        isInSafeZone: false,
      };
    }

    const isInSafeZone = rawX >= this.innerXMin && rawX <= this.innerXMax
      && rawY >= this.innerYMin && rawY <= this.innerYMax;

    let stabilizedX = this.compressAxis(rawX, this.innerXMin, this.innerXMax, this.compressionStrength);

    const effectiveYMax = this.innerYMax - (1 - this.innerYMax) * this.bottomCompression;
    const effectiveYMin = this.innerYMin;
    const totalYRange = effectiveYMax - effectiveYMin;
    const rawYRange = 1;
    const yCompression = 1 - (totalYRange / rawYRange);
    const yStrength = this.compressionStrength * (1 + yCompression * 2);

    let stabilizedY = this.compressAxis(rawY, this.innerYMin, effectiveYMax, yStrength);

    stabilizedX = Math.max(0, Math.min(1, stabilizedX));
    stabilizedY = Math.max(0, Math.min(1, stabilizedY));

    const dampingApplied = stabilizedX !== rawX || stabilizedY !== rawY;

    return { stabilizedX, stabilizedY, rawX, rawY, dampingApplied, isInSafeZone };
  }

  private compressAxis(value: number, innerMin: number, innerMax: number, strength: number): number {
    const innerWidth = innerMax - innerMin;
    const outerLeft = innerMin;
    const outerRight = 1 - innerMax;

    if (value >= innerMin && value <= innerMax) {
      const normalized = (value - innerMin) / innerWidth;
      return innerMin + normalized * innerWidth;
    }

    if (value < innerMin) {
      const t = value / innerMin;
      const compressed = t * innerMin * (1 - strength * (1 - t));
      return compressed;
    }

    if (value > innerMax) {
      const t = (value - innerMax) / outerRight;
      const compressed = t * outerRight * (1 - strength * (1 - t));
      return innerMax + compressed;
    }

    return value;
  }
}
