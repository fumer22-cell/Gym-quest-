/**
 * Builds the single-file Claude artifact version: one IIFE bundle + one stylesheet,
 * inlined into artifact/gym-quest.html by scripts/build-artifact.mjs.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/artifact/main.tsx',
      formats: ['iife'],
      name: 'GymQuest',
      fileName: () => 'app.js',
      cssFileName: 'app',
    },
  },
});
