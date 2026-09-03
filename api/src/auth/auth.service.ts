import { Injectable, JwtService, ConflictException, UnauthorizedException } from 'streetjs';
import { randomUUID, createHash, randomBytes, pbkdf2 } from 'node:crypto';
import { getPool } from '../config/database.js';
import type { PgPool } from 'streetjs';

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

@Injectable()
export class AuthService {
  private get pool(): PgPool { return getPool(); }

  // JwtService takes the secret string directly (not an options object)
  private get jwt(): JwtService {
    return new JwtService(process.env['JWT_SECRET'] ?? 'change-me-minimum-32-chars-secret!!');
  }

  private hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    return new Promise((resolve, reject) => {
      pbkdf2(password, salt, 310_000, 32, 'sha256', (err, key) => {
        if (err) reject(err);
        else resolve(`${salt}:${key.toString('hex')}`);
      });
    });
  }

  private verifyPassword(password: string, stored: string): Promise<boolean> {
    const [salt, key] = stored.split(':');
    return new Promise((resolve, reject) => {
      pbkdf2(password, salt!, 310_000, 32, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex') === key);
      });
    });
  }

  async register(input: RegisterInput): Promise<AuthUser> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) throw new ConflictException('Email already registered');

    const passwordHash = await this.hashPassword(input.password);
    const userId = randomUUID();

    await this.pool.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, phone, company)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, email, passwordHash, input.firstName, input.lastName,
       input.phone ?? null, input.company ?? null],
    );

    const roleResult = await this.pool.query(`SELECT id FROM roles WHERE name = 'customer'`);
    if (roleResult.rows.length > 0) {
      await this.pool.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)`,
        [userId, (roleResult.rows[0] as Record<string, unknown>)['id']],
      );
    }
    return this.getAuthUser(userId);
  }

  async login(input: LoginInput): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const email = input.email.toLowerCase().trim();
    const result = await this.pool.query(
      `SELECT id, password_hash, status FROM users WHERE email = $1`, [email],
    );
    if (result.rows.length === 0) throw new UnauthorizedException('Invalid credentials');

    const row = result.rows[0] as Record<string, unknown>;
    if (row['status'] !== 'active') throw new UnauthorizedException('Account suspended');

    const valid = await this.verifyPassword(String(input.password), String(row['password_hash']));
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const user = await this.getAuthUser(String(row['id']));
    const tokens = await this.issueTokens(String(row['id']), user);
    return { user, tokens };
  }

  async refresh(refreshToken: string): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const result = await this.pool.query(
      `SELECT user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1`, [tokenHash],
    );
    if (result.rows.length === 0) throw new UnauthorizedException('Invalid refresh token');
    const row = result.rows[0] as Record<string, unknown>;
    if (row['revoked_at']) throw new UnauthorizedException('Refresh token revoked');
    if (new Date(String(row['expires_at'])) < new Date()) throw new UnauthorizedException('Refresh token expired');

    const userId = String(row['user_id']);
    const user = await this.getAuthUser(userId);
    await this.pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash]);
    const tokens = await this.issueTokens(userId, user);
    return { user, tokens };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash]);
  }

  async getAuthUser(userId: string): Promise<AuthUser> {
    const userRes = await this.pool.query(
      `SELECT id, email, first_name, last_name FROM users WHERE id = $1`, [userId],
    );
    const rolesRes = await this.pool.query(
      `SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1`, [userId],
    );
    const u = userRes.rows[0] as Record<string, unknown>;
    return {
      id:        String(u['id']),
      email:     String(u['email']),
      firstName: String(u['first_name']),
      lastName:  String(u['last_name']),
      roles:     rolesRes.rows.map((r) => String((r as Record<string, unknown>)['name'])),
    };
  }

  private async issueTokens(userId: string, user: AuthUser): Promise<TokenPair> {
    const payload = { sub: userId, email: user.email, roles: user.roles };
    const expiresIn = 15 * 60;

    // JwtService.sign(payload, options) — second arg is options with expiresInSeconds
    const accessToken = this.jwt.sign(payload, { expiresInSeconds: expiresIn });

    const rawRefresh = randomBytes(48).toString('hex');
    const refreshHash = createHash('sha256').update(rawRefresh).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.pool.query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1,$2,$3,$4)`,
      [randomUUID(), userId, refreshHash, expiresAt.toISOString()],
    );
    return { accessToken, refreshToken: rawRefresh, expiresIn };
  }

  async verifyAccessToken(token: string): Promise<AuthUser | null> {
    try {
      const payload = this.jwt.verify(token) as Record<string, unknown> | null;
      if (!payload) return null;
      const userId = String(payload['sub'] ?? '');
      if (!userId) return null;
      return this.getAuthUser(userId);
    } catch {
      return null;
    }
  }
}
