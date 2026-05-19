import { useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';

const STEPS = [
  {
    icon: '👋',
    en: 'Wave your hand to begin',
    fa: 'برای شروع دست خود را تکان دهید',
  },
  {
    icon: '✍️',
    en: 'Pinch to draw',
    fa: 'برای نقاشی کردن انگشتان را به هم بزنید',
  },
  {
    icon: '🖐️',
    en: 'Open palm for menu',
    fa: 'برای باز کردن منو کف دست را نشان دهید',
  },
];

export function TutorialOverlay() {
  const showTutorial = useStore((s) => s.showTutorial);
  const currentGesture = useStore((s) => s.currentGesture);
  const setShowTutorial = useStore((s) => s.setShowTutorial);
  const dismissTimeoutRef = useRef<number | null>(null);
  const gestureRef = useRef(currentGesture);

  gestureRef.current = currentGesture;

  useEffect(() => {
    if (!showTutorial) return;

    dismissTimeoutRef.current = window.setTimeout(() => {
      setShowTutorial(false);
    }, 10000);

    return () => {
      if (dismissTimeoutRef.current !== null) {
        window.clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = null;
      }
    };
  }, [showTutorial, setShowTutorial]);

  useEffect(() => {
    if (!showTutorial) return;
    if (gestureRef.current !== 'idle') {
      setShowTutorial(false);
    }
  }, [currentGesture, showTutorial, setShowTutorial]);

  if (!showTutorial) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 290,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,10,15,0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          position: 'absolute', top: 20, right: 20,
          width: 32, height: 32, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#868e96', fontSize: 18, lineHeight: 1,
          transition: 'background 0.2s',
        }}
        onClick={() => setShowTutorial(false)}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
      >
        ✕
      </div>

      <h2
        style={{
          fontSize: 13, fontWeight: 600, letterSpacing: '3px',
          textTransform: 'uppercase', color: '#495057',
          marginBottom: 32,
        }}
      >
        GETTING STARTED / راهنما
      </h2>

      <div
        style={{
          display: 'flex', flexDirection: 'column', gap: 16,
          maxWidth: 360, width: '100%', padding: '0 24px',
        }}
      >
        {STEPS.map((step, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span style={{ fontSize: 28, flexShrink: 0 }}>{step.icon}</span>
            <div>
              <div style={{ fontSize: 13, color: '#dee2e6', fontWeight: 500, marginBottom: 2 }}>
                {step.en}
              </div>
              <div style={{ fontSize: 12, color: '#868e96', direction: 'rtl' }}>
                {step.fa}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p
        style={{
          marginTop: 32, fontSize: 11, color: '#495057',
          letterSpacing: '0.5px',
        }}
      >
        Tap anywhere or make a gesture to dismiss
      </p>
    </div>
  );
}
