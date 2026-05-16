import { StrokePoint, Handedness } from '../core/types';

export interface ActiveStroke {
  id: string;
  hand: Handedness;
  points: StrokePoint[];
  color: string;
  width: number;
  isEraser: boolean;
  eraserSize: number;
  lastPointTime: number;
}

export interface StrokeState {
  activeStrokes: Map<string, ActiveStroke>;
  completedStrokes: CompletedStrokeInfo[];
  undoStack: CompletedStrokeInfo[];
}

export interface CompletedStrokeInfo {
  id: string;
  pointCount: number;
  hand: Handedness;
}

export interface StrokeGeometry {
  positions: Float32Array;
  colors: Float32Array;
  indices: Uint16Array;
  vertexCount: number;
  indexCount: number;
}
