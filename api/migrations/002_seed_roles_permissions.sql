-- Seed roles
INSERT INTO roles (name) VALUES
  ('customer'),
  ('staff'),
  ('admin'),
  ('super_admin')
ON CONFLICT (name) DO NOTHING;

-- Seed permissions
INSERT INTO permissions (name) VALUES
  ('products.read'),   ('products.write'),   ('products.delete'),
  ('inventory.read'),  ('inventory.write'),
  ('orders.read'),     ('orders.write'),
  ('payments.read'),   ('payments.write'),
  ('users.read'),      ('users.write'),
  ('reviews.read'),    ('reviews.moderate'),
  ('coupons.read'),    ('coupons.write'),
  ('settings.read'),   ('settings.write'),
  ('audit.read'),
  ('admin.access')
ON CONFLICT (name) DO NOTHING;

-- customer: read only commerce
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'customer'
  AND p.name IN ('products.read','reviews.read','orders.read','inventory.read')
ON CONFLICT DO NOTHING;

-- staff: products + orders + inventory + reviews
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'staff'
  AND p.name IN (
    'products.read','products.write',
    'inventory.read','inventory.write',
    'orders.read','orders.write',
    'reviews.read','reviews.moderate',
    'coupons.read'
  )
ON CONFLICT DO NOTHING;

-- admin: everything except super_admin actions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.name NOT IN ('settings.write','admin.access')
ON CONFLICT DO NOTHING;

-- super_admin: all
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Seed default shipping methods
INSERT INTO shipping_methods (name, carrier, estimated_days_min, estimated_days_max, price_cents, free_threshold_cents) VALUES
  ('Standard Shipping',  'DHL',   3,  7,  0,        1000000),  -- free over $10,000
  ('Express Shipping',   'FedEx', 1,  3,  5000,     null),
  ('Economy Shipping',   'UPS',   7, 14,  0,        1000000),
  ('Overnight Delivery', 'FedEx', 1,  1,  15000,    null);

-- Seed supported crypto assets
INSERT INTO supported_assets (symbol, name, network, contract_address, decimals, chain_id, confirmation_requirements, enabled) VALUES
  ('BTC',  'Bitcoin',             'BITCOIN',   null,                                         8,  null,   3,  true),
  ('ETH',  'Ethereum',            'ETHEREUM',  null,                                         18, '1',    12, true),
  ('USDT', 'Tether USD (ERC-20)', 'ETHEREUM',  '0xdac17f958d2ee523a2206206994597c13d831ec7', 6,  '1',    12, true),
  ('USDT', 'Tether USD (TRC-20)', 'TRON',      'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',        6,  null,   20, true)
ON CONFLICT (symbol, network) DO NOTHING;

-- Seed system settings
INSERT INTO system_settings (key, value) VALUES
  ('company_name',                '"SCminer Co., Ltd"'),
  ('company_email',               '"info@en-scminer.com"'),
  ('company_phone',               '"+1 (424) 513-3056"'),
  ('company_whatsapp',            '"+1 (743) 201 1306"'),
  ('company_address',             '"#2410 Chang Jiang Center, Longhua District, Shenzhen, China"'),
  ('base_currency',               '"USD"'),
  ('default_page_size',           '12'),
  ('max_page_size',               '100'),
  ('free_shipping_threshold_cents','1000000'),
  ('crypto_payment_expiry_minutes','30'),
  ('supported_payment_methods',   '["BANK_WIRE","BTC","ETH","USDT_ERC20","USDT_TRC20"]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
