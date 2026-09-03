import { Controller, Get, Post, Delete, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { getPool } from '../config/database.js';
import { getUser } from '../middleware/auth.middleware.js';
import { randomUUID } from 'node:crypto';

@Controller('/api/v1/products/:productId/reviews')
export class ReviewController {

  @Get('/')
  @ApiOperation({ summary: 'Get approved reviews for a product', tags: ['reviews'] })
  async list(ctx: StreetContext): Promise<void> {
    const pool = getPool();
    const q = ctx.query as Record<string,string|undefined>;
    const page  = Math.max(1, Number(q['page']  ?? 1));
    const limit = Math.min(50, Math.max(1, Number(q['limit'] ?? 10)));
    const offset = (page - 1) * limit;

    const [dataRes, countRes, summaryRes] = await Promise.all([
      pool.query(
        `SELECT r.id, r.rating, r.title, r.body, r.is_verified_purchase, r.created_at,
                u.first_name, u.last_name
         FROM reviews r
         JOIN users u ON u.id = r.user_id
         WHERE r.product_id = $1 AND r.status = 'APPROVED'
         ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
        [ctx.params['productId'], limit, offset],
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM reviews WHERE product_id = $1 AND status = 'APPROVED'`,
        [ctx.params['productId']],
      ),
      pool.query(
        `SELECT AVG(rating) AS avg_rating, COUNT(*) AS total_count,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS five,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS four,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS three,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS two,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS one
         FROM reviews WHERE product_id = $1 AND status = 'APPROVED'`,
        [ctx.params['productId']],
      ),
    ]);

    const total = Number((countRes.rows[0] as Record<string,unknown>)['total'] ?? 0);
    const s = summaryRes.rows[0] as Record<string,unknown>;

    ctx.json({
      items: dataRes.rows,
      total, page, limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        averageRating: s['avg_rating'] ? Number(Number(s['avg_rating']).toFixed(2)) : 0,
        totalCount: Number(s['total_count'] ?? 0),
        distribution: { 5: Number(s['five']??0), 4: Number(s['four']??0), 3: Number(s['three']??0), 2: Number(s['two']??0), 1: Number(s['one']??0) },
      },
    });
  }

  @Post('/')
  @ApiOperation({ summary: 'Submit a product review', tags: ['reviews'] })
  async create(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required to submit a review' } }, 401); return; }

    const body = ctx.body as Record<string,unknown>|null;
    const rating = Number(body?.['rating']);
    if (!body || rating < 1 || rating > 5) {
      ctx.json({ error: { code: 'INVALID_RATING', message: 'Rating must be 1–5' } }, 400); return;
    }

    const pool = getPool();
    // Check for existing pending/approved review
    const existing = await pool.query(
      `SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2 AND status != 'REJECTED' LIMIT 1`,
      [ctx.params['productId'], user.id],
    );
    if (existing.rows.length > 0) {
      ctx.json({ error: { code: 'ALREADY_REVIEWED', message: 'You have already reviewed this product' } }, 409);
      return;
    }

    const id = randomUUID();
    await pool.query(
      `INSERT INTO reviews (id, product_id, user_id, rating, title, body)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, ctx.params['productId'], user.id, rating,
       body['title'] ?? null, body['body'] ?? null],
    );
    ctx.json({ id, status: 'PENDING', message: 'Review submitted and awaiting moderation' }, 201);
  }

  @Delete('/:reviewId')
  @ApiOperation({ summary: '[Admin] Delete/reject a review', tags: ['reviews'] })
  async moderate(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user?.roles.some(r => ['admin','super_admin','staff'].includes(r))) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403); return;
    }
    const body = ctx.body as Record<string,unknown>|null;
    const status = String(body?.['status'] ?? 'REJECTED');
    if (!['APPROVED','REJECTED'].includes(status)) {
      ctx.json({ error: { code: 'INVALID_STATUS', message: 'status must be APPROVED or REJECTED' } }, 400); return;
    }
    const pool = getPool();
    await pool.query(
      `UPDATE reviews SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, ctx.params['reviewId']],
    );
    // Update product rating aggregate
    await pool.query(
      `UPDATE products p SET
         rating       = (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE product_id = p.id AND status = 'APPROVED'),
         review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = p.id AND status = 'APPROVED'),
         updated_at   = NOW()
       WHERE id = (SELECT product_id FROM reviews WHERE id = $1)`,
      [ctx.params['reviewId']],
    );
    ctx.json({ success: true });
  }
}
