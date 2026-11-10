import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsPositive, IsUUID, Max } from 'class-validator';
import { IsFutureDate } from '../../common/is-future-date.decorator.js';

// Keeps price * seat count within the safe integer range.
const MAX_PRICE = 100_000_000;

export class CreateShowingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  filmId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  hallId: string;

  @ApiProperty({
    example: '2030-06-15T18:00:00.000Z',
    description: 'Дата й час початку в форматі ISO 8601, не в минулому',
  })
  @IsISO8601({ strict: true })
  @IsFutureDate()
  startsAt: string;

  @ApiProperty({
    example: 12500,
    minimum: 1,
    maximum: MAX_PRICE,
    description: 'Ціна квитка в копійках',
  })
  @IsInt()
  @IsPositive()
  @Max(MAX_PRICE)
  price: number;
}
