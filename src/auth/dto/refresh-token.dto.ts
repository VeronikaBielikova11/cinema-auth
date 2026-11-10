import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh-токен, отриманий під час входу' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
