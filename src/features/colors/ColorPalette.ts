export const DEFAULT_PALETTE = [
  { name: 'Coral Red', hex: '#FF6B6B' },
  { name: 'Orange', hex: '#FFA94D' },
  { name: 'Yellow', hex: '#FFD43B' },
  { name: 'Green', hex: '#69DB7C' },
  { name: 'Teal', hex: '#38D9A9' },
  { name: 'Sky Blue', hex: '#4DABF7' },
  { name: 'Periwinkle', hex: '#748FFC' },
  { name: 'Purple', hex: '#9775FA' },
  { name: 'Pink', hex: '#DA77F2' },
  { name: 'Rose', hex: '#F783AC' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Silver', hex: '#CED4DA' },
] as const;

export type PaletteColor = (typeof DEFAULT_PALETTE)[number];
export const PALETTE_HEXES = DEFAULT_PALETTE.map((c) => c.hex);
export const PALETTE_COUNT = DEFAULT_PALETTE.length;
