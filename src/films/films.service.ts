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
} from '../database/postgres-errors.js';
import { CreateFilmDto } from './dto/create-film.dto.js';
import { UpdateFilmDto } from './dto/update-film.dto.js';
import { Film } from './entities/film.entity.js';

@Injectable()
export class FilmsService {
  constructor(
    @InjectRepository(Film)
    private readonly filmsRepository: Repository<Film>,
  ) {}

  create(dto: CreateFilmDto): Promise<Film> {
    const film = this.filmsRepository.create({
      title: dto.title,
      durationMinutes: dto.durationMinutes,
      releaseYear: dto.releaseYear,
    });
    return this.filmsRepository.save(film);
  }

  findAll(): Promise<Film[]> {
    return this.filmsRepository.find({ order: { title: 'ASC', id: 'ASC' } });
  }

  findById(id: string): Promise<Film | null> {
    return this.filmsRepository.findOneBy({ id });
  }

  async findOne(id: string): Promise<Film> {
    const film = await this.findById(id);
    if (!film) {
      throw new NotFoundException(`Film with id "${id}" not found`);
    }
    return film;
  }

  async update(id: string, dto: UpdateFilmDto): Promise<Film> {
    const film = await this.findOne(id);
    this.filmsRepository.merge(film, {
      title: dto.title ?? film.title,
      durationMinutes: dto.durationMinutes ?? film.durationMinutes,
      releaseYear: dto.releaseYear ?? film.releaseYear,
    });
    return this.filmsRepository.save(film);
  }

  async remove(id: string): Promise<void> {
    try {
      const { affected } = await this.filmsRepository.delete({ id });
      if (!affected) {
        throw new NotFoundException(`Film with id "${id}" not found`);
      }
    } catch (error) {
      // showings.film_id is ON DELETE RESTRICT, so the database itself refuses.
      if (isPgError(error, PG_FOREIGN_KEY_VIOLATION)) {
        throw new ConflictException(
          `Film with id "${id}" is referenced by a showing and cannot be deleted`,
        );
      }
      throw error;
    }
  }
}
