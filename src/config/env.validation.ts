import { plainToInstance, Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_USER: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  // An access token lives for minutes, a refresh token for days.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  ACCESS_TOKEN_TTL_MINUTES: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  REFRESH_TOKEN_TTL_DAYS: number;
}

// Needed only by the seed script, so the API can start without them.
export class SeedVariables {
  @IsEmail()
  ADMIN_EMAIL: string;

  @IsString()
  @MinLength(8)
  ADMIN_PASSWORD: string;
}

export const validateEnv = (config: Record<string, unknown>) =>
  validate(EnvironmentVariables, config);

export const validateSeedEnv = (config: Record<string, unknown>) =>
  validate(SeedVariables, config);

function validate<T extends object>(
  schema: new () => T,
  config: Record<string, unknown>,
): T {
  const env = plainToInstance(schema, config);
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join('\n  ');
    throw new Error(`Invalid environment variables:\n  ${details}`);
  }
  return env;
}
