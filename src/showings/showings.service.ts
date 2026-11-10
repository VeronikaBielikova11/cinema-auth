import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { FilmsService } from '../films/films.service.js';
import { HallsService } from '../halls/halls.service.js';
import { CreateShowingDto } from './dto/create-showing.dto.js';
import { FindShowingsQueryDto } from './dto/find-showings-query.dto.js';
import { ShowingsPageDto } from './dto/showings-page.dto.js';
import { Showing, ShowingDetails } from './entities/showing.entity.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ShowingsService {
  constructor(
    @InjectRepository(Showing)
    private readonly showingsRepository: Repository<Showing>,
    private readonly filmsService: FilmsService,
    private readonly hallsService: HallsService,
  ) {}

  async create(dto: CreateShowingDto): Promise<Showing> {
    if (!(await this.filmsService.findById(dto.filmId))) {
      throw new BadRequestException(`Film with id "${dto.filmId}" not found`);
    }
    if (!(await this.hallsService.findById(dto.hallId))) {
      throw new BadRequestException(`Hall with id "${dto.hallId}" not found`);
    }
    const showing = this.showingsRepository.create({
      filmId: dto.filmId,
      hallId: dto.hallId,
      startsAt: new Date(dto.startsAt),
      price: dto.price,
    });
    const saved = await this.showingsRepository.save(showing);
    return {
      id: saved.id,
      filmId: saved.filmId,
      hallId: saved.hallId,
      startsAt: saved.startsAt,
      price: saved.price,
    };
  }

  async findAll({
    filmId,
    date,
    page,
    limit,
    sort,
  }: FindShowingsQueryDto): Promise<ShowingsPageDto> {
    // No showing can belong to a malformed film id; answer like for any unknown film.
    if (filmId !== undefined && !isUUID(filmId)) {
      return { items: [], total: 0, page, limit };
    }

    const direction = sort === 'desc' ? 'DESC' : 'ASC';
    const query = this.showingsRepository
      .createQueryBuilder('showing')
      .innerJoinAndSelect('showing.film', 'film')
      .innerJoinAndSelect('showing.hall', 'hall')
      .orderBy('showing.startsAt', direction)
      .addOrderBy('showing.id', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit);

    if (filmId) {
      query.andWhere('showing.filmId = :filmId', { filmId });
    }
    if (date) {
      // A half-open UTC day keeps the index on starts_at usable.
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      query.andWhere(
        'showing.startsAt >= :dayStart AND showing.startsAt < :dayEnd',
        {
          dayStart,
          dayEnd: new Date(dayStart.getTime() + DAY_MS),
        },
      );
    }

    const [showings, total] = await query.getManyAndCount();
    return {
      items: showings.map((showing) => this.toDetails(showing)),
      total,
      page,
      limit,
    };
  }

  async findById(id: string): Promise<Showing> {
    const showing = await this.showingsRepository.findOneBy({ id });
    if (!showing) {
      throw new NotFoundException(`Showing with id "${id}" not found`);
    }
    return showing;
  }

  async findOne(id: string): Promise<ShowingDetails> {
    const showing = await this.showingsRepository.findOne({
      where: { id },
      relations: { film: true, hall: true },
    });
    if (!showing) {
      throw new NotFoundException(`Showing with id "${id}" not found`);
    }
    return this.toDetails(showing);
  }

  private toDetails(showing: Showing): ShowingDetails {
    return {
      id: showing.id,
      filmTitle: showing.film!.title,
      hallName: showing.hall!.name,
      startsAt: showing.startsAt,
      price: showing.price,
    };
  }
}
