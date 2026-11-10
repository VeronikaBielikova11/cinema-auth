import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsPositive,
  ValidateNested,
} from 'class-validator';

export class SeatDto {
  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @IsPositive()
  row: number;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @IsPositive()
  seat: number;
}

export class CreateBookingDto {
  @ApiProperty({
    type: [SeatDto],
    description: 'Непорожній масив різних місць',
  })
  @IsArray()
  @ArrayNotEmpty()
  // Optional chaining: elements are not validated yet, and null must become a 400, not a crash.
  @ArrayUnique((item?: SeatDto) => `${item?.row}:${item?.seat}`, {
    message: 'seats must not contain the same seat twice',
  })
  @ValidateNested({ each: true })
  @Type(() => SeatDto)
  seats: SeatDto[];
}
