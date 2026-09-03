import { BadRequestException, UnauthorizedException, ForbiddenException, NotFoundException, ConflictException, } from 'streetjs';
export function apiError(ctx, code, message, status = 400) {
    ctx.json({ error: { code, message } }, status);
}
export function notFound(ctx, resource) {
    ctx.json({ error: { code: `${resource.toUpperCase()}_NOT_FOUND`, message: `${resource} not found` } }, 404);
}
export function forbidden(ctx) {
    ctx.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403);
}
export function unauthorized(ctx) {
    ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
}
export { BadRequestException, UnauthorizedException, ForbiddenException, NotFoundException, ConflictException, };
