import { useStore } from '../../store/useStore';

export function DebugToggle() {
  const toggleDebug = useStore((s) => s.toggleDebug);

  return (
    <div
      onClick={toggleDebug}
      style={{
        position: 'fixed', bottom: 8, right: 8, zIndex: 300,
        padding: '4px 10px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 6,
        color: 'rgba(255,255,255,0.25)',
        fontSize: 10, fontFamily: 'monospace',
        cursor: 'pointer', userSelect: 'none',
        pointerEvents: 'auto',
        letterSpacing: '0.5px',
        transition: 'background 0.2s, color 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
        e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.color = 'rgba(255,255,255,0.25)';
      }}
    >
      [DBG]
    </div>
  );
}
