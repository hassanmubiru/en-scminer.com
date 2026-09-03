var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Post, Get, ApiOperation } from 'streetjs';
import { AuthService } from './auth.service.js';
import { getPool } from '../config/database.js';
let AuthController = class AuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
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
                email: String(email),
                password: String(password),
                firstName: String(firstName),
                lastName: typeof lastName === 'string' ? lastName : '',
                phone: typeof phone === 'string' ? phone : undefined,
                company: typeof company === 'string' ? company : undefined,
            });
            const { tokens } = await this.auth.login({ email: String(email), password: String(password) });
            ctx.json({ user, tokens }, 201);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Registration failed';
            const status = msg.includes('already') ? 409 : 400;
            ctx.json({ error: { code: 'REGISTRATION_FAILED', message: msg } }, status);
        }
    }
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
            const result = await this.auth.login({ email: String(email), password: String(password) });
            ctx.json(result);
        }
        catch {
            ctx.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401);
        }
    }
    async refresh(ctx) {
        const body = ctx.body;
        const refreshToken = body?.['refreshToken'];
        if (typeof refreshToken !== 'string') {
            ctx.json({ error: { code: 'MISSING_TOKEN', message: 'refreshToken required' } }, 400);
            return;
        }
        try {
            const result = await this.auth.refresh(refreshToken);
            ctx.json(result);
        }
        catch {
            ctx.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' } }, 401);
        }
    }
    async logout(ctx) {
        const body = ctx.body;
        const refreshToken = body?.['refreshToken'];
        if (typeof refreshToken === 'string') {
            await this.auth.logout(refreshToken);
        }
        ctx.json({ success: true });
    }
    async me(ctx) {
        const token = ctx.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
            ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
            return;
        }
        const user = await this.auth.verifyAccessToken(token);
        if (!user) {
            ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }, 401);
            return;
        }
        // Full user profile
        const pool = getPool();
        const res = await pool.query(`SELECT id, email, first_name, last_name, phone, company, email_verified_at, created_at
       FROM users WHERE id = $1`, [user.id]);
        const u = res.rows[0];
        ctx.json({ user: { ...u, roles: user.roles } });
    }
};
__decorate([
    Post('/register'),
    ApiOperation({ summary: 'Register a new customer account', tags: ['auth'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    Post('/login'),
    ApiOperation({ summary: 'Login with email and password', tags: ['auth'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    Post('/refresh'),
    ApiOperation({ summary: 'Refresh access token', tags: ['auth'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    Post('/logout'),
    ApiOperation({ summary: 'Logout and revoke refresh token', tags: ['auth'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    Get('/me'),
    ApiOperation({ summary: 'Get current authenticated user', tags: ['auth'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
AuthController = __decorate([
    Controller('/api/v1/auth'),
    __metadata("design:paramtypes", [AuthService])
], AuthController);
export { AuthController };
