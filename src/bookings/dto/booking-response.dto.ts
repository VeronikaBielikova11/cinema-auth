import { ApiProperty } from '@nestjs/swagger';
import { Seat } from '../../halls/entities/hall.entity.js';
import { ShowingDetails } from '../../showings/entities/showing.entity.js';

export class BookingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  showingId: string;

  @ApiProperty({ format: 'uuid', description: 'Власник бронювання' })
  userId: string;

  @ApiProperty({ type: [Seat] })
  seats: Seat[];

  @ApiProperty({
    example: 25000,
    description: 'Ціна сеансу, помножена на кількість місць, у копійках',
  })
  totalPrice: number;
}

export class UserBookingDto extends BookingResponseDto {
  @ApiProperty({ type: ShowingDetails })
  showing: ShowingDetails;
}

export class ShowingSeat extends Seat {
  @ApiProperty({ example: false })
  isBooked: boolean;
}
