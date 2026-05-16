export const LANDMARK_INDICES = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export const NUM_LANDMARKS = 21;
export const LANDMARKS_FLOAT_SIZE = NUM_LANDMARKS * 3;

export type Handedness = 'Left' | 'Right';

export interface HandSnapshot {
  landmarks: Float32Array;
  handedness: Handedness;
  confidence: number;
  timestamp: number;
}

export type GestureType =
  | 'idle'
  | 'drawing'
  | 'color_select'
  | 'stop_drawing'
  | 'clear_canvas'
  | 'eraser'
  | 'dual_hand';

export interface GestureEvent {
  type: GestureType;
  hand: Handedness;
  confidence: number;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface StrokePoint {
  x: number;
  y: number;
  z: number;
}

export interface StrokeData {
  id: string;
  points: StrokePoint[];
  color: string;
  width: number;
  hand: Handedness;
  createdAt: number;
}

export type EngineState =
  | 'uninitialized'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'error';

export type EngineMode = 'camera' | 'fallback';

export interface EngineStats {
  fps: number;
  inferenceMs: number;
  gestureMs: number;
  drawMs: number;
  renderMs: number;
  activeHands: number;
  strokeCount: number;
  mode: EngineMode;
}

export type GestureHand = 'Left' | 'Right' | 'Both';
