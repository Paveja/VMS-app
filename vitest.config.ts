import 'dotenv/config';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['apps/**/*.test.{ts,tsx}'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
