import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilmsModule } from '../films/films.module.js';
import { HallsModule } from '../halls/halls.module.js';
import { Showing } from './entities/showing.entity.js';
import { ShowingsController } from './showings.controller.js';
import { ShowingsService } from './showings.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Showing]), FilmsModule, HallsModule],
  controllers: [ShowingsController],
  providers: [ShowingsService],
  exports: [ShowingsService],
})
export class ShowingsModule {}
