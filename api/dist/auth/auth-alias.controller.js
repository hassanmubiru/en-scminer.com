var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
/**
 * AuthAliasController — bridges the @streetjs/client built-in auth helper.
 *
 * @streetjs/client hardcodes auth routes as:
 *   GET  /auth/session   → "restore session / current user"
 *   POST /auth/login
 *   POST /auth/register
 *   POST /auth/logout
 *
 * The real routes live at /api/v1/auth/*. This controller adds the expected
 * short paths so StreetProvider works without any frontend changes.
 */
import { Controller, Get, Post, ApiOperation } from 'streetjs';
import { AuthService } from './auth.service.js';
import { getPool } from '../config/database.js';
let AuthAliasController = class AuthAliasController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    /**
     * GET /auth/session
     * Called automatically by StreetProvider on mount to restore a saved session.
     * Returns the current user from the Bearer token, or null (not an error) if
     * no token is present — StreetProvider handles the null case gracefully.
     */
    async session(ctx) {
        const token = ctx.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
            // No token — return null user (not 401); StreetProvider treats this as
            // "not logged in" and does not surface an error to the user.
            ctx.json({ user: null });
            return;
        }
        const user = await this.auth.verifyAccessToken(token);
        if (!user) {
            ctx.json({ user: null });
            return;
        }
        const pool = getPool();
        const res = await pool.query(`SELECT id, email, first_name, last_name, phone, company, created_at
       FROM users WHERE id = $1`, [user.id]);
        const u = res.rows[0];
        ctx.json({ user: u ? { ...u, roles: user.roles } : null });
    }
    /**
     * POST /auth/login
     * Alias for POST /api/v1/auth/login — used by client.auth.login().
     */
    async login(ctx) {
        const body = ctx.body;
        if (!body) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'Request body required' } }, 400);
            return;
        }
        const { email, password } = body;
        if (typeof email !== 'string' || typeof password !== 'string') {
            ctx.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email and password required' } }, 400);
            return;
        }
        try {
            const result = await this.auth.login({ email, password });
            ctx.json(result);
        }
        catch {
            ctx.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401);
        }
    }
    /**
     * POST /auth/register
     * Alias for POST /api/v1/auth/register — used by client.auth.register().
     */
    async register(ctx) {
        const body = ctx.body;
        if (!body) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'Request body required' } }, 400);
            return;
        }
        const { email, password, firstName, lastName, phone, company } = body;
        if (typeof email !== 'string' || !email.includes('@')) {
            ctx.json({ error: { code: 'INVALID_EMAIL', message: 'Valid email required' } }, 400);
            return;
        }
        if (typeof password !== 'string' || password.length < 8) {
            ctx.json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' } }, 400);
            return;
        }
        if (typeof firstName !== 'string' || !firstName.trim()) {
            ctx.json({ error: { code: 'INVALID_NAME', message: 'First name required' } }, 400);
            return;
        }
        try {
            const user = await this.auth.register({
                email,
                password,
                firstName,
                lastName: typeof lastName === 'string' ? lastName : '',
                phone: typeof phone === 'string' ? phone : undefined,
                company: typeof company === 'string' ? company : undefined,
            });
            const { tokens } = await this.auth.login({ email, password });
            ctx.json({ user, tokens }, 201);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Registration failed';
            const status = msg.includes('already') ? 409 : 400;
            ctx.json({ error: { code: 'REGISTRATION_FAILED', message: msg } }, status);
        }
    }
    /**
     * POST /auth/logout
     * Alias for POST /api/v1/auth/logout — used by client.auth.logout().
     */
    async logout(ctx) {
        const body = ctx.body;
        const refreshToken = body?.['refreshToken'];
        if (typeof refreshToken === 'string') {
            await this.auth.logout(refreshToken);
        }
        ctx.json({ success: true });
    }
};
__decorate([
    Get('/session'),
    ApiOperation({ summary: 'Restore session for @streetjs/client StreetProvider', tags: ['auth'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthAliasController.prototype, "session", null);
__decorate([
    Post('/login'),
    ApiOperation({ summary: 'Login alias for @streetjs/client', tags: ['auth'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthAliasController.prototype, "login", null);
__decorate([
    Post('/register'),
    ApiOperation({ summary: 'Register alias for @streetjs/client', tags: ['auth'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthAliasController.prototype, "register", null);
__decorate([
    Post('/logout'),
    ApiOperation({ summary: 'Logout alias for @streetjs/client', tags: ['auth'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthAliasController.prototype, "logout", null);
AuthAliasController = __decorate([
    Controller('/auth'),
    __metadata("design:paramtypes", [AuthService])
], AuthAliasController);
export { AuthAliasController };
