import type { Request } from 'express';
import type { UserRole } from '../users/entities/user.entity.js';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
