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
let BrandController = class BrandController {
    async list(ctx) {
        const pool = getPool();
        const res = await pool.query(`SELECT id, name, slug, description, logo_url, website FROM brands WHERE active = true ORDER BY name`);
        ctx.json({ items: res.rows });
    }
    async findBySlug(ctx) {
        const pool = getPool();
        const res = await pool.query(`SELECT id, name, slug, description, logo_url, website FROM brands WHERE slug = $1 AND active = true`, [ctx.params['slug']]);
        if (!res.rows[0]) {
            ctx.json({ error: { code: 'BRAND_NOT_FOUND', message: 'Brand not found' } }, 404);
            return;
        }
        ctx.json(res.rows[0]);
    }
    async create(ctx) {
        const user = getUser(ctx);
        if (!user?.roles.some(r => ['admin', 'super_admin'].includes(r))) {
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
        await pool.query(`INSERT INTO brands (id, name, slug, description, logo_url, website)
       VALUES ($1,$2,$3,$4,$5,$6)`, [id, body['name'], slug, body['description'] ?? null, body['logoUrl'] ?? null, body['website'] ?? null]);
        ctx.json({ id, slug }, 201);
    }
};
__decorate([
    Get('/'),
    ApiOperation({ summary: 'List all active brands', tags: ['brands'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BrandController.prototype, "list", null);
__decorate([
    Get('/:slug'),
    ApiOperation({ summary: 'Get brand by slug', tags: ['brands'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BrandController.prototype, "findBySlug", null);
__decorate([
    Post('/'),
    ApiOperation({ summary: '[Admin] Create brand', tags: ['brands'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BrandController.prototype, "create", null);
BrandController = __decorate([
    Controller('/api/v1/brands')
], BrandController);
export { BrandController };
