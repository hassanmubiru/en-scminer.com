import { Controller, Get, Post, Patch, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { getPool } from '../config/database.js';
import { getUser } from '../middleware/auth.middleware.js';
import { CheckoutService } from '../checkout/checkout.service.js';

@Controller('/api/v1/orders')
export class OrderController {
  constructor(private readonly checkoutSvc: CheckoutService) {}

  @Post('/')
  @ApiOperation({ summary: 'Place an order (server-authoritative totals)', tags: ['orders'] })
  async create(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401); return; }

    const b = ctx.body as Record<string, unknown> | null;
    if (!b?.['shippingMethodId'] || !b?.['billingAddress'] || !b?.['paymentMethod']) {
      ctx.json({ error: { code: 'INVALID_BODY', message: 'shippingMethodId, billingAddress, paymentMethod required' } }, 400);
      return;
    }

    const validMethods = ['BANK_WIRE','BTC','ETH','USDT_ERC20','USDT_TRC20','USDT_BEP20'];
    if (!validMethods.includes(String(b['paymentMethod']))) {
      ctx.json({ error: { code: 'INVALID_PAYMENT_METHOD', message: `paymentMethod must be one of: ${validMethods.join(', ')}` } }, 400);
      return;
    }

    try {
      const result = await this.checkoutSvc.createOrder({
        userId:           user.id,
        cartId:           '',       // resolved internally from userId
        billingAddress:   b['billingAddress'] as never,
        shippingAddress:  b['shippingAddress'] as never | undefined,
        shippingMethodId: String(b['shippingMethodId']),
        couponCode:       b['couponCode'] ? String(b['couponCode']) : undefined,
        customerNote:     b['customerNote'] ? String(b['customerNote']) : undefined,
        paymentMethod:    b['paymentMethod'] as never,
      });
      ctx.json(result, 201);
    } catch (err) {
      ctx.json({ error: { code: 'ORDER_FAILED', message: err instanceof Error ? err.message : 'Order creation failed' } }, 400);
    }
  }

  @Get('/')
  @ApiOperation({ summary: 'List orders for authenticated customer', tags: ['orders'] })
  async list(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401); return; }

    const pool = getPool();
    const q = ctx.query as Record<string, string | undefined>;
    const page  = Math.max(1, Number(q['page']  ?? 1));
    const limit = Math.min(50, Number(q['limit'] ?? 10));
    const offset = (page - 1) * limit;

    const isAdmin = user.roles.some(r => ['admin','super_admin','staff'].includes(r));

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT id, order_number, status, total_cents, currency, created_at
         FROM orders ${isAdmin ? '' : 'WHERE user_id = $3'}
         ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        isAdmin ? [limit, offset] : [limit, offset, user.id],
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM orders ${isAdmin ? '' : 'WHERE user_id = $1'}`,
        isAdmin ? [] : [user.id],
      ),
    ]);

    ctx.json({
      items: dataRes.rows.map(r => {
        const row = r as Record<string, unknown>;
        return { ...row, total: Number(row['total_cents']) / 100 };
      }),
      total: Number((countRes.rows[0] as Record<string,unknown>)['total'] ?? 0),
      page, limit,
    });
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get order details', tags: ['orders'] })
  async findOne(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401); return; }

    const pool = getPool();
    const orderId = ctx.params['id'] ?? '';
    const isAdmin = user.roles.some(r => ['admin','super_admin','staff'].includes(r));

    const orderRes = await pool.query(
      `SELECT o.*, sm.name AS shipping_method_name
       FROM orders o
       LEFT JOIN shipping_methods sm ON sm.id = o.shipping_method_id
       WHERE o.id = $1 ${isAdmin ? '' : 'AND o.user_id = $2'}`,
      isAdmin ? [orderId] : [orderId, user.id],
    );
    if (!orderRes.rows[0]) {
      ctx.json({ error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } }, 404); return;
    }

    const order = orderRes.rows[0] as Record<string, unknown>;

    const [itemsRes, addressesRes, paymentsRes] = await Promise.all([
      pool.query(
        `SELECT product_name, product_sku, unit_price_cents, quantity, subtotal_cents
         FROM order_items WHERE order_id = $1`, [orderId],
      ),
      pool.query(
        `SELECT type, first_name, last_name, line1, city, postcode, country_code
         FROM order_addresses WHERE order_id = $1`, [orderId],
      ),
      pool.query(
        `SELECT method, status, amount_cents, currency, created_at
         FROM payments WHERE order_id = $1 ORDER BY created_at DESC`, [orderId],
      ),
    ]);

    ctx.json({
      ...order,
      total:          Number(order['total_cents']) / 100,
      subtotal:       Number(order['subtotal_cents']) / 100,
      shippingAmount: Number(order['shipping_cents']) / 100,
      discount:       Number(order['discount_cents']) / 100,
      items:          itemsRes.rows.map(r => {
        const row = r as Record<string, unknown>;
        return { ...row, unitPrice: Number(row['unit_price_cents'])/100, subtotal: Number(row['subtotal_cents'])/100 };
      }),
      addresses:  addressesRes.rows,
      payments:   paymentsRes.rows.map(r => {
        const row = r as Record<string, unknown>;
        return { ...row, amount: Number(row['amount_cents'])/100 };
      }),
    });
  }

  @Patch('/:id/status')
  @ApiOperation({ summary: '[Admin] Update order status', tags: ['orders'] })
  async updateStatus(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user?.roles.some(r => ['admin','super_admin','staff'].includes(r))) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403); return;
    }
    const b = ctx.body as Record<string, unknown> | null;
    if (!b?.['status']) {
      ctx.json({ error: { code: 'INVALID_BODY', message: 'status required' } }, 400); return;
    }
    const pool = getPool();
    await pool.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [b['status'], ctx.params['id']],
    );
    ctx.json({ success: true });
  }
}
