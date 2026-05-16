import { useStore } from '../../store/useStore';
import { DEFAULT_PALETTE, PALETTE_HEXES } from '../../features/colors/ColorPalette';

export function BottomPalette() {
  const expanded = useStore((s) => s.colorPaletteActive);
  const selectedIndex = useStore((s) => s.selectedPaletteIndex);
  const hoverIndex = useStore((s) => s.colorHoverIndex);

  const currentColor = PALETTE_HEXES[selectedIndex];

  return (
    <div className={`bottom-palette${expanded ? ' expanded' : ''}`}>
      <span className="palette-mini" style={{ background: currentColor }} />
      {expanded && (
        <div className="palette-strip-vertical">
          {DEFAULT_PALETTE.map((c, i) => {
            let cls = 'palette-swatch';
            if (i === hoverIndex) cls += ' hover';
            if (i === selectedIndex) cls += ' active';
            return (
              <span
                key={c.hex}
                className={cls}
                style={{ background: c.hex }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
