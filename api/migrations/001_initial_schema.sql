-- SCminer initial schema
-- All monetary values stored as integer cents (BIGINT) to avoid floating-point errors

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Roles & Permissions ──────────────────────────────────────────────────────
CREATE TABLE roles (
  id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
  id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email               TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  first_name          TEXT NOT NULL DEFAULT '',
  last_name           TEXT NOT NULL DEFAULT '',
  phone               TEXT,
  company             TEXT,
  email_verified_at   TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','deleted')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email  ON users(email);
CREATE INDEX idx_users_status ON users(status);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

CREATE TABLE password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Addresses ─────────────────────────────────────────────────────────────────
CREATE TABLE addresses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL DEFAULT 'shipping'
                 CHECK (type IN ('billing','shipping')),
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  company      TEXT,
  line1        TEXT NOT NULL,
  line2        TEXT,
  city         TEXT NOT NULL,
  state        TEXT,
  postcode     TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  phone        TEXT,
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_addresses_user ON addresses(user_id);

-- ── Brands ────────────────────────────────────────────────────────────────────
CREATE TABLE brands (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url    TEXT,
  website     TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_brands_slug ON brands(slug);

-- ── Categories ────────────────────────────────────────────────────────────────
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id   UUID REFERENCES categories(id),
  image_url   TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_categories_slug      ON categories(slug);
CREATE INDEX idx_categories_parent    ON categories(parent_id);

-- ── Products ──────────────────────────────────────────────────────────────────
CREATE TABLE products (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug                 TEXT NOT NULL UNIQUE,
  sku                  TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  short_description    TEXT NOT NULL DEFAULT '',
  description          TEXT NOT NULL DEFAULT '',
  brand_id             UUID REFERENCES brands(id),
  category_id          UUID REFERENCES categories(id),
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','draft','archived')),
  -- money in cents
  price_cents          BIGINT NOT NULL CHECK (price_cents >= 0),
  compare_at_price_cents BIGINT CHECK (compare_at_price_cents >= 0),
  cost_price_cents     BIGINT CHECK (cost_price_cents >= 0),
  currency             CHAR(3) NOT NULL DEFAULT 'USD',
  weight_grams         INT,
  featured             BOOLEAN NOT NULL DEFAULT FALSE,
  rating               NUMERIC(3,2) NOT NULL DEFAULT 0
                         CHECK (rating BETWEEN 0 AND 5),
  review_count         INT NOT NULL DEFAULT 0,
  -- mining-specific
  hashrate             NUMERIC(20,6),
  hashrate_unit        TEXT,
  power_consumption    INT,
  power_unit           TEXT DEFAULT 'W',
  efficiency           NUMERIC(10,4),
  efficiency_unit      TEXT,
  algorithm            TEXT,
  coin                 TEXT,
  noise_level          INT,
  operating_temp_min   INT,
  operating_temp_max   INT,
  manufacturer         TEXT,
  warranty_months      INT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_slug      ON products(slug);
CREATE INDEX idx_products_sku       ON products(sku);
CREATE INDEX idx_products_category  ON products(category_id);
CREATE INDEX idx_products_brand     ON products(brand_id);
CREATE INDEX idx_products_status    ON products(status);
CREATE INDEX idx_products_featured  ON products(featured);
CREATE INDEX idx_products_algorithm ON products(algorithm);
CREATE INDEX idx_products_fts ON products
  USING gin(to_tsvector('english',
    coalesce(name,'') || ' ' ||
    coalesce(short_description,'') || ' ' ||
    coalesce(description,'')
  ));

-- ── Product images ────────────────────────────────────────────────────────────
CREATE TABLE product_images (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  alt        TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_product_images_product ON product_images(product_id);

-- ── Product specs ─────────────────────────────────────────────────────────────
CREATE TABLE product_specs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  value      TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_product_specs_product ON product_specs(product_id);

-- ── Inventory ─────────────────────────────────────────────────────────────────
CREATE TABLE inventory (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  quantity_on_hand    INT NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  quantity_reserved   INT NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  low_stock_threshold INT NOT NULL DEFAULT 5,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_movements (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID NOT NULL REFERENCES products(id),
  type           TEXT NOT NULL CHECK (
    type IN ('PURCHASE','SALE','RESERVATION','RELEASE',
             'ADJUSTMENT','RETURN','DAMAGE','RESTOCK')
  ),
  quantity_delta INT NOT NULL,
  reference_id   UUID,
  note           TEXT,
  actor_id       UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inv_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inv_movements_time    ON inventory_movements(created_at);

-- ── Carts ─────────────────────────────────────────────────────────────────────
CREATE TABLE carts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  currency   CHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cart_owner CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);
CREATE INDEX idx_carts_user    ON carts(user_id);
CREATE INDEX idx_carts_session ON carts(session_id);

CREATE TABLE cart_items (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id                  UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id               UUID NOT NULL REFERENCES products(id),
  quantity                 INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_snapshot_cents BIGINT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, product_id)
);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);

-- ── Wishlist ──────────────────────────────────────────────────────────────────
CREATE TABLE wishlist_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX idx_wishlist_user ON wishlist_items(user_id);

-- ── Compare ───────────────────────────────────────────────────────────────────
CREATE TABLE compare_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Reviews ───────────────────────────────────────────────────────────────────
CREATE TABLE reviews (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_item_id       UUID,
  rating              SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title               TEXT,
  body                TEXT,
  status              TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_status  ON reviews(status);

-- ── Coupons ───────────────────────────────────────────────────────────────────
CREATE TABLE coupons (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code               TEXT NOT NULL UNIQUE,
  type               TEXT NOT NULL CHECK (type IN ('percentage','fixed')),
  value              NUMERIC(10,4) NOT NULL CHECK (value > 0),
  min_order_cents    BIGINT NOT NULL DEFAULT 0,
  max_discount_cents BIGINT,
  usage_limit        INT,
  per_user_limit     INT NOT NULL DEFAULT 1,
  usage_count        INT NOT NULL DEFAULT 0,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_coupons_code ON coupons(code);

CREATE TABLE coupon_redemptions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id  UUID NOT NULL REFERENCES coupons(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  order_id   UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Shipping methods ──────────────────────────────────────────────────────────
CREATE TABLE shipping_methods (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  carrier               TEXT,
  estimated_days_min    INT,
  estimated_days_max    INT,
  price_cents           BIGINT NOT NULL DEFAULT 0,
  free_threshold_cents  BIGINT,
  active                BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── Orders ────────────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number       TEXT NOT NULL UNIQUE,
  user_id            UUID REFERENCES users(id),
  status             TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (
    status IN (
      'PENDING_PAYMENT','PAYMENT_PROCESSING','PAID',
      'PROCESSING','PACKED','SHIPPED','DELIVERED',
      'CANCELLED','REFUND_PENDING','REFUNDED','ON_HOLD'
    )
  ),
  currency           CHAR(3) NOT NULL DEFAULT 'USD',
  subtotal_cents     BIGINT NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents     BIGINT NOT NULL DEFAULT 0,
  shipping_cents     BIGINT NOT NULL DEFAULT 0,
  tax_cents          BIGINT NOT NULL DEFAULT 0,
  total_cents        BIGINT NOT NULL CHECK (total_cents >= 0),
  coupon_id          UUID REFERENCES coupons(id),
  shipping_method_id UUID REFERENCES shipping_methods(id),
  tracking_number    TEXT,
  carrier            TEXT,
  notes              TEXT,
  customer_note      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_user   ON orders(user_id);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);

-- ── Order items (immutable snapshots) ─────────────────────────────────────────
CREATE TABLE order_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES products(id),
  product_name     TEXT NOT NULL,
  product_sku      TEXT NOT NULL,
  product_slug     TEXT NOT NULL,
  unit_price_cents BIGINT NOT NULL,
  quantity         INT NOT NULL CHECK (quantity > 0),
  discount_cents   BIGINT NOT NULL DEFAULT 0,
  subtotal_cents   BIGINT NOT NULL,
  product_meta     JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ── Order addresses (immutable snapshots) ─────────────────────────────────────
CREATE TABLE order_addresses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('billing','shipping')),
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  company      TEXT,
  line1        TEXT NOT NULL,
  line2        TEXT,
  city         TEXT NOT NULL,
  state        TEXT,
  postcode     TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  phone        TEXT
);

-- ── Crypto assets & networks ──────────────────────────────────────────────────
CREATE TABLE supported_assets (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol                    TEXT NOT NULL,
  name                      TEXT NOT NULL,
  network                   TEXT NOT NULL,
  contract_address          TEXT,
  decimals                  INT NOT NULL DEFAULT 18,
  chain_id                  TEXT,
  confirmation_requirements INT NOT NULL DEFAULT 3,
  enabled                   BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (symbol, network)
);

-- ── Wallets (receiving addresses only — NO private keys stored here) ──────────
CREATE TABLE wallets (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id   UUID NOT NULL REFERENCES supported_assets(id),
  address    TEXT NOT NULL,
  label      TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wallets_asset  ON wallets(asset_id);
CREATE INDEX idx_wallets_active ON wallets(asset_id, active);

-- ── Payments ──────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id               UUID NOT NULL REFERENCES orders(id),
  method                 TEXT NOT NULL CHECK (
    method IN ('BANK_WIRE','BTC','ETH','USDT_ERC20','USDT_TRC20','USDT_BEP20')
  ),
  status                 TEXT NOT NULL DEFAULT 'CREATED' CHECK (
    status IN (
      'CREATED','AWAITING_PAYMENT','PAYMENT_DETECTED',
      'CONFIRMING','CONFIRMED','UNDERPAID','OVERPAID',
      'EXPIRED','FAILED','MANUAL_REVIEW','REFUNDED'
    )
  ),
  amount_cents           BIGINT NOT NULL,
  currency               CHAR(3) NOT NULL DEFAULT 'USD',
  asset_id               UUID REFERENCES supported_assets(id),
  wallet_id              UUID REFERENCES wallets(id),
  crypto_amount          NUMERIC(36,18),
  crypto_amount_received NUMERIC(36,18),
  exchange_rate          NUMERIC(20,8),
  rate_expires_at        TIMESTAMPTZ,
  expires_at             TIMESTAMPTZ,
  idempotency_key        TEXT UNIQUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_order  ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_expiry ON payments(expires_at) WHERE status = 'AWAITING_PAYMENT';

-- ── Payment events ────────────────────────────────────────────────────────────
CREATE TABLE payment_events (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id),
  event      TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payment_events_payment ON payment_events(payment_id);

-- ── Blockchain transactions ───────────────────────────────────────────────────
CREATE TABLE blockchain_transactions (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id               UUID NOT NULL REFERENCES payments(id),
  network                  TEXT NOT NULL,
  transaction_hash         TEXT NOT NULL,
  from_address             TEXT,
  to_address               TEXT NOT NULL,
  amount                   NUMERIC(36,18) NOT NULL,
  asset_symbol             TEXT NOT NULL,
  contract_address         TEXT,
  confirmations            INT NOT NULL DEFAULT 0,
  required_confirmations   INT NOT NULL DEFAULT 3,
  block_number             BIGINT,
  block_time               TIMESTAMPTZ,
  status                   TEXT NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING','CONFIRMED','FAILED')),
  credited                 BOOLEAN NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (network, transaction_hash)
);
CREATE INDEX idx_blockchain_tx_hash    ON blockchain_transactions(transaction_hash);
CREATE INDEX idx_blockchain_tx_payment ON blockchain_transactions(payment_id);
CREATE INDEX idx_blockchain_tx_pending ON blockchain_transactions(status, credited)
  WHERE status = 'PENDING';

-- ── Contact messages ──────────────────────────────────────────────────────────
CREATE TABLE contact_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  company    TEXT,
  subject    TEXT NOT NULL,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'NEW'
               CHECK (status IN ('NEW','IN_PROGRESS','RESOLVED','SPAM')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_contact_status ON contact_messages(status);

-- ── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- ── Audit logs ────────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id   UUID REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  before     JSONB,
  after      JSONB,
  request_id TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_actor  ON audit_logs(actor_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_time   ON audit_logs(created_at DESC);

-- ── System settings ───────────────────────────────────────────────────────────
CREATE TABLE system_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
