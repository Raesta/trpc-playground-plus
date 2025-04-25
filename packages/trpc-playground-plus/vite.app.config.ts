import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-html',
      closeBundle() {
        fs.copyFileSync(
          resolve(__dirname, 'index.html'),
          resolve(__dirname, 'dist/app/index.html')
        )
      }
    }
  ],
  build: {
    outDir: 'dist/app',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/main.tsx'),
      output: {
        entryFileNames: 'app.js',
        assetFileNames: '[name].[ext]'
      }
    }
  }
})