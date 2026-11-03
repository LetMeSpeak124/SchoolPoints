import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    fileParallelism: false,
    env: {
      DATABASE_URL: 'file:./test.db',
      SESSION_SECRET: 'test-only-session-secret-at-least-32-characters',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
