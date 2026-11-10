import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { isPgError, PG_UNIQUE_VIOLATION } from '../database/postgres-errors.js';
import { Seat } from '../halls/entities/hall.entity.js';
import { HallsService } from '../halls/halls.service.js';
import { Showing } from '../showings/entities/showing.entity.js';
import { ShowingsService } from '../showings/showings.service.js';
import { UserRole } from '../users/entities/user.entity.js';
import {
  BookingResponseDto,
  ShowingSeat,
  UserBookingDto,
} from './dto/booking-response.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { BookingSeat } from './entities/booking-seat.entity.js';
import { Booking } from './entities/booking.entity.js';

const seatKey = ({ row, seat }: Seat) => `${row}:${seat}`;
const seatLabel = ({ row, seat }: Seat) => `row ${row} seat ${seat}`;
const bySeat = (a: Seat, b: Seat) => a.row - b.row || a.seat - b.seat;

@Injectable()
export class BookingsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(BookingSeat)
    private readonly seatsRepository: Repository<BookingSeat>,
    private readonly showingsService: ShowingsService,
    private readonly hallsService: HallsService,
  ) {}

  async create(
    showingId: string,
    userId: string,
    dto: CreateBookingDto,
  ): Promise<BookingResponseDto> {
    const showing = await this.showingsService.findById(showingId);
    const hall = await this.hallsService.findOne(showing.hallId);
    const seats = dto.seats.map(({ row, seat }) => ({ row, seat }));

    const outsideHall = seats.filter(
      (seat) => !this.hallsService.hasSeat(hall, seat),
    );
    if (outsideHall.length > 0) {
      throw new BadRequestException(
        `Hall "${hall.name}" has no ${outsideHall.map(seatLabel).join(', ')}`,
      );
    }

    try {
      // The booking and all of its seats are written atomically: if any seat
      // is already taken, the unique index fails the insert and the whole
      // transaction rolls back, leaving neither the booking nor any seat.
      const booking = await this.dataSource.transaction(async (manager) => {
        const booking = await manager.save(
          manager.create(Booking, {
            showingId,
            userId,
            totalPrice: showing.price * seats.length,
          }),
        );
        booking.seats = await manager.save(
          seats.map((seat) =>
            manager.create(BookingSeat, {
              bookingId: booking.id,
              showingId,
              row: seat.row,
              seat: seat.seat,
            }),
          ),
        );
        return booking;
      });
      return this.toResponse(booking);
    } catch (error) {
      if (isPgError(error, PG_UNIQUE_VIOLATION)) {
        throw new ConflictException(await this.describeTaken(showingId, seats));
      }
      throw error;
    }
  }

  async findAll(): Promise<BookingResponseDto[]> {
    const bookings = await this.bookingsRepository.find({
      relations: { seats: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return bookings.map((booking) => this.toResponse(booking));
  }

  async findByUser(userId: string): Promise<UserBookingDto[]> {
    const bookings = await this.bookingsRepository.find({
      where: { userId },
      relations: { seats: true, showing: { film: true, hall: true } },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return bookings.map((booking) => this.toUserBooking(booking));
  }

  async findByShowing(showingId: string): Promise<BookingResponseDto[]> {
    await this.showingsService.findById(showingId);
    const bookings = await this.bookingsRepository.find({
      where: { showingId },
      relations: { seats: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return bookings.map((booking) => this.toResponse(booking));
  }

  async findSeats(showingId: string): Promise<ShowingSeat[]> {
    const showing = await this.showingsService.findById(showingId);
    const hall = await this.hallsService.findOne(showing.hallId);
    const booked = await this.findBookedSeatKeys(showingId);
    return this.hallsService.listSeats(hall).map((seat) => ({
      ...seat,
      isBooked: booked.has(seatKey(seat)),
    }));
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const booking = await this.bookingsRepository.findOneBy({ id });
    if (!booking) {
      throw new NotFoundException(`Booking with id "${id}" not found`);
    }
    if (user.role !== UserRole.Admin && booking.userId !== user.id) {
      throw new ForbiddenException('You can cancel only your own bookings');
    }
    // booking_seats.booking_id is ON DELETE CASCADE, the seats go with the booking.
    await this.bookingsRepository.delete({ id });
  }

  private async findBookedSeatKeys(showingId: string): Promise<Set<string>> {
    const seats = await this.seatsRepository.find({
      select: { row: true, seat: true },
      where: { showingId },
    });
    return new Set(seats.map(seatKey));
  }

  // Builds the 409 message from data only, never from the database error text.
  private async describeTaken(showingId: string, seats: Seat[]) {
    const booked = await this.findBookedSeatKeys(showingId);
    const taken = seats.filter((seat) => booked.has(seatKey(seat)));
    return taken.length > 0
      ? `Already booked: ${taken.map(seatLabel).join(', ')}`
      : 'One or more seats are already booked';
  }

  private toResponse(booking: Booking): BookingResponseDto {
    return Object.assign(new BookingResponseDto(), {
      id: booking.id,
      showingId: booking.showingId,
      userId: booking.userId,
      seats: (booking.seats ?? [])
        .map(({ row, seat }) => ({ row, seat }))
        .sort(bySeat),
      totalPrice: booking.totalPrice,
    });
  }

  private toUserBooking(booking: Booking): UserBookingDto {
    const showing = booking.showing as Showing;
    return Object.assign(new UserBookingDto(), this.toResponse(booking), {
      showing: {
        id: showing.id,
        filmTitle: showing.film?.title as string,
        hallName: showing.hall?.name as string,
        startsAt: showing.startsAt,
        price: showing.price,
      },
    });
  }
}
