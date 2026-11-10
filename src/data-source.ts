import { DataSource } from 'typeorm';
import { validateEnv } from './config/env.validation.js';
import { databaseOptions } from './database/database.options.js';
import { entities } from './database/entities.js';

// Data source for the TypeORM CLI (migrations) and the seed script.
// They run outside Nest, so .env is loaded and validated here directly.
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on variables already set in the environment.
}

const env = validateEnv(process.env);

export default new DataSource({
  ...databaseOptions(env),
  entities,
  migrations: [`${import.meta.dirname}/database/migrations/*.{ts,js}`],
});
