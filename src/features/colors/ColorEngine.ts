import { DEFAULT_PALETTE } from './ColorPalette';
import { useStore } from '../../store/useStore';

export class ColorEngine {
  private currentIndex = 0;

  getCurrentColor(): string {
    return DEFAULT_PALETTE[this.currentIndex].hex;
  }

  nextColor(): string {
    this.currentIndex = (this.currentIndex + 1) % DEFAULT_PALETTE.length;
    const color = DEFAULT_PALETTE[this.currentIndex].hex;
    useStore.getState().setColor(color);
    useStore.getState().selectPaletteIndex(this.currentIndex);
    return color;
  }

  previousColor(): string {
    this.currentIndex = (this.currentIndex - 1 + DEFAULT_PALETTE.length) % DEFAULT_PALETTE.length;
    const color = DEFAULT_PALETTE[this.currentIndex].hex;
    useStore.getState().setColor(color);
    useStore.getState().selectPaletteIndex(this.currentIndex);
    return color;
  }

  selectColor(index: number): string {
    this.currentIndex = Math.min(Math.max(index, 0), DEFAULT_PALETTE.length - 1);
    const color = DEFAULT_PALETTE[this.currentIndex].hex;
    useStore.getState().setColor(color);
    useStore.getState().selectPaletteIndex(this.currentIndex);
    return color;
  }

  setColor(color: string): void {
    const idx = DEFAULT_PALETTE.findIndex((c) => c.hex === color);
    if (idx !== -1) this.currentIndex = idx;
    useStore.getState().setColor(color);
  }

  reset(): void {
    this.currentIndex = 0;
  }
}
