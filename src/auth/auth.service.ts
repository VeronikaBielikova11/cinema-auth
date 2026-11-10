import { createHash, randomBytes } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EnvironmentVariables } from '../config/env.validation.js';
import { User } from '../users/entities/user.entity.js';
import { UNKNOWN_USER_HASH, verifyPassword } from '../users/password.js';
import { UsersService } from '../users/users.service.js';
import type { AccessTokenPayload } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { TokenPairDto } from './dto/token-pair.dto.js';
import { RefreshToken } from './entities/refresh-token.entity.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// SHA-256 is deterministic, so the token can be found in the table by its hash.
// bcrypt could not do that, and a long random token does not need its slowness.
const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  register({ email, password }: RegisterDto): Promise<User> {
    return this.usersService.create(email, password);
  }

  async login({ email, password }: LoginDto): Promise<TokenPairDto> {
    const user = await this.usersService.findByEmail(email);
    const matches = await verifyPassword(
      password,
      user?.passwordHash ?? UNKNOWN_USER_HASH,
    );
    if (!user || !matches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueTokens(user, this.dataSource.manager);
  }

  async refresh(refreshToken: string): Promise<TokenPairDto> {
    return this.dataSource.transaction(async (manager) => {
      // One atomic statement: of two simultaneous requests with the same
      // token only one gets the row back, the other sees an empty result.
      const { raw } = await manager
        .createQueryBuilder()
        .delete()
        .from(RefreshToken)
        .where('token_hash = :tokenHash AND expires_at > now()', {
          tokenHash: hashToken(refreshToken),
        })
        .returning('user_id')
        .execute();
      const [consumed] = raw as { user_id: string }[];
      if (!consumed) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const user = await manager.findOneByOrFail(User, {
        id: consumed.user_id,
      });
      return this.issueTokens(user, manager);
    });
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const { affected } = await this.refreshTokensRepository.delete({
      userId,
      tokenHash: hashToken(refreshToken),
    });
    if (!affected) {
      throw new NotFoundException('Refresh token not found');
    }
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid or missing access token');
    }
    return user;
  }

  private async issueTokens(
    user: User,
    manager: EntityManager,
  ): Promise<TokenPairDto> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    const refreshToken = randomBytes(32).toString('base64url');
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });

    await manager.insert(RefreshToken, {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + ttlDays * DAY_IN_MS),
    });

    return Object.assign(new TokenPairDto(), {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken,
    });
  }
}
