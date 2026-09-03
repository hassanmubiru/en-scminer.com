var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Get, Post, ApiOperation } from 'streetjs';
import { getPool } from '../config/database.js';
import { getUser } from '../middleware/auth.middleware.js';
import { randomUUID } from 'node:crypto';
import { toSlug } from '../common/slug.js';
let CategoryController = class CategoryController {
    async list(ctx) {
        const pool = getPool();
        const res = await pool.query(`SELECT id, name, slug, description, parent_id, image_url, sort_order
       FROM categories WHERE active = true ORDER BY sort_order, name`);
        ctx.json({ items: res.rows });
    }
    async findBySlug(ctx) {
        const pool = getPool();
        const res = await pool.query(`SELECT id, name, slug, description, parent_id, image_url, sort_order
       FROM categories WHERE slug = $1 AND active = true`, [ctx.params['slug']]);
        if (!res.rows[0]) {
            ctx.json({ error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' } }, 404);
            return;
        }
        ctx.json(res.rows[0]);
    }
    async create(ctx) {
        const user = getUser(ctx);
        if (!user?.roles.some(r => ['admin', 'super_admin', 'staff'].includes(r))) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403);
            return;
        }
        const body = ctx.body;
        if (!body?.['name']) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'name required' } }, 400);
            return;
        }
        const pool = getPool();
        const id = randomUUID();
        const slug = toSlug(String(body['name']));
        await pool.query(`INSERT INTO categories (id, name, slug, description, parent_id, image_url, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, body['name'], slug, body['description'] ?? null,
            body['parentId'] ?? null, body['imageUrl'] ?? null, body['sortOrder'] ?? 0]);
        ctx.json({ id, slug }, 201);
    }
};
__decorate([
    Get('/'),
    ApiOperation({ summary: 'List all active categories', tags: ['categories'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "list", null);
__decorate([
    Get('/:slug'),
    ApiOperation({ summary: 'Get category by slug', tags: ['categories'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "findBySlug", null);
__decorate([
    Post('/'),
    ApiOperation({ summary: '[Admin] Create category', tags: ['categories'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "create", null);
CategoryController = __decorate([
    Controller('/api/v1/categories')
], CategoryController);
export { CategoryController };
