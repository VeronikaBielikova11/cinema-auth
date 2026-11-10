import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';
import { RefreshToken } from './../src/auth/entities/refresh-token.entity.js';
import { User, UserRole } from './../src/users/entities/user.entity.js';

const PASSWORD = 'password123';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  const api = () => request(app.getHttpServer());
  const bearer = (token: string) =>
    ['Authorization', `Bearer ${token}`] as const;

  let counter = 0;
  const register = async (email = `user${++counter}@example.com`) =>
    (
      await api()
        .post('/auth/register')
        .send({ email, password: PASSWORD })
        .expect(201)
    ).body as { id: string; email: string; role: string };

  const login = async (email: string, password = PASSWORD) =>
    (await api().post('/auth/login').send({ email, password }).expect(200))
      .body as {
      accessToken: string;
      refreshToken: string;
    };

  const newUser = async () => {
    const user = await register();
    return { ...user, ...(await login(user.email)) };
  };

  const newAdmin = async () => {
    const user = await register();
    await db.getRepository(User).update(user.id, { role: UserRole.Admin });
    return { ...user, ...(await login(user.email)) };
  };

  const createShowing = async (adminToken: string) => {
    const film = await api()
      .post('/films')
      .set(...bearer(adminToken))
      .send({ title: 'Film', durationMinutes: 90, releaseYear: 2000 })
      .expect(201);
    const hall = await api()
      .post('/halls')
      .set(...bearer(adminToken))
      .send({ name: `Hall ${++counter}`, rows: 3, seatsPerRow: 5 })
      .expect(201);
    const showing = await api()
      .post('/showings')
      .set(...bearer(adminToken))
      .send({
        filmId: film.body.id,
        hallId: hall.body.id,
        startsAt: '2030-06-15T18:00:00.000Z',
        price: 100,
      })
      .expect(201);
    return showing.body.id as string;
  };

  const book = async (token: string, showingId: string, row = 1, seat = 1) =>
    (
      await api()
        .post(`/showings/${showingId}/bookings`)
        .set(...bearer(token))
        .send({ seats: [{ row, seat }] })
        .expect(201)
    ).body as { id: string; userId: string };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    db = app.get(DataSource);
    await db.query(
      'TRUNCATE booking_seats, bookings, showings, halls, films, refresh_tokens, users',
    );
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('creates a user with a bcrypt hash and hides it from the response', async () => {
      const { body } = await api()
        .post('/auth/register')
        .send({ email: 'a@example.com', password: PASSWORD })
        .expect(201);
      expect(body).toEqual({
        id: expect.any(String),
        email: 'a@example.com',
        role: 'user',
      });
      const user = await db
        .getRepository(User)
        .findOneByOrFail({ id: body.id });
      expect(user.passwordHash).not.toBe(PASSWORD);
      expect(await bcrypt.compare(PASSWORD, user.passwordHash)).toBe(true);
    });

    it('ignores a role passed in the body', async () => {
      const { body } = await api()
        .post('/auth/register')
        .send({ email: 'a@example.com', password: PASSWORD, role: 'admin' })
        .expect(201);
      expect(body.role).toBe('user');
    });

    it.each([
      [{ email: 'not-an-email', password: PASSWORD }],
      [{ email: 'a@example.com', password: 'short' }],
      [{ password: PASSWORD }],
      [{ email: 'a@example.com' }],
    ])('rejects %j with 400', async (body) => {
      await api().post('/auth/register').send(body).expect(400);
    });

    it('returns 409 for a taken email, whatever its case', async () => {
      await register('a@example.com');
      await api()
        .post('/auth/register')
        .send({ email: 'A@Example.com', password: PASSWORD })
        .expect(409);
    });

    it('lets exactly one of two simultaneous registrations win', async () => {
      const send = () =>
        api()
          .post('/auth/register')
          .send({ email: 'a@example.com', password: PASSWORD });
      const statuses = (await Promise.all([send(), send()])).map(
        (r) => r.status,
      );
      expect(statuses.sort((a, b) => a - b)).toEqual([201, 409]);
    });
  });

  describe('POST /auth/login', () => {
    it('returns a token pair with id and role in the access token', async () => {
      const user = await register();
      const { accessToken, refreshToken } = await login(user.email);
      const payload = app.get(JwtService).decode(accessToken);
      expect(payload).toMatchObject({ sub: user.id, role: 'user' });
      expect(refreshToken.split('.')).toHaveLength(1);
    });

    it('stores only a sha-256 hash of the refresh token', async () => {
      const user = await register();
      const { refreshToken } = await login(user.email);
      const [row] = await db.getRepository(RefreshToken).find();
      expect(row.tokenHash).toBe(sha256(refreshToken));
      expect(row.tokenHash).not.toBe(refreshToken);
    });

    it('answers the same for a wrong password and an unknown email', async () => {
      const user = await register();
      const wrong = await api()
        .post('/auth/login')
        .send({ email: user.email, password: 'wrong-password' })
        .expect(401);
      const unknown = await api()
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: PASSWORD })
        .expect(401);
      expect(wrong.body.message).toBe(unknown.body.message);
    });

    it('allows several devices at once', async () => {
      const user = await register();
      await login(user.email);
      await login(user.email);
      expect(await db.getRepository(RefreshToken).count()).toBe(2);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the pair and invalidates the old refresh token', async () => {
      const user = await newUser();
      const { body } = await api()
        .post('/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(200);
      expect(body.refreshToken).not.toBe(user.refreshToken);
      await api()
        .get('/auth/me')
        .set(...bearer(body.accessToken))
        .expect(200);
      await api()
        .post('/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);
      expect(await db.getRepository(RefreshToken).count()).toBe(1);
    });

    it('lets only one of many simultaneous refreshes succeed', async () => {
      const { refreshToken } = await newUser();
      const responses = await Promise.all(
        Array.from({ length: 8 }, () =>
          api().post('/auth/refresh').send({ refreshToken }),
        ),
      );
      const statuses = responses
        .map((response) => response.status)
        .sort((a, b) => a - b);
      expect(statuses).toEqual([200, ...Array<number>(7).fill(401)]);
    });

    it('returns 401 for an unknown token', async () => {
      await api()
        .post('/auth/refresh')
        .send({ refreshToken: 'unknown' })
        .expect(401);
    });

    it('returns 401 for an expired token', async () => {
      const { refreshToken } = await newUser();
      await db
        .getRepository(RefreshToken)
        .update(
          { tokenHash: sha256(refreshToken) },
          { expiresAt: new Date(0) },
        );
      await api().post('/auth/refresh').send({ refreshToken }).expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the token', async () => {
      const user = await newUser();
      const response = await api()
        .post('/auth/logout')
        .set(...bearer(user.accessToken))
        .send({ refreshToken: user.refreshToken })
        .expect(204);
      expect(response.text).toBe('');
      await api()
        .post('/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);
    });

    it('returns 404 for a token of another user and keeps it valid', async () => {
      const owner = await newUser();
      const stranger = await newUser();
      await api()
        .post('/auth/logout')
        .set(...bearer(stranger.accessToken))
        .send({ refreshToken: owner.refreshToken })
        .expect(404);
      await api()
        .post('/auth/refresh')
        .send({ refreshToken: owner.refreshToken })
        .expect(200);
    });

    it('returns 404 for an unknown token and 401 without an access token', async () => {
      const user = await newUser();
      await api()
        .post('/auth/logout')
        .set(...bearer(user.accessToken))
        .send({ refreshToken: 'unknown' })
        .expect(404);
      await api()
        .post('/auth/logout')
        .send({ refreshToken: user.refreshToken })
        .expect(401);
    });
  });

  describe('access token', () => {
    it('GET /auth/me returns only id, email and role', async () => {
      const user = await newUser();
      const { body } = await api()
        .get('/auth/me')
        .set(...bearer(user.accessToken))
        .expect(200);
      expect(body).toEqual({ id: user.id, email: user.email, role: 'user' });
    });

    it('rejects a missing, malformed, forged and expired token with 401', async () => {
      const user = await newUser();
      const jwt = app.get(JwtService);
      const expired = jwt.sign(
        { sub: user.id, role: 'user' },
        { expiresIn: -10 },
      );
      const forged = jwt.sign(
        { sub: user.id, role: 'admin' },
        { secret: 'x'.repeat(32) },
      );
      await api().get('/auth/me').expect(401);
      for (const header of [
        user.accessToken,
        `Basic ${user.accessToken}`,
        'Bearer',
        'Bearer not.a.jwt',
        `Bearer ${expired}`,
        `Bearer ${forged}`,
        `Bearer ${user.refreshToken}`,
      ]) {
        await api().get('/auth/me').set('Authorization', header).expect(401);
      }
    });
  });

  describe('access rules', () => {
    it.each([
      ['get', '/films'],
      ['get', `/films/${MISSING_ID}`],
      ['get', '/halls'],
      ['get', `/halls/${MISSING_ID}`],
      ['get', '/showings'],
      ['get', `/showings/${MISSING_ID}`],
      ['get', `/showings/${MISSING_ID}/seats`],
    ] as const)('%s %s works without a token', async (method, path) => {
      const { status } = await api()[method](path);
      expect([200, 404]).toContain(status);
    });

    const adminRoutes = [
      ['post', '/films'],
      ['patch', `/films/${MISSING_ID}`],
      ['delete', `/films/${MISSING_ID}`],
      ['post', '/halls'],
      ['delete', `/halls/${MISSING_ID}`],
      ['get', '/bookings'],
      ['post', '/showings'],
      ['get', `/showings/${MISSING_ID}/bookings`],
    ] as const;

    it.each(adminRoutes)(
      '%s %s is 401 without a token',
      async (method, path) => {
        await api()[method](path).expect(401);
      },
    );

    it.each(adminRoutes)('%s %s is 403 for a user', async (method, path) => {
      const user = await newUser();
      await api()
        [method](path)
        .set(...bearer(user.accessToken))
        .expect(403);
    });

    it.each([
      ['post', `/showings/${MISSING_ID}/bookings`],
      ['delete', `/bookings/${MISSING_ID}`],
      ['get', '/bookings/my'],
      ['post', '/auth/logout'],
      ['get', '/auth/me'],
    ] as const)('%s %s is 401 without a token', async (method, path) => {
      await api()[method](path).expect(401);
    });
  });

  describe('booking ownership', () => {
    it('binds a booking to the token and ignores userId in the body', async () => {
      const admin = await newAdmin();
      const user = await newUser();
      const showingId = await createShowing(admin.accessToken);
      const { body } = await api()
        .post(`/showings/${showingId}/bookings`)
        .set(...bearer(user.accessToken))
        .send({ seats: [{ row: 1, seat: 1 }], userId: admin.id })
        .expect(201);
      expect(body.userId).toBe(user.id);
    });

    it('GET /bookings/my returns only own bookings with showing data', async () => {
      const admin = await newAdmin();
      const user = await newUser();
      const stranger = await newUser();
      const showingId = await createShowing(admin.accessToken);
      const own = await book(user.accessToken, showingId, 1, 1);
      await book(stranger.accessToken, showingId, 1, 2);

      const { body } = await api()
        .get('/bookings/my')
        .set(...bearer(user.accessToken))
        .expect(200);
      expect(body).toEqual([
        {
          id: own.id,
          showingId,
          userId: user.id,
          seats: [{ row: 1, seat: 1 }],
          totalPrice: 100,
          showing: {
            id: showingId,
            filmTitle: 'Film',
            hallName: expect.any(String),
            startsAt: '2030-06-15T18:00:00.000Z',
            price: 100,
          },
        },
      ]);
    });

    it('lets the owner and an admin cancel, and refuses a stranger', async () => {
      const admin = await newAdmin();
      const user = await newUser();
      const stranger = await newUser();
      const showingId = await createShowing(admin.accessToken);
      const first = await book(user.accessToken, showingId, 1, 1);
      const second = await book(user.accessToken, showingId, 1, 2);

      await api()
        .delete(`/bookings/${first.id}`)
        .set(...bearer(stranger.accessToken))
        .expect(403);
      await api()
        .delete(`/bookings/${first.id}`)
        .set(...bearer(user.accessToken))
        .expect(204);
      await api()
        .delete(`/bookings/${second.id}`)
        .set(...bearer(admin.accessToken))
        .expect(204);
      await api()
        .delete(`/bookings/${MISSING_ID}`)
        .set(...bearer(user.accessToken))
        .expect(404);
    });
  });

  it('describes Bearer auth and 401/403 responses in Swagger', async () => {
    const { body } = await api().get('/docs-json').expect(200);
    expect(body.components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    const createFilm = body.paths['/films'].post;
    expect(createFilm.security).toEqual([{ bearer: [] }]);
    expect(createFilm.responses).toHaveProperty('401');
    expect(createFilm.responses).toHaveProperty('403');
    const cancel = body.paths['/bookings/{id}'].delete;
    expect(cancel.responses).toHaveProperty('401');
    expect(cancel.responses).toHaveProperty('403');
    expect(body.paths['/films'].get.security).toBeUndefined();
  });
});
