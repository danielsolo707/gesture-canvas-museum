export interface WebcamConfig {
  width: number;
  height: number;
  fps: number;
  facingMode: 'user' | 'environment';
}

export type WebcamState = 'inactive' | 'requesting' | 'active' | 'error';

export interface WorkerInitMessage {
  type: 'init';
  modelPath: string;
  maxHands: number;
  minConfidence: number;
}

export interface WorkerFrameMessage {
  type: 'frame';
  bitmap: ImageBitmap;
  timestamp: number;
}

export interface WorkerLandmarksMessage {
  type: 'landmarks';
  hands: WorkerHandData[];
  timestamp: number;
}

export interface WorkerHandData {
  landmarks: Float32Array;
  handedness: 'Left' | 'Right';
  confidence: number;
}

export type WorkerMessage = WorkerInitMessage | WorkerFrameMessage;
export type WorkerResponse = WorkerLandmarksMessage;
