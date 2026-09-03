var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Get, Patch, ApiOperation } from 'streetjs';
import { getPool } from '../config/database.js';
import { getUser } from '../middleware/auth.middleware.js';
import { AuditService } from '../audit/audit.service.js';
let AdminController = class AdminController {
    audit = new AuditService();
    isAdmin(ctx) {
        const user = getUser(ctx);
        return !!user?.roles.some(r => ['admin', 'super_admin'].includes(r));
    }
    async dashboard(ctx) {
        if (!this.isAdmin(ctx)) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin required' } }, 403);
            return;
        }
        const pool = getPool();
        const [orders, revenue, customers, products, pendingPayments, pendingReviews, newMessages] = await Promise.all([
            pool.query(`SELECT COUNT(*) AS total, status FROM orders GROUP BY status`),
            pool.query(`SELECT COALESCE(SUM(total_cents),0) AS total FROM orders WHERE status NOT IN ('CANCELLED','REFUNDED')`),
            pool.query(`SELECT COUNT(*) AS total FROM users WHERE status = 'active'`),
            pool.query(`SELECT COUNT(*) AS total FROM products WHERE status = 'active'`),
            pool.query(`SELECT COUNT(*) AS total FROM payments WHERE status IN ('AWAITING_PAYMENT','CONFIRMING','MANUAL_REVIEW')`),
            pool.query(`SELECT COUNT(*) AS total FROM reviews WHERE status = 'PENDING'`),
            pool.query(`SELECT COUNT(*) AS total FROM contact_messages WHERE status = 'NEW'`),
        ]);
        ctx.json({
            orders: orders.rows,
            totalRevenueCents: Number(revenue.rows[0]['total'] ?? 0),
            totalRevenue: Number(revenue.rows[0]['total'] ?? 0) / 100,
            totalCustomers: Number(customers.rows[0]['total'] ?? 0),
            totalProducts: Number(products.rows[0]['total'] ?? 0),
            pendingPayments: Number(pendingPayments.rows[0]['total'] ?? 0),
            pendingReviews: Number(pendingReviews.rows[0]['total'] ?? 0),
            newMessages: Number(newMessages.rows[0]['total'] ?? 0),
        });
    }
    async customers(ctx) {
        if (!this.isAdmin(ctx)) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin required' } }, 403);
            return;
        }
        const pool = getPool();
        const q = ctx.query;
        const page = Math.max(1, Number(q['page'] ?? 1));
        const limit = Math.min(100, Number(q['limit'] ?? 20));
        const offset = (page - 1) * limit;
        const [data, count] = await Promise.all([
            pool.query(`SELECT id, email, first_name, last_name, phone, company, status, created_at
         FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]),
            pool.query(`SELECT COUNT(*) AS total FROM users`),
        ]);
        ctx.json({
            items: data.rows,
            total: Number(count.rows[0]['total'] ?? 0),
            page, limit,
        });
    }
    async customerStatus(ctx) {
        const user = getUser(ctx);
        if (!this.isAdmin(ctx)) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin required' } }, 403);
            return;
        }
        const b = ctx.body;
        const status = String(b?.['status'] ?? '');
        if (!['active', 'suspended'].includes(status)) {
            ctx.json({ error: { code: 'INVALID_STATUS', message: 'status must be active or suspended' } }, 400);
            return;
        }
        const pool = getPool();
        const before = await pool.query(`SELECT status FROM users WHERE id = $1`, [ctx.params['id']]);
        await pool.query(`UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`, [status, ctx.params['id']]);
        await this.audit.log({
            actorId: user?.id,
            action: 'UPDATE_CUSTOMER_STATUS',
            entity: 'users',
            entityId: ctx.params['id'],
            before: before.rows[0],
            after: { status },
        });
        ctx.json({ success: true });
    }
    async pendingPayments(ctx) {
        if (!this.isAdmin(ctx)) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin required' } }, 403);
            return;
        }
        const pool = getPool();
        const res = await pool.query(`SELECT p.id, p.order_id, p.method, p.status, p.amount_cents, p.crypto_amount,
              p.crypto_amount_received, p.expires_at, p.created_at,
              o.order_number, sa.symbol, sa.network, w.address AS receiving_address
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       LEFT JOIN supported_assets sa ON sa.id = p.asset_id
       LEFT JOIN wallets w ON w.id = p.wallet_id
       WHERE p.status IN ('AWAITING_PAYMENT','PAYMENT_DETECTED','CONFIRMING','UNDERPAID','OVERPAID','MANUAL_REVIEW')
       ORDER BY p.created_at`);
        ctx.json({ items: res.rows.map(r => ({ ...r, amount: Number(r['amount_cents']) / 100 })) });
    }
    async manualConfirm(ctx) {
        const user = getUser(ctx);
        if (!user?.roles.some(r => r === 'super_admin')) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'super_admin required for manual payment confirmation' } }, 403);
            return;
        }
        const pool = getPool();
        const before = await pool.query(`SELECT status, order_id FROM payments WHERE id = $1`, [ctx.params['id']]);
        if (!before.rows[0]) {
            ctx.json({ error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
            return;
        }
        const prev = before.rows[0];
        await pool.query(`UPDATE payments SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1`, [ctx.params['id']]);
        await pool.query(`UPDATE orders SET status = 'PAID', updated_at = NOW() WHERE id = $1`, [prev['order_id']]);
        await this.audit.log({
            actorId: user.id,
            action: 'MANUAL_PAYMENT_CONFIRM',
            entity: 'payments',
            entityId: ctx.params['id'],
            before: { status: prev['status'] },
            after: { status: 'CONFIRMED', manuallyConfirmedBy: user.id },
        });
        ctx.json({ success: true });
    }
    async auditLog(ctx) {
        if (!this.isAdmin(ctx)) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin required' } }, 403);
            return;
        }
        const q = ctx.query;
        const result = await this.audit.query({
            entity: q['entity'],
            actorId: q['actorId'],
            page: q['page'] ? Number(q['page']) : 1,
            limit: q['limit'] ? Number(q['limit']) : 20,
        });
        ctx.json(result);
    }
    async getSettings(ctx) {
        if (!this.isAdmin(ctx)) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin required' } }, 403);
            return;
        }
        const pool = getPool();
        const res = await pool.query(`SELECT key, value FROM system_settings ORDER BY key`);
        const settings = {};
        for (const row of res.rows) {
            settings[String(row['key'])] = row['value'];
        }
        ctx.json(settings);
    }
    async updateSetting(ctx) {
        const user = getUser(ctx);
        if (!user?.roles.some(r => ['admin', 'super_admin'].includes(r))) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin required' } }, 403);
            return;
        }
        const b = ctx.body;
        if (!b || !('value' in b)) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'value required' } }, 400);
            return;
        }
        const pool = getPool();
        const before = await pool.query(`SELECT value FROM system_settings WHERE key = $1`, [ctx.params['key']]);
        await pool.query(`INSERT INTO system_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [ctx.params['key'], JSON.stringify(b['value'])]);
        await this.audit.log({
            actorId: user.id,
            action: 'UPDATE_SETTING',
            entity: 'system_settings',
            entityId: String(ctx.params['key']),
            before: before.rows[0] ?? null,
            after: { value: b['value'] },
        });
        ctx.json({ success: true });
    }
};
__decorate([
    Get('/dashboard'),
    ApiOperation({ summary: 'Admin dashboard stats', tags: ['admin'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "dashboard", null);
__decorate([
    Get('/customers'),
    ApiOperation({ summary: '[Admin] List customers', tags: ['admin'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "customers", null);
__decorate([
    Patch('/customers/:id/status'),
    ApiOperation({ summary: '[Admin] Update customer status', tags: ['admin'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "customerStatus", null);
__decorate([
    Get('/payments/pending'),
    ApiOperation({ summary: '[Admin] Payments requiring attention', tags: ['admin'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "pendingPayments", null);
__decorate([
    Patch('/payments/:id/manual-confirm'),
    ApiOperation({ summary: '[Admin] Manually confirm a payment (elevated permission + audit)', tags: ['admin'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "manualConfirm", null);
__decorate([
    Get('/audit'),
    ApiOperation({ summary: '[Admin] Query audit log', tags: ['admin'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "auditLog", null);
__decorate([
    Get('/settings'),
    ApiOperation({ summary: '[Admin] Get system settings', tags: ['admin'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getSettings", null);
__decorate([
    Patch('/settings/:key'),
    ApiOperation({ summary: '[Admin] Update a system setting', tags: ['admin'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateSetting", null);
AdminController = __decorate([
    Controller('/api/v1/admin')
], AdminController);
export { AdminController };
