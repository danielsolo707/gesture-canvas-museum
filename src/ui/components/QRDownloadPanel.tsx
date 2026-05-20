import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import QRCode from 'qrcode';

async function uploadSnapshot(blob: Blob): Promise<string> {
  const resp = await fetch('/api/upload', { method: 'POST', body: blob });
  if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
  const { downloadUrl } = await resp.json();
  if (!downloadUrl) throw new Error('No download URL returned');
  return downloadUrl;
}

async function generateQr(qrTarget: string): Promise<string> {
  return QRCode.toDataURL(qrTarget, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#ffffff', light: '#0a0a0f' },
  });
}

export function QRDownloadPanel() {
  const showQRPanel = useStore((s) => s.showQRPanel);
  const setShowQRPanel = useStore((s) => s.setShowQRPanel);
  const qrSnapshotBlob = useStore((s) => s.qrSnapshotBlob);
  const qrSnapshotPreviewUrl = useStore((s) => s.qrSnapshotPreviewUrl);
  const clearQrSnapshot = useStore((s) => s.clearQrSnapshot);
  const strokeCount = useStore((s) => s.strokeCount);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const processingRef = useRef(false);
  const lastStrokeRef = useRef(strokeCount);

  const process = useCallback(async () => {
    if (processingRef.current) return;
    const blob = qrSnapshotBlob;
    if (!blob) return;
    processingRef.current = true;

    setError(null);
    setStatus('Uploading...');

    try {
      const downloadPath = await uploadSnapshot(blob);
      const origin = window.location.origin;
      const fullUrl = `${origin}${downloadPath}`;

      setStatus('Generating QR...');
      const qr = await generateQr(fullUrl);

      setDownloadUrl(fullUrl);
      setPreviewUrl(qrSnapshotPreviewUrl);
      setQrDataUrl(qr);
      setStatus('');
    } catch {
      setError('Could not generate download link');
      setStatus('');
    } finally {
      processingRef.current = false;
    }
  }, [qrSnapshotBlob, qrSnapshotPreviewUrl]);

  useEffect(() => {
    if (!showQRPanel) return;
    lastStrokeRef.current = strokeCount;
    process();
  }, [showQRPanel, process, strokeCount]);

  useEffect(() => {
    if (!showQRPanel) return;
    if (strokeCount !== lastStrokeRef.current) {
      lastStrokeRef.current = strokeCount;
      clearQrSnapshot();
    }
  }, [strokeCount, showQRPanel, clearQrSnapshot]);

  useEffect(() => {
    if (!showQRPanel) {
      setPreviewUrl(null);
      setQrDataUrl(null);
      setDownloadUrl(null);
      setStatus('');
      setError(null);
    }
  }, [showQRPanel]);

  if (!showQRPanel) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 340, zIndex: 275,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(10,10,15,0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        pointerEvents: 'auto',
        animation: 'slideInRight 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        padding: 20,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e9ecef', letterSpacing: '0.5px' }}>
          Download
        </h3>
        <div
          style={{
            width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', background: 'rgba(255,255,255,0.06)', color: '#868e96', fontSize: 14,
          }}
          onClick={() => setShowQRPanel(false)}
        >
          x
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <div
          style={{
            width: '100%', aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.10)', background: '#0a0a0f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Scene preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ color: '#6c757d', fontSize: 11 }}>Generating preview...</div>
          )}
        </div>

        {error && <div style={{ color: '#fa5252', fontSize: 11 }}>{error}</div>}
        {!error && status && <div style={{ color: '#adb5bd', fontSize: 11 }}>{status}</div>}

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR download link"
              style={{ width: 260, height: 260, borderRadius: 10, imageRendering: 'pixelated' }}
            />
          ) : (
            <div
              style={{
                width: 260, height: 260, borderRadius: 10,
                background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#495057', fontSize: 11,
              }}
            >
              Generating QR...
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: '#adb5bd', lineHeight: 1.5, direction: 'rtl', textAlign: 'center' }}>
          QR کد را با گوشی اسکن کنید تا نقاشی دانلود شود
        </div>

        {downloadUrl && (
          <a
            href={downloadUrl}
            download={`gesture-canvas-${Date.now()}.jpg`}
            style={{
              marginTop: 'auto', textAlign: 'center', fontSize: 12, color: '#e9ecef', textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.16)', borderRadius: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.04)',
            }}
          >
            Download on this device
          </a>
        )}
      </div>
    </div>
  );
}
