import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';
import { FIRST_FILM_YEAR } from './create-film.dto.js';

// ValidateIf instead of IsOptional: IsOptional would also let an explicit null through.
const isProvided = (_: object, value: unknown) => value !== undefined;

export class UpdateFilmDto {
  @ApiPropertyOptional({ example: 'Захар Беркут' })
  @ValidateIf(isProvided)
  @Trim()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({
    example: 100,
    minimum: 1,
    description: 'Тривалість у хвилинах',
  })
  @ValidateIf(isProvided)
  @IsInt()
  @IsPositive()
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 1971, minimum: FIRST_FILM_YEAR })
  @ValidateIf(isProvided)
  @IsInt()
  @Min(FIRST_FILM_YEAR)
  releaseYear?: number;
}
