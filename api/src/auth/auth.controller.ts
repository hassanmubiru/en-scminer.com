import { Controller, Post, Get, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { AuthService } from './auth.service.js';
import { getPool } from '../config/database.js';

@Controller('/api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('/register')
  @ApiOperation({ summary: 'Register a new customer account', tags: ['auth'] })
  async register(ctx: StreetContext): Promise<void> {
    const body = ctx.body as Record<string, unknown> | null;
    if (!body) { ctx.json({ error: { code: 'INVALID_BODY', message: 'Request body required' } }, 400); return; }

    const { email, password, firstName, lastName, phone, company } = body as Record<string, unknown>;

    if (typeof email !== 'string' || !email.includes('@')) {
      ctx.json({ error: { code: 'INVALID_EMAIL', message: 'Valid email required' } }, 400); return;
    }
    if (typeof password !== 'string' || password.length < 8) {
      ctx.json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' } }, 400); return;
    }
    if (typeof firstName !== 'string' || !firstName.trim()) {
      ctx.json({ error: { code: 'INVALID_NAME', message: 'First name required' } }, 400); return;
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      const status = msg.includes('already') ? 409 : 400;
      ctx.json({ error: { code: 'REGISTRATION_FAILED', message: msg } }, status);
    }
  }

  @Post('/login')
  @ApiOperation({ summary: 'Login with email and password', tags: ['auth'] })
  async login(ctx: StreetContext): Promise<void> {
    const body = ctx.body as Record<string, unknown> | null;
    if (!body) { ctx.json({ error: { code: 'INVALID_BODY', message: 'Request body required' } }, 400); return; }

    const { email, password } = body as Record<string, unknown>;
    if (typeof email !== 'string' || typeof password !== 'string') {
      ctx.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email and password required' } }, 400); return;
    }

    try {
      const result = await this.auth.login({ email: String(email), password: String(password) });
      ctx.json(result);
    } catch {
      ctx.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401);
    }
  }

  @Post('/refresh')
  @ApiOperation({ summary: 'Refresh access token', tags: ['auth'] })
  async refresh(ctx: StreetContext): Promise<void> {
    const body = ctx.body as Record<string, unknown> | null;
    const refreshToken = body?.['refreshToken'];
    if (typeof refreshToken !== 'string') {
      ctx.json({ error: { code: 'MISSING_TOKEN', message: 'refreshToken required' } }, 400); return;
    }
    try {
      const result = await this.auth.refresh(refreshToken);
      ctx.json(result);
    } catch {
      ctx.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' } }, 401);
    }
  }

  @Post('/logout')
  @ApiOperation({ summary: 'Logout and revoke refresh token', tags: ['auth'] })
  async logout(ctx: StreetContext): Promise<void> {
    const body = ctx.body as Record<string, unknown> | null;
    const refreshToken = body?.['refreshToken'];
    if (typeof refreshToken === 'string') {
      await this.auth.logout(refreshToken);
    }
    ctx.json({ success: true });
  }

  @Get('/me')
  @ApiOperation({ summary: 'Get current authenticated user', tags: ['auth'] })
  async me(ctx: StreetContext): Promise<void> {
    const token = ctx.headers['authorization']?.replace('Bearer ', '');
    if (!token) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401); return; }

    const user = await this.auth.verifyAccessToken(token);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }, 401); return; }

    // Full user profile
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, email, first_name, last_name, phone, company, email_verified_at, created_at
       FROM users WHERE id = $1`, [user.id],
    );
    const u = res.rows[0] as Record<string, unknown>;
    ctx.json({ user: { ...u, roles: user.roles } });
  }
}
