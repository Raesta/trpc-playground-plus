import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      exclude: ['**/*.test.ts'],
    }),
  ],
  build: {
    lib: {
      // One entry (bundle) per adapter, kept flat in `dist/` so each adapter can
      // resolve `./app` relative to its own bundle. Add new adapters here.
      entry: {
        fastify: resolve(__dirname, 'src/adapters/fastify.ts'),
      },
      name: 'TRPCPlaygroundPlus',
      fileName: (format, entryName) => `${entryName}.${format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        '@trpc/client',
        '@trpc/server',
        'node:path',
        'node:fs',
        'node:url',
        '@fastify/static',
      ],
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
