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
let WishlistController = class WishlistController {
    async get(ctx) {
        const user = getUser(ctx);
        if (!user) {
            ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401);
            return;
        }
        const pool = getPool();
        const res = await pool.query(`SELECT wi.id, wi.product_id, wi.created_at,
              p.name, p.slug, p.price_cents,
              pi.url AS image
       FROM wishlist_items wi
       JOIN products p ON p.id = wi.product_id
       LEFT JOIN LATERAL (
         SELECT url FROM product_images WHERE product_id = p.id
         ORDER BY is_primary DESC, sort_order LIMIT 1
       ) pi ON true
       WHERE wi.user_id = $1 ORDER BY wi.created_at DESC`, [user.id]);
        ctx.json({ items: res.rows.map(r => ({ ...r, price: Number(r['price_cents']) / 100 })) });
    }
    async add(ctx) {
        const user = getUser(ctx);
        if (!user) {
            ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401);
            return;
        }
        const body = ctx.body;
        if (!body?.['productId']) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'productId required' } }, 400);
            return;
        }
        const pool = getPool();
        try {
            await pool.query(`INSERT INTO wishlist_items (id, user_id, product_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [randomUUID(), user.id, body['productId']]);
            ctx.json({ success: true });
        }
        catch (err) {
            ctx.json({ error: { code: 'ADD_FAILED', message: err instanceof Error ? err.message : 'Failed' } }, 400);
        }
    }
    async remove(ctx) {
        const user = getUser(ctx);
        if (!user) {
            ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401);
            return;
        }
        const pool = getPool();
        await pool.query(`DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2`, [user.id, ctx.params['productId']]);
        ctx.json({ success: true });
    }
};
__decorate([
    Get('/'),
    ApiOperation({ summary: 'Get wishlist', tags: ['wishlist'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WishlistController.prototype, "get", null);
__decorate([
    Post('/items'),
    ApiOperation({ summary: 'Add product to wishlist', tags: ['wishlist'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WishlistController.prototype, "add", null);
__decorate([
    Delete('/items/:productId'),
    ApiOperation({ summary: 'Remove product from wishlist', tags: ['wishlist'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WishlistController.prototype, "remove", null);
WishlistController = __decorate([
    Controller('/api/v1/wishlist')
], WishlistController);
export { WishlistController };
