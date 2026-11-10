import { DataSourceOptions } from 'typeorm';
import { EnvironmentVariables } from '../config/env.validation.js';

// Connection settings shared by the Nest app, the TypeORM CLI and the seed script.
export const databaseOptions = (
  env: Pick<
    EnvironmentVariables,
    'DB_HOST' | 'DB_PORT' | 'DB_USER' | 'DB_PASSWORD' | 'DB_NAME'
  >,
) =>
  ({
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    uuidExtension: 'pgcrypto',
    // The schema is owned by migrations only.
    synchronize: false,
    migrationsRun: false,
  }) satisfies DataSourceOptions;
