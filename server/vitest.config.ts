import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-only-secret-value-that-is-long-enough-for-hs256',
      RATE_LIMIT_DISABLED: 'true',
      COOKIE_SECURE: 'false',
      UPLOAD_DIR: 'test-uploads',
      LOG_LEVEL: 'silent',
    },
  },
});
