import { AuthService } from '../auth/auth.service.js';
const authService = new AuthService();
export const authenticate = async (ctx, next) => {
    const token = ctx.headers['authorization']?.replace('Bearer ', '');
    if (token) {
        const user = await authService.verifyAccessToken(token);
        if (user) {
            ctx['user'] = user;
        }
    }
    await next();
};
export const requireAuth = async (ctx, next) => {
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
    ctx['user'] = user;
    await next();
};
export function requireRole(...roles) {
    return async (ctx, next) => {
        const user = ctx['user'];
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
export function getUser(ctx) {
    return ctx['user'] ?? null;
}
