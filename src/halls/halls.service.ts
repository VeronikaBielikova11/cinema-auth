import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  isPgError,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from '../database/postgres-errors.js';
import { CreateHallDto } from './dto/create-hall.dto.js';
import { Hall, HallWithSeats, Seat } from './entities/hall.entity.js';

@Injectable()
export class HallsService {
  constructor(
    @InjectRepository(Hall)
    private readonly hallsRepository: Repository<Hall>,
  ) {}

  async create(dto: CreateHallDto): Promise<Hall> {
    const hall = this.hallsRepository.create({
      name: dto.name,
      rows: dto.rows,
      seatsPerRow: dto.seatsPerRow,
    });
    try {
      // The unique constraint on halls.name settles the race between two
      // requests with the same name, so there is no separate lookup first.
      return await this.hallsRepository.save(hall);
    } catch (error) {
      if (isPgError(error, PG_UNIQUE_VIOLATION)) {
        throw new ConflictException(`Hall named "${dto.name}" already exists`);
      }
      throw error;
    }
  }

  findAll(): Promise<Hall[]> {
    return this.hallsRepository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<Hall | null> {
    return this.hallsRepository.findOneBy({ id });
  }

  async findOne(id: string): Promise<Hall> {
    const hall = await this.findById(id);
    if (!hall) {
      throw new NotFoundException(`Hall with id "${id}" not found`);
    }
    return hall;
  }

  async findOneWithSeats(id: string): Promise<HallWithSeats> {
    const hall = await this.findOne(id);
    return { ...hall, seats: this.listSeats(hall) };
  }

  listSeats(hall: Hall): Seat[] {
    const seats: Seat[] = [];
    for (let row = 1; row <= hall.rows; row++) {
      for (let seat = 1; seat <= hall.seatsPerRow; seat++) {
        seats.push({ row, seat });
      }
    }
    return seats;
  }

  hasSeat(hall: Hall, { row, seat }: Seat): boolean {
    return row <= hall.rows && seat <= hall.seatsPerRow;
  }

  async remove(id: string): Promise<void> {
    try {
      const { affected } = await this.hallsRepository.delete({ id });
      if (!affected) {
        throw new NotFoundException(`Hall with id "${id}" not found`);
      }
    } catch (error) {
      // showings.hall_id is ON DELETE RESTRICT, so the database itself refuses.
      if (isPgError(error, PG_FOREIGN_KEY_VIOLATION)) {
        throw new ConflictException(
          `Hall with id "${id}" is referenced by a showing and cannot be deleted`,
        );
      }
      throw error;
    }
  }
}
