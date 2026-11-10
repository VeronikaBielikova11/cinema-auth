import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { CreateHallDto } from './dto/create-hall.dto.js';
import { Hall, HallWithSeats } from './entities/hall.entity.js';
import { HallsService } from './halls.service.js';

@ApiTags('halls')
@Controller('halls')
export class HallsController {
  constructor(private readonly hallsService: HallsService) {}

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Створити зал' })
  @ApiCreatedResponse({ type: Hall, description: 'Зал створено' })
  @ApiBadRequestResponse({
    description:
      'Поле відсутнє, має неправильний тип або число не є цілим додатним',
  })
  @ApiConflictResponse({ description: 'Зал з такою назвою вже існує' })
  create(@Body() dto: CreateHallDto): Promise<Hall> {
    return this.hallsService.create(dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Отримати всі зали' })
  @ApiOkResponse({ type: [Hall], description: 'Масив залів' })
  findAll(): Promise<Hall[]> {
    return this.hallsService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Отримати зал із переліком місць' })
  @ApiOkResponse({ type: HallWithSeats, description: 'Зал і його місця' })
  @ApiNotFoundResponse({ description: 'Залу з таким id немає' })
  findOne(@Param('id', parseIdPipe) id: string): Promise<HallWithSeats> {
    return this.hallsService.findOneWithSeats(id);
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Видалити зал' })
  @ApiNoContentResponse({ description: 'Зал видалено' })
  @ApiNotFoundResponse({ description: 'Залу з таким id немає' })
  @ApiConflictResponse({ description: 'На зал посилається сеанс' })
  remove(@Param('id', parseIdPipe) id: string): Promise<void> {
    return this.hallsService.remove(id);
  }
}
