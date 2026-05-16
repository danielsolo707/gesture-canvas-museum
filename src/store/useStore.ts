import { create } from 'zustand';
import {
  GestureType,
  GestureEvent,
  StrokeData,
  EngineState,
  EngineMode,
  Handedness,
} from '../core/types';
import { PALETTE_HEXES } from '../features/colors/ColorPalette';

export interface HandData {
  handedness: Handedness;
  landmarks: Float32Array | null;
  confidence: number;
}

export interface AppStore {
  hands: HandData[];
  activeHandCount: number;
  setHands: (hands: HandData[]) => void;

  currentGesture: GestureType;
  previousGesture: GestureType;
  leftHandGesture: GestureType;
  rightHandGesture: GestureType;
  gestureConfidence: number;
  lastGestureEvent: GestureEvent | null;
  clearProgress: number;
  setGesture: (type: GestureType, hand: 'Left' | 'Right', confidence: number) => void;
  setClearProgress: (progress: number) => void;

  strokes: StrokeData[];
  strokeCount: number;
  isDrawing: boolean;
  addStroke: (stroke: StrokeData) => void;
  removeStroke: (id: string) => void;
  clearAllStrokes: () => void;
  setIsDrawing: (drawing: boolean) => void;

  engineState: EngineState;
  mode: EngineMode;
  showToolbar: boolean;
  showPerformance: boolean;
  webcamReady: boolean;
  webcamError: string | null;
  setEngineState: (state: EngineState) => void;
  setMode: (mode: EngineMode) => void;
  setWebcamReady: (ready: boolean) => void;
  setWebcamError: (error: string | null) => void;
  toggleToolbar: () => void;
  togglePerformance: () => void;

  color: string;
  strokeWidth: number;
  eraserSize: number;
  palette: readonly string[];
  selectedPaletteIndex: number;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setEraserSize: (size: number) => void;
  selectPaletteIndex: (index: number) => void;
}

export const useStore = create<AppStore>()((set, get) => ({
  hands: [],
  activeHandCount: 0,
  setHands: (hands) => set({ hands, activeHandCount: hands.length }),

  currentGesture: 'idle',
  previousGesture: 'idle',
  leftHandGesture: 'idle',
  rightHandGesture: 'idle',
  gestureConfidence: 0,
  lastGestureEvent: null,
  clearProgress: 0,
  setGesture: (type, hand, confidence) => {
    const state = get();
    const leftHand = hand === 'Left' ? type : state.leftHandGesture;
    const rightHand = hand === 'Right' ? type : state.rightHandGesture;
    set({
      currentGesture: type,
      previousGesture: state.currentGesture,
      leftHandGesture: leftHand,
      rightHandGesture: rightHand,
      gestureConfidence: confidence,
      lastGestureEvent: { type, hand, confidence, timestamp: Date.now() },
    });
  },
  setClearProgress: (clearProgress) => set({ clearProgress }),

  strokes: [],
  strokeCount: 0,
  isDrawing: false,
  addStroke: (stroke) =>
    set((s) => ({ strokes: [...s.strokes, stroke], strokeCount: s.strokeCount + 1 })),
  removeStroke: (id) => set((s) => ({ strokes: s.strokes.filter((st) => st.id !== id) })),
  clearAllStrokes: () => set({ strokes: [], strokeCount: 0 }),
  setIsDrawing: (isDrawing) => set({ isDrawing }),

  engineState: 'uninitialized',
  mode: 'camera',
  showToolbar: true,
  showPerformance: false,
  webcamReady: false,
  webcamError: null,
  setEngineState: (engineState) => set({ engineState }),
  setMode: (mode) => set({ mode }),
  setWebcamReady: (webcamReady) => set({ webcamReady, webcamError: webcamReady ? null : null }),
  setWebcamError: (webcamError) => set({ webcamError, webcamReady: false }),
  toggleToolbar: () => set((s) => ({ showToolbar: !s.showToolbar })),
  togglePerformance: () => set((s) => ({ showPerformance: !s.showPerformance })),

  color: PALETTE_HEXES[0],
  strokeWidth: 3,
  eraserSize: 10,
  palette: PALETTE_HEXES,
  selectedPaletteIndex: 0,
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setEraserSize: (eraserSize) => set({ eraserSize }),
  selectPaletteIndex: (selectedPaletteIndex) =>
    set({ selectedPaletteIndex, color: PALETTE_HEXES[selectedPaletteIndex] }),
}));

export function getStore(): AppStore {
  return useStore.getState();
}
