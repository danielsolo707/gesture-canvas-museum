import { useStore } from '../../store/useStore';
import { DownloadIcon } from './icons/DownloadIcon';

function getMainCanvas(): HTMLCanvasElement | null {
  const list = Array.from(document.querySelectorAll('canvas')) as HTMLCanvasElement[];
  if (list.length === 0) return null;
  return list.reduce((best, c) => {
    const bestArea = best.width * best.height;
    const area = c.width * c.height;
    return area > bestArea ? c : best;
  });
}

function captureSceneCanvas(): HTMLCanvasElement | null {
  const src = getMainCanvas();
  if (!src) return null;

  const W = 1280;
  const H = Math.max(720, Math.round((src.height / Math.max(src.width, 1)) * W));
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(src, 0, 0, W, H);
  return out;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('snapshot failed'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', 0.92);
  });
}

export function DownloadButton() {
  const strokeCount = useStore((s) => s.strokeCount);
  const showQRPanel = useStore((s) => s.showQRPanel);
  const setShowQRPanel = useStore((s) => s.setShowQRPanel);
  const setQrSnapshot = useStore((s) => s.setQrSnapshot);
  const clearQrSnapshot = useStore((s) => s.clearQrSnapshot);

  const openQrWithFreshSnapshot = async () => {
    clearQrSnapshot();
    const canvas = captureSceneCanvas();
    if (!canvas) {
      setShowQRPanel(true);
      return;
    }
    try {
      const blob = await canvasToBlob(canvas);
      const previewUrl = canvas.toDataURL('image/jpeg', 0.75);
      setQrSnapshot(blob, previewUrl);
    } catch {
      // no-op fallback: panel still opens
    }
    setShowQRPanel(true);
  };

  if (strokeCount === 0) return null;

  return (
    <div
      onClick={() => {
        if (showQRPanel) {
          setShowQRPanel(false);
          return;
        }
        void openQrWithFreshSnapshot();
      }}
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
