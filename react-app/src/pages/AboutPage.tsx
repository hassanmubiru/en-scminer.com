import { Link } from 'react-router-dom';
import './AboutPage.css';

const FOUNDERS = [
  {
    name: 'KK. President',
    img: '/images/team/kk.jpg',
    quote: 'My principle of doing things: Whether it should be done based on benefits. Whether it should be gambled from the risks. Whether it can be done from all my ability. Whether it worthy from the estimated results.',
  },
  {
    name: 'Maily. General Manager',
    img: '/images/team/maily.jpg',
    quote: 'Cease to struggle and you cease to live.',
  },
  {
    name: 'Terry. Sales Director',
    img: '/images/team/terry.jpg',
    quote: 'If winter comes, can spring be far behind?',
  },
  {
    name: 'Jeason. Technical Director',
    img: '/images/team/jeason.jpg',
    quote: 'He who seize the right moment, is the rightman.',
  },
];

const EVENTS = [
  { label: 'WDMS HONG KONG 2023',      img: '/images/about/banner1.jpg' },
  { label: 'Blockchain Life 2023 Dubai', img: '/images/about/banner2.jpg' },
  { label: 'CRYPTO SUMMIT 2023 Moscow', img: '/images/about/event1.webp' },
  { label: 'Mining Disrupt Expo Miami', img: '/images/about/event2.webp' },
];

export default function AboutPage() {
  return (
    <div className="about-page">

      {/* ── Page title ───────────────────────────────────────────────── */}
      <div className="page-title-banner">
        <div className="container">
          <h1>About Us</h1>
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span className="breadcrumb-sep">/</span>
            <span>About Us</span>
          </nav>
        </div>
      </div>

      {/* ── Company intro — dark bg, 2-col layout ───────────────────── */}
      <section className="about-intro-section">
        <div className="container about-intro-grid">

          {/* Left: portrait images stacked */}
          <div className="about-portraits">
            <div className="portrait-wrap portrait-front">
              <img src="/images/about/portrait_left.png" alt="SCminer team" />
            </div>
            <div className="portrait-wrap portrait-back">
              <img src="/images/about/portrait_right.png" alt="SCminer office" />
            </div>
          </div>

          {/* Right: company text */}
          <div className="about-intro-text">
            <span className="about-eyebrow">SCMINER COMPANY LIMITED</span>
            <h2>About SCminer — Top Trusted ASIC Miner Supplier</h2>

            <div className="about-meta-row">
              <div className="about-meta-item">
                <span className="meta-label">Year Established:</span>
                <span className="meta-value">2016</span>
              </div>
              <div className="about-meta-item">
                <span className="meta-label">Customers Served:</span>
                <span className="meta-value">&gt;50,000</span>
              </div>
              <div className="about-meta-item">
                <span className="meta-label">Export p.c:</span>
                <span className="meta-value">100%</span>
              </div>
            </div>

            <p>
              SCminer, one of the largest companies in the mining industry, is always committed
              to the sale of mining machines. We regularly purchase large quantities of miners
              from suppliers such as Bitmain, MicroBT and Canaan, consistently maintaining a
              monthly inventory of over 10,000 units.
            </p>
            <p>
              SCminer headquarters is located in Shenzhen, China, with a strong sales team
              speaking several foreign languages including English, Russian, Spanish, and Arabic
              — enabling us to serve customers across North America, Europe, the Middle East,
              Central Asia, and Southeast Asia.
            </p>
            <p>
              SCminer's mission is to provide customers with cost-effective machines and excellent
              service. We have been awarded the <strong>"2024 Whatsminer Elite Distributor"</strong> award,
              a testament to our commitment and volume.
            </p>

            <div className="about-intro-actions">
              <Link to="/shop" className="btn btn-primary">Shop Now</Link>
              <Link to="/contact-us" className="btn btn-dark">Contact Us</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats row ────────────────────────────────────────────────── */}
      <section className="about-stats-section">
        <div className="container about-stats-grid">
          {[
            { value: '9',          label: 'Years Since 2016' },
            { value: '>50,000',    label: 'Customers' },
            { value: '>1,000,000', label: 'Miners Sold' },
            { value: '>100,000',   label: 'Miners Hosted' },
          ].map((s) => (
            <div key={s.label} className="about-stat-card">
              <span className="asc-value">{s.value}</span>
              <span className="asc-label">{s.label}</span>
              <span className="asc-line" />
            </div>
          ))}
        </div>
      </section>

      {/* ── Why Choose Us ────────────────────────────────────────────── */}
      <section className="about-why-section">
        <div className="container">
          <div className="section-title about-section-title">
            <h2>WHY CHOOSE US</h2>
            <div className="underline" />
          </div>
          <div className="about-why-pills">
            {[
              'Full Experience In ASIC Miner Distribution and Exportation Since 2017',
              'Reputable and Reliable Miner Supplier Cherish Every Client',
              'Large Inventory With Mature Logistics System Supports Global Delivery',
            ].map((t) => (
              <div key={t} className="about-why-pill">{t}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Founders' Perceptions ─────────────────────────────────────── */}
      <section className="about-founders-section">
        <div className="container">
          <div className="section-title about-section-title">
            <h2>FOUNDERS' PERCEPTIONS</h2>
            <div className="underline" />
          </div>
          <div className="about-founders-grid">
            {FOUNDERS.map((f) => (
              <div key={f.name} className="about-founder-card">
                <div className="afc-photo-wrap">
                  <img src={f.img} alt={f.name} />
                </div>
                <h4 className="afc-name">{f.name}</h4>
                <p className="afc-quote">{f.quote}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Events section ────────────────────────────────────────────── */}
      <section className="about-events-section">
        <div className="container">
          <div className="section-title about-section-title">
            <h2>EVENTS &amp; EXHIBITIONS</h2>
            <p>SCminer attends major global crypto mining conferences every year</p>
            <div className="underline" />
          </div>
          <div className="events-grid">
            {EVENTS.map((e) => (
              <div key={e.label} className="event-card">
                <div className="event-img-wrap">
                  <img src={e.img} alt={e.label} />
                </div>
                <div className="event-label">{e.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Markets ───────────────────────────────────────────────────── */}
      <section className="about-markets-section">
        <div className="container">
          <div className="section-title about-section-title">
            <h2>MARKETS WE SERVE</h2>
            <div className="underline" />
          </div>
          <div className="markets-grid">
            {[
              { region: 'North America',  countries: 'USA, Canada, Mexico',                 emoji: '🌎' },
              { region: 'Europe',         countries: 'UK, Germany, France, Russia',          emoji: '🌍' },
              { region: 'Middle East',    countries: 'UAE, Saudi Arabia, Iran, Kuwait',      emoji: '🕌' },
              { region: 'Central Asia',   countries: 'Kazakhstan, Uzbekistan, Georgia',      emoji: '🗺️' },
              { region: 'Southeast Asia', countries: 'Thailand, Vietnam, Singapore',         emoji: '🌏' },
              { region: 'Oceania',        countries: 'Australia, New Zealand',               emoji: '🌊' },
            ].map((m) => (
              <div key={m.region} className="market-card">
                <span className="market-emoji">{m.emoji}</span>
                <strong>{m.region}</strong>
                <span>{m.countries}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="about-cta">
        <div className="container about-cta-inner">
          <h2>Ready to Start Mining?</h2>
          <p>Contact our team for a customized quote and expert hardware recommendations.</p>
          <div className="about-cta-btns">
            <Link to="/shop" className="btn btn-accent btn-lg">Browse Products</Link>
            <Link to="/contact-us" className="btn btn-outline btn-lg">Contact Us</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
