import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Showing } from '../../showings/entities/showing.entity.js';

@Entity('films')
export class Film {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Тіні забутих предків' })
  @Column({ type: 'varchar' })
  title: string;

  @ApiProperty({ example: 97, description: 'Тривалість у хвилинах' })
  @Column({ name: 'duration_minutes', type: 'integer' })
  durationMinutes: number;

  @ApiProperty({ example: 1965 })
  @Column({ name: 'release_year', type: 'integer' })
  releaseYear: number;

  @OneToMany(() => Showing, (showing) => showing.film)
  showings?: Relation<Showing>[];
}
