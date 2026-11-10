import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Showing } from '../../showings/entities/showing.entity.js';
import { Booking } from './booking.entity.js';

// One row is one seat taken by one booking on one showing.
// showing_id is duplicated from the booking on purpose: the unique index below
// lets the database itself refuse to sell the same seat twice.
@Entity('booking_seats')
@Index('UQ_booking_seats_showing_row_seat', ['showingId', 'row', 'seat'], {
  unique: true,
})
export class BookingSeat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @Column({ name: 'showing_id', type: 'uuid' })
  showingId: string;

  @Column({ type: 'integer' })
  row: number;

  @Column({ type: 'integer' })
  seat: number;

  @ManyToOne(() => Booking, (booking) => booking.seats, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_id' })
  booking?: Relation<Booking>;

  @ManyToOne(() => Showing, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'showing_id' })
  showing?: Relation<Showing>;
}
