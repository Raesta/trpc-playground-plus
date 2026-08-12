import { defineConfig } from 'vitest/config';

// Dedicated Vitest config so the library's dts plugin (vite.config.ts) is not
// loaded while running tests. Pure-utility tests run in a Node environment.
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
});
