var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Get, Post, Delete, ApiOperation } from 'streetjs';
import { getPool } from '../config/database.js';
import { getUser } from '../middleware/auth.middleware.js';
import { randomUUID } from 'node:crypto';
const MAX_COMPARE = 4;
let CompareController = class CompareController {
    async get(ctx) {
        const user = getUser(ctx);
        const sessionId = ctx.headers['x-session-id'];
        if (!user && !sessionId) {
            ctx.json({ items: [] });
            return;
        }
        const pool = getPool();
        const condition = user ? 'ci.user_id = $1' : 'ci.session_id = $1';
        const param = user ? user.id : sessionId;
        const res = await pool.query(`SELECT p.id, p.slug, p.name, p.price_cents, p.hashrate, p.hashrate_unit,
              p.power_consumption, p.algorithm, p.noise_level, p.rating,
              pi.url AS image
       FROM compare_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN LATERAL (
         SELECT url FROM product_images WHERE product_id = p.id
         ORDER BY is_primary DESC, sort_order LIMIT 1
       ) pi ON true
       WHERE ${condition} ORDER BY ci.created_at`, [param]);
        ctx.json({ items: res.rows.map(r => ({ ...r, price: Number(r['price_cents']) / 100 })) });
    }
    async add(ctx) {
        const user = getUser(ctx);
        const sessionId = ctx.headers['x-session-id'];
        const body = ctx.body;
        if (!body?.['productId']) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'productId required' } }, 400);
            return;
        }
        const pool = getPool();
        const condition = user ? 'user_id = $1' : 'session_id = $1';
        const param = user ? user.id : sessionId;
        const count = await pool.query(`SELECT COUNT(*) AS c FROM compare_items WHERE ${condition}`, [param]);
        if (Number(count.rows[0]['c']) >= MAX_COMPARE) {
            ctx.json({ error: { code: 'COMPARE_LIMIT', message: `Maximum ${MAX_COMPARE} products for comparison` } }, 400);
            return;
        }
        await pool.query(`INSERT INTO compare_items (id, user_id, session_id, product_id) VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING`, [randomUUID(), user?.id ?? null, user ? null : sessionId, body['productId']]);
        ctx.json({ success: true });
    }
    async remove(ctx) {
        const user = getUser(ctx);
        const sessionId = ctx.headers['x-session-id'];
        const pool = getPool();
        const condition = user ? 'user_id = $1 AND product_id = $2' : 'session_id = $1 AND product_id = $2';
        const param = user ? user.id : sessionId;
        await pool.query(`DELETE FROM compare_items WHERE ${condition}`, [param, ctx.params['productId']]);
        ctx.json({ success: true });
    }
};
__decorate([
    Get('/'),
    ApiOperation({ summary: 'Get comparison list', tags: ['compare'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CompareController.prototype, "get", null);
__decorate([
    Post('/items'),
    ApiOperation({ summary: 'Add product to compare list', tags: ['compare'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CompareController.prototype, "add", null);
__decorate([
    Delete('/items/:productId'),
    ApiOperation({ summary: 'Remove product from compare list', tags: ['compare'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CompareController.prototype, "remove", null);
CompareController = __decorate([
    Controller('/api/v1/compare')
], CompareController);
export { CompareController };
