import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import './HeroSlider.css';

export interface Slide {
  id: number;
  bg: string;          // full-width background image
  minerImg: string;    // product/miner cutout image
  eyebrow: string;
  title: string;
  titleBold: string;
  subtitle: string;
  desc: string;
  price: string;
  ctaLabel: string;
  ctaTo: string;
  bgPos?: string;
}

const SLIDES: Slide[] = [
  {
    id: 1,
    bg: '/images/C3xtYP3PDMln.jpg',
    minerImg: '/images/2jhE2rUm98bi.jpg',
    eyebrow: 'En-SCminer，Sincerely',
    title: 'Cherish',
    titleBold: 'Every Client.',
    subtitle: 'ASIC Miner Supplier Since 2016',
    desc: 'En-SCminer is committed to providing the highest quality miners, excellent service and innovative solutions to our customers.',
    price: '',
    ctaLabel: 'SHOP NOW',
    ctaTo: '/shop',
    bgPos: 'center center',
  },
  {
    id: 2,
    bg: '/images/mMCOtVzWUaJu.jpg',
    minerImg: '/images/4mpUIiqi7KES.jpg',
    eyebrow: '190T · 3610W · SHA-256',
    title: '190T Antminer T21',
    titleBold: 'Crypto Machine',
    subtitle: 'Factory Original Antminer',
    desc: 'Antminer T21 computing power 190T. Power consumption 3610W. Supports NEM to HEM self-adjustment. Max ambient temp 45°C.',
    price: '$6,100.00',
    ctaLabel: 'SHOP NOW',
    ctaTo: '/product/190t-antminer-t21-3610w',
    bgPos: 'center top',
  },
  {
    id: 3,
    bg: '/images/dPBduUs4nspF.jpg',
    minerImg: '/images/CawsZqkvRy90.jpg',
    eyebrow: '200T · 3500W · SHA-256',
    title: '200T S21 3500W',
    titleBold: 'Antminer S21',
    subtitle: 'Hot Selling BTC Miner',
    desc: 'The Bitmain Antminer S21 delivers exceptional Bitcoin mining performance at 200 TH/s with an efficient 3500W power draw.',
    price: '$5,800.00',
    ctaLabel: 'SHOP NOW',
    ctaTo: '/product/200t-s21-3500w-antminer',
    bgPos: 'center center',
  },
  {
    id: 4,
    bg: '/images/aSpoLPb2GwHm.jpg',
    minerImg: '/images/Hkr1GJJpK3KK.jpg',
    eyebrow: 'WhatsMiner · SHA-256',
    title: 'WhatsMiner M50S',
    titleBold: '126T 3276W',
    subtitle: 'MicroBT Professional Miner',
    desc: 'The WhatsMiner M50S from MicroBT delivers 126 TH/s at 3276W. Excellent build quality and reliability for Bitcoin mining at scale.',
    price: '$4,200.00',
    ctaLabel: 'SHOP NOW',
    ctaTo: '/product/whatsminer-m50s-126t',
    bgPos: 'center center',
  },
];

interface Props {
  autoPlay?: boolean;
  interval?: number;
}

export default function HeroSlider({ autoPlay = true, interval = 6000 }: Props) {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback((index: number, dir: 'next' | 'prev' = 'next') => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setCurrent(index);
      setAnimating(false);
    }, 700);
  }, [animating]);

  const next = useCallback(() => {
    goTo((current + 1) % SLIDES.length, 'next');
  }, [current, goTo]);

  const prev = useCallback(() => {
    goTo((current - 1 + SLIDES.length) % SLIDES.length, 'prev');
  }, [current, goTo]);

  // Auto-play
  useEffect(() => {
    if (!autoPlay) return;
    timerRef.current = setInterval(next, interval);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoPlay, interval, next]);

  // Pause on hover
  function pauseTimer() { if (timerRef.current) clearInterval(timerRef.current); }
  function resumeTimer() {
    if (!autoPlay) return;
    timerRef.current = setInterval(next, interval);
  }

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft')  prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const slide = SLIDES[current];

  return (
    <section
      className="hero-slider"
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      aria-label="Hero slider"
    >
      {/* Background layer — cross-fade between slides */}
      {SLIDES.map((s, i) => (
        <div
          key={s.id}
          className={`slider-bg${i === current ? ' slider-bg-active' : ''}`}
          style={{
            backgroundImage: `url(${s.bg})`,
            backgroundPosition: s.bgPos ?? 'center center',
          }}
          aria-hidden="true"
        />
      ))}

      {/* Dark overlay gradient */}
      <div className="slider-overlay" aria-hidden="true" />

      {/* Content */}
      <div className={`slider-content${animating ? ` slide-out-${direction}` : ' slide-in'}`}>
        <div className="container slider-inner">

          {/* Left: text + CTA */}
          <div className="slider-text">
            <span className="slider-eyebrow">{slide.eyebrow}</span>

            <h1 className="slider-title">
              {slide.title}<br />
              <span className="slider-title-bold">{slide.titleBold}</span>
            </h1>

            <p className="slider-subtitle">{slide.subtitle}</p>

            <p className="slider-desc">{slide.desc}</p>

            {slide.price && (
              <div className="slider-price">{slide.price}</div>
            )}

            <div className="slider-actions">
              <Link to={slide.ctaTo} className="btn btn-accent btn-lg slider-cta">
                {slide.ctaLabel}
              </Link>
              <Link to="/contact-us" className="btn btn-outline btn-lg">
                Get a Quote
              </Link>
            </div>
          </div>

          {/* Right: miner product image */}
          <div className="slider-product-img" aria-hidden="true">
            <img
              src={slide.minerImg}
              alt={slide.titleBold}
              key={slide.id}              /* forces re-render / fade on change */
              className="slider-miner-img"
            />
          </div>

        </div>
      </div>

      {/* Arrow navigation */}
      <button
        className="slider-arrow slider-arrow-prev"
        onClick={prev}
        aria-label="Previous slide"
      >
        ‹
      </button>
      <button
        className="slider-arrow slider-arrow-next"
        onClick={next}
        aria-label="Next slide"
      >
        ›
      </button>

      {/* Dot navigation */}
      <div className="slider-dots" role="tablist" aria-label="Slide navigation">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === current}
            aria-label={`Slide ${i + 1}`}
            className={`slider-dot${i === current ? ' slider-dot-active' : ''}`}
            onClick={() => goTo(i, i > current ? 'next' : 'prev')}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="slider-progress" aria-hidden="true">
        <div
          key={`progress-${current}`}
          className="slider-progress-bar"
          style={{ animationDuration: `${interval}ms` }}
        />
      </div>
    </section>
  );
}
