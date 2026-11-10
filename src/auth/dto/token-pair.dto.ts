import { ApiProperty } from '@nestjs/swagger';

export class TokenPairDto {
  @ApiProperty({ description: 'JWT для заголовка Authorization: Bearer' })
  accessToken: string;

  @ApiProperty({ description: 'Випадковий рядок для POST /auth/refresh' })
  refreshToken: string;
}
