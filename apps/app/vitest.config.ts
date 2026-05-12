import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'],
    exclude: ['node_modules', 'e2e'],
    setupFiles: [],
  },
});
