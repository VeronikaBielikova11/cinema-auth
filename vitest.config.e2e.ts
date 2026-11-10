import { defineConfig } from 'vitest/config';
import { TEST_DB_NAME } from './test/test-db.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // process.env wins over .env in ConfigModule, so the app connects to the test database.
    env: { DB_NAME: TEST_DB_NAME },
    fileParallelism: false,
  },
});
