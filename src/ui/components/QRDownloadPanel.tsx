import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import QRCode from 'qrcode';

const QR_MAX_BYTES = 2900;

function mapX(x: number, aspect: number, W: number): number {
  return ((x / aspect) + 1) / 2 * W;
}
function mapY(y: number, H: number): number {
  return (1 - y) / 2 * H;
}

function renderStrokesOnly(): HTMLCanvasElement | null {
  const { strokes } = useStore.getState();
  if (strokes.length === 0) return null;

  const threeCanvas = document.querySelector('canvas');
  const aspect = threeCanvas ? threeCanvas.clientWidth / threeCanvas.clientHeight : 16 / 9;

  const W = 1000;
  const H = Math.round(W / aspect);
  const offscreen = document.createElement('canvas');
  offscreen.width = W;
  offscreen.height = H;
  const ctx = offscreen.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;

    const pixelWidth = Math.max(1, (stroke.width * 0.008 / 2) * H);

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = pixelWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const p0 = stroke.points[0];
    ctx.moveTo(mapX(p0.x, aspect, W), mapY(p0.y, H));

    for (let i = 1; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      ctx.lineTo(mapX(p.x, aspect, W), mapY(p.y, H));
    }

    ctx.stroke();
  }

  return offscreen;
}

function resizeImage(src: HTMLCanvasElement, maxWidth: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const ratio = maxWidth / src.width;
  c.width = maxWidth;
  c.height = Math.round(src.height * ratio);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

async function generateQR(srcCanvas: HTMLCanvasElement): Promise<{ qrDataUrl: string; thumbUrl: string }> {
  const thumb = resizeImage(srcCanvas, 120);
  const thumbUrl = thumb.toDataURL('image/jpeg', 0.6);

  let w = 100;
  let q = 0.5;
  let best: string | null = null;

  while (w >= 20) {
    const small = resizeImage(srcCanvas, w);
    const dataUrl = small.toDataURL('image/jpeg', q);
    if (dataUrl.length >= QR_MAX_BYTES) {
      w -= 15;
      q = Math.max(0.15, q - 0.1);
      continue;
    }
    try {
      best = await QRCode.toDataURL(dataUrl, {
        width: 200, margin: 2,
        color: { dark: '#ffffff', light: '#0a0a0f' },
        errorCorrectionLevel: 'L',
      });
      break;
    } catch {
      w -= 15;
      q = Math.max(0.15, q - 0.1);
    }
  }

  if (!best) {
    const fallback = resizeImage(srcCanvas, 20);
    const dataUrl = fallback.toDataURL('image/jpeg', 0.15);
    best = await QRCode.toDataURL(dataUrl, {
      width: 200, margin: 2,
      color: { dark: '#ffffff', light: '#0a0a0f' },
      errorCorrectionLevel: 'L',
    });
  }

  return { qrDataUrl: best, thumbUrl };
}

export function QRDownloadPanel() {
  const showQRPanel = useStore((s) => s.showQRPanel);
  const setShowQRPanel = useStore((s) => s.setShowQRPanel);
  const strokeCount = useStore((s) => s.strokeCount);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastStrokeRef = useRef(strokeCount);

  const capture = useCallback(async () => {
    setError(null);
    const canvas = renderStrokesOnly();
    if (!canvas) {
      setError('Draw something first');
      return;
    }

    try {
      const result = await generateQR(canvas);
      setQrDataUrl(result.qrDataUrl);
      setThumbUrl(result.thumbUrl);
    } catch (err) {
      setError('Could not generate QR code');
      setQrDataUrl(null);
    }
  }, []);

  useEffect(() => {
    if (!showQRPanel) return;
    lastStrokeRef.current = strokeCount;
    capture();
  }, [showQRPanel, capture, strokeCount]);

  useEffect(() => {
    if (!showQRPanel) return;
    if (strokeCount !== lastStrokeRef.current) {
      lastStrokeRef.current = strokeCount;
      capture();
    }
  }, [strokeCount, showQRPanel, capture]);

  if (!showQRPanel) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 280, zIndex: 275,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(10,10,15,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        pointerEvents: 'auto',
        animation: 'slideInRight 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        padding: 24,
      }}
    >
      <div
        style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 24,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e9ecef', letterSpacing: '0.5px' }}>
          QR Code
        </h3>
        <div
          style={{
            width: 28, height: 28, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
            color: '#868e96', fontSize: 14,
            transition: 'background 0.2s',
          }}
          onClick={() => setShowQRPanel(false)}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
        >
          ✕
        </div>
      </div>

      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 20,
        }}
      >
        {thumbUrl && (
          <div
            style={{
              width: 120, height: 80, borderRadius: 6, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
            }}
          >
            <img src={thumbUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {error && (
          <div style={{ color: '#fa5252', fontSize: 11, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR Code"
            style={{ width: 160, height: 160, borderRadius: 8, imageRendering: 'pixelated' }}
          />
        ) : !error ? (
          <div
            style={{
              width: 160, height: 160, borderRadius: 8,
              background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#495057', fontSize: 11,
            }}
          >
            Generating QR...
          </div>
        ) : null}

        <p style={{ fontSize: 10, color: '#495057', textAlign: 'center', maxWidth: 200, lineHeight: 1.5, direction: 'rtl' }}>
          اسکن کنید و تصویر را ذخیره کنید
        </p>
      </div>
    </div>
  );
}
