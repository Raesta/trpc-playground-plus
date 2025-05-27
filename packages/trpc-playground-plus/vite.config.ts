import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TRPCPlaygroundPlus',
      fileName: (format) => `index.${format}.js`,
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        '@trpc/client',
        '@trpc/server',
        'path',
        'fs',
        'url',
        '@fastify/static'
      ]
    },
    outDir: 'dist',
    emptyOutDir: true
  }
})