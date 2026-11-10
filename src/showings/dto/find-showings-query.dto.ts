import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const MAX_PAGE_LIMIT = 100;

// Strict integer parsing: "1.5", "1e2", "abc" and "" stay non-integers and fail validation.
const toInteger = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;

export class FindShowingsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Лишити сеанси тільки цього фільму',
  })
  @IsOptional()
  @IsString()
  filmId?: string;

  @ApiPropertyOptional({
    example: '2030-06-15',
    description: 'Лишити сеанси, що починаються цієї доби за UTC',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must match YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'date must be a real calendar date' })
  date?: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    default: 1,
    description: 'Номер сторінки',
  })
  @IsOptional()
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: MAX_PAGE_LIMIT,
    default: 20,
    description: 'Кількість сеансів на сторінці',
  })
  @IsOptional()
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit: number = 20;

  @ApiPropertyOptional({
    enum: SORT_ORDERS,
    default: 'asc',
    description:
      'Порядок за часом початку; сеанси з однаковим часом ідуть за id',
  })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  sort: SortOrder = 'asc';
}
