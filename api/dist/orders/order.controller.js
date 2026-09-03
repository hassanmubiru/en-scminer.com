var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Get, Post, Patch, ApiOperation } from 'streetjs';
import { getPool } from '../config/database.js';
import { getUser } from '../middleware/auth.middleware.js';
import { CheckoutService } from '../checkout/checkout.service.js';
let OrderController = class OrderController {
    checkoutSvc;
    constructor(checkoutSvc) {
        this.checkoutSvc = checkoutSvc;
    }
    async create(ctx) {
        const user = getUser(ctx);
        if (!user) {
            ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401);
            return;
        }
        const b = ctx.body;
        if (!b?.['shippingMethodId'] || !b?.['billingAddress'] || !b?.['paymentMethod']) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'shippingMethodId, billingAddress, paymentMethod required' } }, 400);
            return;
        }
        const validMethods = ['BANK_WIRE', 'BTC', 'ETH', 'USDT_ERC20', 'USDT_TRC20', 'USDT_BEP20'];
        if (!validMethods.includes(String(b['paymentMethod']))) {
            ctx.json({ error: { code: 'INVALID_PAYMENT_METHOD', message: `paymentMethod must be one of: ${validMethods.join(', ')}` } }, 400);
            return;
        }
        try {
            const result = await this.checkoutSvc.createOrder({
                userId: user.id,
                cartId: '', // resolved internally from userId
                billingAddress: b['billingAddress'],
                shippingAddress: b['shippingAddress'],
                shippingMethodId: String(b['shippingMethodId']),
                couponCode: b['couponCode'] ? String(b['couponCode']) : undefined,
                customerNote: b['customerNote'] ? String(b['customerNote']) : undefined,
                paymentMethod: b['paymentMethod'],
            });
            ctx.json(result, 201);
        }
        catch (err) {
            ctx.json({ error: { code: 'ORDER_FAILED', message: err instanceof Error ? err.message : 'Order creation failed' } }, 400);
        }
    }
    async list(ctx) {
        const user = getUser(ctx);
        if (!user) {
            ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401);
            return;
        }
        const pool = getPool();
        const q = ctx.query;
        const page = Math.max(1, Number(q['page'] ?? 1));
        const limit = Math.min(50, Number(q['limit'] ?? 10));
        const offset = (page - 1) * limit;
        const isAdmin = user.roles.some(r => ['admin', 'super_admin', 'staff'].includes(r));
        const [dataRes, countRes] = await Promise.all([
            pool.query(`SELECT id, order_number, status, total_cents, currency, created_at
         FROM orders ${isAdmin ? '' : 'WHERE user_id = $3'}
         ORDER BY created_at DESC LIMIT $1 OFFSET $2`, isAdmin ? [limit, offset] : [limit, offset, user.id]),
            pool.query(`SELECT COUNT(*) AS total FROM orders ${isAdmin ? '' : 'WHERE user_id = $1'}`, isAdmin ? [] : [user.id]),
        ]);
        ctx.json({
            items: dataRes.rows.map(r => {
                const row = r;
                return { ...row, total: Number(row['total_cents']) / 100 };
            }),
            total: Number(countRes.rows[0]['total'] ?? 0),
            page, limit,
        });
    }
    async findOne(ctx) {
        const user = getUser(ctx);
        if (!user) {
            ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401);
            return;
        }
        const pool = getPool();
        const orderId = ctx.params['id'] ?? '';
        const isAdmin = user.roles.some(r => ['admin', 'super_admin', 'staff'].includes(r));
        const orderRes = await pool.query(`SELECT o.*, sm.name AS shipping_method_name
       FROM orders o
       LEFT JOIN shipping_methods sm ON sm.id = o.shipping_method_id
       WHERE o.id = $1 ${isAdmin ? '' : 'AND o.user_id = $2'}`, isAdmin ? [orderId] : [orderId, user.id]);
        if (!orderRes.rows[0]) {
            ctx.json({ error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } }, 404);
            return;
        }
        const order = orderRes.rows[0];
        const [itemsRes, addressesRes, paymentsRes] = await Promise.all([
            pool.query(`SELECT product_name, product_sku, unit_price_cents, quantity, subtotal_cents
         FROM order_items WHERE order_id = $1`, [orderId]),
            pool.query(`SELECT type, first_name, last_name, line1, city, postcode, country_code
         FROM order_addresses WHERE order_id = $1`, [orderId]),
            pool.query(`SELECT method, status, amount_cents, currency, created_at
         FROM payments WHERE order_id = $1 ORDER BY created_at DESC`, [orderId]),
        ]);
        ctx.json({
            ...order,
            total: Number(order['total_cents']) / 100,
            subtotal: Number(order['subtotal_cents']) / 100,
            shippingAmount: Number(order['shipping_cents']) / 100,
            discount: Number(order['discount_cents']) / 100,
            items: itemsRes.rows.map(r => {
                const row = r;
                return { ...row, unitPrice: Number(row['unit_price_cents']) / 100, subtotal: Number(row['subtotal_cents']) / 100 };
            }),
            addresses: addressesRes.rows,
            payments: paymentsRes.rows.map(r => {
                const row = r;
                return { ...row, amount: Number(row['amount_cents']) / 100 };
            }),
        });
    }
    async updateStatus(ctx) {
        const user = getUser(ctx);
        if (!user?.roles.some(r => ['admin', 'super_admin', 'staff'].includes(r))) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403);
            return;
        }
        const b = ctx.body;
        if (!b?.['status']) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'status required' } }, 400);
            return;
        }
        const pool = getPool();
        await pool.query(`UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`, [b['status'], ctx.params['id']]);
        ctx.json({ success: true });
    }
};
__decorate([
    Post('/'),
    ApiOperation({ summary: 'Place an order (server-authoritative totals)', tags: ['orders'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "create", null);
__decorate([
    Get('/'),
    ApiOperation({ summary: 'List orders for authenticated customer', tags: ['orders'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "list", null);
__decorate([
    Get('/:id'),
    ApiOperation({ summary: 'Get order details', tags: ['orders'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "findOne", null);
__decorate([
    Patch('/:id/status'),
    ApiOperation({ summary: '[Admin] Update order status', tags: ['orders'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "updateStatus", null);
OrderController = __decorate([
    Controller('/api/v1/orders'),
    __metadata("design:paramtypes", [CheckoutService])
], OrderController);
export { OrderController };
