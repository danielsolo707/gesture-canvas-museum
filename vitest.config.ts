import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': '/src',
      '@core': '/src/core',
      '@tracking': '/src/tracking',
      '@gestures': '/src/gestures',
      '@drawing': '/src/drawing',
      '@rendering': '/src/rendering',
      '@features': '/src/features',
      '@store': '/src/store',
      '@hooks': '/src/hooks',
      '@ui': '/src/ui',
      '@utils': '/src/utils',
      '@smoothing': '/src/smoothing',
    },
  },
});
