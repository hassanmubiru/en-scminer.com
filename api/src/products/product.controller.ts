import { Controller, Get, Post, Put, Delete, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { ProductService } from './product.service.js';
import { getUser } from '../middleware/auth.middleware.js';
import { randomUUID } from 'node:crypto';
import { getPool } from '../config/database.js';

@Controller('/api/v1/products')
export class ProductController {
  constructor(private readonly svc: ProductService) {}

  @Get('/')
  @ApiOperation({ summary: 'Search/list products with filtering and pagination', tags: ['products'] })
  async list(ctx: StreetContext): Promise<void> {
    const q = ctx.query as Record<string, string | undefined>;
    const result = await this.svc.search({
      q:            q['q'],
      category:     q['category'],
      brand:        q['brand'],
      algorithm:    q['algorithm'],
      minPrice:     q['minPrice']     ? Number(q['minPrice'])     : undefined,
      maxPrice:     q['maxPrice']     ? Number(q['maxPrice'])     : undefined,
      minHashrate:  q['minHashrate']  ? Number(q['minHashrate'])  : undefined,
      maxHashrate:  q['maxHashrate']  ? Number(q['maxHashrate'])  : undefined,
      stockStatus:  q['stockStatus'],
      featured:     q['featured'] === 'true',
      sort:         q['sort'],
      page:         q['page']  ? Number(q['page'])  : 1,
      limit:        q['limit'] ? Number(q['limit']) : 12,
    });
    ctx.json(result);
  }

  @Get('/slug/:slug')
  @ApiOperation({ summary: 'Get product by slug', tags: ['products'] })
  async findBySlug(ctx: StreetContext): Promise<void> {
    const product = await this.svc.findBySlug(ctx.params['slug'] ?? '');
    if (!product) { ctx.json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } }, 404); return; }
    ctx.json(product);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get product by ID', tags: ['products'] })
  async findById(ctx: StreetContext): Promise<void> {
    const product = await this.svc.findById(ctx.params['id'] ?? '');
    if (!product) { ctx.json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } }, 404); return; }
    ctx.json(product);
  }

  @Get('/:id/related')
  @ApiOperation({ summary: 'Get related products', tags: ['products'] })
  async related(ctx: StreetContext): Promise<void> {
    const q = ctx.query as Record<string, string | undefined>;
    const items = await this.svc.getRelated(ctx.params['id'] ?? '', Number(q['limit'] ?? 8));
    ctx.json({ items });
  }

  @Post('/')
  @ApiOperation({ summary: '[Admin] Create product', tags: ['products'] })
  async create(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user?.roles.some(r => ['admin','super_admin','staff'].includes(r))) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403); return;
    }
    const body = ctx.body as Record<string, unknown> | null;
    if (!body?.['name'] || !body?.['sku'] || body?.['priceCents'] == null) {
      ctx.json({ error: { code: 'INVALID_BODY', message: 'name, sku, priceCents required' } }, 400); return;
    }
    try {
      const id = await this.svc.create({
        name:                body['name'] as string,
        sku:                 body['sku'] as string,
        priceCents:          Number(body['priceCents']),
        shortDescription:    body['shortDescription'] as string | undefined,
        description:         body['description'] as string | undefined,
        brandId:             body['brandId'] as string | undefined,
        categoryId:          body['categoryId'] as string | undefined,
        status:              body['status'] as string | undefined,
        compareAtPriceCents: body['compareAtPriceCents'] != null ? Number(body['compareAtPriceCents']) : undefined,
        featured:            Boolean(body['featured']),
        hashrate:            body['hashrate'] != null ? Number(body['hashrate']) : undefined,
        hashrateUnit:        body['hashrateUnit'] as string | undefined,
        powerConsumption:    body['powerConsumption'] != null ? Number(body['powerConsumption']) : undefined,
        algorithm:           body['algorithm'] as string | undefined,
        coin:                body['coin'] as string | undefined,
        noiseLevel:          body['noiseLevel'] != null ? Number(body['noiseLevel']) : undefined,
        manufacturer:        body['manufacturer'] as string | undefined,
        warrantyMonths:      body['warrantyMonths'] != null ? Number(body['warrantyMonths']) : undefined,
      });
      ctx.json({ id }, 201);
    } catch (err) {
      ctx.json({ error: { code: 'CREATE_FAILED', message: err instanceof Error ? err.message : 'Failed' } }, 400);
    }
  }

  @Post('/:id/images')
  @ApiOperation({ summary: '[Admin] Add product image', tags: ['products'] })
  async addImage(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user?.roles.some(r => ['admin','super_admin','staff'].includes(r))) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403); return;
    }
    const body = ctx.body as Record<string, unknown> | null;
    if (!body?.['url']) { ctx.json({ error: { code: 'INVALID_BODY', message: 'url required' } }, 400); return; }

    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO product_images (id, product_id, url, alt, sort_order, is_primary)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, ctx.params['id'], body['url'], body['alt'] ?? '',
       body['sortOrder'] ?? 0, body['isPrimary'] ?? false],
    );
    ctx.json({ id }, 201);
  }

  @Post('/:id/specs')
  @ApiOperation({ summary: '[Admin] Add product specification', tags: ['products'] })
  async addSpec(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user?.roles.some(r => ['admin','super_admin','staff'].includes(r))) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403); return;
    }
    const body = ctx.body as Record<string, unknown> | null;
    if (!body?.['label'] || !body?.['value']) {
      ctx.json({ error: { code: 'INVALID_BODY', message: 'label and value required' } }, 400); return;
    }
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO product_specs (id, product_id, label, value, sort_order) VALUES ($1,$2,$3,$4,$5)`,
      [id, ctx.params['id'], body['label'], body['value'], body['sortOrder'] ?? 0],
    );
    ctx.json({ id }, 201);
  }

  @Delete('/:id')
  @ApiOperation({ summary: '[Admin] Archive product (soft delete)', tags: ['products'] })
  async archive(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user?.roles.some(r => ['admin','super_admin'].includes(r))) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403); return;
    }
    const pool = getPool();
    await pool.query(
      `UPDATE products SET status = 'archived', updated_at = NOW() WHERE id = $1`,
      [ctx.params['id']],
    );
    ctx.json({ success: true });
  }
}


