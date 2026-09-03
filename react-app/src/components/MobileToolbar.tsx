import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './MobileToolbar.css';

export default function MobileToolbar() {
  const { count } = useCart();
  const { pathname } = useLocation();

  const isActive = (path: string) => pathname === path;

  return (
    <div className="mobile-toolbar" role="navigation" aria-label="Mobile toolbar">
      <Link to="/shop" className={`toolbar-item${isActive('/shop') ? ' active' : ''}`}>
        <span className="toolbar-icon">
          <IconShop />
        </span>
        <span className="toolbar-label">Shop</span>
      </Link>

      <Link to="/wishlist" className={`toolbar-item${isActive('/wishlist') ? ' active' : ''}`}>
        <span className="toolbar-icon">
          <IconHeart />
        </span>
        <span className="toolbar-label">Wishlist</span>
      </Link>

      <Link to="/cart" className={`toolbar-item${isActive('/cart') ? ' active' : ''}`}>
        <span className="toolbar-icon toolbar-icon-cart">
          <IconCart />
          {count > 0 && (
            <span className="toolbar-cart-count">{count}</span>
          )}
        </span>
        <span className="toolbar-label">Cart</span>
      </Link>

      <Link to="/my-account" className={`toolbar-item${isActive('/my-account') ? ' active' : ''}`}>
        <span className="toolbar-icon">
          <IconUser />
        </span>
        <span className="toolbar-label">My account</span>
      </Link>
    </div>
  );
}

function IconShop() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  );
}
function IconHeart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}
function IconCart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  );
}
function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
