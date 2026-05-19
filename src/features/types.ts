export interface FingerAngles {
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  pinky: number;
}

export interface FingerOpenness {
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  pinky: number;
}

export interface HandFeatures {
  fingerAngles: FingerAngles;
  fingerOpenness: FingerOpenness;
  interFingerDistances: [number, number, number, number, number];
  palmOrientation: [number, number, number];
  fingertipVelocity: [number, number, number];
  fingertipAcceleration: [number, number, number];
  motionDirection: [number, number, number];
  speed: number;
  handConfidence: number;
  handScale: number;
}

export const FEATURE_COUNT = 26;
export const FEATURE_NAMES = [
  'angle_thumb', 'angle_index', 'angle_middle', 'angle_ring', 'angle_pinky',
  'openness_thumb', 'openness_index', 'openness_middle', 'openness_ring', 'openness_pinky',
  'ifd_thumb_index', 'ifd_index_middle', 'ifd_middle_ring', 'ifd_ring_pinky', 'ifd_thumb_pinky',
  'palm_orient_x', 'palm_orient_y', 'palm_orient_z',
  'vel_x', 'vel_y', 'vel_z',
  'accel_x', 'accel_y', 'accel_z',
  'speed', 'hand_scale_normalized',
] as const;
