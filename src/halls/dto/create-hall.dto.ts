import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString, Max } from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

// The seat list is computed on every read, so its size has to stay bounded.
const MAX_ROWS = 1000;
const MAX_SEATS_PER_ROW = 1000;

export class CreateHallDto {
  @ApiProperty({ example: 'Синій зал', description: 'Унікальна назва залу' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: MAX_ROWS })
  @IsInt()
  @IsPositive()
  @Max(MAX_ROWS)
  rows: number;

  @ApiProperty({ example: 5, minimum: 1, maximum: MAX_SEATS_PER_ROW })
  @IsInt()
  @IsPositive()
  @Max(MAX_SEATS_PER_ROW)
  seatsPerRow: number;
}
