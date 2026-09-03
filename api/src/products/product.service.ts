import { Injectable } from 'streetjs';
import { randomUUID } from 'node:crypto';
import { getPool } from '../config/database.js';
import { parsePagination, paginate, type PaginatedResult } from '../common/pagination.js';
import { toSlug } from '../common/slug.js';
import { dollarsToCents } from '../common/money.js';

export interface ProductRow {
  id: string;
  slug: string;
  sku: string;
  name: string;
  short_description: string;
  description: string;
  brand_id: string | null;
  category_id: string | null;
  status: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  currency: string;
  featured: boolean;
  rating: number;
  review_count: number;
  hashrate: number | null;
  hashrate_unit: string | null;
  power_consumption: number | null;
  algorithm: string | null;
  coin: string | null;
  noise_level: number | null;
  manufacturer: string | null;
  warranty_months: number | null;
  created_at: string;
  updated_at: string;
  // joined
  brand_name?: string | null;
  brand_slug?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
}

export interface ProductSearchQuery {
  q?: string;
  category?: string;
  brand?: string;
  algorithm?: string;
  minPrice?: number;
  maxPrice?: number;
  minHashrate?: number;
  maxHashrate?: number;
  stockStatus?: string;
  featured?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface CreateProductInput {
  name: string;
  slug?: string;
  sku: string;
  shortDescription?: string;
  description?: string;
  brandId?: string;
  categoryId?: string;
  status?: string;
  priceCents: number;
  compareAtPriceCents?: number;
  featured?: boolean;
  hashrate?: number;
  hashrateUnit?: string;
  powerConsumption?: number;
  algorithm?: string;
  coin?: string;
  noiseLevel?: number;
  manufacturer?: string;
  warrantyMonths?: number;
}

@Injectable()
export class ProductService {

  async search(query: ProductSearchQuery): Promise<PaginatedResult<Record<string, unknown>>> {
    const pool = getPool();
    const { page, limit, offset } = parsePagination(
      { page: String(query.page ?? 1), limit: String(query.limit ?? 12) },
    );

    const conditions: string[] = ["p.status = 'active'"];
    const params: unknown[] = [];
    let p = 1;

    if (query.q) {
      conditions.push(`to_tsvector('english', coalesce(p.name,'') || ' ' || coalesce(p.short_description,'')) @@ plainto_tsquery('english', $${p})`);
      params.push(query.q); p++;
    }
    if (query.category) {
      conditions.push(`c.slug = $${p}`); params.push(query.category); p++;
    }
    if (query.brand) {
      conditions.push(`b.slug = $${p}`); params.push(query.brand); p++;
    }
    if (query.algorithm) {
      conditions.push(`p.algorithm ILIKE $${p}`); params.push(`%${query.algorithm}%`); p++;
    }
    if (query.minPrice != null) {
      conditions.push(`p.price_cents >= $${p}`); params.push(dollarsToCents(query.minPrice)); p++;
    }
    if (query.maxPrice != null) {
      conditions.push(`p.price_cents <= $${p}`); params.push(dollarsToCents(query.maxPrice)); p++;
    }
    if (query.minHashrate != null) {
      conditions.push(`p.hashrate >= $${p}`); params.push(query.minHashrate); p++;
    }
    if (query.maxHashrate != null) {
      conditions.push(`p.hashrate <= $${p}`); params.push(query.maxHashrate); p++;
    }
    if (query.featured) {
      conditions.push(`p.featured = true`);
    }
    if (query.stockStatus === 'instock') {
      conditions.push(`EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.id AND (i.quantity_on_hand - i.quantity_reserved) > 0)`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortMap: Record<string, string> = {
      default:        'p.featured DESC, p.rating DESC, p.created_at DESC',
      price_low_high: 'p.price_cents ASC',
      price_high_low: 'p.price_cents DESC',
      rating:         'p.rating DESC',
      newest:         'p.created_at DESC',
      name_asc:       'p.name ASC',
      name_desc:      'p.name DESC',
    };
    const orderBy = sortMap[query.sort ?? 'default'] ?? sortMap['default'];

    const baseQuery = `
      FROM products p
      LEFT JOIN brands b     ON b.id = p.brand_id
      LEFT JOIN categories c ON c.id = p.category_id
      ${where}
    `;

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT p.*, b.name AS brand_name, b.slug AS brand_slug,
                c.name AS category_name, c.slug AS category_slug
         ${baseQuery}
         ORDER BY ${orderBy}
         LIMIT $${p} OFFSET $${p+1}`,
        [...params, limit, offset],
      ),
      pool.query(`SELECT COUNT(*) AS total ${baseQuery}`, params),
    ]);

    // Attach first image to each product
    const ids = dataRes.rows.map((r) => (r as Record<string,unknown>)['id'] as string);
    let imageMap: Record<string, string> = {};
    if (ids.length > 0) {
      // Build individual placeholders: ($1,$2,...) to avoid array serialization issues
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const imgRes = await pool.query(
        `SELECT DISTINCT ON (product_id) product_id, url
         FROM product_images WHERE product_id IN (${placeholders})
         ORDER BY product_id, is_primary DESC, sort_order ASC`,
        ids,
      );
      for (const row of imgRes.rows as Array<Record<string, unknown>>) {
        imageMap[String(row['product_id'])] = String(row['url']);
      }
    }

    const items = dataRes.rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        ...row,
        price: Number(row['price_cents']) / 100,
        compareAtPrice: row['compare_at_price_cents'] != null ? Number(row['compare_at_price_cents']) / 100 : null,
        image: imageMap[String(row['id'])] ?? null,
      };
    });

    return paginate(items, Number((countRes.rows[0] as Record<string,unknown>)['total'] ?? 0), page, limit);
  }

  async findBySlug(slug: string): Promise<Record<string, unknown> | null> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT p.*, b.name AS brand_name, b.slug AS brand_slug,
              c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN brands b     ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.slug = $1 AND p.status = 'active'`, [slug],
    );
    if (!res.rows[0]) return null;

    const product = res.rows[0] as Record<string, unknown>;
    const id = String(product['id']);

    const [imagesRes, specsRes, inventoryRes] = await Promise.all([
      pool.query(
        `SELECT id, url, alt, sort_order, is_primary FROM product_images
         WHERE product_id = $1 ORDER BY is_primary DESC, sort_order ASC`, [id],
      ),
      pool.query(
        `SELECT label, value, sort_order FROM product_specs
         WHERE product_id = $1 ORDER BY sort_order`, [id],
      ),
      pool.query(
        `SELECT quantity_on_hand, quantity_reserved,
                (quantity_on_hand - quantity_reserved) AS quantity_available
         FROM inventory WHERE product_id = $1`, [id],
      ),
    ]);

    const inv = inventoryRes.rows[0] as Record<string,unknown> | undefined;
    return {
      ...product,
      price:           Number(product['price_cents']) / 100,
      compareAtPrice:  product['compare_at_price_cents'] != null ? Number(product['compare_at_price_cents']) / 100 : null,
      images:          imagesRes.rows,
      specs:           specsRes.rows,
      inventory: inv ? {
        quantityOnHand:    Number(inv['quantity_on_hand']),
        quantityReserved:  Number(inv['quantity_reserved']),
        quantityAvailable: Number(inv['quantity_available']),
        inStock:           Number(inv['quantity_available']) > 0,
      } : { inStock: false },
    };
  }

  async findById(id: string): Promise<Record<string, unknown> | null> {
    const pool = getPool();
    const res = await pool.query(`SELECT slug FROM products WHERE id = $1`, [id]);
    if (!res.rows[0]) return null;
    return this.findBySlug(String((res.rows[0] as Record<string,unknown>)['slug']));
  }

  async getRelated(productId: string, limit = 8): Promise<Record<string, unknown>[]> {
    const pool = getPool();
    const src = await pool.query(
      `SELECT category_id, brand_id, algorithm, price_cents FROM products WHERE id = $1`, [productId],
    );
    if (!src.rows[0]) return [];

    const row = src.rows[0] as Record<string, unknown>;
    const res = await pool.query(
      `SELECT p.id, p.slug, p.name, p.price_cents, p.rating,
              pi.url AS image
       FROM products p
       LEFT JOIN LATERAL (
         SELECT url FROM product_images WHERE product_id = p.id
         ORDER BY is_primary DESC, sort_order LIMIT 1
       ) pi ON true
       WHERE p.id != $1 AND p.status = 'active'
         AND (p.category_id = $2 OR p.brand_id = $3 OR p.algorithm = $4)
       ORDER BY
         (CASE WHEN p.category_id = $2 THEN 2 ELSE 0 END +
          CASE WHEN p.brand_id = $3    THEN 1 ELSE 0 END) DESC,
         p.rating DESC
       LIMIT $5`,
      [productId, row['category_id'], row['brand_id'], row['algorithm'], limit],
    );
    return res.rows.map((r) => {
      const rr = r as Record<string, unknown>;
      return { ...rr, price: Number(rr['price_cents']) / 100 };
    });
  }

  async create(input: CreateProductInput): Promise<string> {
    const pool = getPool();
    const id = randomUUID();
    const slug = input.slug ?? toSlug(input.name);

    await pool.query(
      `INSERT INTO products
        (id,slug,sku,name,short_description,description,brand_id,category_id,
         status,price_cents,compare_at_price_cents,featured,
         hashrate,hashrate_unit,power_consumption,algorithm,coin,noise_level,manufacturer,warranty_months)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [id, slug, input.sku, input.name,
       input.shortDescription ?? '', input.description ?? '',
       input.brandId ?? null, input.categoryId ?? null,
       input.status ?? 'draft', input.priceCents,
       input.compareAtPriceCents ?? null, input.featured ?? false,
       input.hashrate ?? null, input.hashrateUnit ?? null,
       input.powerConsumption ?? null, input.algorithm ?? null,
       input.coin ?? null, input.noiseLevel ?? null,
       input.manufacturer ?? null, input.warrantyMonths ?? null],
    );

    // Create inventory record
    await pool.query(
      `INSERT INTO inventory (id, product_id) VALUES ($1, $2)
       ON CONFLICT (product_id) DO NOTHING`,
      [randomUUID(), id],
    );

    return id;
  }
}
