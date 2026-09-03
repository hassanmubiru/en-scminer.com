export interface Product {
  id: number;
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
}

// Base path for extracted product images
const I = (slug: string, ext = 'jpg') =>
  `/images/products/${slug}.${ext}`;

export const products: Product[] = [
  // ── Antminer S21 ──────────────────────────────────────────────────────────
  {
    id: 1,
    slug: '200t-s21-3500w-antminer',
    name: '200T S21 3500W Antminer',
    category: 'Antminer S21', categorySlug: 'antminer-s21',
    price: 5800, badge: 'hot',
    image: I('200t-s21-3500w-antminer', 'png'),
    hashrate: '200 TH/s', power: '3500W', algorithm: 'SHA-256 (BTC)', brand: 'Bitmain', inStock: true,
    description: "The Bitmain Antminer S21 200T delivers exceptional Bitcoin mining performance at 200 TH/s with an efficient 3500W power draw. Factory original, brand-new unit with full warranty.",
    specs: [
      { label: 'Model', value: 'Antminer S21' },
      { label: 'Manufacturer', value: 'Bitmain' },
      { label: 'Hashrate', value: '200 TH/s' },
      { label: 'Power Consumption', value: '3500W' },
      { label: 'Algorithm', value: 'SHA-256' },
      { label: 'Cryptocurrency', value: 'BTC' },
      { label: 'Noise Level', value: '75 dB' },
      { label: 'Delivery Time', value: '1–2 Working days' },
      { label: 'Payment Terms', value: 'USD | BTC | USDT (ERC20/TRC20)' },
    ],
  },
  {
    id: 2,
    slug: 'bitmain-antminer-s21-bitcoin-miner-188t',
    name: 'Bitmain Antminer S21 188T Bitcoin Miner',
    category: 'Antminer S21', categorySlug: 'antminer-s21',
    price: 5600, badge: 'new',
    image: I('bitmain-antminer-s21-bitcoin-miner-188t', 'png'),
    hashrate: '188 TH/s', power: '3500W', algorithm: 'SHA-256 (BTC)', brand: 'Bitmain', inStock: true,
    description: "The Antminer S21 188T is the flagship next-generation Bitcoin miner from Bitmain with best-in-class efficiency.",
    specs: [
      { label: 'Model', value: 'Antminer S21' },
      { label: 'Hashrate', value: '188 TH/s' },
      { label: 'Power Consumption', value: '3500W' },
      { label: 'Algorithm', value: 'SHA-256' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 3,
    slug: 'bitmain-antminer-s21-bitcoin-miner-195t',
    name: 'Bitmain Antminer S21 195T Bitcoin Miner',
    category: 'Antminer S21', categorySlug: 'antminer-s21',
    price: 5700,
    image: I('bitmain-antminer-s21-bitcoin-miner-195t', 'png'),
    hashrate: '195 TH/s', power: '3500W', algorithm: 'SHA-256 (BTC)', brand: 'Bitmain', inStock: true,
    description: "Antminer S21 195T with outstanding efficiency for large-scale Bitcoin mining operations.",
    specs: [
      { label: 'Model', value: 'Antminer S21' },
      { label: 'Hashrate', value: '195 TH/s' },
      { label: 'Power Consumption', value: '3500W' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 4,
    slug: 'bitmain-antminer-s19-pro-hyd-bitcoin-miner-177t',
    name: 'Bitmain Antminer S19 Pro Hyd 177T',
    category: 'Antminer S19', categorySlug: 'antminer-s19',
    price: 4800,
    image: I('bitmain-antminer-s19-pro-hyd-bitcoin-miner-177t', 'png'),
    hashrate: '177 TH/s', power: '5221W', algorithm: 'SHA-256 (BTC)', brand: 'Bitmain', inStock: true,
    description: "The Antminer S19 Pro Hyd 177T uses liquid cooling for exceptional efficiency and hashrate in hydro setups.",
    specs: [
      { label: 'Hashrate', value: '177 TH/s' },
      { label: 'Power Consumption', value: '5221W' },
      { label: 'Cooling', value: 'Hydro (liquid)' },
      { label: 'Algorithm', value: 'SHA-256' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 5,
    slug: 'antminer-bitmain-s19-xp-profit-consumption-141t-hi',
    name: 'Antminer S19 XP 141T High Computing Power',
    category: 'Antminer S19', categorySlug: 'antminer-s19',
    price: 4500, oldPrice: 5200, badge: 'sale',
    image: I('antminer-bitmain-s19-xp-profit-consumption-141t-hi', 'webp'),
    hashrate: '141 TH/s', power: '3010W', algorithm: 'SHA-256 (BTC)', brand: 'Bitmain', inStock: true,
    description: "The Antminer S19 XP 141T offers exceptional efficiency at 21.5 J/TH. High computing power for serious Bitcoin miners.",
    specs: [
      { label: 'Model', value: 'Antminer S19 XP' },
      { label: 'Hashrate', value: '141 TH/s' },
      { label: 'Power Consumption', value: '3010W' },
      { label: 'Efficiency', value: '21.5 J/TH' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },

  // ── Antminer T21 ──────────────────────────────────────────────────────────
  {
    id: 6,
    slug: '190t-antminer-t21-3610w',
    name: '190T Antminer T21 3610W ASIC',
    category: 'Antminer T21', categorySlug: 'antminer-t21',
    price: 6100, badge: 'new',
    image: I('190t-antminer-t21-3610w-asic-mining-most-popular-b', 'webp'),
    hashrate: '190 TH/s', power: '3610W', algorithm: 'SHA-256 (BTC)', brand: 'Bitmain', inStock: true,
    description: "The Antminer T21 190T is Bitmain's most popular mid-range BTC miner, offering 190 TH/s at 3610W. Ideal for large-scale mining farms.",
    specs: [
      { label: 'Model', value: 'Antminer T21' },
      { label: 'Manufacturer', value: 'Bitmain' },
      { label: 'Hashrate', value: '190 TH/s' },
      { label: 'Power Consumption', value: '3610W' },
      { label: 'Algorithm', value: 'SHA-256' },
      { label: 'Noise Level', value: '76 dB' },
      { label: 'Delivery Time', value: '1–2 Working days' },
      { label: 'Payment Terms', value: 'USD | BTC | USDT (ERC20/TRC20)' },
    ],
  },
  {
    id: 7,
    slug: 'crypto-mining-machine-190t-antminer-t21-3610w-sha-',
    name: '190T Antminer T21 SHA-256 IN Stock',
    category: 'Antminer T21', categorySlug: 'antminer-t21',
    price: 5780,
    image: I('crypto-mining-machine-190t-antminer-t21-3610w-sha-', 'webp'),
    hashrate: '190 TH/s', power: '3610W', algorithm: 'SHA-256 (BTC)', brand: 'Bitmain', inStock: true,
    description: "Antminer T21 3610W SHA-256 algorithm. Brand new, factory sealed. Ships within 1–2 working days.",
    specs: [
      { label: 'Hashrate', value: '190 TH/s' },
      { label: 'Power Consumption', value: '3610W' },
      { label: 'Algorithm', value: 'SHA-256' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },

  // ── WhatsMiner ────────────────────────────────────────────────────────────
  {
    id: 8,
    slug: 'whatsminer-m50s-bitcoin-miner',
    name: 'WhatsMiner M50S Bitcoin Miner',
    category: 'WhatsMiner', categorySlug: 'whatsminer',
    price: 4200,
    image: I('whatsminer-m50s-bitcoin-miner'),
    hashrate: '126 TH/s', power: '3276W', algorithm: 'SHA-256 (BTC)', brand: 'MicroBT', inStock: true,
    description: "The WhatsMiner M50S from MicroBT delivers 126 TH/s at 3276W. Excellent build quality and reliability for Bitcoin mining at scale.",
    specs: [
      { label: 'Model', value: 'WhatsMiner M50S' },
      { label: 'Manufacturer', value: 'MicroBT' },
      { label: 'Hashrate', value: '126 TH/s' },
      { label: 'Power Consumption', value: '3276W' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 9,
    slug: 'whatsminer-m50-bitcoin-miner',
    name: 'WhatsMiner M50 Bitcoin Miner',
    category: 'WhatsMiner', categorySlug: 'whatsminer',
    price: 3900,
    image: I('whatsminer-m50-bitcoin-miner'),
    hashrate: '114 TH/s', power: '3306W', algorithm: 'SHA-256 (BTC)', brand: 'MicroBT', inStock: true,
    description: "The WhatsMiner M50 is a reliable and efficient Bitcoin miner from MicroBT offering competitive hashrate at scale.",
    specs: [
      { label: 'Hashrate', value: '114 TH/s' },
      { label: 'Power Consumption', value: '3306W' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 10,
    slug: 'whatsminer-m53-27w-t',
    name: 'WhatsMiner M53 27W/T Bitcoin Miner',
    category: 'WhatsMiner', categorySlug: 'whatsminer',
    price: 5200, badge: 'hot',
    image: I('whatsminer-m53-27w-t'),
    hashrate: '226 TH/s', power: '6762W', algorithm: 'SHA-256 (BTC)', brand: 'MicroBT', inStock: true,
    description: "The WhatsMiner M53 delivers class-leading 226 TH/s at 27W/T efficiency — MicroBT flagship hydro cooling miner.",
    specs: [
      { label: 'Hashrate', value: '226 TH/s' },
      { label: 'Power Consumption', value: '6762W' },
      { label: 'Cooling', value: 'Hydro' },
      { label: 'Efficiency', value: '27 W/T' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 11,
    slug: 'whatsminer-m56s-bitcoin-miner',
    name: 'WhatsMiner M56S Bitcoin Miner',
    category: 'WhatsMiner', categorySlug: 'whatsminer',
    price: 5600,
    image: I('whatsminer-m56s-bitcoin-miner'),
    hashrate: '212 TH/s', power: '5762W', algorithm: 'SHA-256 (BTC)', brand: 'MicroBT', inStock: true,
    description: "The WhatsMiner M56S features immersion liquid cooling for ultra-high-density mining deployments.",
    specs: [
      { label: 'Hashrate', value: '212 TH/s' },
      { label: 'Power Consumption', value: '5762W' },
      { label: 'Cooling', value: 'Immersion' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 12,
    slug: 'whatsminer-m30s-88t-btc-miner',
    name: 'WhatsMiner M30S 88T BTC Miner',
    category: 'WhatsMiner', categorySlug: 'whatsminer',
    price: 2800, oldPrice: 3400, badge: 'sale',
    image: I('whatsminer-m30s-88t-btc-miner'),
    hashrate: '88 TH/s', power: '3344W', algorithm: 'SHA-256 (BTC)', brand: 'MicroBT', inStock: true,
    description: "The WhatsMiner M30S 88T is a proven and reliable Bitcoin miner at a competitive price point.",
    specs: [
      { label: 'Hashrate', value: '88 TH/s' },
      { label: 'Power Consumption', value: '3344W' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },

  // ── Antminer L7 (Scrypt) ──────────────────────────────────────────────────
  {
    id: 13,
    slug: 'bitmain-antminer-l7-9500mh-s-air-cooling-miner',
    name: 'Antminer L7 9500 MH/s Litecoin Miner',
    category: 'Antminer L7', categorySlug: 'antminer-l7',
    price: 3800, badge: 'new',
    image: I('bitmain-antminer-l7-9500mh-s-air-cooling-miner'),
    hashrate: '9.5 GH/s', power: '3425W', algorithm: 'Scrypt (LTC/DOGE)', brand: 'Bitmain', inStock: true,
    description: "Mine Litecoin and Dogecoin simultaneously with the Antminer L7 at 9.5 GH/s. The most powerful Scrypt ASIC miner available.",
    specs: [
      { label: 'Model', value: 'Antminer L7' },
      { label: 'Hashrate', value: '9.5 GH/s' },
      { label: 'Power Consumption', value: '3425W' },
      { label: 'Algorithm', value: 'Scrypt' },
      { label: 'Cryptocurrency', value: 'LTC / DOGE' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 14,
    slug: 'bitmain-antminer-l7-9300mh-s-air-cooling-miner',
    name: 'Antminer L7 9300 MH/s Litecoin Miner',
    category: 'Antminer L7', categorySlug: 'antminer-l7',
    price: 3600,
    image: I('bitmain-antminer-l7-9300mh-s-air-cooling-miner'),
    hashrate: '9.3 GH/s', power: '3425W', algorithm: 'Scrypt (LTC/DOGE)', brand: 'Bitmain', inStock: true,
    description: "Antminer L7 9300 MH/s — powerful Scrypt miner for LTC and DOGE mining operations.",
    specs: [
      { label: 'Hashrate', value: '9.3 GH/s' },
      { label: 'Power Consumption', value: '3425W' },
      { label: 'Algorithm', value: 'Scrypt' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 15,
    slug: 'bitmain-antminer-l7-8800mh-s-air-cooling-miner',
    name: 'Antminer L7 8800 MH/s Litecoin Miner',
    category: 'Antminer L7', categorySlug: 'antminer-l7',
    price: 3400,
    image: I('bitmain-antminer-l7-8800mh-s-air-cooling-miner', 'png'),
    hashrate: '8.8 GH/s', power: '3425W', algorithm: 'Scrypt (LTC/DOGE)', brand: 'Bitmain', inStock: true,
    description: "Antminer L7 8800 MH/s for Scrypt coin mining.",
    specs: [
      { label: 'Hashrate', value: '8.8 GH/s' },
      { label: 'Power Consumption', value: '3425W' },
      { label: 'Algorithm', value: 'Scrypt' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },

  // ── Goldshell ─────────────────────────────────────────────────────────────
  {
    id: 16,
    slug: 'goldshell-kd-max-40-2t-3350w',
    name: 'Goldshell KD Max 40.2T Kadena',
    category: 'Goldshell', categorySlug: 'goldshell',
    price: 7500,
    image: I('goldshell-kd-max-40-2t-3350w'),
    hashrate: '40.2 TH/s', power: '3350W', algorithm: 'KDA (Kadena)', brand: 'Goldshell', inStock: true,
    description: "The Goldshell KD Max is the highest hashrate Kadena miner with 40.2 TH/s. Dominate KDA mining with this powerhouse machine.",
    specs: [
      { label: 'Hashrate', value: '40.2 TH/s' },
      { label: 'Power Consumption', value: '3350W' },
      { label: 'Algorithm', value: 'KDA' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 17,
    slug: 'goldshell-hs6-se-hns3-7t-sc8-2t-miner',
    name: 'Goldshell HS6 SE HNS/SC Miner',
    category: 'Goldshell', categorySlug: 'goldshell',
    price: 2800,
    image: I('goldshell-hs6-se-hns3-7t-sc8-2t-miner'),
    hashrate: '3.7 TH/s (HNS)', power: '2700W', algorithm: 'Blake2B-Sia (HNS/SC)', brand: 'Goldshell', inStock: true,
    description: "Goldshell HS6 SE mines HNS and SC simultaneously with great efficiency.",
    specs: [
      { label: 'Hashrate (HNS)', value: '3.7 TH/s' },
      { label: 'Power Consumption', value: '2700W' },
      { label: 'Algorithm', value: 'Blake2B-Sia' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 18,
    slug: 'goldshell-lt6-litecoin-dogecoin-miner',
    name: 'Goldshell LT6 Litecoin/Dogecoin Miner',
    category: 'Goldshell', categorySlug: 'goldshell',
    price: 1800,
    image: I('goldshell-lt6-litecoin-dogecoin-miner', 'png'),
    hashrate: '1.625 GH/s', power: '2000W', algorithm: 'Scrypt (LTC/DOGE)', brand: 'Goldshell', inStock: true,
    description: "The Goldshell LT6 is a compact and efficient Scrypt miner for LTC and DOGE.",
    specs: [
      { label: 'Hashrate', value: '1.625 GH/s' },
      { label: 'Power Consumption', value: '2000W' },
      { label: 'Algorithm', value: 'Scrypt' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },

  // ── Power Supplies ────────────────────────────────────────────────────────
  {
    id: 19,
    slug: '6000w-overclocking-power-supply',
    name: '6000W Overclocking Power Supply',
    category: 'Power Supplies', categorySlug: 'power-supplies',
    price: 620,
    image: I('6000w-overclocking-power-supply', 'png'),
    hashrate: 'N/A', power: '6000W output', algorithm: 'Universal', brand: 'OEM', inStock: true,
    description: "High-efficiency 6000W overclocking PSU compatible with all major ASIC miners. Supports Antminer S19/S21, WhatsMiner M50, and more.",
    specs: [
      { label: 'Output Power', value: '6000W' },
      { label: 'Efficiency', value: '93%+' },
      { label: 'Compatibility', value: 'Antminer, WhatsMiner, Avalon' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 20,
    slug: '8000w-overclocking-power-supply',
    name: '8000W Overclocking Power Supply',
    category: 'Power Supplies', categorySlug: 'power-supplies',
    price: 780,
    image: I('8000w-overclocking-power-supply'),
    hashrate: 'N/A', power: '8000W output', algorithm: 'Universal', brand: 'OEM', inStock: true,
    description: "8000W overclocking PSU for the most demanding ASIC mining hardware.",
    specs: [
      { label: 'Output Power', value: '8000W' },
      { label: 'Efficiency', value: '93%+' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 21,
    slug: '4500w-overclocking-power-supply',
    name: '4500W Overclocking Power Supply',
    category: 'Power Supplies', categorySlug: 'power-supplies',
    price: 480,
    image: I('4500w-overclocking-power-supply'),
    hashrate: 'N/A', power: '4500W output', algorithm: 'Universal', brand: 'OEM', inStock: true,
    description: "4500W overclocking PSU for mid-range ASIC miners.",
    specs: [
      { label: 'Output Power', value: '4500W' },
      { label: 'Efficiency', value: '93%+' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },

  // ── iBeLink ───────────────────────────────────────────────────────────────
  {
    id: 22,
    slug: 'ibelink-k3-kadena-miner-70t-3300w',
    name: 'iBeLink K3 Kadena Miner 70T',
    category: 'Goldshell', categorySlug: 'goldshell',
    price: 4800,
    image: I('ibelink-k3-kadena-miner-70t-3300w'),
    hashrate: '70 TH/s', power: '3300W', algorithm: 'KDA (Kadena)', brand: 'iBeLink', inStock: true,
    description: "The iBeLink K3 is the highest hashrate Kadena ASIC miner at 70 TH/s.",
    specs: [
      { label: 'Hashrate', value: '70 TH/s' },
      { label: 'Power Consumption', value: '3300W' },
      { label: 'Algorithm', value: 'KDA' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },

  // ── S19 series ────────────────────────────────────────────────────────────
  {
    id: 23,
    slug: 'bitmain-antminer-s19-pro-110t-bitcoin-miner',
    name: 'Antminer S19 Pro 110T Bitcoin Miner',
    category: 'Antminer S19', categorySlug: 'antminer-s19',
    price: 3200, oldPrice: 4100, badge: 'sale',
    image: I('bitmain-antminer-s19-pro-110t-bitcoin-miner', 'png'),
    hashrate: '110 TH/s', power: '3250W', algorithm: 'SHA-256 (BTC)', brand: 'Bitmain', inStock: true,
    description: "The Antminer S19 Pro 110T remains one of the most reliable and cost-effective Bitcoin miners available.",
    specs: [
      { label: 'Hashrate', value: '110 TH/s' },
      { label: 'Power Consumption', value: '3250W' },
      { label: 'Efficiency', value: '29.5 J/TH' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 24,
    slug: 'bitmain-antminer-s19-pro-100t-miner',
    name: 'Antminer S19 Pro 100T Miner',
    category: 'Antminer S19', categorySlug: 'antminer-s19',
    price: 2900, oldPrice: 3600, badge: 'sale',
    image: I('bitmain-antminer-s19-pro-100t-miner', 'png'),
    hashrate: '100 TH/s', power: '3050W', algorithm: 'SHA-256 (BTC)', brand: 'Bitmain', inStock: true,
    description: "The Antminer S19 Pro 100T is an excellent entry point into professional Bitcoin mining.",
    specs: [
      { label: 'Hashrate', value: '100 TH/s' },
      { label: 'Power Consumption', value: '3050W' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },

  // ── Other ─────────────────────────────────────────────────────────────────
  {
    id: 25,
    slug: 'antminer-e9-pro-miner',
    name: 'Antminer E9 Pro ETC Miner',
    category: 'Other Miners', categorySlug: 'other',
    price: 2400,
    image: I('antminer-e9-pro-miner'),
    hashrate: '3.68 GH/s', power: '2200W', algorithm: 'ETHash (ETC)', brand: 'Bitmain', inStock: true,
    description: "The Antminer E9 Pro mines Ethereum Classic (ETC) with leading hashrate and efficiency.",
    specs: [
      { label: 'Hashrate', value: '3.68 GH/s' },
      { label: 'Power Consumption', value: '2200W' },
      { label: 'Algorithm', value: 'ETHash' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
  {
    id: 26,
    slug: 'bitmain-antminer-hs3-hns-miner-9t',
    name: 'Bitmain Antminer HS3 HNS Miner 9T',
    category: 'Other Miners', categorySlug: 'other',
    price: 1800,
    image: I('bitmain-antminer-hs3-hns-miner-9t', 'png'),
    hashrate: '9 TH/s', power: '2079W', algorithm: 'Blake2B-Sia (HNS)', brand: 'Bitmain', inStock: true,
    description: "The Antminer HS3 is the leading HNS/Handshake ASIC miner from Bitmain.",
    specs: [
      { label: 'Hashrate', value: '9 TH/s' },
      { label: 'Power Consumption', value: '2079W' },
      { label: 'Algorithm', value: 'Blake2B-Sia' },
      { label: 'Delivery Time', value: '1–2 Working days' },
    ],
  },
];

export const categories = [
  { name: 'All Products',   slug: '' },
  { name: 'Antminer S21',   slug: 'antminer-s21' },
  { name: 'Antminer T21',   slug: 'antminer-t21' },
  { name: 'Antminer S19',   slug: 'antminer-s19' },
  { name: 'Antminer L7',    slug: 'antminer-l7' },
  { name: 'WhatsMiner',     slug: 'whatsminer' },
  { name: 'Goldshell',      slug: 'goldshell' },
  { name: 'Power Supplies', slug: 'power-supplies' },
  { name: 'Other Miners',   slug: 'other' },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getRelatedProducts(product: Product, count = 4): Product[] {
  const same = products.filter(
    (p) => p.id !== product.id && p.categorySlug === product.categorySlug,
  );
  const others = products.filter(
    (p) => p.id !== product.id && p.categorySlug !== product.categorySlug,
  );
  return [...same, ...others].slice(0, count);
}
