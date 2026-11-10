import { DataSource } from 'typeorm';
import { validateEnv } from '../src/config/env.validation.js';
import { databaseOptions } from '../src/database/database.options.js';
import { entities } from '../src/database/entities.js';
import { TEST_DB_NAME } from './test-db.js';

// Creates a separate database for e2e tests and brings it to the latest
// migration, so the tests never touch the development data.
export default async function setup() {
  try {
    process.loadEnvFile();
  } catch {
    // Variables may come from the environment instead of .env.
  }
  const env = validateEnv({ ...process.env, DB_NAME: TEST_DB_NAME });

  const admin = new DataSource({
    ...databaseOptions(env),
    database: 'postgres',
  });
  await admin.initialize();
  const exists = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [TEST_DB_NAME],
  );
  if (exists.length === 0) {
    await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  }
  await admin.destroy();

  const test = new DataSource({
    ...databaseOptions(env),
    entities,
    migrations: [`${import.meta.dirname}/../src/database/migrations/*.ts`],
  });
  await test.initialize();
  await test.runMigrations();
  await test.destroy();
}
