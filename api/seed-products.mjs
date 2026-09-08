/**
 * Seed 26 real products using StreetJS PgPool (no external pg package).
 * Run: node --experimental-vm-modules seed-products.mjs
 * Or via psql directly — this script generates SQL and runs it.
 */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DB_URL = process.env['DATABASE_URL'] ?? 'postgresql://scminer:scminer_dev_pass_2024@localhost:5432/scminer';

function uuid() { return crypto.randomUUID(); }
function esc(v) { return v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`; }
function num(v) { return v === null || v === undefined ? 'NULL' : Number(v); }
function bool(v) { return v ? 'true' : 'false'; }

// ── IDs ───────────────────────────────────────────────────────────────────────
const IDS = {
  brands: { bitmain: uuid(), microbt: uuid(), goldshell: uuid(), ibelink: uuid(), oem: uuid() },
  cats:   { s21: uuid(), t21: uuid(), s19: uuid(), l7: uuid(), wm: uuid(), gs: uuid(), psu: uuid(), other: uuid() },
};

const lines = [];
const push = (...args) => lines.push(...args);

// ── Brands ────────────────────────────────────────────────────────────────────
push(`INSERT INTO brands (id,name,slug,active) VALUES`);
push(`  ('${IDS.brands.bitmain}','Bitmain','bitmain',true),`);
push(`  ('${IDS.brands.microbt}','MicroBT','microbt',true),`);
push(`  ('${IDS.brands.goldshell}','Goldshell','goldshell',true),`);
push(`  ('${IDS.brands.ibelink}','iBeLink','ibelink',true),`);
push(`  ('${IDS.brands.oem}','OEM','oem',true)`);
push(`ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;`);
push(``);

// Re-fetch actual IDs after upsert — use slug-based lookups in product INSERT
push(`-- Re-assign brand ids by slug for product inserts`);
for (const [k,slug] of [['bitmain','bitmain'],['microbt','microbt'],['goldshell','goldshell'],['ibelink','ibelink'],['oem','oem']]) {
  push(`\\set brand_${k} \`psql -tA -c "SELECT id FROM brands WHERE slug='${slug}'" "${DB_URL}"\``);
}
push(``);

// ── Categories ────────────────────────────────────────────────────────────────
push(`INSERT INTO categories (id,name,slug,active) VALUES`);
push(`  ('${IDS.cats.s21}','Antminer S21','antminer-s21',true),`);
push(`  ('${IDS.cats.t21}','Antminer T21','antminer-t21',true),`);
push(`  ('${IDS.cats.s19}','Antminer S19','antminer-s19',true),`);
push(`  ('${IDS.cats.l7}', 'Antminer L7', 'antminer-l7', true),`);
push(`  ('${IDS.cats.wm}', 'WhatsMiner',  'whatsminer',  true),`);
push(`  ('${IDS.cats.gs}', 'Goldshell',   'goldshell-miners',   true),`);
push(`  ('${IDS.cats.psu}','Power Supplies','power-supplies',true),`);
push(`  ('${IDS.cats.other}','Other Miners','other-miners',true)`);
push(`ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;`);
push(``);

// ── Products helper ────────────────────────────────────────────────────────────
function insertProduct({ slug, sku, name, desc, brandKey, catKey, price, hashrate, hrUnit, power, algo, coin, noise, mfr, warranty, featured, imgPath, specs }) {
  const prodId = uuid();
  const cents  = Math.round(price * 100);
  const bId    = IDS.brands[brandKey];
  const cId    = IDS.cats[catKey];

  push(`-- ${name}`);
  push(`DO $$ BEGIN`);
  push(`  IF NOT EXISTS (SELECT 1 FROM products WHERE slug=${esc(slug)}) THEN`);
  push(`    INSERT INTO products (id,slug,sku,name,short_description,description,brand_id,category_id,status,price_cents,featured,hashrate,hashrate_unit,power_consumption,algorithm,coin,noise_level,manufacturer,warranty_months)`);
  push(`    VALUES (${esc(prodId)},${esc(slug)},${esc(sku)},${esc(name)},${esc(desc.slice(0,120))},${esc(desc)},${esc(bId)},${esc(cId)},'active',${cents},${bool(featured)},${num(hashrate)},${esc(hrUnit)},${num(power)},${esc(algo)},${esc(coin)},${num(noise)},${esc(mfr)},${num(warranty)});`);
  push(`    INSERT INTO product_images (id,product_id,url,alt,sort_order,is_primary)`);
  push(`    VALUES (${esc(uuid())},${esc(prodId)},${esc(imgPath)},${esc(name)},0,true);`);
  for (let i=0; i<specs.length; i++) {
    push(`    INSERT INTO product_specs (id,product_id,label,value,sort_order) VALUES (${esc(uuid())},${esc(prodId)},${esc(specs[i][0])},${esc(specs[i][1])},${i});`);
  }
  push(`    INSERT INTO inventory (id,product_id,quantity_on_hand,low_stock_threshold) VALUES (${esc(uuid())},${esc(prodId)},100,5);`);
  push(`  END IF;`);
  push(`END $$;`);
  push(``);
}

// ── All 26 products ────────────────────────────────────────────────────────────
const IMG = '/images/products/';
insertProduct({ slug:'200t-s21-3500w-antminer', sku:'ANT-S21-200T', name:'200T S21 3500W Antminer', desc:'The Bitmain Antminer S21 200T delivers exceptional Bitcoin mining at 200 TH/s with 3500W power draw. Factory original, brand-new.', brandKey:'bitmain', catKey:'s21', price:5800, featured:true, hashrate:200, hrUnit:'TH/s', power:3500, algo:'SHA-256', coin:'BTC', noise:75, mfr:'Bitmain', warranty:12, imgPath:IMG+'200t-s21-3500w-antminer.png', specs:[['Model','Antminer S21'],['Hashrate','200 TH/s'],['Power','3500W'],['Algorithm','SHA-256'],['Noise Level','75 dB'],['Delivery','1–2 Working Days'],['Payment','USD | BTC | USDT']] });
insertProduct({ slug:'bitmain-antminer-s21-bitcoin-miner-188t', sku:'ANT-S21-188T', name:'Bitmain Antminer S21 188T Bitcoin Miner', desc:'Antminer S21 188T — flagship next-generation Bitcoin miner from Bitmain with best-in-class efficiency.', brandKey:'bitmain', catKey:'s21', price:5600, featured:true, hashrate:188, hrUnit:'TH/s', power:3500, algo:'SHA-256', coin:'BTC', noise:75, mfr:'Bitmain', warranty:12, imgPath:IMG+'bitmain-antminer-s21-bitcoin-miner-188t.png', specs:[['Model','Antminer S21'],['Hashrate','188 TH/s'],['Power','3500W'],['Algorithm','SHA-256'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'bitmain-antminer-s21-bitcoin-miner-195t', sku:'ANT-S21-195T', name:'Bitmain Antminer S21 195T Bitcoin Miner', desc:'Antminer S21 195T with outstanding efficiency for large-scale Bitcoin mining operations.', brandKey:'bitmain', catKey:'s21', price:5700, featured:false, hashrate:195, hrUnit:'TH/s', power:3500, algo:'SHA-256', coin:'BTC', noise:75, mfr:'Bitmain', warranty:12, imgPath:IMG+'bitmain-antminer-s21-bitcoin-miner-195t.png', specs:[['Hashrate','195 TH/s'],['Power','3500W'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'bitmain-antminer-s19-pro-hyd-bitcoin-miner-177t', sku:'ANT-S19-HYD-177T', name:'Bitmain Antminer S19 Pro Hyd 177T', desc:'Antminer S19 Pro Hyd 177T uses liquid cooling for exceptional efficiency and hashrate.', brandKey:'bitmain', catKey:'s19', price:4800, featured:false, hashrate:177, hrUnit:'TH/s', power:5221, algo:'SHA-256', coin:'BTC', noise:50, mfr:'Bitmain', warranty:12, imgPath:IMG+'bitmain-antminer-s19-pro-hyd-bitcoin-miner-177t.png', specs:[['Hashrate','177 TH/s'],['Power','5221W'],['Cooling','Hydro (liquid)'],['Algorithm','SHA-256'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'antminer-bitmain-s19-xp-profit-consumption-141t-hi', sku:'ANT-S19XP-141T', name:'Antminer S19 XP 141T 3010W', desc:'Antminer S19 XP 141T offers exceptional efficiency at 21.5 J/TH with 141 TH/s hashrate.', brandKey:'bitmain', catKey:'s19', price:4500, featured:false, hashrate:141, hrUnit:'TH/s', power:3010, algo:'SHA-256', coin:'BTC', noise:75, mfr:'Bitmain', warranty:12, imgPath:IMG+'antminer-bitmain-s19-xp-profit-consumption-141t-hi.webp', specs:[['Hashrate','141 TH/s'],['Power','3010W'],['Efficiency','21.5 J/TH'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'bitmain-antminer-s19-pro-110t-bitcoin-miner', sku:'ANT-S19PRO-110T', name:'Antminer S19 Pro 110T Bitcoin Miner', desc:'Antminer S19 Pro 110T — one of the most reliable and cost-effective Bitcoin miners available.', brandKey:'bitmain', catKey:'s19', price:3200, featured:false, hashrate:110, hrUnit:'TH/s', power:3250, algo:'SHA-256', coin:'BTC', noise:75, mfr:'Bitmain', warranty:12, imgPath:IMG+'bitmain-antminer-s19-pro-110t-bitcoin-miner.png', specs:[['Hashrate','110 TH/s'],['Power','3250W'],['Efficiency','29.5 J/TH'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'bitmain-antminer-s19-pro-100t-miner', sku:'ANT-S19PRO-100T', name:'Antminer S19 Pro 100T Miner', desc:'Antminer S19 Pro 100T — excellent entry point into professional Bitcoin mining.', brandKey:'bitmain', catKey:'s19', price:2900, featured:false, hashrate:100, hrUnit:'TH/s', power:3050, algo:'SHA-256', coin:'BTC', noise:75, mfr:'Bitmain', warranty:12, imgPath:IMG+'bitmain-antminer-s19-pro-100t-miner.png', specs:[['Hashrate','100 TH/s'],['Power','3050W'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'190t-antminer-t21-3610w', sku:'ANT-T21-190T-A', name:'190T Antminer T21 3610W ASIC', desc:"Antminer T21 190T — Bitmain's most popular mid-range BTC miner, 190 TH/s at 3610W. Supports NEM to HEM self-adjustment.", brandKey:'bitmain', catKey:'t21', price:6100, featured:true, hashrate:190, hrUnit:'TH/s', power:3610, algo:'SHA-256', coin:'BTC', noise:76, mfr:'Bitmain', warranty:12, imgPath:IMG+'190t-antminer-t21-3610w-asic-mining-most-popular-b.webp', specs:[['Model','Antminer T21'],['Hashrate','190 TH/s'],['Power','3610W'],['Noise','76 dB'],['Algorithm','SHA-256'],['Delivery','1–2 Working Days'],['Payment','USD | BTC | USDT']] });
insertProduct({ slug:'crypto-mining-machine-190t-antminer-t21-3610w-sha-', sku:'ANT-T21-190T-B', name:'190T Antminer T21 SHA-256 IN Stock', desc:'Antminer T21 3610W SHA-256 algorithm. Brand new, factory sealed. Ships within 1–2 working days.', brandKey:'bitmain', catKey:'t21', price:5780, featured:false, hashrate:190, hrUnit:'TH/s', power:3610, algo:'SHA-256', coin:'BTC', noise:76, mfr:'Bitmain', warranty:12, imgPath:IMG+'crypto-mining-machine-190t-antminer-t21-3610w-sha-.webp', specs:[['Hashrate','190 TH/s'],['Power','3610W'],['Algorithm','SHA-256'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'whatsminer-m50s-bitcoin-miner', sku:'WM-M50S-126T', name:'WhatsMiner M50S Bitcoin Miner', desc:'WhatsMiner M50S from MicroBT delivers 126 TH/s at 3276W. Excellent build quality and reliability for Bitcoin mining at scale.', brandKey:'microbt', catKey:'wm', price:4200, featured:true, hashrate:126, hrUnit:'TH/s', power:3276, algo:'SHA-256', coin:'BTC', noise:75, mfr:'MicroBT', warranty:12, imgPath:IMG+'whatsminer-m50s-bitcoin-miner.jpg', specs:[['Model','WhatsMiner M50S'],['Hashrate','126 TH/s'],['Power','3276W'],['Algorithm','SHA-256'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'whatsminer-m50-bitcoin-miner', sku:'WM-M50-114T', name:'WhatsMiner M50 Bitcoin Miner', desc:'WhatsMiner M50 — reliable and efficient Bitcoin miner from MicroBT.', brandKey:'microbt', catKey:'wm', price:3900, featured:false, hashrate:114, hrUnit:'TH/s', power:3306, algo:'SHA-256', coin:'BTC', noise:75, mfr:'MicroBT', warranty:12, imgPath:IMG+'whatsminer-m50-bitcoin-miner.jpg', specs:[['Hashrate','114 TH/s'],['Power','3306W'],['Algorithm','SHA-256'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'whatsminer-m53-27w-t', sku:'WM-M53-226T', name:'WhatsMiner M53 27W/T Bitcoin Miner', desc:'WhatsMiner M53 flagship hydro cooling miner — 226 TH/s at 27W/T efficiency.', brandKey:'microbt', catKey:'wm', price:5200, featured:true, hashrate:226, hrUnit:'TH/s', power:6762, algo:'SHA-256', coin:'BTC', noise:45, mfr:'MicroBT', warranty:12, imgPath:IMG+'whatsminer-m53-27w-t.jpg', specs:[['Hashrate','226 TH/s'],['Power','6762W'],['Cooling','Hydro'],['Efficiency','27 W/T'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'whatsminer-m56s-bitcoin-miner', sku:'WM-M56S-212T', name:'WhatsMiner M56S Bitcoin Miner', desc:'WhatsMiner M56S features immersion liquid cooling for ultra-high-density mining deployments.', brandKey:'microbt', catKey:'wm', price:5600, featured:false, hashrate:212, hrUnit:'TH/s', power:5762, algo:'SHA-256', coin:'BTC', noise:45, mfr:'MicroBT', warranty:12, imgPath:IMG+'whatsminer-m56s-bitcoin-miner.jpg', specs:[['Hashrate','212 TH/s'],['Power','5762W'],['Cooling','Immersion'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'whatsminer-m30s-88t-btc-miner', sku:'WM-M30S-88T', name:'WhatsMiner M30S 88T BTC Miner', desc:'WhatsMiner M30S 88T — proven and reliable Bitcoin miner at a competitive price point.', brandKey:'microbt', catKey:'wm', price:2800, featured:false, hashrate:88, hrUnit:'TH/s', power:3344, algo:'SHA-256', coin:'BTC', noise:75, mfr:'MicroBT', warranty:12, imgPath:IMG+'whatsminer-m30s-88t-btc-miner.jpg', specs:[['Hashrate','88 TH/s'],['Power','3344W'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'bitmain-antminer-l7-9500mh-s-air-cooling-miner', sku:'ANT-L7-9500M', name:'Antminer L7 9500 MH/s Litecoin Miner', desc:'Mine Litecoin and Dogecoin simultaneously with the Antminer L7 at 9.5 GH/s. The most powerful Scrypt ASIC miner.', brandKey:'bitmain', catKey:'l7', price:3800, featured:true, hashrate:9.5, hrUnit:'GH/s', power:3425, algo:'Scrypt', coin:'LTC/DOGE', noise:75, mfr:'Bitmain', warranty:12, imgPath:IMG+'bitmain-antminer-l7-9500mh-s-air-cooling-miner.jpg', specs:[['Hashrate','9.5 GH/s'],['Power','3425W'],['Algorithm','Scrypt'],['Cryptocurrency','LTC / DOGE'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'bitmain-antminer-l7-9300mh-s-air-cooling-miner', sku:'ANT-L7-9300M', name:'Antminer L7 9300 MH/s Litecoin Miner', desc:'Antminer L7 9300 MH/s for LTC and DOGE Scrypt mining.', brandKey:'bitmain', catKey:'l7', price:3600, featured:false, hashrate:9.3, hrUnit:'GH/s', power:3425, algo:'Scrypt', coin:'LTC/DOGE', noise:75, mfr:'Bitmain', warranty:12, imgPath:IMG+'bitmain-antminer-l7-9300mh-s-air-cooling-miner.jpg', specs:[['Hashrate','9.3 GH/s'],['Power','3425W'],['Algorithm','Scrypt'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'bitmain-antminer-l7-8800mh-s-air-cooling-miner', sku:'ANT-L7-8800M', name:'Antminer L7 8800 MH/s Litecoin Miner', desc:'Antminer L7 8800 MH/s for Scrypt coin mining.', brandKey:'bitmain', catKey:'l7', price:3400, featured:false, hashrate:8.8, hrUnit:'GH/s', power:3425, algo:'Scrypt', coin:'LTC/DOGE', noise:75, mfr:'Bitmain', warranty:12, imgPath:IMG+'bitmain-antminer-l7-8800mh-s-air-cooling-miner.png', specs:[['Hashrate','8.8 GH/s'],['Power','3425W'],['Algorithm','Scrypt'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'goldshell-kd-max-40-2t-3350w', sku:'GS-KDMAX-40T', name:'Goldshell KD Max 40.2T Kadena', desc:'Goldshell KD Max — highest hashrate Kadena miner at 40.2 TH/s. Dominate KDA mining.', brandKey:'goldshell', catKey:'gs', price:7500, featured:true, hashrate:40.2, hrUnit:'TH/s', power:3350, algo:'KDA', coin:'KDA', noise:80, mfr:'Goldshell', warranty:12, imgPath:IMG+'goldshell-kd-max-40-2t-3350w.jpg', specs:[['Hashrate','40.2 TH/s'],['Power','3350W'],['Algorithm','KDA'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'goldshell-hs6-se-hns3-7t-sc8-2t-miner', sku:'GS-HS6SE', name:'Goldshell HS6 SE HNS/SC Miner', desc:'Goldshell HS6 SE mines HNS and SC simultaneously with great efficiency.', brandKey:'goldshell', catKey:'gs', price:2800, featured:false, hashrate:3.7, hrUnit:'TH/s', power:2700, algo:'Blake2B-Sia', coin:'HNS/SC', noise:75, mfr:'Goldshell', warranty:12, imgPath:IMG+'goldshell-hs6-se-hns3-7t-sc8-2t-miner.jpg', specs:[['Hashrate (HNS)','3.7 TH/s'],['Power','2700W'],['Algorithm','Blake2B-Sia'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'goldshell-lt6-litecoin-dogecoin-miner', sku:'GS-LT6', name:'Goldshell LT6 Litecoin/Dogecoin Miner', desc:'Goldshell LT6 — compact efficient Scrypt miner for LTC and DOGE.', brandKey:'goldshell', catKey:'gs', price:1800, featured:false, hashrate:1.625, hrUnit:'GH/s', power:2000, algo:'Scrypt', coin:'LTC/DOGE', noise:75, mfr:'Goldshell', warranty:12, imgPath:IMG+'goldshell-lt6-litecoin-dogecoin-miner.png', specs:[['Hashrate','1.625 GH/s'],['Power','2000W'],['Algorithm','Scrypt'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'ibelink-k3-kadena-miner-70t-3300w', sku:'IBL-K3-70T', name:'iBeLink K3 Kadena Miner 70T', desc:'iBeLink K3 — highest hashrate Kadena ASIC miner at 70 TH/s.', brandKey:'ibelink', catKey:'gs', price:4800, featured:false, hashrate:70, hrUnit:'TH/s', power:3300, algo:'KDA', coin:'KDA', noise:80, mfr:'iBeLink', warranty:12, imgPath:IMG+'ibelink-k3-kadena-miner-70t-3300w.jpg', specs:[['Hashrate','70 TH/s'],['Power','3300W'],['Algorithm','KDA'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'6000w-overclocking-power-supply', sku:'PSU-6000W-OC', name:'6000W Overclocking Power Supply', desc:'High-efficiency 6000W overclocking PSU compatible with all major ASIC miners. Supports Antminer S19/S21, WhatsMiner M50, and more.', brandKey:'oem', catKey:'psu', price:620, featured:false, hashrate:null, hrUnit:null, power:6000, algo:'Universal', coin:null, noise:null, mfr:'OEM', warranty:6, imgPath:IMG+'6000w-overclocking-power-supply.png', specs:[['Output Power','6000W'],['Efficiency','93%+'],['Compatibility','Antminer, WhatsMiner, Avalon'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'8000w-overclocking-power-supply', sku:'PSU-8000W-OC', name:'8000W Overclocking Power Supply', desc:'8000W overclocking PSU for the most demanding ASIC mining hardware.', brandKey:'oem', catKey:'psu', price:780, featured:false, hashrate:null, hrUnit:null, power:8000, algo:'Universal', coin:null, noise:null, mfr:'OEM', warranty:6, imgPath:IMG+'8000w-overclocking-power-supply.jpg', specs:[['Output Power','8000W'],['Efficiency','93%+'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'4500w-overclocking-power-supply', sku:'PSU-4500W-OC', name:'4500W Overclocking Power Supply', desc:'4500W overclocking PSU for mid-range ASIC miners.', brandKey:'oem', catKey:'psu', price:480, featured:false, hashrate:null, hrUnit:null, power:4500, algo:'Universal', coin:null, noise:null, mfr:'OEM', warranty:6, imgPath:IMG+'4500w-overclocking-power-supply.jpg', specs:[['Output Power','4500W'],['Efficiency','93%+'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'antminer-e9-pro-miner', sku:'ANT-E9PRO', name:'Antminer E9 Pro ETC Miner', desc:'Antminer E9 Pro mines Ethereum Classic (ETC) with leading hashrate and efficiency.', brandKey:'bitmain', catKey:'other', price:2400, featured:false, hashrate:3.68, hrUnit:'GH/s', power:2200, algo:'ETHash', coin:'ETC', noise:75, mfr:'Bitmain', warranty:12, imgPath:IMG+'antminer-e9-pro-miner.jpg', specs:[['Hashrate','3.68 GH/s'],['Power','2200W'],['Algorithm','ETHash'],['Delivery','1–2 Working Days']] });
insertProduct({ slug:'bitmain-antminer-hs3-hns-miner-9t', sku:'ANT-HS3-9T', name:'Bitmain Antminer HS3 HNS Miner 9T', desc:'Antminer HS3 — leading HNS/Handshake ASIC miner from Bitmain at 9 TH/s.', brandKey:'bitmain', catKey:'other', price:1800, featured:false, hashrate:9, hrUnit:'TH/s', power:2079, algo:'Blake2B-Sia', coin:'HNS', noise:75, mfr:'Bitmain', warranty:12, imgPath:IMG+'bitmain-antminer-hs3-hns-miner-9t.png', specs:[['Hashrate','9 TH/s'],['Power','2079W'],['Algorithm','Blake2B-Sia'],['Delivery','1–2 Working Days']] });

// ── Write SQL file and run via psql ────────────────────────────────────────────
const sql = lines.join('\n');
const tmpFile = join(tmpdir(), `scminer-seed-${Date.now()}.sql`);
writeFileSync(tmpFile, sql, 'utf8');

console.log(`Running seed SQL (${lines.length} lines)...`);
try {
  const out = execSync(
    `psql "${DB_URL}" -f "${tmpFile}"`,
    { encoding: 'utf8' },
  );
  console.log(out);
  console.log('✓ Seed complete.');
} catch (err) {
  console.error('Seed failed:', err.stderr || err.message);
  process.exit(1);
} finally {
  unlinkSync(tmpFile);
}
