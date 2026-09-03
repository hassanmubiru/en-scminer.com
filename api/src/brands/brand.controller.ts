import { Controller, Get, Post, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { getPool } from '../config/database.js';
import { getUser } from '../middleware/auth.middleware.js';
import { randomUUID } from 'node:crypto';
import { toSlug } from '../common/slug.js';

@Controller('/api/v1/brands')
export class BrandController {

  @Get('/')
  @ApiOperation({ summary: 'List all active brands', tags: ['brands'] })
  async list(ctx: StreetContext): Promise<void> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, name, slug, description, logo_url, website FROM brands WHERE active = true ORDER BY name`,
    );
    ctx.json({ items: res.rows });
  }

  @Get('/:slug')
  @ApiOperation({ summary: 'Get brand by slug', tags: ['brands'] })
  async findBySlug(ctx: StreetContext): Promise<void> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, name, slug, description, logo_url, website FROM brands WHERE slug = $1 AND active = true`,
      [ctx.params['slug']],
    );
    if (!res.rows[0]) { ctx.json({ error: { code: 'BRAND_NOT_FOUND', message: 'Brand not found' } }, 404); return; }
    ctx.json(res.rows[0]);
  }

  @Post('/')
  @ApiOperation({ summary: '[Admin] Create brand', tags: ['brands'] })
  async create(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user?.roles.some(r => ['admin','super_admin'].includes(r))) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403); return;
    }
    const body = ctx.body as Record<string,unknown> | null;
    if (!body?.['name']) { ctx.json({ error: { code: 'INVALID_BODY', message: 'name required' } }, 400); return; }

    const pool = getPool();
    const id = randomUUID();
    const slug = toSlug(String(body['name']));
    await pool.query(
      `INSERT INTO brands (id, name, slug, description, logo_url, website)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, body['name'], slug, body['description'] ?? null, body['logoUrl'] ?? null, body['website'] ?? null],
    );
    ctx.json({ id, slug }, 201);
  }
}
