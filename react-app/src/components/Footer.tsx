import { Link } from 'react-router-dom';
import './Footer.css';

// Brand partners shown in the original footer swiper carousel
const BRANDS = [
  'Bitmain', 'MicroBT', 'Canaan', 'Goldshell',
  'Innosilicon', 'iBeLink', 'Jasminer', 'BOMBAX',
  'Ebit', 'iPollo', 'Goldshell', 'Avalon',
];

const USEFUL_LINKS = [
  { label: 'Home',       to: '/' },
  { label: 'About Us',   to: '/about-us' },
  { label: 'Products',   to: '/shop' },
  { label: 'Contact Us', to: '/contact-us' },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="container footer-grid">

          {/* ── Column 1 – Brand, tagline, brand logos, contact ── */}
          <div className="footer-col footer-col-brand">
            <div className="footer-logo">
              <img src="/logo.png" alt="SCminer" className="footer-logo-img" width={200} height={61} />
            </div>

            <p className="footer-tagline">
              We Offer One-Stop Exportation Service Of Brand-New ASIC Miners.
            </p>

            {/* Brand logo strip — matches the original swiper */}
            <div className="footer-brand-logos" aria-label="Partner brands">
              {BRANDS.map((b, i) => (
                <span key={`${b}-${i}`} className="footer-brand-chip">{b}</span>
              ))}
            </div>

            <ul className="footer-contact">
              <li>
                <IconPin />
                2410 Chang Jiang Center, Longhua Renmin Road, Longhua District,
                Shenzhen, Guangdong Province, China
              </li>
              <li>
                <IconPhone />
                Phone: +1 (424) 513-3056 (direct call or text)
              </li>
              <li>
                <IconPhone />
                Phone: +1 (743) 201 1306 (WhatsApp Only)
              </li>
              <li>
                <IconMail />
                Email: info@en-scminer.com
              </li>
            </ul>
          </div>

          {/* ── Column 2 – Useful Links ── */}
          <div className="footer-col">
            <h5 className="footer-widget-title">USEFUL LINKS</h5>
            <ul className="footer-links">
              {USEFUL_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      {/* ── Copyright bar ── */}
      <div className="footer-copyright">
        <div className="container copyright-inner">
          <span>
            <strong>China Good Quality</strong>{' '}
            © Bitmain Antminer S21 Supplier.{' '}
            <strong>Copyright © {new Date().getFullYear()}</strong>.{' '}
            scminer.shop. All Rights Reserved.
          </span>
          <div className="payment-methods-row">
            {['VISA', 'MC', 'BTC', 'USDT', 'ETH'].map((m) => (
              <span key={m} className="pm-badge">{m}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Icons ─────────────────────────────────────────────────────────────── */
function IconPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      style={{ flexShrink: 0 }}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.37 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.59a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      style={{ flexShrink: 0 }}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 7 10-7" />
    </svg>
  );
}
