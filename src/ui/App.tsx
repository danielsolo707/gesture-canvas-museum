import { useState, useCallback, useEffect, useRef } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThreeCanvas } from './ThreeCanvas';
import { GestureIndicator } from './components/GestureIndicator';
import { BottomPalette } from './components/BottomPalette';
import { WebcamStatus } from './components/WebcamStatus';
import { HandStatus } from './components/HandStatus';
import { HandDebugOverlay } from './components/HandDebugOverlay';
import { FingertipCursor } from './components/FingertipCursor';
import { FallbackControls } from './components/FallbackControls';
import { PerformanceHUD } from './components/PerformanceHUD';
import { StartupScreen } from './components/StartupScreen';
import { TemporalDebugPanel } from './components/debug/TemporalDebugPanel';
import { TutorialOverlay } from './components/TutorialOverlay';
import { AttractModeOverlay } from './components/AttractModeOverlay';
import { QRDownloadPanel } from './components/QRDownloadPanel';
import { DownloadButton } from './components/DownloadButton';
import { DebugToggle } from './components/DebugToggle';
import { useFallbackInput } from '../hooks/useFallbackInput';
import { Engine } from '../core/Engine';
import { useStore } from '../store/useStore';
import './styles/global.css';

export function App() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const deleteCountRef = useRef(0);

  useFallbackInput(engine);

  const handleEngineReady = useCallback((e: Engine) => {
    setEngine(e);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const state = useStore.getState();
      const { hands, currentGesture, engineState, idleSeconds, showQRPanel } = state;

      if (showQRPanel) {
        state.setIdleSeconds(0);
        return;
      }

      if (engineState === 'running') {
        if (hands.length === 0 && currentGesture === 'idle') {
          state.setIdleSeconds(idleSeconds + 1);
        } else {
          state.setIdleSeconds(0);
        }
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const strokeCount = useStore((s) => s.strokeCount);
  useEffect(() => {
    if (strokeCount > 0 && deleteCountRef.current === 0) {
      deleteCountRef.current = strokeCount;
      useStore.getState().setShowTutorial(false);
    }
  }, [strokeCount]);

  return (
    <ErrorBoundary>
      <div className="gesture-canvas-container">
        <ThreeCanvas onEngineReady={handleEngineReady} />

        <div className="ui-overlay">
          <BottomPalette />
          <HandDebugOverlay />
          <FingertipCursor />
          <GestureIndicator />
          <WebcamStatus />
          <HandStatus />
          <FallbackControls />
          <PerformanceHUD />
          <TemporalDebugPanel />
        </div>

        <TutorialOverlay />
        <AttractModeOverlay />
        <QRDownloadPanel />
        <DownloadButton />
        <DebugToggle />

        <StartupScreen />
      </div>
    </ErrorBoundary>
  );
}
