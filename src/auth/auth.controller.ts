import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { User } from '../users/entities/user.entity.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './auth.types.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { Authenticated } from './decorators/roles.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { TokenPairDto } from './dto/token-pair.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Зареєструвати користувача з роллю user' })
  @ApiCreatedResponse({ type: User, description: 'Користувача створено' })
  @ApiBadRequestResponse({
    description: 'Некоректний формат пошти або короткий пароль',
  })
  @ApiConflictResponse({ description: 'Користувач з такою поштою вже існує' })
  register(@Body() dto: RegisterDto): Promise<User> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Увійти й отримати пару токенів' })
  @ApiOkResponse({ type: TokenPairDto, description: 'Пара токенів' })
  @ApiUnauthorizedResponse({ description: 'Неправильна пошта або пароль' })
  login(@Body() dto: LoginDto): Promise<TokenPairDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Обміняти refresh-токен на нову пару',
    description: 'Переданий refresh-токен після цього стає недійсним.',
  })
  @ApiOkResponse({ type: TokenPairDto, description: 'Нова пара токенів' })
  @ApiUnauthorizedResponse({
    description: 'Токен не знайдено, він прострочений або вже використаний',
  })
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPairDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authenticated()
  @ApiOperation({ summary: 'Відкликати refresh-токен' })
  @ApiNoContentResponse({ description: 'Токен відкликано' })
  @ApiNotFoundResponse({
    description: 'Токен не існує або не належить поточному користувачу',
  })
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefreshTokenDto,
  ): Promise<void> {
    return this.authService.logout(user.id, dto.refreshToken);
  }

  @Get('me')
  @Authenticated()
  @ApiOperation({ summary: 'Отримати дані поточного користувача' })
  @ApiOkResponse({ type: User, description: 'id, email і role' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<User> {
    return this.authService.getProfile(user.id);
  }
}
