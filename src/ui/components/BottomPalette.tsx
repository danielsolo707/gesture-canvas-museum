import { useStore } from '../../store/useStore';
import { DEFAULT_PALETTE, PALETTE_HEXES } from '../../features/colors/ColorPalette';

export function BottomPalette() {
  const expanded = useStore((s) => s.colorPaletteActive);
  const selectedIndex = useStore((s) => s.selectedPaletteIndex);
  const hoverIndex = useStore((s) => s.colorHoverIndex);
  const cursorMode = useStore((s) => s.cursorMode);
  const currentColor = PALETTE_HEXES[selectedIndex];

  // Always show a compact color swatch at top-left when not in palette mode
  if (!expanded) {
    return (
      <div className="color-indicator" style={{
        position: 'fixed', top: 16, left: 16, bottom: 'auto', zIndex: 250,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', background: 'rgba(10,10,15,0.7)',
        borderRadius: 100, border: '1px solid rgba(255,255,255,0.08)',
        width: 'auto', height: 'auto',
      }}>
        <span className="color-indicator-swatch" style={{
          width: 16, height: 16, borderRadius: '50%',
          background: currentColor, border: '2px solid rgba(255,255,255,0.2)',
          display: 'inline-block',
        }} />
        <span className="color-indicator-name" style={{ fontSize: 11, color: '#adb5bd', fontWeight: 600 }}>
          {DEFAULT_PALETTE[selectedIndex]?.name ?? ''}
        </span>
      </div>
    );
  }

  // Expanded palette at top-left, arranged vertically
  return (
    <div
      className="bottom-palette"
      style={{
        position: 'fixed', top: 16, left: 16,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
        padding: '10px 12px',
        background: 'rgba(10,10,15,0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)',
        zIndex: 250, pointerEvents: 'none',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        opacity: expanded ? 1 : 0,
        transform: expanded ? 'translateX(0) translateY(0)' : 'translateX(-20px) translateY(0)',
      }}
    >
      {DEFAULT_PALETTE.map((c, i) => {
        const isHover = i === hoverIndex && expanded;
        const isActive = i === selectedIndex;
        return (
          <div
            key={c.hex}
            style={{
              width: isActive ? 30 : isHover ? 28 : 24,
              height: isActive ? 30 : isHover ? 28 : 24,
              borderRadius: isActive ? 8 : 6,
              background: c.hex,
              border: isActive
                ? '2px solid white'
                : isHover
                  ? '2px solid rgba(255,255,255,0.6)'
                  : '2px solid rgba(255,255,255,0.08)',
              transform: isActive ? 'scale(1.1)' : isHover ? 'scale(1.05)' : 'scale(1)',
              boxShadow: isActive
                ? `0 0 12px ${c.hex}88, 0 0 4px rgba(255,255,255,0.3)`
                : isHover
                  ? `0 0 8px ${c.hex}44`
                  : 'none',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}
