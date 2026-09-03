import type { StreetContext } from 'streetjs';
import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from 'streetjs';

export function apiError(
  ctx: StreetContext,
  code: string,
  message: string,
  status = 400,
): void {
  ctx.json({ error: { code, message } }, status);
}

export function notFound(ctx: StreetContext, resource: string): void {
  ctx.json({ error: { code: `${resource.toUpperCase()}_NOT_FOUND`, message: `${resource} not found` } }, 404);
}

export function forbidden(ctx: StreetContext): void {
  ctx.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403);
}

export function unauthorized(ctx: StreetContext): void {
  ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
}

export {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
};
