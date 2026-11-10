import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum UserRole {
  User = 'user',
  Admin = 'admin',
}

@Entity('users')
@Check('CHK_users_role', `"role" IN ('user', 'admin')`)
export class User {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  @Column({ type: 'varchar', unique: true })
  email: string;

  // Excluded by the global ClassSerializerInterceptor, so it never reaches a response.
  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash: string;

  @ApiProperty({ enum: UserRole, example: UserRole.User })
  @Column({ type: 'varchar', default: UserRole.User })
  role: UserRole;

  @Exclude()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
