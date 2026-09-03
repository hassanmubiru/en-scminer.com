import { Controller, Get, Post, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { getPool } from '../config/database.js';
import { getUser } from '../middleware/auth.middleware.js';
import { randomUUID } from 'node:crypto';

@Controller('/api/v1/coupons')
export class CouponController {

  @Post('/validate')
  @ApiOperation({ summary: 'Validate a coupon code against cart total', tags: ['coupons'] })
  async validate(ctx: StreetContext): Promise<void> {
    const b = ctx.body as Record<string, unknown> | null;
    if (!b?.['code'] || b?.['cartTotalCents'] == null) {
      ctx.json({ error: { code: 'INVALID_BODY', message: 'code and cartTotalCents required' } }, 400); return;
    }
    const pool = getPool();
    const user = getUser(ctx);
    const cartTotalCents = Number(b['cartTotalCents']);

    const res = await pool.query(
      `SELECT * FROM coupons WHERE code = $1 AND active = true
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (usage_limit IS NULL OR usage_count < usage_limit)`,
      [String(b['code']).toUpperCase()],
    );
    if (!res.rows[0]) {
      ctx.json({ valid: false, reason: 'Coupon not found or expired' }); return;
    }
    const c = res.rows[0] as Record<string, unknown>;

    if (cartTotalCents < Number(c['min_order_cents'])) {
      ctx.json({ valid: false, reason: `Minimum order of $${Number(c['min_order_cents'])/100} required` }); return;
    }

    // Check per-user limit
    if (user && c['per_user_limit']) {
      const used = await pool.query(
        `SELECT COUNT(*) AS cnt FROM coupon_redemptions WHERE coupon_id = $1 AND user_id = $2`,
        [c['id'], user.id],
      );
      if (Number((used.rows[0] as Record<string,unknown>)['cnt']) >= Number(c['per_user_limit'])) {
        ctx.json({ valid: false, reason: 'Coupon already used' }); return;
      }
    }

    let discountCents = c['type'] === 'percentage'
      ? Math.round(cartTotalCents * Number(c['value']) / 100)
      : Math.round(Number(c['value']) * 100);

    if (c['max_discount_cents']) {
      discountCents = Math.min(discountCents, Number(c['max_discount_cents']));
    }

    ctx.json({
      valid: true,
      code: c['code'],
      type: c['type'],
      discountCents,
      discountAmount: discountCents / 100,
    });
  }

  @Get('/')
  @ApiOperation({ summary: '[Admin] List all coupons', tags: ['coupons'] })
  async list(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user?.roles.some(r => ['admin','super_admin'].includes(r))) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403); return;
    }
    const pool = getPool();
    const res = await pool.query(`SELECT * FROM coupons ORDER BY created_at DESC`);
    ctx.json({ items: res.rows });
  }

  @Post('/')
  @ApiOperation({ summary: '[Admin] Create coupon', tags: ['coupons'] })
  async create(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user?.roles.some(r => ['admin','super_admin'].includes(r))) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403); return;
    }
    const b = ctx.body as Record<string, unknown> | null;
    if (!b?.['code'] || !b?.['type'] || b?.['value'] == null) {
      ctx.json({ error: { code: 'INVALID_BODY', message: 'code, type, value required' } }, 400); return;
    }
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO coupons (id, code, type, value, min_order_cents, max_discount_cents, usage_limit, per_user_limit, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, String(b['code']).toUpperCase(), b['type'], b['value'],
       b['minOrderCents'] ?? 0, b['maxDiscountCents'] ?? null,
       b['usageLimit'] ?? null, b['perUserLimit'] ?? 1,
       b['expiresAt'] ?? null],
    );
    ctx.json({ id }, 201);
  }
}
