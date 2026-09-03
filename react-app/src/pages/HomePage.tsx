import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import HeroSlider from '../components/HeroSlider';
import { fetchProducts, type Product } from '../lib/api';
import './HomePage.css';

const WHY_CHOOSE = [
  'Full Experience In ASIC Miner Distribution and Exportation Since 2017',
  'Reputable and Reliable Miner Supplier Cherish Every Client',
  'Large Inventory With Mature Logistics System Supports Global Delivery',
];

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

export default function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchProducts({ featured: true, limit: 16, sort: 'default' })
      .then((res) => {
        if (cancelled) return;
        // If fewer than 8 featured, fill up with any products
        if (res.items.length < 8) {
          return fetchProducts({ limit: 16, sort: 'default' }).then((all) => {
            if (!cancelled) setFeatured(all.items.slice(0, 16));
          });
        }
        setFeatured(res.items.slice(0, 16));
      })
      .catch(() => {
        if (!cancelled) setFeatured([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="home-page">

      {/* 1 ── Hero slider ─────────────────────────────────────────── */}
      <HeroSlider autoPlay interval={6000} />

      {/* 2 ── Trusted ASIC Miner — text + stat cards ─────────────── */}
      <section className="trusted-section">
        <div className="container trusted-inner">
          <h2 className="trusted-title">
            Trusted ASIC Miner Supplier for Professional Crypto Mining Solutions
          </h2>
          <p className="trusted-body">
            Finding a reliable ASIC miner supplier is important for anyone who wants to succeed
            in cryptocurrency mining. Whether you are starting a small mining operation or
            managing a large mining farm, choosing the right ASIC miner supplier can improve
            your profitability and mining performance. A trusted supplier provides high-quality
            mining hardware, competitive prices, fast shipping, and long-term technical support.
          </p>
          <p className="trusted-body">
            Today, the demand for Bitcoin mining hardware continues to grow across the world.
            Professional miners are searching for efficient ASIC mining machines that deliver
            strong hash rates and lower power consumption. A professional ASIC miner supplier
            helps customers access the latest mining equipment from leading manufacturers such
            as Antminer and WhatsMiner. For more information you can contact us on Telegram,
            Facebook, YouTube, WhatsApp channel, TikTok.
          </p>
          <div className="trusted-stats">
            {[
              { value: '9',          label: 'Years since 2016' },
              { value: '>50,000',    label: 'Customers' },
              { value: '>1,000,000', label: 'Miners Soled' },
              { value: '>100,000',   label: 'Miners Hosted' },
            ].map((s) => (
              <div key={s.label} className="trusted-stat-card">
                <span className="tsc-value">{s.value}</span>
                <span className="tsc-label">{s.label}</span>
                <span className="tsc-line" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 ── PRODUCT SERIES ──────────────────────────────────────── */}
      <section className="featured-section">
        <div className="container">
          <div className="section-title">
            <h2>PRODUCT SERIES</h2>
            <p>Most Of The Hot-selling ASIC Miners Models Are On Stock.</p>
            <div className="underline" />
          </div>
          {loading ? (
            <div className="loading-state"><span className="spinner" /> Loading…</div>
          ) : featured.length === 0 ? (
            <div className="loading-state">No products available.</div>
          ) : (
            <div className="products-grid">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
          <div className="view-all-wrap">
            <Link to="/shop" className="btn btn-primary btn-lg">All Products</Link>
          </div>
        </div>
      </section>

      {/* 4 ── WHY CHOOSE US ───────────────────────────────────────── */}
      <section className="why-section">
        <div className="container">
          <div className="section-title why-title">
            <h2>WHY CHOOSE US</h2>
            <div className="underline" />
          </div>
          <div className="why-pills">
            {WHY_CHOOSE.map((w) => (
              <div key={w} className="why-pill">{w}</div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 ── FOUNDERS' PERCEPTIONS ───────────────────────────────── */}
      <section className="founders-section">
        <div className="container">
          <div className="section-title">
            <h2>FOUNDERS' PERCEPTIONS</h2>
            <div className="underline" />
          </div>
          <div className="founders-grid">
            {FOUNDERS.map((f) => (
              <div key={f.name} className="founder-card">
                <div className="founder-photo-wrap">
                  <img src={f.img} alt={f.name} className="founder-photo" />
                </div>
                <h4 className="founder-name">{f.name}</h4>
                <p className="founder-quote">{f.quote}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
