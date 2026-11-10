import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString, Min } from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

export const FIRST_FILM_YEAR = 1888;

export class CreateFilmDto {
  @ApiProperty({ example: 'Тіні забутих предків' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 97,
    minimum: 1,
    description: 'Тривалість у хвилинах',
  })
  @IsInt()
  @IsPositive()
  durationMinutes: number;

  @ApiProperty({ example: 1965, minimum: FIRST_FILM_YEAR })
  @IsInt()
  @Min(FIRST_FILM_YEAR)
  releaseYear: number;
}
