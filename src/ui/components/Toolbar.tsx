import { useStore } from '../../store/useStore';
import { PALETTE_HEXES } from '../../features/colors/ColorPalette';

export function Toolbar() {
  const showToolbar = useStore((s) => s.showToolbar);
  const color = useStore((s) => s.color);
  const selectedPaletteIndex = useStore((s) => s.selectedPaletteIndex);
  const selectPaletteIndex = useStore((s) => s.selectPaletteIndex);

  return (
    <div className={`toolbar${showToolbar ? '' : ' hidden'}`}>
      {PALETTE_HEXES.map((hex, i) => (
        <button
          key={hex}
          className={`color-swatch${i === selectedPaletteIndex ? ' active' : ''}`}
          style={{ background: hex }}
          onClick={() => selectPaletteIndex(i)}
          aria-label={`Color ${i + 1}`}
        />
      ))}
    </div>
  );
}
