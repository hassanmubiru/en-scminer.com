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
import { ProductService } from './product.service.js';
import { getUser } from '../middleware/auth.middleware.js';
import { randomUUID } from 'node:crypto';
import { getPool } from '../config/database.js';
let ProductController = class ProductController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    async list(ctx) {
        const q = ctx.query;
        const result = await this.svc.search({
            q: q['q'],
            category: q['category'],
            brand: q['brand'],
            algorithm: q['algorithm'],
            minPrice: q['minPrice'] ? Number(q['minPrice']) : undefined,
            maxPrice: q['maxPrice'] ? Number(q['maxPrice']) : undefined,
            minHashrate: q['minHashrate'] ? Number(q['minHashrate']) : undefined,
            maxHashrate: q['maxHashrate'] ? Number(q['maxHashrate']) : undefined,
            stockStatus: q['stockStatus'],
            featured: q['featured'] === 'true',
            sort: q['sort'],
            page: q['page'] ? Number(q['page']) : 1,
            limit: q['limit'] ? Number(q['limit']) : 12,
        });
        ctx.json(result);
    }
    async findBySlug(ctx) {
        const product = await this.svc.findBySlug(ctx.params['slug'] ?? '');
        if (!product) {
            ctx.json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } }, 404);
            return;
        }
        ctx.json(product);
    }
    async findById(ctx) {
        const product = await this.svc.findById(ctx.params['id'] ?? '');
        if (!product) {
            ctx.json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } }, 404);
            return;
        }
        ctx.json(product);
    }
    async related(ctx) {
        const q = ctx.query;
        const items = await this.svc.getRelated(ctx.params['id'] ?? '', Number(q['limit'] ?? 8));
        ctx.json({ items });
    }
    async create(ctx) {
        const user = getUser(ctx);
        if (!user?.roles.some(r => ['admin', 'super_admin', 'staff'].includes(r))) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403);
            return;
        }
        const body = ctx.body;
        if (!body?.['name'] || !body?.['sku'] || body?.['priceCents'] == null) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'name, sku, priceCents required' } }, 400);
            return;
        }
        try {
            const id = await this.svc.create({
                name: body['name'],
                sku: body['sku'],
                priceCents: Number(body['priceCents']),
                shortDescription: body['shortDescription'],
                description: body['description'],
                brandId: body['brandId'],
                categoryId: body['categoryId'],
                status: body['status'],
                compareAtPriceCents: body['compareAtPriceCents'] != null ? Number(body['compareAtPriceCents']) : undefined,
                featured: Boolean(body['featured']),
                hashrate: body['hashrate'] != null ? Number(body['hashrate']) : undefined,
                hashrateUnit: body['hashrateUnit'],
                powerConsumption: body['powerConsumption'] != null ? Number(body['powerConsumption']) : undefined,
                algorithm: body['algorithm'],
                coin: body['coin'],
                noiseLevel: body['noiseLevel'] != null ? Number(body['noiseLevel']) : undefined,
                manufacturer: body['manufacturer'],
                warrantyMonths: body['warrantyMonths'] != null ? Number(body['warrantyMonths']) : undefined,
            });
            ctx.json({ id }, 201);
        }
        catch (err) {
            ctx.json({ error: { code: 'CREATE_FAILED', message: err instanceof Error ? err.message : 'Failed' } }, 400);
        }
    }
    async addImage(ctx) {
        const user = getUser(ctx);
        if (!user?.roles.some(r => ['admin', 'super_admin', 'staff'].includes(r))) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403);
            return;
        }
        const body = ctx.body;
        if (!body?.['url']) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'url required' } }, 400);
            return;
        }
        const pool = getPool();
        const id = randomUUID();
        await pool.query(`INSERT INTO product_images (id, product_id, url, alt, sort_order, is_primary)
       VALUES ($1,$2,$3,$4,$5,$6)`, [id, ctx.params['id'], body['url'], body['alt'] ?? '',
            body['sortOrder'] ?? 0, body['isPrimary'] ?? false]);
        ctx.json({ id }, 201);
    }
    async addSpec(ctx) {
        const user = getUser(ctx);
        if (!user?.roles.some(r => ['admin', 'super_admin', 'staff'].includes(r))) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403);
            return;
        }
        const body = ctx.body;
        if (!body?.['label'] || !body?.['value']) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'label and value required' } }, 400);
            return;
        }
        const pool = getPool();
        const id = randomUUID();
        await pool.query(`INSERT INTO product_specs (id, product_id, label, value, sort_order) VALUES ($1,$2,$3,$4,$5)`, [id, ctx.params['id'], body['label'], body['value'], body['sortOrder'] ?? 0]);
        ctx.json({ id }, 201);
    }
    async archive(ctx) {
        const user = getUser(ctx);
        if (!user?.roles.some(r => ['admin', 'super_admin'].includes(r))) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403);
            return;
        }
        const pool = getPool();
        await pool.query(`UPDATE products SET status = 'archived', updated_at = NOW() WHERE id = $1`, [ctx.params['id']]);
        ctx.json({ success: true });
    }
};
__decorate([
    Get('/'),
    ApiOperation({ summary: 'Search/list products with filtering and pagination', tags: ['products'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "list", null);
__decorate([
    Get('/slug/:slug'),
    ApiOperation({ summary: 'Get product by slug', tags: ['products'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "findBySlug", null);
__decorate([
    Get('/:id'),
    ApiOperation({ summary: 'Get product by ID', tags: ['products'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "findById", null);
__decorate([
    Get('/:id/related'),
    ApiOperation({ summary: 'Get related products', tags: ['products'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "related", null);
__decorate([
    Post('/'),
    ApiOperation({ summary: '[Admin] Create product', tags: ['products'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "create", null);
__decorate([
    Post('/:id/images'),
    ApiOperation({ summary: '[Admin] Add product image', tags: ['products'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "addImage", null);
__decorate([
    Post('/:id/specs'),
    ApiOperation({ summary: '[Admin] Add product specification', tags: ['products'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "addSpec", null);
__decorate([
    Delete('/:id'),
    ApiOperation({ summary: '[Admin] Archive product (soft delete)', tags: ['products'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "archive", null);
ProductController = __decorate([
    Controller('/api/v1/products'),
    __metadata("design:paramtypes", [ProductService])
], ProductController);
export { ProductController };
