import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './Header.css';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'About Us', to: '/about-us' },
  { label: 'Products', to: '/shop' },
  { label: 'Contact Us', to: '/contact-us' },
];

export default function Header() {
  const { count, subtotal } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  }

  return (
    <>
      {/* Top bar */}
      <div className="header-topbar">
        <div className="container topbar-inner">
          <span className="topbar-email">
            <IconMail /> Email: info@en-scminer.com
          </span>
        </div>
      </div>

      {/* Main header */}
      <header className={`site-header${scrolled ? ' header-sticky' : ''}`}>
        <div className="container header-inner">
          {/* Logo */}
          <div className="header-logo">
            <Link to="/">
              <img
                src="/logo.png"
                alt="SCminer"
                className="header-logo-img"
                width={180}
                height={55}
              />
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="header-nav hide-mobile" aria-label="Main navigation">
            <ul className="nav-list">
              {NAV_LINKS.map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    end={l.to === '/'}
                    className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Header tools */}
          <div className="header-tools">
            {/* Search */}
            <button
              className="tool-btn"
              aria-label="Search"
              onClick={() => setSearchOpen((v) => !v)}
            >
              <IconSearch />
            </button>

            {/* My Account */}
            <Link to="/my-account" className="tool-btn hide-mobile" aria-label="My account">
              <IconUser />
              <span className="tool-label">My Account</span>
            </Link>

            {/* Cart */}
            <Link to="/cart" className="tool-btn cart-btn" aria-label="Cart">
              <IconCart />
              {count > 0 && <span className="cart-count">{count}</span>}
              <span className="tool-label hide-mobile">
                ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </Link>

            {/* Mobile burger */}
            <button
              className="tool-btn hide-desktop"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <IconMenu />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="header-search-bar">
            <form className="container search-form" onSubmit={handleSearch}>
              <input
                autoFocus
                type="text"
                placeholder="Search for miners, power supplies…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" aria-label="Submit search"><IconSearch /></button>
              <button type="button" className="search-close" onClick={() => setSearchOpen(false)}>
                ✕
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />
          <nav className="mobile-drawer">
            <div className="mobile-drawer-header">
              <Link to="/" onClick={() => setMenuOpen(false)}>
                <img src="/logo.png" alt="SCminer" className="mobile-logo-img" width={140} height={43} />
              </Link>
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
            </div>
            <ul>
              {NAV_LINKS.map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    end={l.to === '/'}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) => isActive ? 'active' : ''}
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <Link to="/my-account" onClick={() => setMenuOpen(false)}>My Account</Link>
              </li>
              <li>
                <Link to="/cart" onClick={() => setMenuOpen(false)}>
                  Cart {count > 0 && `(${count})`}
                </Link>
              </li>
            </ul>
            <div className="mobile-drawer-contact">
              <div>📧 info@en-scminer.com</div>
              <div>📞 +1 (424) 513-3056</div>
            </div>
          </nav>
        </>
      )}
    </>
  );
}

/* ── Inline SVG icons ─────────────────────────────────────────────────────── */
function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 7 10-7" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconCart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
