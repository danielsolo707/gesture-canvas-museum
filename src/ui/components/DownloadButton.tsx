import { useStore } from '../../store/useStore';
import { DownloadIcon } from './icons/DownloadIcon';

export function DownloadButton() {
  const strokeCount = useStore((s) => s.strokeCount);
  const showQRPanel = useStore((s) => s.showQRPanel);
  const setShowQRPanel = useStore((s) => s.setShowQRPanel);

  if (strokeCount === 0) return null;

  return (
    <div
      onClick={() => setShowQRPanel(!showQRPanel)}
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 260,
        width: 44, height: 44, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', pointerEvents: 'auto',
        transition: 'background 0.2s, transform 0.2s',
        animation: 'fadeIn 0.5s ease forwards',
        color: '#e9ecef',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
        e.currentTarget.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <DownloadIcon />
    </div>
  );
}
