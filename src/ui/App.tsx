import { useState, useCallback } from 'react';
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
import { useFallbackInput } from '../hooks/useFallbackInput';
import { Engine } from '../core/Engine';
import { useStore } from '../store/useStore';
import './styles/global.css';

export function App() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const toggleDebug = useStore((s) => s.toggleDebug);

  useFallbackInput(engine);

  const handleEngineReady = useCallback((e: Engine) => {
    setEngine(e);
  }, []);

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

        <div
          className="debug-toggle"
          onClick={toggleDebug}
          style={{
            position: 'absolute', bottom: 8, right: 8, zIndex: 300,
            color: 'rgba(255,255,255,0.3)', fontSize: 10, cursor: 'pointer',
            fontFamily: 'monospace', userSelect: 'none',
          }}
        >
          [DBG]
        </div>

        <StartupScreen />
      </div>
    </ErrorBoundary>
  );
}
