import { create } from 'zustand';
import {
  GestureType,
  GestureEvent,
  StrokeData,
  EngineState,
  EngineMode,
  Handedness,
  GestureDebugInfo,
  CursorState,
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
  setGesture: (type: GestureType, hand: 'Left' | 'Right', confidence: number) => void;

  gestureDebug: GestureDebugInfo | null;
  setGestureDebug: (info: GestureDebugInfo) => void;

  handIntegrity: number;
  edgeProximity: number;
  gestureFrozen: boolean;
  freezeActive: boolean;
  predictionActive: boolean;
  safeZoneActive: boolean;
  extrapolating: boolean;
  setIntegrityDebug: (
    integrity: number, edge: number, frozen: boolean,
    freeze: boolean, prediction: boolean, safeZone: boolean, extrapolating: boolean,
  ) => void;

  strokes: StrokeData[];
  strokeCount: number;
  isDrawing: boolean;
  isErasing: boolean;
  addStroke: (stroke: StrokeData) => void;
  removeStroke: (id: string) => void;
  clearAllStrokes: () => void;
  setIsDrawing: (drawing: boolean) => void;
  setIsErasing: (erasing: boolean) => void;

  engineState: EngineState;
  mode: EngineMode;
  showToolbar: boolean;
  colorPaletteActive: boolean;
  showPerformance: boolean;
  showDebug: boolean;
  cursorMode: boolean;
  webcamReady: boolean;
  webcamError: string | null;
  setEngineState: (state: EngineState) => void;
  setMode: (mode: EngineMode) => void;
  setWebcamReady: (ready: boolean) => void;
  setWebcamError: (error: string | null) => void;
  toggleToolbar: () => void;
  setColorPaletteActive: (active: boolean) => void;
  togglePerformance: () => void;
  toggleDebug: () => void;
  setCursorMode: (active: boolean) => void;

  color: string;
  strokeWidth: number;
  eraserSize: number;
  palette: readonly string[];
  selectedPaletteIndex: number;
  colorHoverIndex: number | null;
  cursorX: number | null;
  cursorY: number | null;
  cursorState: CursorState | null;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setEraserSize: (size: number) => void;
  selectPaletteIndex: (index: number) => void;
  setColorHoverIndex: (index: number | null) => void;
  setCursor: (x: number | null, y: number | null, state?: CursorState) => void;
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

  gestureDebug: null,
  setGestureDebug: (gestureDebug) => set({ gestureDebug }),

  handIntegrity: 0,
  edgeProximity: 0,
  gestureFrozen: false,
  freezeActive: false,
  predictionActive: false,
  safeZoneActive: false,
  extrapolating: false,
  setIntegrityDebug: (integrity, edge, frozen, freeze, prediction, safeZone, extrapolating) =>
    set({ handIntegrity: integrity, edgeProximity: edge, gestureFrozen: frozen, freezeActive: freeze, predictionActive: prediction, safeZoneActive: safeZone, extrapolating }),

  strokes: [],
  strokeCount: 0,
  isDrawing: false,
  isErasing: false,
  addStroke: (stroke) =>
    set((s) => ({ strokes: [...s.strokes, stroke], strokeCount: s.strokeCount + 1 })),
  removeStroke: (id) => set((s) => ({ strokes: s.strokes.filter((st) => st.id !== id) })),
  clearAllStrokes: () => set({ strokes: [], strokeCount: 0 }),
  setIsDrawing: (isDrawing) => set({ isDrawing }),
  setIsErasing: (isErasing) => set({ isErasing }),

  engineState: 'uninitialized',
  mode: 'camera',
  showToolbar: true,
  colorPaletteActive: false,
  showPerformance: false,
  showDebug: false,
  cursorMode: false,
  webcamReady: false,
  webcamError: null,
  setEngineState: (engineState) => set({ engineState }),
  setMode: (mode) => set({ mode }),
  setWebcamReady: (webcamReady) => set({ webcamReady, webcamError: webcamReady ? null : null }),
  setWebcamError: (webcamError) => set({ webcamError, webcamReady: false }),
  toggleToolbar: () => set((s) => ({ showToolbar: !s.showToolbar })),
  setColorPaletteActive: (colorPaletteActive) => set({ colorPaletteActive }),
  togglePerformance: () => set((s) => ({ showPerformance: !s.showPerformance })),
  toggleDebug: () => set((s) => ({ showDebug: !s.showDebug })),
  setCursorMode: (cursorMode) => set({ cursorMode }),

  color: PALETTE_HEXES[0],
  strokeWidth: 3,
  eraserSize: 10,
  palette: PALETTE_HEXES,
  selectedPaletteIndex: 0,
  colorHoverIndex: null,
  cursorX: null,
  cursorY: null,
  cursorState: null,
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setEraserSize: (eraserSize) => set({ eraserSize }),
  selectPaletteIndex: (selectedPaletteIndex) =>
    set({ selectedPaletteIndex, color: PALETTE_HEXES[selectedPaletteIndex] }),
  setColorHoverIndex: (colorHoverIndex) => set({ colorHoverIndex }),
  setCursor: (cursorX, cursorY, cursorState) => set({ cursorX, cursorY, cursorState }),
}));

export function getStore(): AppStore {
  return useStore.getState();
}
