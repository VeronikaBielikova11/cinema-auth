import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { NormalizeEmail } from './register.dto.js';

// No format rules here: a malformed email is simply a wrong email and gets the same 401.
export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @NormalizeEmail()
  @IsString()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}
