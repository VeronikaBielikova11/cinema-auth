import { ApiProperty } from '@nestjs/swagger';
import { ShowingDetails } from '../entities/showing.entity.js';

export class ShowingsPageDto {
  @ApiProperty({
    type: [ShowingDetails],
    description: 'Сеанси поточної сторінки',
  })
  items: ShowingDetails[];

  @ApiProperty({
    example: 42,
    description: 'Скільки всього сеансів відповідає фільтрам',
  })
  total: number;

  @ApiProperty({ example: 1, description: 'Номер поточної сторінки' })
  page: number;

  @ApiProperty({ example: 20, description: 'Розмір сторінки' })
  limit: number;
}
