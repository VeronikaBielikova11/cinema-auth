import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { AdminOnly } from '../auth/decorators/roles.decorator.js';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { CreateShowingDto } from './dto/create-showing.dto.js';
import { FindShowingsQueryDto } from './dto/find-showings-query.dto.js';
import { ShowingsPageDto } from './dto/showings-page.dto.js';
import { Showing, ShowingDetails } from './entities/showing.entity.js';
import { ShowingsService } from './showings.service.js';

@ApiTags('showings')
@Controller('showings')
export class ShowingsController {
  constructor(private readonly showingsService: ShowingsService) {}

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Створити сеанс' })
  @ApiCreatedResponse({ type: Showing, description: 'Сеанс створено' })
  @ApiBadRequestResponse({
    description:
      'Фільму або залу немає, startsAt некоректний чи в минулому, price не є цілим додатним',
  })
  create(@Body() dto: CreateShowingDto): Promise<Showing> {
    return this.showingsService.create(dto);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Отримати розклад сеансів',
    description:
      'Фільтрація за фільмом і добою, посторінкова видача, сортування за часом початку. Сеанси з однаковим часом упорядковані за id.',
  })
  @ApiOkResponse({
    type: ShowingsPageDto,
    description: 'Сторінка сеансів і загальна кількість',
  })
  @ApiBadRequestResponse({
    description:
      'page чи limit не є цілим числом або поза межами, date не відповідає YYYY-MM-DD, sort не asc і не desc',
  })
  findAll(@Query() query: FindShowingsQueryDto): Promise<ShowingsPageDto> {
    return this.showingsService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Отримати сеанс' })
  @ApiOkResponse({ type: ShowingDetails, description: 'Сеанс' })
  @ApiNotFoundResponse({ description: 'Сеансу з таким id немає' })
  findOne(@Param('id', parseIdPipe) id: string): Promise<ShowingDetails> {
    return this.showingsService.findOne(id);
  }
}
