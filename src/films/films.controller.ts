import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { AdminOnly } from '../auth/decorators/roles.decorator.js';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { CreateFilmDto } from './dto/create-film.dto.js';
import { UpdateFilmDto } from './dto/update-film.dto.js';
import { Film } from './entities/film.entity.js';
import { FilmsService } from './films.service.js';

@ApiTags('films')
@Controller('films')
export class FilmsController {
  constructor(private readonly filmsService: FilmsService) {}

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Створити фільм' })
  @ApiCreatedResponse({ type: Film, description: 'Фільм створено' })
  @ApiBadRequestResponse({
    description: 'Поле відсутнє або має неправильний тип',
  })
  create(@Body() dto: CreateFilmDto): Promise<Film> {
    return this.filmsService.create(dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Отримати всі фільми' })
  @ApiOkResponse({ type: [Film], description: 'Масив фільмів' })
  findAll(): Promise<Film[]> {
    return this.filmsService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Отримати фільм' })
  @ApiOkResponse({ type: Film, description: 'Фільм' })
  @ApiNotFoundResponse({ description: 'Фільму з таким id немає' })
  findOne(@Param('id', parseIdPipe) id: string): Promise<Film> {
    return this.filmsService.findOne(id);
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Оновити фільм' })
  @ApiOkResponse({ type: Film, description: 'Оновлений фільм' })
  @ApiBadRequestResponse({ description: 'Поле має неправильний тип' })
  @ApiNotFoundResponse({ description: 'Фільму з таким id немає' })
  update(
    @Param('id', parseIdPipe) id: string,
    @Body() dto: UpdateFilmDto,
  ): Promise<Film> {
    return this.filmsService.update(id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Видалити фільм' })
  @ApiNoContentResponse({ description: 'Фільм видалено' })
  @ApiNotFoundResponse({ description: 'Фільму з таким id немає' })
  @ApiConflictResponse({ description: 'На фільм посилається сеанс' })
  remove(@Param('id', parseIdPipe) id: string): Promise<void> {
    return this.filmsService.remove(id);
  }
}
