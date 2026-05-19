import { useStore } from '../../../store/useStore';

function healthColor(value: number): string {
  if (value >= 0.7) return '#0f0';
  if (value >= 0.4) return '#ff0';
  return '#f00';
}

export function TemporalDebugPanel() {
  const showDebug = useStore((s) => s.showDebug);
  const gestureDebug = useStore((s) => s.gestureDebug);
  const currentGesture = useStore((s) => s.currentGesture);
  const gestureConfidence = useStore((s) => s.gestureConfidence);
  const engineState = useStore((s) => s.engineState);
  const cursorMode = useStore((s) => s.cursorMode);
  const colorPaletteActive = useStore((s) => s.colorPaletteActive);

  const handIntegrity = useStore((s) => s.handIntegrity);
  const edgeProximity = useStore((s) => s.edgeProximity);
  const gestureFrozen = useStore((s) => s.gestureFrozen);
  const freezeActive = useStore((s) => s.freezeActive);
  const predictionActive = useStore((s) => s.predictionActive);
  const safeZoneActive = useStore((s) => s.safeZoneActive);
  const extrapolating = useStore((s) => s.extrapolating);

  if (!showDebug) return null;

  return (
    <div className="debug-panel" style={{
      position: 'absolute', top: 8, right: 8, width: 340,
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
        <span>Conf: <span style={{ color: healthColor(gestureConfidence) }}>{(gestureConfidence * 100).toFixed(0)}%</span></span>
      </div>

      <div style={{ marginBottom: 4, display: 'flex', gap: 8, flexWrap: 'wrap', color: '#aaa' }}>
        <span>Cursor: <span style={{ color: cursorMode ? '#ffd43b' : '#666' }}>{cursorMode ? 'YES' : 'no'}</span></span>
        <span>Palette: <span style={{ color: colorPaletteActive ? '#ffd43b' : '#666' }}>{colorPaletteActive ? 'active' : 'off'}</span></span>
      </div>

      <div style={{ marginBottom: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span>Integrity: <span style={{ color: healthColor(handIntegrity) }}>{(handIntegrity * 100).toFixed(0)}%</span></span>
        <span>Edge: <span style={{ color: edgeProximity > 0.5 ? '#f00' : edgeProximity > 0.3 ? '#ff0' : '#0f0' }}>{(edgeProximity * 100).toFixed(0)}%</span></span>
      </div>

      <div style={{ marginBottom: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span>Freeze: <span style={{ color: gestureFrozen ? '#ff0' : '#666' }}>{gestureFrozen ? 'FROZEN' : 'no'}</span></span>
        {freezeActive && <span style={{ color: '#ffd43b' }}>ACTIVE</span>}
        {predictionActive && <span style={{ color: '#0ff' }}>PREDICT</span>}
        {safeZoneActive && <span style={{ color: '#0ff' }}>SAFEZN</span>}
        {extrapolating && <span style={{ color: '#ff0' }}>EXTRAP</span>}
      </div>

      {gestureDebug && (
        <>
          <div style={{ color: '#888', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4, paddingTop: 4 }}>
            {gestureDebug.activeGesture} | {(gestureDebug.gestureConfidence * 100).toFixed(0)}%
          </div>
          <div style={{ color: '#888' }}>
            Speed: {gestureDebug.motionSpeed.toFixed(3)}
            {gestureDebug.trackingStability !== undefined && (
              <> | Stable: {(gestureDebug.trackingStability * 100).toFixed(0)}%</>
            )}
          </div>
          <div style={{ color: '#888' }}>
            Intent: {(gestureDebug.intentScore * 100).toFixed(0)}%
            {gestureDebug.dynamicThreshold !== undefined && (
              <> | Dyn: {(gestureDebug.dynamicThreshold * 100).toFixed(0)}%</>
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
