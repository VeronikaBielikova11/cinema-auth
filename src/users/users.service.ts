import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isPgError, PG_UNIQUE_VIOLATION } from '../database/postgres-errors.js';
import { User, UserRole } from './entities/user.entity.js';
import { hashPassword } from './password.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(email: string, password: string): Promise<User> {
    const user = this.usersRepository.create({
      email,
      passwordHash: await hashPassword(password),
      role: UserRole.User,
    });
    try {
      // The unique index decides, so two simultaneous registrations cannot both win.
      return await this.usersRepository.save(user);
    } catch (error) {
      if (isPgError(error, PG_UNIQUE_VIOLATION)) {
        throw new ConflictException(
          `User with email "${email}" already exists`,
        );
      }
      throw error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }
}
