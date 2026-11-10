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
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import {
  AdminOnly,
  Authenticated,
} from '../auth/decorators/roles.decorator.js';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import {
  BookingResponseDto,
  ShowingSeat,
  UserBookingDto,
} from './dto/booking-response.dto.js';

@ApiTags('bookings')
@Controller()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('bookings')
  @AdminOnly()
  @ApiOperation({ summary: 'Отримати всі бронювання' })
  @ApiOkResponse({ type: [BookingResponseDto], description: 'Масив бронювань' })
  findAll(): Promise<BookingResponseDto[]> {
    return this.bookingsService.findAll();
  }

  @Get('bookings/my')
  @Authenticated()
  @ApiOperation({ summary: 'Отримати власні бронювання' })
  @ApiOkResponse({
    type: [UserBookingDto],
    description: 'Масив бронювань поточного користувача з даними сеансу',
  })
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<UserBookingDto[]> {
    return this.bookingsService.findByUser(user.id);
  }

  @Post('showings/:id/bookings')
  @Authenticated()
  @ApiOperation({ summary: 'Забронювати місця на сеанс' })
  @ApiCreatedResponse({
    type: BookingResponseDto,
    description: 'Бронювання створено',
  })
  @ApiBadRequestResponse({
    description:
      'Масив порожній, елемент некоректний, місце повторюється або його немає в залі',
  })
  @ApiNotFoundResponse({ description: 'Сеансу з таким id немає' })
  @ApiConflictResponse({
    description:
      'Місце вже заброньоване, жодне місце зі списку не бронюється (транзакція відкочується)',
  })
  create(
    @Param('id', parseIdPipe) showingId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.create(showingId, user.id, dto);
  }

  @Get('showings/:id/bookings')
  @AdminOnly()
  @ApiOperation({ summary: 'Отримати бронювання сеансу' })
  @ApiOkResponse({
    type: [BookingResponseDto],
    description: 'Масив бронювань сеансу',
  })
  @ApiNotFoundResponse({ description: 'Сеансу з таким id немає' })
  findByShowing(
    @Param('id', parseIdPipe) showingId: string,
  ): Promise<BookingResponseDto[]> {
    return this.bookingsService.findByShowing(showingId);
  }

  @Public()
  @Get('showings/:id/seats')
  @ApiOperation({ summary: 'Отримати місця залу із зайнятістю на сеансі' })
  @ApiOkResponse({ type: [ShowingSeat], description: 'Усі місця залу' })
  @ApiNotFoundResponse({ description: 'Сеансу з таким id немає' })
  findSeats(
    @Param('id', parseIdPipe) showingId: string,
  ): Promise<ShowingSeat[]> {
    return this.bookingsService.findSeats(showingId);
  }

  @Delete('bookings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authenticated()
  @ApiOperation({
    summary: 'Скасувати бронювання',
    description: 'Користувач скасовує власне, адміністратор будь-яке.',
  })
  @ApiNoContentResponse({ description: 'Бронювання скасовано' })
  @ApiForbiddenResponse({
    description: 'Бронювання належить іншому користувачу',
  })
  @ApiNotFoundResponse({ description: 'Бронювання з таким id немає' })
  remove(
    @Param('id', parseIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.bookingsService.remove(id, user);
  }
}
