import { useStore } from '../../../store/useStore';

export function TemporalDebugPanel() {
  const showDebug = useStore((s) => s.showDebug);
  const gestureDebug = useStore((s) => s.gestureDebug);
  const currentGesture = useStore((s) => s.currentGesture);
  const gestureConfidence = useStore((s) => s.gestureConfidence);
  const engineState = useStore((s) => s.engineState);
  const cursorMode = useStore((s) => s.cursorMode);
  const colorPaletteActive = useStore((s) => s.colorPaletteActive);

  if (!showDebug) return null;

  return (
    <div className="debug-panel" style={{
      position: 'absolute', top: 8, right: 8, width: 320,
      background: 'rgba(0,0,0,0.88)', color: '#0f0',
      fontFamily: 'monospace', fontSize: 11, padding: 12, borderRadius: 8,
      zIndex: 200, pointerEvents: 'auto', userSelect: 'text',
      border: '1px solid rgba(0,255,0,0.3)',
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#fff' }}>
        GESTURE PIPELINE
      </div>

      <div style={{ marginBottom: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span>State: <span style={{ color: engineState === 'running' ? '#0f0' : '#ff0' }}>{engineState}</span></span>
        <span>Gesture: <span style={{ color: '#0ff' }}>{currentGesture}</span></span>
        <span>Conf: <span style={{ color: '#0f0' }}>{(gestureConfidence * 100).toFixed(0)}%</span></span>
      </div>

      <div style={{ marginBottom: 4, display: 'flex', gap: 8, flexWrap: 'wrap', color: '#aaa' }}>
        <span>Cursor: <span style={{ color: cursorMode ? '#ffd43b' : '#666' }}>{cursorMode ? 'YES' : 'no'}</span></span>
        <span>Palette: <span style={{ color: colorPaletteActive ? '#ffd43b' : '#666' }}>{colorPaletteActive ? 'active' : 'off'}</span></span>
      </div>

      {gestureDebug && (
        <>
          <div style={{ color: '#888' }}>
            Gesture: {gestureDebug.activeGesture} | Conf: {(gestureDebug.gestureConfidence * 100).toFixed(0)}%
          </div>
          <div style={{ color: '#888' }}>
            Speed: {gestureDebug.motionSpeed.toFixed(3)}
            {gestureDebug.trackingStability !== undefined && (
              <> | Stability: {(gestureDebug.trackingStability * 100).toFixed(0)}%</>
            )}
          </div>
          <div style={{ color: '#888' }}>
            Intent: {(gestureDebug.intentScore * 100).toFixed(0)}%
            {gestureDebug.dynamicThreshold !== undefined && (
              <> | DynThresh: {(gestureDebug.dynamicThreshold * 100).toFixed(0)}%</>
            )}
          </div>
        </>
      )}

      {!gestureDebug && (
        <div style={{ color: '#555' }}>Waiting for pipeline data...</div>
      )}
    </div>
  );
}
