import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import { getProductBySlug, getRelatedProducts, products } from '../data/products';
import './ProductPage.css';

type Tab = 'description' | 'reviews' | 'shipping';

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { add } = useCart();

  const [qty, setQty]             = useState(1);
  const [activeTab, setActiveTab] = useState<Tab>('description');
  const [added, setAdded]         = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [wishlist, setWishlist]   = useState(false);

  const product = getProductBySlug(slug ?? '');

  if (!product) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '80px 0' }}>
        <h2>Product not found</h2>
        <p style={{ marginBottom: 24 }}>This product does not exist or has been removed.</p>
        <button className="btn btn-primary" onClick={() => navigate('/shop')}>
          Back to Shop
        </button>
      </div>
    );
  }

  // Prev / next products in same category
  const sameCat  = products.filter((p) => p.categorySlug === product.categorySlug);
  const myIdx    = sameCat.findIndex((p) => p.id === product.id);
  const prevProd = myIdx > 0 ? sameCat[myIdx - 1] : null;
  const nextProd = myIdx < sameCat.length - 1 ? sameCat[myIdx + 1] : null;

  const galleryImgs = [product.image, product.image, product.image];
  const related     = getRelatedProducts(product, 4);

  function handleAdd() {
    add(product!, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  }
  function handleBuy() {
    add(product!, qty);
    navigate('/cart');
  }

  const shareUrl = encodeURIComponent(window.location.href);
  const shareTitle = encodeURIComponent(product.name);

  return (
    <div className="product-page">

      {/* ── Breadcrumb banner ──────────────────────────────────────────── */}
      <div className="page-title-banner">
        <div className="container">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span className="breadcrumb-sep">/</span>
            <Link to={`/shop?cat=${product.categorySlug}`}>{product.category}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{product.name}</span>
          </nav>
        </div>
      </div>

      {/* ── Product layout ─────────────────────────────────────────────── */}
      <div className="container product-layout">

        {/* ── LEFT: Gallery ────────────────────────────────────── */}
        <div className="product-gallery">

          {/* Prev / Next navigation above gallery */}
          <div className="product-nav-row">
            {prevProd ? (
              <Link to={`/product/${prevProd.slug}`} className="prod-nav-btn prod-nav-prev" title={prevProd.name}>
                ‹
              </Link>
            ) : <span className="prod-nav-btn prod-nav-prev disabled">‹</span>}

            <Link to="/shop" className="prod-nav-back">Back to products</Link>

            {nextProd ? (
              <Link to={`/product/${nextProd.slug}`} className="prod-nav-btn prod-nav-next" title={nextProd.name}>
                ›
              </Link>
            ) : <span className="prod-nav-btn prod-nav-next disabled">›</span>}
          </div>

          {/* Main image */}
          <div className="gallery-main">
            <img
              key={activeImg}
              src={galleryImgs[activeImg]}
              alt={product.name}
              className="gallery-main-img"
            />
            {product.badge && (
              <span className={`badge badge-${product.badge} gallery-badge`}>
                {product.badge === 'sale' ? 'Sale' : product.badge === 'new' ? 'New' : 'Hot'}
              </span>
            )}
            <button className="gallery-enlarge" aria-label="Click to enlarge">
              Click to enlarge
            </button>
          </div>

          {/* Thumbnails */}
          <div className="gallery-thumbs">
            {galleryImgs.map((img, i) => (
              <button
                key={i}
                className={`gallery-thumb${i === activeImg ? ' active-thumb' : ''}`}
                onClick={() => setActiveImg(i)}
                aria-label={`View image ${i + 1}`}
              >
                <img src={img} alt={`${product.name} view ${i + 1}`} />
              </button>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Summary ────────────────────────────────────── */}
        <div className="product-summary">

          {/* Title */}
          <h1 className="product-title">{product.name}</h1>

          {/* Price */}
          <p className="product-price-display">
            <span className="price">${product.price.toLocaleString()}.00</span>
            {product.oldPrice && (
              <span className="price-old">${product.oldPrice.toLocaleString()}.00</span>
            )}
          </p>

          {/* Short description */}
          <div className="product-short-desc">
            <p>{product.description}</p>
          </div>

          {/* Stock */}
          <div className={`stock-badge${product.inStock ? ' in-stock' : ' out-of-stock'}`}>
            {product.inStock
              ? <><span className="stock-dot" />In stock</>
              : <><span className="stock-dot" />Out of stock</>}
          </div>

          {/* Qty + Add to cart */}
          <div className="product-actions">
            <div className="qty-wrap">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
              <input
                type="number" value={qty} min={1}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                aria-label="Quantity"
              />
              <button onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity">+</button>
            </div>
            <button
              className={`btn btn-primary btn-add-cart${added ? ' btn-added' : ''}`}
              onClick={handleAdd}
            >
              {added ? '✓ Added to cart' : 'Add to cart'}
            </button>
          </div>

          {/* Compare + Wishlist */}
          <div className="product-action-links">
            <Link to="/compare" className="prod-action-link">
              <IconCompare /> Compare
            </Link>
            <button
              className={`prod-action-link${wishlist ? ' wishlisted' : ''}`}
              onClick={() => setWishlist((v) => !v)}
              aria-label="Add to wishlist"
            >
              <IconHeart filled={wishlist} />
              {wishlist ? 'Browse Wishlist' : 'Add to wishlist'}
            </button>
          </div>

          {/* Category meta */}
          <div className="product-meta-row">
            <span className="meta-item">
              <strong>Category:</strong>{' '}
              <Link to={`/shop?cat=${product.categorySlug}`}>{product.category}</Link>
            </span>
          </div>

          {/* Social share — matches original Facebook/Twitter/Pinterest/LinkedIn/Telegram */}
          <div className="product-share">
            <span className="share-label">Share:</span>
            <div className="share-icons">
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook" className="share-btn share-fb">
                <IconFacebook />
              </a>
              <a href={`https://twitter.com/share?url=${shareUrl}&text=${shareTitle}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Twitter" className="share-btn share-tw">
                <IconTwitter />
              </a>
              <a href={`https://pinterest.com/pin/create/button/?url=${shareUrl}&description=${shareTitle}`} target="_blank" rel="noopener noreferrer" aria-label="Pin on Pinterest" className="share-btn share-pi">
                <IconPinterest />
              </a>
              <a href={`https://www.linkedin.com/shareArticle?mini=true&url=${shareUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn" className="share-btn share-li">
                <IconLinkedIn />
              </a>
              <a href={`https://telegram.me/share/url?url=${shareUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Telegram" className="share-btn share-tg">
                <IconTelegram />
              </a>
            </div>
          </div>

          {/* Payment accepted */}
          <div className="payment-info-row">
            <span className="payment-info-label">Payment:</span>
            <div className="payment-chips">
              {['USD', 'BTC', 'ETC', 'USDT (ERC20)', 'USDT (TRC20)'].map((m) => (
                <span key={m} className="pm-chip">{m}</span>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Tabs: Description / Reviews / Shipping & Delivery ─────────── */}
      <div className="product-tabs-section">
        <div className="container">

          {/* Desktop tab nav */}
          <ul className="tabs-nav" role="tablist">
            {([
              { id: 'description' as Tab, label: 'Description' },
              { id: 'reviews'     as Tab, label: 'Reviews (0)' },
              { id: 'shipping'    as Tab, label: 'Shipping & Delivery' },
            ]).map((t) => (
              <li key={t.id} role="presentation">
                <button
                  role="tab"
                  aria-selected={activeTab === t.id}
                  className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>

          {/* Tab panels */}
          <div className="tab-content">

            {activeTab === 'description' && (
              <div className="tab-panel" role="tabpanel">
                <div className="tab-description">
                  <h3>Description</h3>
                  <p>{product.description}</p>

                  {product.specs.length > 0 && (
                    <>
                      <h4 style={{ marginTop: 24, marginBottom: 12, color: 'var(--title)' }}>
                        Product Specifications
                      </h4>
                      <div className="specs-table-wrap">
                        <table className="specs-table">
                          <tbody>
                            {product.specs.map((s) => (
                              <tr key={s.label}>
                                <th>{s.label}</th>
                                <td>{s.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  <p style={{ marginTop: 16, fontSize: 14, color: 'var(--text)', lineHeight: 1.8 }}>
                    All units are brand-new, factory sealed, and ship from Shenzhen, China. Every order
                    includes original manufacturer packaging. Feel free to contact us for a customized
                    solution based on your detailed requirements.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="tab-panel" role="tabpanel">
                <div className="tab-reviews">
                  <h3>Reviews</h3>
                  <p className="no-reviews">There are no reviews yet.</p>
                  <div className="review-form-wrap">
                    <h4>Be the first to review "{product.name}"</h4>
                    <form className="review-form" onSubmit={(e) => e.preventDefault()}>
                      <div className="form-row">
                        <label>Your rating <span className="required">*</span></label>
                        <div className="star-rating-input">
                          {[5, 4, 3, 2, 1].map((n) => (
                            <span key={n} className="star-opt">{'★'.repeat(n)}</span>
                          ))}
                        </div>
                      </div>
                      <div className="form-row">
                        <label htmlFor="review-msg">Your review <span className="required">*</span></label>
                        <textarea id="review-msg" rows={5} required />
                      </div>
                      <div className="review-form-row2">
                        <div className="form-row">
                          <label htmlFor="review-name">Name <span className="required">*</span></label>
                          <input id="review-name" type="text" required />
                        </div>
                        <div className="form-row">
                          <label htmlFor="review-email">Email <span className="required">*</span></label>
                          <input id="review-email" type="email" required />
                        </div>
                      </div>
                      <button type="submit" className="btn btn-primary">Submit</button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="tab-panel" role="tabpanel">
                <div className="tab-shipping">
                  <div className="shipping-grid">
                    {/* Two real delivery photos from /details/ */}
                    <div className="shipping-images">
                      <img src="/images/ship1.jpg" alt="Delivery" className="ship-img" />
                      <img src="/images/ship2.jpg" alt="Shipping" className="ship-img" />
                    </div>
                    <div className="shipping-info">
                      <h3>Maecenas Iaculis</h3>
                      <p>
                        Vestibulum curae torquent diam diam commodo parturient penatibus nunc dui
                        adipiscing convallis bulum parturient suspendisse parturient. Parturient in
                        parturient scelerisque nibh lectus quam a natoque adipiscing a vestibulum
                        hendrerit et pharetra fames nunc natoque dui.
                      </p>
                      <h4>Adipiscing Convallis Bulum</h4>
                      <ul className="shipping-list">
                        <li>Vestibulum penatibus nunc dui adipiscing convallis bulum parturient suspendisse.</li>
                        <li>Abitur parturient praesent lectus quam a natoque adipiscing a vestibulum hendre.</li>
                        <li>Diam parturient dictumst parturient scelerisque nibh lectus.</li>
                      </ul>
                      <p style={{ marginTop: 18 }}>
                        Scelerisque adipiscing bibendum sem vestibulum et in a a purus lectus faucibus
                        lobortis tincidunt purus lectus nisl class eros. Condimentum a et ullamcorper
                        dictumst mus et tristique elementum nam inceptos hac parturient scelerisque
                        vestibulum amet elit ut volutpat.
                      </p>
                      <h4 style={{ marginTop: 24 }}>Shipping Details</h4>
                      <ul className="shipping-list">
                        <li>Delivery Time: <strong style={{ color: '#fff' }}>1–2 Working Days</strong></li>
                        <li>Express shipping: DHL / FedEx / UPS</li>
                        <li>Free shipping on orders over $10,000</li>
                        <li>Full tracking provided — ships from Shenzhen, China</li>
                        <li>Payment: USD | BTC | ETC | USDT (ERC20 / TRC20)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Related Products ───────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="related-section">
          <div className="container">
            <h3 className="related-title">Related products</h3>
            <div className="related-grid">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}

/* ── Icons ─────────────────────────────────────────────────────────────── */
function IconCompare() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  );
}
function IconHeart({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'var(--primary)' : 'none'} stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}
function IconFacebook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  );
}
function IconTwitter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>
    </svg>
  );
}
function IconPinterest() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.65 7.86 6.39 9.29-.09-.78-.17-1.98.03-2.83.19-.77 1.27-5.38 1.27-5.38s-.32-.65-.32-1.61c0-1.51.88-2.64 1.97-2.64.93 0 1.38.7 1.38 1.54 0 .94-.6 2.34-.91 3.64-.26 1.09.54 1.97 1.6 1.97 1.92 0 3.22-2.46 3.22-5.38 0-2.22-1.5-3.78-3.64-3.78-2.48 0-3.93 1.87-3.93 3.8 0 .75.29 1.56.65 2 .07.09.08.16.06.25-.07.27-.21.85-.24.97-.04.16-.13.19-.3.12-1.12-.52-1.82-2.17-1.82-3.49 0-2.84 2.07-5.45 5.96-5.45 3.13 0 5.56 2.23 5.56 5.21 0 3.11-1.96 5.61-4.67 5.61-.91 0-1.77-.47-2.06-1.03l-.56 2.1c-.2.78-.75 1.76-1.12 2.35.85.26 1.75.4 2.68.4 5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
    </svg>
  );
}
function IconLinkedIn() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
      <rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
    </svg>
  );
}
function IconTelegram() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
    </svg>
  );
}
