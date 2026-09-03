import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { fetchProducts, fetchCategories, type Product, type Category } from '../lib/api';
import './ShopPage.css';

/* ── Static sidebar categories (subset for display) ─────────────────── */
const SIDEBAR_CATS = [
  { label: 'All Products',           slug: '' },
  { label: 'Bitmain Antminer S21',   slug: 'antminer-s21' },
  { label: 'Antminer T21',           slug: 'antminer-t21' },
  { label: 'Antminer S19 / S19 Pro', slug: 'antminer-s19' },
  { label: 'Bitmain L7 Miner',       slug: 'antminer-l7' },
  { label: 'WhatsMiner',             slug: 'whatsminer' },
  { label: 'Goldshell / KDA / HNS',  slug: 'goldshell-miners' },
  { label: 'Power Supply',           slug: 'power-supplies' },
  { label: 'Other Miners',           slug: 'other' },
];

const SORT_OPTIONS = [
  { value: 'default',        label: 'Default sorting' },
  { value: 'price_low_high', label: 'Sort by price: low to high' },
  { value: 'price_high_low', label: 'Sort by price: high to low' },
  { value: 'rating',         label: 'Sort by rating' },
  { value: 'newest',         label: 'Sort by latest' },
];

const PER_PAGE = 12;

export default function ShopPage() {
  const [params, setParams] = useSearchParams();
  const cat = params.get('cat') ?? '';
  const q   = params.get('q')   ?? '';

  const [sort, setSort]             = useState('default');
  const [page, setPage]             = useState(1);
  const [minPrice, setMinPrice]     = useState(0);
  const [maxPrice, setMaxPrice]     = useState(50000);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // API data
  const [products, setProducts]     = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [topRated, setTopRated]     = useState<Product[]>([]);

  // Fetch categories once
  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
    // Top rated for sidebar
    fetchProducts({ sort: 'rating', limit: 4 })
      .then((r) => setTopRated(r.items))
      .catch(() => {});
  }, []);

  // Fetch products when filters/page change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchProducts({
      q:        q || undefined,
      category: cat || undefined,
      sort,
      page,
      limit:    PER_PAGE,
      minPrice: minPrice > 0 ? minPrice : undefined,
      maxPrice: maxPrice < 50000 ? maxPrice : undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setProducts(res.items);
        setTotalCount(res.total);
      })
      .catch(() => {
        if (!cancelled) { setProducts([]); setTotalCount(0); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cat, q, sort, page, minPrice, maxPrice]);

  // Client-side stock filter (already filtered on server, just for UI toggle)
  const displayed = useMemo(
    () => inStockOnly ? products.filter((p) => p.inStock) : products,
    [products, inStockOnly],
  );

  const totalPages = Math.ceil(totalCount / PER_PAGE);

  function setCat(slug: string) {
    const next = new URLSearchParams(params);
    slug ? next.set('cat', slug) : next.delete('cat');
    next.delete('q');
    setParams(next);
    setPage(1);
  }

  const activeCatLabel = SIDEBAR_CATS.find((c) => c.slug === cat)?.label ?? 'Shop';

  // Category product counts from the API categories list
  function catCount(slug: string) {
    if (!slug) return totalCount || '…';
    return null; // count not available without extra API call
  }

  return (
    <div className="shop-page">
      {/* ── Page title banner ───────────────────────────────────────── */}
      <div className="page-title-banner">
        <div className="container">
          <h1>{q ? `Search: "${q}"` : activeCatLabel}</h1>
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{q ? 'Search Results' : 'Shop'}</span>
            {cat && <><span className="breadcrumb-sep">/</span><span>{activeCatLabel}</span></>}
          </nav>
        </div>
      </div>

      {/* ── Mobile sidebar toggle ────────────────────────────────────── */}
      <div className="shop-mobile-bar">
        <div className="container shop-mobile-bar-inner">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-expanded={sidebarOpen}
          >
            <IconFilter /> Filter
          </button>
          <select
            className="sort-select-mobile"
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="container shop-layout">
        {/* ── LEFT SIDEBAR ─────────────────────────────────────────── */}
        <aside className={`shop-sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
          {sidebarOpen && (
            <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
          )}
          <div className="sidebar-inner">

            {/* Product Categories widget */}
            <div className="sidebar-widget">
              <h4 className="sidebar-widget-title">Product Categories</h4>
              <ul className="sidebar-cat-list">
                {SIDEBAR_CATS.map((c) => (
                  <li key={c.slug}>
                    <button
                      className={`sidebar-cat-btn${cat === c.slug ? ' active' : ''}`}
                      onClick={() => { setCat(c.slug); setSidebarOpen(false); }}
                    >
                      <span className="cat-btn-label">{c.label}</span>
                      {c.slug === '' && totalCount > 0 && (
                        <span className="cat-btn-count">({totalCount})</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Price Filter widget */}
            <div className="sidebar-widget">
              <h4 className="sidebar-widget-title">Filter by price</h4>
              <div className="price-filter">
                <div className="price-range-row">
                  <span className="price-range-label">
                    Price: <strong>${minPrice.toLocaleString()}</strong> — <strong>${maxPrice.toLocaleString()}</strong>
                  </span>
                </div>
                <div className="price-sliders">
                  <input
                    type="range" min={0} max={50000} step={100}
                    value={minPrice}
                    onChange={(e) => { setMinPrice(+e.target.value); setPage(1); }}
                    className="price-slider"
                    aria-label="Minimum price"
                  />
                  <input
                    type="range" min={0} max={50000} step={100}
                    value={maxPrice}
                    onChange={(e) => { setMaxPrice(+e.target.value); setPage(1); }}
                    className="price-slider"
                    aria-label="Maximum price"
                  />
                </div>
                <button
                  className="btn btn-dark btn-sm price-filter-btn"
                  onClick={() => setPage(1)}
                >
                  Filter
                </button>
              </div>
            </div>

            {/* Stock Status widget */}
            <div className="sidebar-widget">
              <h4 className="sidebar-widget-title">Stock status</h4>
              <label className="stock-filter-label">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => { setInStockOnly(e.target.checked); setPage(1); }}
                />
                <span>In stock</span>
              </label>
            </div>

            {/* Top rated products */}
            {topRated.length > 0 && (
              <div className="sidebar-widget">
                <h4 className="sidebar-widget-title">Top rated products</h4>
                <ul className="sidebar-product-list">
                  {topRated.map((p) => (
                    <li key={p.id} className="sidebar-product-item">
                      <Link to={`/product/${p.slug}`} className="spi-img">
                        <img src={p.image} alt={p.name} width={60} height={60} />
                      </Link>
                      <div className="spi-info">
                        <Link to={`/product/${p.slug}`} className="spi-name">{p.name}</Link>
                        <span className="price spi-price">${p.price.toLocaleString()}.00</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        </aside>

        {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
        <div className="shop-main">

          {/* Toolbar */}
          <div className="shop-toolbar">
            <p className="result-count">
              {loading
                ? 'Loading…'
                : totalCount === 0
                  ? 'No products found'
                  : `Showing ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, totalCount)} of ${totalCount} result${totalCount !== 1 ? 's' : ''}`}
            </p>
            <div className="toolbar-right">
              <select
                className="sort-select"
                value={sort}
                onChange={(e) => { setSort(e.target.value); setPage(1); }}
                aria-label="Sort products"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Products grid */}
          {loading ? (
            <div className="loading-state">
              <span className="spinner" /> Loading products…
            </div>
          ) : displayed.length === 0 ? (
            <div className="empty-state">
              <span style={{ fontSize: 48 }}>🔍</span>
              <h3>No products found</h3>
              <p>Try a different category or clear your filters.</p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setParams({});
                  setMinPrice(0);
                  setMaxPrice(50000);
                  setInStockOnly(false);
                  setPage(1);
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="shop-grid">
              {displayed.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="shop-pagination" aria-label="Pagination">
              <button
                className="page-btn"
                disabled={page === 1}
                onClick={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                aria-label="Previous page"
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  className={`page-btn${n === page ? ' page-btn-active' : ''}`}
                  onClick={() => { setPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  aria-label={`Page ${n}`}
                  aria-current={n === page ? 'page' : undefined}
                >
                  {n}
                </button>
              ))}

              <button
                className="page-btn"
                disabled={page === totalPages}
                onClick={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                aria-label="Next page"
              >
                ›
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}

function IconFilter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}
