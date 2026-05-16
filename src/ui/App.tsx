import { useState, useCallback } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThreeCanvas } from './ThreeCanvas';
import { Toolbar } from './components/Toolbar';
import { GestureIndicator } from './components/GestureIndicator';
import { ClearProgressRing } from './components/ClearProgressRing';
import { WebcamStatus } from './components/WebcamStatus';
import { FallbackControls } from './components/FallbackControls';
import { PerformanceHUD } from './components/PerformanceHUD';
import { StartupScreen } from './components/StartupScreen';
import { useFallbackInput } from '../hooks/useFallbackInput';
import { Engine } from '../core/Engine';
import './styles/global.css';

export function App() {
  const [engine, setEngine] = useState<Engine | null>(null);

  useFallbackInput(engine);

  const handleEngineReady = useCallback((e: Engine) => {
    setEngine(e);
  }, []);

  return (
    <ErrorBoundary>
      <div className="gesture-canvas-container">
        <ThreeCanvas onEngineReady={handleEngineReady} />

        <div className="ui-overlay">
          <GestureIndicator />
          <WebcamStatus />
          <ClearProgressRing />
          <Toolbar />
          <FallbackControls />
          <PerformanceHUD />
        </div>

        <StartupScreen />
      </div>
    </ErrorBoundary>
  );
}
