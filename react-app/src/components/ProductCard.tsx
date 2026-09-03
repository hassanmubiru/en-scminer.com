import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import type { Product } from '../lib/api';
import './ProductCard.css';

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    add(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="product-card">
      {/* Image area */}
      <div className="product-card-image">
        {product.badge && (
          <span className={`badge badge-${product.badge} product-badge`}>
            {product.badge === 'sale' ? 'Sale' : product.badge === 'new' ? 'New' : 'Hot'}
          </span>
        )}
        <Link to={`/product/${product.slug}`} className="product-card-img-link">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            width={430}
            height={430}
          />
        </Link>
        {/* Hover overlay */}
        <div className="product-card-hover">
          <button
            className={`btn btn-primary btn-sm product-card-atc${added ? ' added' : ''}`}
            onClick={handleAddToCart}
          >
            {added ? '✓ Added' : 'Add to Cart'}
          </button>
        </div>
      </div>

      {/* Info area */}
      <div className="product-card-info">
        <p className="product-card-category">{product.category}</p>
        <h3 className="product-card-title">
          <Link to={`/product/${product.slug}`}>{product.name}</Link>
        </h3>
        <div className="product-card-meta">
          <span className="meta-item">{product.hashrate}</span>
          <span className="meta-sep">·</span>
          <span className="meta-item">{product.power}</span>
        </div>
        <div className="product-card-price">
          <span className="price">${product.price.toLocaleString()}.00</span>
          {product.oldPrice && (
            <span className="price-old">${product.oldPrice.toLocaleString()}.00</span>
          )}
        </div>
      </div>
    </div>
  );
}
