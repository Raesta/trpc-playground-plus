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
        fastify: resolve(import.meta.dirname, 'src/adapters/fastify.ts'),
      },
      name: 'TRPCPlaygroundPlus',
      // CJS must use a real `.cjs` extension: the package is `type: module`, so a `.js`
      // file is loaded as ESM by Node and the CommonJS `exports.x = …` would populate nothing.
      fileName: (format, entryName) => (format === 'cjs' ? `${entryName}.cjs` : `${entryName}.es.js`),
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
      onwarn(warning, defaultHandler) {
        // The adapter uses `import.meta.url` (valid in the ESM bundle). In the CJS bundle
        // Rolldown replaces it with `{}` and `resolveDistAppPath` falls back to `__dirname` —
        // this is intended, so silence the cosmetic EMPTY_IMPORT_META warning.
        if (warning.code === 'EMPTY_IMPORT_META') return;
        defaultHandler(warning);
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
