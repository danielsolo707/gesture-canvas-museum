export interface WebcamConfig {
  width: number;
  height: number;
  fps: number;
  facingMode: 'user' | 'environment';
}

export type WebcamState = 'inactive' | 'requesting' | 'active' | 'error';
