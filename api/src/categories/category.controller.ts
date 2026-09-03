import { Controller, Get, Post, Put, Delete, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { getPool } from '../config/database.js';
import { requireRole, getUser } from '../middleware/auth.middleware.js';
import { randomUUID } from 'node:crypto';
import { toSlug } from '../common/slug.js';

@Controller('/api/v1/categories')
export class CategoryController {

  @Get('/')
  @ApiOperation({ summary: 'List all active categories', tags: ['categories'] })
  async list(ctx: StreetContext): Promise<void> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, name, slug, description, parent_id, image_url, sort_order
       FROM categories WHERE active = true ORDER BY sort_order, name`,
    );
    ctx.json({ items: res.rows });
  }

  @Get('/:slug')
  @ApiOperation({ summary: 'Get category by slug', tags: ['categories'] })
  async findBySlug(ctx: StreetContext): Promise<void> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, name, slug, description, parent_id, image_url, sort_order
       FROM categories WHERE slug = $1 AND active = true`, [ctx.params['slug']],
    );
    if (!res.rows[0]) { ctx.json({ error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' } }, 404); return; }
    ctx.json(res.rows[0]);
  }

  @Post('/')
  @ApiOperation({ summary: '[Admin] Create category', tags: ['categories'] })
  async create(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user?.roles.some(r => ['admin','super_admin','staff'].includes(r))) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403); return;
    }
    const body = ctx.body as Record<string,unknown> | null;
    if (!body?.['name']) { ctx.json({ error: { code: 'INVALID_BODY', message: 'name required' } }, 400); return; }

    const pool = getPool();
    const id = randomUUID();
    const slug = toSlug(String(body['name']));
    await pool.query(
      `INSERT INTO categories (id, name, slug, description, parent_id, image_url, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, body['name'], slug, body['description'] ?? null,
       body['parentId'] ?? null, body['imageUrl'] ?? null, body['sortOrder'] ?? 0],
    );
    ctx.json({ id, slug }, 201);
  }
}
