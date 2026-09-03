import { Controller, Get, Post, Put, Delete, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { getPool } from '../config/database.js';
import { getUser } from '../middleware/auth.middleware.js';
import { randomUUID } from 'node:crypto';

@Controller('/api/v1/addresses')
export class AddressController {

  @Get('/')
  @ApiOperation({ summary: 'List addresses for authenticated user', tags: ['addresses'] })
  async list(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401); return; }
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, type, first_name, last_name, company, line1, line2,
              city, state, postcode, country_code, phone, is_default
       FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [user.id],
    );
    ctx.json({ items: res.rows });
  }

  @Post('/')
  @ApiOperation({ summary: 'Create address', tags: ['addresses'] })
  async create(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401); return; }
    const b = ctx.body as Record<string, unknown> | null;
    if (!b?.['firstName'] || !b?.['line1'] || !b?.['city'] || !b?.['postcode'] || !b?.['countryCode']) {
      ctx.json({ error: { code: 'INVALID_BODY', message: 'firstName, line1, city, postcode, countryCode required' } }, 400);
      return;
    }
    const pool = getPool();
    const id = randomUUID();
    if (b['isDefault']) {
      await pool.query(
        `UPDATE addresses SET is_default = FALSE WHERE user_id = $1 AND type = $2`,
        [user.id, b['type'] ?? 'shipping'],
      );
    }
    await pool.query(
      `INSERT INTO addresses (id, user_id, type, first_name, last_name, company,
        line1, line2, city, state, postcode, country_code, phone, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, user.id, b['type'] ?? 'shipping', b['firstName'], b['lastName'] ?? '',
       b['company'] ?? null, b['line1'], b['line2'] ?? null, b['city'],
       b['state'] ?? null, b['postcode'], b['countryCode'], b['phone'] ?? null,
       Boolean(b['isDefault'])],
    );
    ctx.json({ id }, 201);
  }

  @Put('/:id')
  @ApiOperation({ summary: 'Update address', tags: ['addresses'] })
  async update(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401); return; }
    const b = ctx.body as Record<string, unknown> | null;
    const pool = getPool();
    // Verify ownership
    const check = await pool.query(
      `SELECT id FROM addresses WHERE id = $1 AND user_id = $2`, [ctx.params['id'], user.id],
    );
    if (!check.rows[0]) { ctx.json({ error: { code: 'NOT_FOUND', message: 'Address not found' } }, 404); return; }

    if (b?.['isDefault']) {
      await pool.query(
        `UPDATE addresses SET is_default = FALSE WHERE user_id = $1`, [user.id],
      );
    }
    await pool.query(
      `UPDATE addresses SET
         first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
         line1 = COALESCE($3, line1), line2 = $4, city = COALESCE($5, city),
         state = $6, postcode = COALESCE($7, postcode), country_code = COALESCE($8, country_code),
         phone = $9, is_default = COALESCE($10, is_default), updated_at = NOW()
       WHERE id = $11`,
      [b?.['firstName'] ?? null, b?.['lastName'] ?? null, b?.['line1'] ?? null,
       b?.['line2'] ?? null, b?.['city'] ?? null, b?.['state'] ?? null,
       b?.['postcode'] ?? null, b?.['countryCode'] ?? null, b?.['phone'] ?? null,
       b?.['isDefault'] != null ? Boolean(b['isDefault']) : null, ctx.params['id']],
    );
    ctx.json({ success: true });
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Delete address', tags: ['addresses'] })
  async remove(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401); return; }
    const pool = getPool();
    await pool.query(
      `DELETE FROM addresses WHERE id = $1 AND user_id = $2`, [ctx.params['id'], user.id],
    );
    ctx.json({ success: true });
  }
}
