import type { StreetContext, MiddlewareFn } from 'streetjs';
import { AuthService } from '../auth/auth.service.js';

const authService = new AuthService();

export const authenticate: MiddlewareFn = async (ctx, next) => {
  const token = ctx.headers['authorization']?.replace('Bearer ', '');
  if (token) {
    const user = await authService.verifyAccessToken(token);
    if (user) {
      (ctx as unknown as Record<string, unknown>)['user'] = user;
    }
  }
  await next();
};

export const requireAuth: MiddlewareFn = async (ctx, next) => {
  const token = ctx.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
    return;
  }
  const user = await authService.verifyAccessToken(token);
  if (!user) {
    ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }, 401);
    return;
  }
  (ctx as unknown as Record<string, unknown>)['user'] = user;
  await next();
};

export function requireRole(...roles: string[]): MiddlewareFn {
  return async (ctx, next) => {
    const user = (ctx as unknown as Record<string, unknown>)['user'] as { roles: string[] } | undefined;
    if (!user) {
      ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
      return;
    }
    const hasRole = roles.some((r) => user.roles.includes(r));
    if (!hasRole) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403);
      return;
    }
    await next();
  };
}

export function getUser(ctx: StreetContext): { id: string; email: string; roles: string[] } | null {
  return ((ctx as unknown as Record<string, unknown>)['user'] as { id: string; email: string; roles: string[] }) ?? null;
}
