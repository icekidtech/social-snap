import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/interactive.test.ts', 'node_modules'],
    reporter: 'verbose',
  },
});
