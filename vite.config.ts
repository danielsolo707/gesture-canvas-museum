import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { addDownloadRoutes } from './scripts/download-server.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'download-server',
      configureServer(server) {
        addDownloadRoutes(server);
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@tracking': path.resolve(__dirname, './src/tracking'),
      '@gestures': path.resolve(__dirname, './src/gestures'),
      '@drawing': path.resolve(__dirname, './src/drawing'),
      '@rendering': path.resolve(__dirname, './src/rendering'),
      '@features': path.resolve(__dirname, './src/features'),
      '@store': path.resolve(__dirname, './src/store'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@smoothing': path.resolve(__dirname, './src/smoothing'),
    },
  },
  server: {
    host: true,
    port: 3000,
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
  },
  worker: {
    format: 'es',
  },
});
