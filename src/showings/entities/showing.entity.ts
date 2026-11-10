import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity.js';
import { Film } from '../../films/entities/film.entity.js';
import { Hall } from '../../halls/entities/hall.entity.js';

@Entity('showings')
@Index(['startsAt', 'id'])
export class Showing {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'film_id', type: 'uuid' })
  filmId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'hall_id', type: 'uuid' })
  hallId: string;

  @ApiProperty({
    example: '2030-06-15T18:00:00.000Z',
    description: 'Початок сеансу в UTC',
  })
  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @ApiProperty({ example: 12500, description: 'Ціна квитка в копійках' })
  @Column({ type: 'integer' })
  price: number;

  // RESTRICT: a film or hall with showings cannot be deleted, showings are never cascaded away.
  @ManyToOne(() => Film, (film) => film.showings, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'film_id' })
  film?: Relation<Film>;

  @ManyToOne(() => Hall, (hall) => hall.showings, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'hall_id' })
  hall?: Relation<Hall>;

  @OneToMany(() => Booking, (booking) => booking.showing)
  bookings?: Relation<Booking>[];
}

export class ShowingDetails {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Тіні забутих предків' })
  filmTitle: string;

  @ApiProperty({ example: 'Синій зал' })
  hallName: string;

  @ApiProperty({
    example: '2030-06-15T18:00:00.000Z',
    description: 'Початок сеансу в UTC',
  })
  startsAt: Date;

  @ApiProperty({ example: 12500, description: 'Ціна квитка в копійках' })
  price: number;
}
