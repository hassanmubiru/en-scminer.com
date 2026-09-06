/**
 * API client layer for the scminer backend (StreetJS).
 * Maps raw API responses to the frontend Product shape used throughout the app.
 *
 * In production: set VITE_API_URL=https://your-backend.railway.app in Vercel env vars.
 * In development: defaults to http://localhost:3001
 */

export const API_BASE = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3001';

// ── Frontend Product type (used everywhere in the UI) ────────────────────────
export interface Product {
  id: string;          // UUID from API
  slug: string;
  name: string;
  category: string;
  categorySlug: string;
  price: number;
  oldPrice?: number;
  image: string;
  badge?: 'sale' | 'new' | 'hot';
  hashrate: string;
  power: string;
  algorithm: string;
  brand: string;
  inStock: boolean;
  description: string;
  specs: { label: string; value: string }[];
  images?: { url: string; alt: string; is_primary: boolean }[];
}

// ── Raw API shapes ────────────────────────────────────────────────────────────
interface ApiProductRow {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  price: number;
  compare_at_price_cents?: number;
  price_cents?: string | number;
  compare_at_price?: number | null;
  featured: string | boolean;
  hashrate?: string | number | null;
  hashrate_unit?: string | null;
  power_consumption?: string | number | null;
  algorithm?: string | null;
  coin?: string | null;
  brand_name?: string | null;
  brand_slug?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
  image?: string | null;
  images?: { url: string; alt: string; is_primary: boolean }[];
  specs?: { label: string; value: string }[];
  inventory?: { inStock: boolean; quantityAvailable: number };
}

interface PaginatedResponse {
  items: ApiProductRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Normalize API row → frontend Product ─────────────────────────────────────
export function normalizeProduct(raw: ApiProductRow): Product {
  const hashrate = raw.hashrate != null
    ? `${raw.hashrate} ${raw.hashrate_unit ?? ''}`.trim()
    : '';
  const power = raw.power_consumption != null
    ? `${raw.power_consumption}W`
    : '';

  // Derive badge: featured → 'hot', compareAtPrice > price → 'sale'
  const compareAt = raw.compare_at_price ?? null;
  const badge: Product['badge'] =
    compareAt && Number(compareAt) > Number(raw.price) ? 'sale'
    : (raw.featured === true || raw.featured === 't' || raw.featured === 'true') ? 'hot'
    : undefined;

  const imageUrl = raw.image ?? raw.images?.[0]?.url ?? '/images/products/placeholder.jpg';
  const finalImage = imageUrl.startsWith('http') ? imageUrl : imageUrl;

  return {
    id:           raw.id,
    slug:         raw.slug,
    name:         raw.name,
    category:     raw.category_name ?? 'Miners',
    categorySlug: raw.category_slug ?? '',
    price:        Number(raw.price),
    oldPrice:     compareAt ? Number(compareAt) : undefined,
    image:        finalImage,
    badge,
    hashrate,
    power,
    algorithm:    raw.algorithm ?? '',
    brand:        raw.brand_name ?? '',
    inStock:      raw.inventory?.inStock ?? true,
    description:  raw.short_description || raw.description || '',
    specs:        raw.specs ?? [],
    images:       raw.images,
  };
}

// ── API fetch helpers ─────────────────────────────────────────────────────────

export interface ProductSearchParams {
  q?: string;
  category?: string;
  brand?: string;
  algorithm?: string;
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface ProductsResult {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function fetchProducts(params: ProductSearchParams = {}): Promise<ProductsResult> {
  const qs = new URLSearchParams();
  if (params.q)          qs.set('q', params.q);
  if (params.category)   qs.set('category', params.category);
  if (params.brand)      qs.set('brand', params.brand);
  if (params.algorithm)  qs.set('algorithm', params.algorithm);
  if (params.minPrice != null) qs.set('minPrice', String(params.minPrice));
  if (params.maxPrice != null) qs.set('maxPrice', String(params.maxPrice));
  if (params.featured)   qs.set('featured', 'true');
  if (params.sort)       qs.set('sort', params.sort);
  if (params.page)       qs.set('page', String(params.page));
  if (params.limit)      qs.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/api/v1/products?${qs}`);
  if (!res.ok) throw new Error(`Products fetch failed: ${res.status}`);
  const data: PaginatedResponse = await res.json();
  return {
    ...data,
    items: data.items.map(normalizeProduct),
  };
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const res = await fetch(`${API_BASE}/api/v1/products/slug/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Product fetch failed: ${res.status}`);
  const data: ApiProductRow = await res.json();
  return normalizeProduct(data);
}

export async function fetchRelatedProducts(productId: string, limit = 4): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/api/v1/products/${productId}/related?limit=${limit}`);
  if (!res.ok) return [];
  const data: { items: ApiProductRow[] } = await res.json();
  return (data.items ?? []).map(normalizeProduct);
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  image_url: string | null;
  sort_order: string | number;
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/api/v1/categories`);
  if (!res.ok) return [];
  const data: { items: Category[] } = await res.json();
  return data.items ?? [];
}
