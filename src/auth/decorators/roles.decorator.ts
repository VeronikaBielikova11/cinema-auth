import { applyDecorators, SetMetadata } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity.js';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// Documents a route that needs any valid access token.
export const Authenticated = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Токен відсутній, зіпсований, недійсний або прострочений',
    }),
  );

export const AdminOnly = () =>
  applyDecorators(
    Roles(UserRole.Admin),
    Authenticated(),
    ApiForbiddenResponse({
      description: 'Маршрут доступний лише адміністратору',
    }),
  );
