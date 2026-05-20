import { useStore } from '../../../store/useStore';

function healthColor(value: number): string {
  if (value >= 0.7) return '#0f0';
  if (value >= 0.4) return '#ff0';
  return '#f00';
}

function freezeColor(reason: string): string {
  switch (reason) {
    case 'low_integrity': return '#ff6b6b';
    case 'edge_proximity': return '#ffd43b';
    case 'low_confidence': return '#ff922b';
    default: return '#ff0';
  }
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
  const freezeReason = useStore((s) => s.freezeReason);
  const freezeDurationMs = useStore((s) => s.freezeDurationMs);
  const freezeGraceActive = useStore((s) => s.freezeGraceActive);
  const recoveryMode = useStore((s) => s.recoveryMode);
  const handReentry = useStore((s) => s.handReentry);
  const authorityOwner = useStore((s) => s.authorityOwner);
  const visibilityMode = useStore((s) => s.visibilityMode);
  const capabilityLevel = useStore((s) => s.capabilityLevel);
  const handAbsenceMs = useStore((s) => s.handAbsenceMs);
  const predictionActive = useStore((s) => s.predictionActive);
  const safeZoneActive = useStore((s) => s.safeZoneActive);
  const extrapolating = useStore((s) => s.extrapolating);
  const trackingConfidence = useStore((s) => s.trackingConfidence);

  if (!showDebug) return null;

  return (
    <div className="debug-panel" style={{
      position: 'absolute', top: 8, right: 8, width: 360,
      background: 'rgba(0,0,0,0.88)', color: '#0f0',
      fontFamily: 'monospace', fontSize: 11, padding: 12, borderRadius: 8,
      zIndex: 200, pointerEvents: 'auto', userSelect: 'text',
      border: '1px solid rgba(0,255,0,0.3)',
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#fff' }}>
        GESTURE PIPELINE v2
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

      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span>Integrity: <span style={{ color: healthColor(handIntegrity) }}>{(handIntegrity * 100).toFixed(0)}%</span></span>
          <span>Tracking: <span style={{ color: healthColor(trackingConfidence) }}>{(trackingConfidence * 100).toFixed(0)}%</span></span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span>Edge: <span style={{ color: edgeProximity > 0.5 ? '#f00' : edgeProximity > 0.3 ? '#ff0' : '#0f0' }}>{(edgeProximity * 100).toFixed(0)}%</span></span>
          <span>SafeZone: <span style={{ color: safeZoneActive ? '#0ff' : '#666' }}>{safeZoneActive ? 'on' : 'off'}</span></span>
        </div>
      </div>

      <div style={{ marginBottom: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span>Freeze: <span style={{ color: gestureFrozen ? '#ff0' : '#666' }}>{gestureFrozen ? 'FROZEN' : 'no'}</span></span>
        {gestureFrozen && freezeReason && (
          <span style={{ color: freezeColor(freezeReason) }}>{freezeReason}</span>
        )}
        {freezeGraceActive && <span style={{ color: '#74c0fc' }}>GRACE</span>}
        {handReentry && <span style={{ color: '#69db7c' }}>REENTRY</span>}
        {predictionActive && <span style={{ color: '#0ff' }}>PREDICT</span>}
        {extrapolating && <span style={{ color: '#ff0' }}>EXTRAP</span>}
      </div>

      <div style={{ marginBottom: 4, display: 'flex', gap: 8, flexWrap: 'wrap', color: '#aaa' }}>
        <span>Recovery: <span style={{ color: '#74c0fc' }}>{recoveryMode}</span></span>
        <span>Authority: <span style={{ color: '#ffd43b' }}>{authorityOwner}</span></span>
        <span>Vis: <span style={{ color: '#69db7c' }}>{visibilityMode}</span></span>
        <span>Capability: <span style={{ color: '#f783ac' }}>{capabilityLevel}</span></span>
        <span>Absence: <span style={{ color: '#ffa94d' }}>{Math.round(handAbsenceMs)}ms</span></span>
        <span>FreezeMs: <span style={{ color: '#ff8787' }}>{Math.round(freezeDurationMs)}ms</span></span>
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
            {gestureDebug.smoothedConfidence !== undefined && (
              <> | Smoothed: {(gestureDebug.smoothedConfidence * 100).toFixed(0)}%</>
            )}
          </div>
          <div style={{ color: '#888', fontSize: 10 }}>
            Edges: L={gestureDebug.leftEdge.toFixed(1)} R={gestureDebug.rightEdge.toFixed(1)} T={gestureDebug.topEdge.toFixed(1)} B={gestureDebug.bottomEdge.toFixed(1)}
          </div>
          <div style={{ color: '#888', fontSize: 10 }}>
            Hand: {(gestureDebug.completenessScore !== undefined ? gestureDebug.completenessScore : handIntegrity) * 100}% complete
          </div>
        </>
      )}

      {!gestureDebug && (
        <div style={{ color: '#555' }}>Waiting for pipeline data...</div>
      )}
    </div>
  );
}
