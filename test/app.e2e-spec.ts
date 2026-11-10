import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';
import { User, UserRole } from './../src/users/entities/user.entity.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('Cinema API (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  // These tests cover the domain logic, so they act as an administrator.
  // Access rules are covered in auth.e2e-spec.ts.
  const api = () =>
    request
      .agent(app.getHttpServer())
      .set('Authorization', `Bearer ${adminToken}`);

  const createFilm = async (title = 'Film') =>
    (
      await api()
        .post('/films')
        .send({ title, durationMinutes: 90, releaseYear: 2000 })
        .expect(201)
    ).body;

  let hallCounter = 0;
  const createHall = async (rows = 3, seatsPerRow = 5) =>
    (
      await api()
        .post('/halls')
        .send({ name: `Hall ${++hallCounter}`, rows, seatsPerRow })
        .expect(201)
    ).body;

  const createShowing = async (
    filmId: string,
    hallId: string,
    startsAt = '2030-06-15T18:00:00.000Z',
    price = 12500,
  ) =>
    (
      await api()
        .post('/showings')
        .send({ filmId, hallId, startsAt, price })
        .expect(201)
    ).body;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    await app
      .get(DataSource)
      .query(
        'TRUNCATE booking_seats, bookings, showings, halls, films, refresh_tokens, users',
      );
    const admin = await app.get(DataSource).getRepository(User).save({
      email: 'admin@example.com',
      passwordHash: 'not-used-in-these-tests',
      role: UserRole.Admin,
    });
    adminToken = app.get(JwtService).sign({ sub: admin.id, role: admin.role });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('films', () => {
    it('strips unknown fields on create', async () => {
      const { body } = await api()
        .post('/films')
        .send({ title: 'A', durationMinutes: 1, releaseYear: 2000, extra: 1 })
        .expect(201);
      expect(body).toEqual({
        id: expect.any(String),
        title: 'A',
        durationMinutes: 1,
        releaseYear: 2000,
      });
    });

    it.each([
      [{}],
      [{ title: 'A', durationMinutes: '90', releaseYear: 2000 }],
      [{ title: 'A', durationMinutes: 90 }],
      [{ title: 1, durationMinutes: 90, releaseYear: 2000 }],
      [{ title: '   ', durationMinutes: 90, releaseYear: 2000 }],
      [{ title: 'A', durationMinutes: 1.5, releaseYear: 2000 }],
    ])('rejects invalid create body %j', async (body) => {
      await api().post('/films').send(body).expect(400);
    });

    it('rejects a request without a body', async () => {
      await api().post('/films').expect(400);
    });

    it('returns 404 for missing and malformed ids', async () => {
      await api().get(`/films/${MISSING_ID}`).expect(404);
      await api().get('/films/not-a-uuid').expect(404);
    });

    it('patches only the provided fields', async () => {
      const film = await createFilm('Old');
      const { body } = await api()
        .patch(`/films/${film.id}`)
        .send({ durationMinutes: 120 })
        .expect(200);
      expect(body).toEqual({ ...film, durationMinutes: 120 });
    });

    it('rejects null and wrong types on patch', async () => {
      const film = await createFilm();
      await api().patch(`/films/${film.id}`).send({ title: null }).expect(400);
      await api()
        .patch(`/films/${film.id}`)
        .send({ releaseYear: '2000' })
        .expect(400);
      await api().get(`/films/${film.id}`).expect(200, film);
    });

    it('returns 404 on patch and delete of a missing film', async () => {
      await api()
        .patch(`/films/${MISSING_ID}`)
        .send({ title: 'A' })
        .expect(404);
      await api().delete(`/films/${MISSING_ID}`).expect(404);
    });

    it('blocks deleting a referenced film', async () => {
      const film = await createFilm();
      const hall = await createHall();
      await createShowing(film.id, hall.id);
      await api().delete(`/films/${film.id}`).expect(409);
    });

    it('deletes a free film with an empty 204', async () => {
      const film = await createFilm();
      const { body, text } = await api()
        .delete(`/films/${film.id}`)
        .expect(204);
      expect(body).toEqual({});
      expect(text).toBe('');
      await api().get('/films').expect(200, []);
    });
  });

  describe('halls', () => {
    it('computes the seat list only for a single hall', async () => {
      const hall = await createHall(3, 5);
      await api().get('/halls').expect(200, [hall]);
      const { body } = await api().get(`/halls/${hall.id}`).expect(200);
      expect(body.seats).toHaveLength(15);
      expect(body.seats[0]).toEqual({ row: 1, seat: 1 });
      expect(body.seats[14]).toEqual({ row: 3, seat: 5 });
    });

    it.each([
      [{ name: 'A', rows: 3 }],
      [{ name: 'A', rows: '3', seatsPerRow: 5 }],
      [{ name: 'A', rows: 2.5, seatsPerRow: 5 }],
      [{ name: 'A', rows: 0, seatsPerRow: 5 }],
      [{ name: 'A', rows: 3, seatsPerRow: -1 }],
      [{ name: 'A', rows: 1e9, seatsPerRow: 1e9 }],
    ])('rejects invalid body %j', async (body) => {
      await api().post('/halls').send(body).expect(400);
    });

    it('requires a unique name, ignoring outer spaces', async () => {
      const hall = await createHall();
      await api()
        .post('/halls')
        .send({ name: ` ${hall.name} `, rows: 1, seatsPerRow: 1 })
        .expect(409);
    });

    it('frees the name of a deleted hall', async () => {
      const hall = await createHall();
      await api().delete(`/halls/${hall.id}`).expect(204);
      await api()
        .post('/halls')
        .send({ name: hall.name, rows: 1, seatsPerRow: 1 })
        .expect(201);
    });

    it('returns 404 and 409 on delete', async () => {
      const hall = await createHall();
      await createShowing((await createFilm()).id, hall.id);
      await api().delete(`/halls/${MISSING_ID}`).expect(404);
      await api().delete(`/halls/${hall.id}`).expect(409);
    });
  });

  describe('showings', () => {
    it('names the missing record with a 400', async () => {
      const film = await createFilm();
      const hall = await createHall();
      const startsAt = '2030-06-15T18:00:00.000Z';
      const noFilm = await api()
        .post('/showings')
        .send({ filmId: MISSING_ID, hallId: hall.id, startsAt, price: 1 })
        .expect(400);
      expect(noFilm.body.message).toContain('Film');
      const noHall = await api()
        .post('/showings')
        .send({ filmId: film.id, hallId: MISSING_ID, startsAt, price: 1 })
        .expect(400);
      expect(noHall.body.message).toContain('Hall');
    });

    it.each([
      ['garbage', 12500],
      ['2030-02-30T10:00:00.000Z', 12500],
      ['2030-123', 12500],
      ['2020-01-01T10:00:00.000Z', 12500],
      [12345, 12500],
      ['2030-06-15T18:00:00.000Z', 0],
      ['2030-06-15T18:00:00.000Z', 125.5],
      ['2030-06-15T18:00:00.000Z', '12500'],
    ])('rejects startsAt=%j price=%j', async (startsAt, price) => {
      const film = await createFilm();
      const hall = await createHall();
      await api()
        .post('/showings')
        .send({ filmId: film.id, hallId: hall.id, startsAt, price })
        .expect(400);
    });

    it('filters, sorts by instant and shows current names', async () => {
      const first = await createFilm('First');
      const second = await createFilm('Second');
      const hall = await createHall();
      const late = await createShowing(
        first.id,
        hall.id,
        '2030-06-15T20:00:00.000Z',
      );
      // 19:00 UTC, though its local time reads later than the 20:00 UTC showing
      const early = await createShowing(
        second.id,
        hall.id,
        '2030-06-15T22:00:00+03:00',
      );
      const nextDay = await createShowing(
        first.id,
        hall.id,
        '2030-06-16T00:30:00.000Z',
      );

      const ids = async (query: string) =>
        (await api().get(`/showings${query}`).expect(200)).body.items.map(
          (showing: { id: string }) => showing.id,
        );

      expect(await ids('')).toEqual([early.id, late.id, nextDay.id]);
      expect(await ids(`?filmId=${first.id}`)).toEqual([late.id, nextDay.id]);
      expect(await ids('?date=2030-06-15')).toEqual([early.id, late.id]);
      expect(await ids(`?filmId=${first.id}&date=2030-06-16`)).toEqual([
        nextDay.id,
      ]);
      expect(await ids('?date=2031-01-01')).toEqual([]);

      await api()
        .patch(`/films/${first.id}`)
        .send({ title: 'Renamed' })
        .expect(200);
      const { body } = await api().get(`/showings/${late.id}`).expect(200);
      expect(body).toEqual({
        id: late.id,
        filmTitle: 'Renamed',
        hallName: hall.name,
        startsAt: '2030-06-15T20:00:00.000Z',
        price: 12500,
      });
    });

    it('orders showings with equal start time by id', async () => {
      const film = await createFilm();
      const hall = await createHall();
      const created = [
        await createShowing(film.id, hall.id),
        await createShowing(film.id, hall.id),
        await createShowing(film.id, hall.id),
        await createShowing(film.id, hall.id),
      ];
      const { body } = await api().get('/showings').expect(200);
      expect(body.items.map((showing: { id: string }) => showing.id)).toEqual(
        created.map((showing) => showing.id).sort(),
      );
    });

    describe('pagination and sorting', () => {
      let created: { id: string; startsAt: string }[];

      beforeEach(async () => {
        const film = await createFilm();
        const hall = await createHall();
        created = [];
        for (let day = 10; day < 15; day++) {
          created.push(
            await createShowing(
              film.id,
              hall.id,
              `2030-07-${day}T18:00:00.000Z`,
            ),
          );
        }
      });

      const ids = (items: { id: string }[]) => items.map((item) => item.id);

      it('returns the page envelope with defaults', async () => {
        const { body } = await api().get('/showings').expect(200);
        expect(body).toMatchObject({ total: 5, page: 1, limit: 20 });
        expect(ids(body.items)).toEqual(ids(created));
      });

      it('slices pages in the database', async () => {
        const second = await api().get('/showings?page=2&limit=2').expect(200);
        expect(second.body).toMatchObject({ total: 5, page: 2, limit: 2 });
        expect(ids(second.body.items)).toEqual(ids(created.slice(2, 4)));

        const beyond = await api().get('/showings?page=4&limit=2').expect(200);
        expect(beyond.body).toEqual({ items: [], total: 5, page: 4, limit: 2 });
      });

      it('sorts by start time in both directions', async () => {
        const desc = await api().get('/showings?sort=desc&limit=3').expect(200);
        expect(ids(desc.body.items)).toEqual(
          ids([...created].reverse().slice(0, 3)),
        );
        const asc = await api().get('/showings?sort=asc&limit=1').expect(200);
        expect(ids(asc.body.items)).toEqual([created[0].id]);
      });

      it('counts only filtered showings', async () => {
        const { body } = await api()
          .get('/showings?date=2030-07-12&limit=1')
          .expect(200);
        expect(body.total).toBe(1);
        expect(ids(body.items)).toEqual([created[2].id]);
      });

      it.each([
        'page=0',
        'page=-1',
        'page=1.5',
        'page=abc',
        'page=',
        'limit=0',
        'limit=101',
        'limit=2.5',
        'limit=ten',
        'sort=up',
        'sort=ASC',
      ])('rejects %s with a 400', async (query) => {
        await api().get(`/showings?${query}`).expect(400);
      });

      it('accepts the limit bounds', async () => {
        await api().get('/showings?limit=1').expect(200);
        await api().get('/showings?limit=100').expect(200);
      });
    });

    it.each(['15.06.2030', '2030-6-15', '2030-02-30', '2030-13-01', ''])(
      'rejects date=%s',
      async (date) => {
        await api().get('/showings').query({ date }).expect(400);
      },
    );

    it('returns 404 for a missing showing', async () => {
      await api().get(`/showings/${MISSING_ID}`).expect(404);
      await api().get(`/showings/${MISSING_ID}/seats`).expect(404);
    });
  });

  describe('bookings', () => {
    let showing: { id: string };

    const book = (seats: unknown, showingId = showing.id) =>
      api().post(`/showings/${showingId}/bookings`).send({ seats });

    const bookedSeats = async (showingId = showing.id) => {
      const { body } = await api().get(`/showings/${showingId}/seats`);
      return body
        .filter((seat: { isBooked: boolean }) => seat.isBooked)
        .map(
          (seat: { row: number; seat: number }) => `${seat.row}-${seat.seat}`,
        );
    };

    beforeEach(async () => {
      const film = await createFilm();
      const hall = await createHall(3, 5);
      showing = await createShowing(film.id, hall.id);
    });

    it('creates a booking with the total price', async () => {
      const { body } = await book([
        { row: 1, seat: 1, extra: 'x' },
        { row: 1, seat: 2 },
      ]).expect(201);
      expect(body).toEqual({
        id: expect.any(String),
        showingId: showing.id,
        userId: expect.any(String),
        seats: [
          { row: 1, seat: 1 },
          { row: 1, seat: 2 },
        ],
        totalPrice: 25000,
      });
      await api().get('/bookings').expect(200, [body]);
      await api().get(`/showings/${showing.id}/bookings`).expect(200, [body]);
      expect(await bookedSeats()).toEqual(['1-1', '1-2']);
    });

    it('returns the whole seat map of the hall', async () => {
      const { body } = await api()
        .get(`/showings/${showing.id}/seats`)
        .expect(200);
      expect(body).toHaveLength(15);
      expect(body[0]).toEqual({ row: 1, seat: 1, isBooked: false });
    });

    it.each([
      ['missing array', undefined],
      ['not an array', 'abc'],
      ['empty array', []],
      ['null element', [null]],
      ['primitive element', [1]],
      ['no seat number', [{ row: 1 }]],
      ['string number', [{ row: '1', seat: 1 }]],
      [
        'duplicates',
        [
          { row: 1, seat: 1 },
          { row: 1, seat: 1 },
        ],
      ],
      ['zero', [{ row: 0, seat: 1 }]],
      ['negative', [{ row: 1, seat: -1 }]],
      ['fraction', [{ row: 1.5, seat: 1 }]],
      ['row out of hall', [{ row: 4, seat: 1 }]],
      ['seat out of hall', [{ row: 1, seat: 6 }]],
    ])('rejects %s with a 400', async (_, seats) => {
      await book(seats).expect(400);
      expect(await bookedSeats()).toEqual([]);
    });

    it('answers 409 without database error text', async () => {
      await book([{ row: 1, seat: 1 }]).expect(201);
      const { body } = await book([{ row: 1, seat: 1 }]).expect(409);
      expect(body).toEqual({
        statusCode: 409,
        message: 'Already booked: row 1 seat 1',
        error: 'Conflict',
        path: `/showings/${showing.id}/bookings`,
        timestamp: expect.any(String),
      });
      expect(JSON.stringify(body)).not.toMatch(/duplicate|constraint|23505/i);
    });

    it('lets only one of concurrent bookings of a seat win', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          book([
            { row: 3, seat: 5 },
            { row: 2, seat: index + 1 },
          ]),
        ),
      );
      const statuses = results
        .map((result) => result.status)
        .sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409, 409, 409, 409]);
      const { body } = await api().get(`/showings/${showing.id}/bookings`);
      expect(body).toHaveLength(1);
      expect(await bookedSeats()).toHaveLength(2);
    });

    it('books nothing when one of the seats is taken', async () => {
      await book([{ row: 1, seat: 1 }]).expect(201);
      await book([
        { row: 2, seat: 2 },
        { row: 1, seat: 1 },
      ]).expect(409);
      expect(await bookedSeats()).toEqual(['1-1']);
    });

    it('keeps occupancy separate per showing', async () => {
      const film = await createFilm();
      const hall = await createHall(1, 1);
      const a = await createShowing(film.id, hall.id);
      const b = await createShowing(film.id, hall.id);
      await book([{ row: 1, seat: 1 }], a.id).expect(201);
      await book([{ row: 1, seat: 1 }], b.id).expect(201);
      const { body } = await api()
        .get(`/showings/${a.id}/bookings`)
        .expect(200);
      expect(body).toHaveLength(1);
    });

    it('frees seats after cancelling', async () => {
      const { body } = await book([{ row: 1, seat: 1 }]).expect(201);
      await api().delete(`/bookings/${body.id}`).expect(204);
      expect(await bookedSeats()).toEqual([]);
      await book([{ row: 1, seat: 1 }]).expect(201);
    });

    it('returns 404 for missing records', async () => {
      await book([{ row: 1, seat: 1 }], MISSING_ID).expect(404);
      await api().get(`/showings/${MISSING_ID}/bookings`).expect(404);
      await api().delete(`/bookings/${MISSING_ID}`).expect(404);
    });
  });

  it('gives every error the same shape', async () => {
    const { body } = await api().get(`/films/${MISSING_ID}`).expect(404);
    expect(body).toEqual({
      statusCode: 404,
      message: `Film with id "${MISSING_ID}" not found`,
      error: 'Not Found',
      path: `/films/${MISSING_ID}`,
      timestamp: expect.any(String),
    });
    const invalid = await api().post('/films').send({}).expect(400);
    expect(invalid.body).toMatchObject({
      statusCode: 400,
      path: '/films',
      message: expect.any(Array),
    });
  });

  it('serves the API docs with response codes', async () => {
    await api().get('/docs').expect(200);
    const { body } = await api().get('/docs-json').expect(200);
    expect(Object.keys(body.paths['/films/{id}'].delete.responses)).toEqual([
      '204',
      '401',
      '403',
      '404',
      '409',
    ]);
    expect(
      body.components.schemas.CreateBookingDto.properties.seats,
    ).toBeDefined();
    expect(
      Object.keys(body.components.schemas.ShowingsPageDto.properties),
    ).toEqual(['items', 'total', 'page', 'limit']);
    const params = body.paths['/showings'].get.parameters.map(
      (param: { name: string }) => param.name,
    );
    expect(params).toEqual(
      expect.arrayContaining(['filmId', 'date', 'page', 'limit', 'sort']),
    );
  });
});
