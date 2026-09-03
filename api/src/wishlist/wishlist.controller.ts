import { Controller, Get, Post, Delete, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { getPool } from '../config/database.js';
import { getUser } from '../middleware/auth.middleware.js';
import { randomUUID } from 'node:crypto';

@Controller('/api/v1/wishlist')
export class WishlistController {

  @Get('/')
  @ApiOperation({ summary: 'Get wishlist', tags: ['wishlist'] })
  async get(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401); return; }
    const pool = getPool();
    const res = await pool.query(
      `SELECT wi.id, wi.product_id, wi.created_at,
              p.name, p.slug, p.price_cents,
              pi.url AS image
       FROM wishlist_items wi
       JOIN products p ON p.id = wi.product_id
       LEFT JOIN LATERAL (
         SELECT url FROM product_images WHERE product_id = p.id
         ORDER BY is_primary DESC, sort_order LIMIT 1
       ) pi ON true
       WHERE wi.user_id = $1 ORDER BY wi.created_at DESC`, [user.id],
    );
    ctx.json({ items: res.rows.map(r => ({ ...(r as Record<string,unknown>), price: Number((r as Record<string,unknown>)['price_cents'])/100 })) });
  }

  @Post('/items')
  @ApiOperation({ summary: 'Add product to wishlist', tags: ['wishlist'] })
  async add(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401); return; }
    const body = ctx.body as Record<string,unknown>|null;
    if (!body?.['productId']) { ctx.json({ error: { code: 'INVALID_BODY', message: 'productId required' } }, 400); return; }
    const pool = getPool();
    try {
      await pool.query(
        `INSERT INTO wishlist_items (id, user_id, product_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [randomUUID(), user.id, body['productId']],
      );
      ctx.json({ success: true });
    } catch (err) {
      ctx.json({ error: { code: 'ADD_FAILED', message: err instanceof Error ? err.message : 'Failed' } }, 400);
    }
  }

  @Delete('/items/:productId')
  @ApiOperation({ summary: 'Remove product from wishlist', tags: ['wishlist'] })
  async remove(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401); return; }
    const pool = getPool();
    await pool.query(
      `DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2`,
      [user.id, ctx.params['productId']],
    );
    ctx.json({ success: true });
  }
}
