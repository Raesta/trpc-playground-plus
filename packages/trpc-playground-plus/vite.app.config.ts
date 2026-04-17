import fs from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-html',
      closeBundle() {
        fs.copyFileSync(resolve(__dirname, 'index.html'), resolve(__dirname, 'dist/app/index.html'));
      },
    },
  ],
  build: {
    outDir: 'dist/app',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/main.tsx'),
      output: {
        entryFileNames: 'app.js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
