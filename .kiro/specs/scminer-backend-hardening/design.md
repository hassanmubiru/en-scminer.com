# Design Document — SCMiner Backend Hardening

## Overview

This document describes the architecture and implementation design for six phases of production hardening on the SCMiner StreetJS 1.2.8 backend API. The system uses TypeScript ESM, `@streetjs/postgres` (raw `pg` pool), and PostgreSQL without an ORM. All 54 existing routes are preserved throughout.

The six phases address:

| Phase | Concern | Requirements |
|-------|---------|-------------|
| 1 | Atomic Checkout & Coupon Atomicity | 1, 13, 20 |
| 2 | Crypto Payment Precision & HD Wallets | 2, 3, 4, 5, 6, 7 |
| 3 | Authentication Security | 8, 9, 10 |
| 4 | Business Logic Correctness | 11, 12, 14, 15 |
| 5 | Operations (Locks, Reconciliation, Logging, Audit) | 16, 17, 18, 19 |
| 6 | Test Coverage | 21 |

---

## Architecture Constraints

- **Framework**: StreetJS 1.2.8 only — no additional HTTP frameworks
- **Database driver**: `@streetjs/postgres` / raw `pg.Pool` — no ORM, no query builder
- **Language**: TypeScript ESM (`"type": "module"`, `moduleResolution: bundler`, target ES2022)
- **BigInt**: All on-chain token amounts use JavaScript `bigint` from receipt through persistence
- **HD Wallet**: BIP32 xpub stored in `HD_WALLET_XPUB` env var; private keys never touch the database
- **Migrations**: Numbered `003_production_hardening.sql` and `004_crypto_payment_attribution.sql`
- **Route count**: 54 routes must remain intact after every phase

---

## Phase 1 — Atomic Checkout & Coupon Atomicity

### Problem

`CheckoutService.createOrder` currently issues 10+ sequential `pool.query()` calls with no wrapping transaction. A failure at step 7 (e.g. address insert) leaves an orphaned `orders` row with reserved inventory. Coupon validation and `usage_count` increment are similarly non-atomic, allowing concurrent checkouts to over-redeem a coupon.

### Design

#### Transaction Management

Use `pool.connect()` to obtain a dedicated client, wrap all writes in `BEGIN` / `COMMIT` / `ROLLBACK`:

```typescript
// src/checkout/checkout.service.ts (revised)
async createOrder(input: CheckoutInput): Promise<{ orderId: string; orderNumber: string }> {
  const pool = getPool();

  // Pre-flight validation — no transaction yet (Req 1.6)
  const cart = await this.cartSvc.getOrCreate(input.userId);
  if (cart.items.length === 0) throw new Error('Cart is empty');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock inventory rows (SELECT FOR UPDATE) before check (Req 1.3)
    for (const item of cart.items) {
      await client.query(
        `SELECT id FROM inventory WHERE product_id = $1 FOR UPDATE`,
        [item.productId],
      );
    }

    // 2. Validate stock under lock
    for (const item of cart.items) {
      const res = await client.query(
        `SELECT (quantity_on_hand - quantity_reserved) AS available
         FROM inventory WHERE product_id = $1`,
        [item.productId],
      );
      if (!res.rows[0] || Number(res.rows[0].available) < item.quantity) {
        throw new Error(`Insufficient stock for: ${item.name}`);
      }
    }

    // 3. Quote (server-side totals only — Req 1.7)
    const quote = await this._quoteWithClient(client, input, cart);

    // 4. Coupon lock + validation (Req 1.4, 13.1)
    let couponId: string | null = null;
    if (input.couponCode && quote.discountCents > 0) {
      const cRes = await client.query(
        `SELECT id, per_user_limit, usage_count, usage_limit, active, expires_at
         FROM coupons WHERE code = $1 FOR UPDATE`,
        [input.couponCode.toUpperCase()],
      );
      const coupon = cRes.rows[0];
      if (!coupon || !coupon.active) throw new Error('Coupon not valid');
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
        throw new Error('Coupon expired');
      if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit)
        throw new Error('Coupon usage limit reached');

      // Per-user limit check (Req 13.1)
      const redemptionCount = await client.query(
        `SELECT COUNT(*) AS cnt FROM coupon_redemptions
         WHERE coupon_id = $1 AND user_id = $2`,
        [coupon.id, input.userId],
      );
      if (Number(redemptionCount.rows[0].cnt) >= coupon.per_user_limit)
        throw new Error('Coupon per-user limit exceeded');

      couponId = coupon.id;
    }

    // 5. Insert order row
    const orderId = randomUUID();
    const orderNumber = generateOrderNumber();
    await client.query(
      `INSERT INTO orders (id, order_number, user_id, status, currency,
         subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
         coupon_id, shipping_method_id, customer_note)
       VALUES ($1,$2,$3,'PENDING_PAYMENT','USD',$4,$5,$6,$7,$8,$9,$10,$11)`,
      [orderId, orderNumber, input.userId, quote.subtotalCents, quote.discountCents,
       quote.shippingCents, quote.taxCents, quote.totalCents, couponId,
       input.shippingMethodId, input.customerNote ?? null],
    );

    // 6. Insert order items, addresses, reserve inventory, redeem coupon
    // ... (all via client, same transaction)

    // 7. Increment coupon usage + insert redemption record (Req 1.5)
    if (couponId) {
      await client.query(
        `UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1`, [couponId],
      );
      await client.query(
        `INSERT INTO coupon_redemptions (id, coupon_id, user_id, order_id)
         VALUES ($1,$2,$3,$4)`,
        [randomUUID(), couponId, input.userId, orderId],
      );
    }

    // 8. Clear cart
    await this.cartSvc.clearCartWithClient(client, cart.id);

    await client.query('COMMIT');
    return { orderId, orderNumber };
  } catch (err) {
    await client.query('ROLLBACK'); // Req 1.2
    throw err;
  } finally {
    client.release();
  }
}
```

#### Key invariants enforced

- `SELECT ... FOR UPDATE` on `inventory` rows before stock check prevents TOCTOU race
- `SELECT ... FOR UPDATE` on `coupons` row before redemption count prevents over-redemption
- Per-user limit check runs inside the same locked transaction
- `ROLLBACK` in `catch` ensures no partial state survives any error

### Migration 003 (partial — coupon_redemptions index)

```sql
-- migrations/003_production_hardening.sql (excerpt)
-- Partial unique index enforcing per-user coupon limit at DB level (Req 13.2)
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_redemptions_per_user
  ON coupon_redemptions (coupon_id, user_id)
  WHERE per_user_limit_enforced = true;
```

> Note: The full Migration 003 content is detailed under Phase 2 because it also covers crypto schema changes.

---

## Phase 2 — Crypto Payment Precision & HD Wallets

### Problem

1. `CryptoService` uses `Number()` for all crypto amounts, causing floating-point loss at large wei values.
2. All payment intents for the same asset share one static wallet address, making transaction attribution ambiguous.
3. `CANCELLED` is not in the `payments.status` CHECK constraint.
4. BSC/BEP20 has a live code path in `assetToMethod` and a wallet entry but no blockchain monitor handler.
5. ETH native transfer detection is absent (`checkEthereum` only handles ERC-20 logs).
6. `INSERT` into `blockchain_transactions` is not idempotent — concurrent calls can duplicate rows.

### Design

#### 2.1 PaymentAddressService — HD Wallet Derivation

A new service derives per-intent child addresses from the BIP32 xpub stored in `HD_WALLET_XPUB`.

```typescript
// src/crypto/payment-address.service.ts
import { BIP32Factory } from 'bip32';        // bip32 npm package
import * as ecc from 'tiny-secp256k1';       // tiny-secp256k1 for ECC ops
import { payments } from 'bitcoinjs-lib';    // bitcoin P2WPKH address derivation
import { getPool } from '../config/database.js';

const bip32 = BIP32Factory(ecc);

export class PaymentAddressService {
  /** Returns the derived address and the payment_index used */
  async deriveNextAddress(network: 'BITCOIN' | 'ETHEREUM' | 'TRON'): Promise<{
    address: string;
    paymentIndex: bigint;
  }> {
    const xpub = process.env['HD_WALLET_XPUB'];
    if (!xpub) throw new Error('CRYPTO_NOT_CONFIGURED');

    const pool = getPool();
    // Atomically claim next index (Req 2.1, 2.3)
    const res = await pool.query<{ next_val: string }>(
      `UPDATE crypto_address_counter SET counter = counter + 1
       RETURNING counter AS next_val`,
    );
    const paymentIndex = BigInt(res.rows[0].next_val);

    const node = bip32.fromBase58(xpub);
    const child = node.derive(0).derive(Number(paymentIndex));

    let address: string;
    if (network === 'BITCOIN') {
      const { address: btcAddr } = payments.p2wpkh({ pubkey: Buffer.from(child.publicKey) });
      address = btcAddr!;
    } else if (network === 'ETHEREUM') {
      address = ethereumAddressFromPublicKey(child.publicKey);
    } else {
      address = tronAddressFromPublicKey(child.publicKey);
    }

    return { address, paymentIndex };
  }
}
```

The `crypto_address_counter` table is introduced in Migration 004 with a single row and uses `UPDATE ... RETURNING` as an atomic increment — no race condition.

The `payments` table gains a `payment_index BIGINT NOT NULL DEFAULT 0 UNIQUE` column (Migration 003).

`CryptoService.createPaymentIntent` is refactored to call `PaymentAddressService.deriveNextAddress` instead of querying the `wallets` table.

#### 2.2 BigInt Amount Handling (Req 3)

All blockchain amounts are parsed as `bigint` at the boundary:

```typescript
// Parsing BTC amount from RPC (satoshis)
const amountSatoshis: bigint = BigInt(Math.round(Number(btcAmount) * 1e8));

// Parsing ERC-20 transfer amount from log data
const amountWei: bigint = BigInt(log.data);  // already hex string

// Comparison with tolerance in smallest units (Req 3.4)
const tolerance: bigint = expectedBigint / 1000n; // 0.1% in smallest units
if (receivedBigint < expectedBigint - tolerance) {
  newStatus = 'UNDERPAID';
} else if (receivedBigint > expectedBigint + tolerance) {
  newStatus = 'OVERPAID';
} else {
  newStatus = 'CONFIRMED';
}
```

The `processDetectedTransaction` signature is updated:

```typescript
async processDetectedTransaction(
  paymentId: string,
  txHash: string, network: string, fromAddress: string, toAddress: string,
  amountSmallestUnit: bigint,  // was: string
  assetSymbol: string, confirmations: number,
): Promise<void>
```

Storage: `amountSmallestUnit.toString()` is stored as `NUMERIC(36,0)` (Migration 003 alters the column type with `USING` cast).

#### 2.3 Payment State Machine (Req 4)

Migration 003 adds `'CANCELLED'` to the `payments.status` CHECK constraint. The `CryptoService` gains a `cancelPaymentIntent(paymentId, userId)` method that sets `status = 'CANCELLED'`.

`expirePayments` is tightened:

```typescript
// Only touches AWAITING_PAYMENT rows (Req 4.3)
`UPDATE payments SET status = 'EXPIRED', updated_at = NOW()
 WHERE status = 'AWAITING_PAYMENT' AND expires_at < NOW()`
```

`processDetectedTransaction` now checks status at the start of processing:

```typescript
if (['CANCELLED','EXPIRED'].includes(String(payment['status']))) {
  await this.recordEvent(paymentId, 'TRANSACTION_ON_CANCELLED_OR_EXPIRED', { txHash });
  return; // Req 4.4 — do not credit
}
```

#### 2.4 ETH Native Transfer Detection (Req 5)

`checkEthereum` gains a second scan path for native ETH (when `contractAddress` is `null`):

```typescript
async function checkEthereumNative(paymentId: string, address: string): Promise<void> {
  const ethRpc = process.env['ETH_RPC_URL'];
  if (!ethRpc) {
    logger.warn({ jobName: 'blockchain-monitor', message: 'ETH_RPC_URL not configured — skipping ETH' });
    return; // Req 5.3
  }
  // Use eth_getTransactionCount approach — iterate recent blocks or use
  // eth_getLogs with topic filtering for the address directly.
  // For native ETH: scan last N blocks for transactions to `address`:
  const resp = await fetch(ethRpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'eth_getBalance',
      params: [address, 'latest'], id: 1,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  // ... parse and call processDetectedTransaction with bigint wei amount
}
```

#### 2.5 BSC/BEP20 Removal (Req 6)

- `assetToMethod` has the `BSC` branch removed
- `checkPayment` no longer contains a `BSC` branch
- Migration 003 sets `enabled = false` on `supported_assets WHERE network = 'BSC'`
- `system_settings` updated to remove `'USDT_BEP20'` from `supported_payment_methods`

#### 2.6 Duplicate Transaction Protection (Req 7)

`blockchain_transactions` already has `UNIQUE (network, transaction_hash)`. `processDetectedTransaction` is made idempotent:

```typescript
// Step 1: Idempotent insert (Req 7.4)
const insertRes = await pool.query(
  `INSERT INTO blockchain_transactions
     (id, payment_id, network, transaction_hash, from_address, to_address,
      amount, asset_symbol, confirmations, required_confirmations, status)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING')
   ON CONFLICT (network, transaction_hash) DO NOTHING
   RETURNING id`,
  [txId, paymentId, network, txHash, fromAddress, toAddress,
   amountSmallestUnit.toString(), assetSymbol, confirmations, requiredConfirmations],
);

if (insertRes.rows.length === 0) {
  // Row existed — check if already credited (Req 7.2)
  const existing = await pool.query(
    `SELECT id, credited FROM blockchain_transactions
     WHERE network = $1 AND transaction_hash = $2`,
    [network, txHash],
  );
  if (!existing.rows[0] || existing.rows[0].credited) return;
  // Update confirmations only (Req 7.3)
  await pool.query(
    `UPDATE blockchain_transactions SET confirmations = $1, updated_at = NOW()
     WHERE id = $2`, [confirmations, existing.rows[0].id],
  );
  return;
}
```

### Migration 003 — `003_production_hardening.sql`

Full contents:

```sql
-- 003_production_hardening.sql
-- Idempotent production hardening schema changes

-- Req 2.3: payment_index column for HD wallet derivation
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_index BIGINT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_payment_index
  ON payments (payment_index);

-- Req 3.5: Convert crypto amounts to integer-only NUMERIC
ALTER TABLE payments
  ALTER COLUMN crypto_amount TYPE NUMERIC(36,0)
    USING ROUND(crypto_amount)::NUMERIC(36,0),
  ALTER COLUMN crypto_amount_received TYPE NUMERIC(36,0)
    USING ROUND(COALESCE(crypto_amount_received, 0))::NUMERIC(36,0);

-- Req 4.1: Add CANCELLED to payments.status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_status_check2'
  ) THEN
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
    ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (
      status IN (
        'CREATED','AWAITING_PAYMENT','PAYMENT_DETECTED',
        'CONFIRMING','CONFIRMED','UNDERPAID','OVERPAID',
        'EXPIRED','FAILED','MANUAL_REVIEW','REFUNDED','CANCELLED'
      )
    );
  END IF;
END $$;

-- Req 6.1: Disable BSC asset
UPDATE supported_assets SET enabled = false WHERE network = 'BSC';

UPDATE system_settings
SET value = (
  SELECT jsonb_agg(elem)
  FROM jsonb_array_elements(value) AS elem
  WHERE elem::text != '"USDT_BEP20"'
)
WHERE key = 'supported_payment_methods';

-- Req 13.2: Partial unique index for coupon per-user limit
-- Add a column to track enforcement (used by partial index)
ALTER TABLE coupon_redemptions
  ADD COLUMN IF NOT EXISTS per_user_limit_enforced BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_redemptions_per_user
  ON coupon_redemptions (coupon_id, user_id)
  WHERE per_user_limit_enforced = true;
```

### Migration 004 — `004_crypto_payment_attribution.sql`

```sql
-- 004_crypto_payment_attribution.sql
-- HD wallet address counter and receiving_address denormalisation

CREATE TABLE IF NOT EXISTS crypto_address_counter (
  id      INT PRIMARY KEY DEFAULT 1,
  counter BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO crypto_address_counter (id, counter)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Store derived receiving address directly on payments row
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS receiving_address TEXT;
```

---

## Phase 3 — Authentication Security

### Problem

1. `verifyPassword` compares PBKDF2 hex strings with `===`, enabling timing side-channels.
2. `AuthService.refresh` reads and revokes the token in separate queries — concurrent refresh requests can both read it as valid.
3. `verifyAccessToken` never checks `users.status`, allowing suspended users to authenticate indefinitely.

### Design

#### 3.1 timingSafeEqual Password Comparison (Req 8)

```typescript
// src/auth/auth.service.ts (revised verifyPassword)
import { timingSafeEqual, pbkdf2 } from 'node:crypto';

private verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, storedHex] = stored.split(':');
  const storedKey = Buffer.from(storedHex!, 'hex');
  return new Promise((resolve) => {  // never reject — Req 8.3
    pbkdf2(password, salt!, 310_000, 32, 'sha256', (err, derivedKey) => {
      if (err) {
        resolve(false); // PBKDF2 failure → treat as mismatch, no exception propagated
        return;
      }
      // Both buffers are the same length (32 bytes) because key length is fixed
      resolve(timingSafeEqual(derivedKey, storedKey)); // Req 8.1
    });
  });
}
```

`timingSafeEqual` requires both buffers to have the same byte length. Since PBKDF2 key length is fixed at 32 bytes, no padding is required.

#### 3.2 Atomic Refresh Token Rotation (Req 9)

```typescript
// src/auth/auth.service.ts (revised refresh)
async refresh(refreshToken: string): Promise<{ user: AuthUser; tokens: TokenPair }> {
  const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
  const client = await this.pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the row before reading (Req 9.1)
    const result = await client.query(
      `SELECT id, user_id, expires_at, revoked_at
       FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash],
    );
    if (result.rows.length === 0) throw new UnauthorizedException('Invalid refresh token');

    const row = result.rows[0] as Record<string, unknown>;

    // Token-theft detection (Req 9.3)
    if (row['revoked_at']) {
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW()
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [row['user_id']],
      );
      await client.query('COMMIT');
      throw new UnauthorizedException('Refresh token revoked');
    }
    if (new Date(String(row['expires_at'])) < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const userId = String(row['user_id']);

    // Atomically revoke old token and issue new ones (Req 9.2)
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash],
    );
    const user = await this.getAuthUser(userId);
    const tokens = await this.issueTokensWithClient(client, userId, user);

    await client.query('COMMIT');
    return { user, tokens };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

#### 3.3 Active User Check (Req 10)

```typescript
// src/auth/auth.service.ts (revised verifyAccessToken)
async verifyAccessToken(token: string): Promise<AuthUser | null> {
  try {
    const payload = this.jwt.verify(token) as Record<string, unknown> | null;
    if (!payload) return null;
    const userId = String(payload['sub'] ?? '');
    if (!userId) return null;

    // Req 10.1 — check user status on every token verification
    const statusRes = await this.pool.query(
      `SELECT status FROM users WHERE id = $1`, [userId],
    );
    if (!statusRes.rows[0] || statusRes.rows[0].status !== 'active') return null;

    return this.getAuthUser(userId);
  } catch {
    return null;
  }
}
```

The existing `login` method already checks `status !== 'active'` before issuing tokens (Req 10.2). The `verifyAccessToken` change ensures Req 10.3 (no restart required) because the DB is queried on every request.

---

## Phase 4 — Business Logic Correctness

### Problem

1. `requireRole` checks hardcoded role name strings; granting/revoking permissions requires code changes.
2. `InventoryService.adjust` silently clamps to zero via `GREATEST(0, ...)`.
3. Reviews are always created with `is_verified_purchase = false`; no purchase check is performed.
4. `GET /api/v1/inventory/:productId` returns all internal fields to unauthenticated callers.

### Design

#### 4.1 Permission-Based Authorization (Req 11)

New `requirePermission` middleware in `src/middleware/auth.middleware.ts`:

```typescript
export function requirePermission(permissionName: string): MiddlewareFn {
  return async (ctx, next) => {
    const user = (ctx as unknown as Record<string, unknown>)['user'] as
      { id: string; roles: string[] } | undefined;

    if (!user) {
      ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
      return;
    }

    const pool = getPool();
    const res = await pool.query(
      `SELECT 1 FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1 AND p.name = $2
       LIMIT 1`,
      [user.id, permissionName],
    );

    if (res.rows.length === 0) {
      // Req 11.7 — log unrecognised permission names
      if (res.rows.length === 0) {
        const knownRes = await pool.query(
          `SELECT 1 FROM permissions WHERE name = $1`, [permissionName],
        );
        if (knownRes.rows.length === 0) {
          logger.warn({ message: 'Unknown permission checked', permissionName });
        }
      }
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403);
      return;
    }

    await next();
  };
}
```

Applied to routes:
- `InventoryController` adjust endpoint → `requirePermission('inventory.write')`
- `AdminController` manual-confirm endpoint → `requirePermission('payments.write')` (alongside existing role check)
- `CouponController` admin endpoints → `requirePermission('coupons.write')`
- `ReviewController` moderation endpoint → `requirePermission('reviews.moderate')`

#### 4.2 Inventory Adjustment Safety (Req 12)

```typescript
// src/inventory/inventory.service.ts (revised adjust)
async adjust(productId: string, delta: number, note: string, actorId?: string): Promise<void> {
  const pool = getPool();

  // Pre-flight check — no SQL until we know it's valid (Req 12.1)
  const current = await pool.query(
    `SELECT quantity_on_hand FROM inventory WHERE product_id = $1`, [productId],
  );
  if (!current.rows[0]) throw new Error(`Inventory record not found for product ${productId}`);
  if (Number(current.rows[0].quantity_on_hand) + delta < 0) {
    throw new Error('Adjustment would result in negative on-hand quantity'); // Req 12.1
  }

  // SQL-level guard as belt-and-suspenders (Req 12.2)
  const result = await pool.query(
    `UPDATE inventory
     SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
     WHERE product_id = $2 AND quantity_on_hand + $1 >= 0
     RETURNING id`,
    [delta, productId],
  );

  if (result.rowCount === 0) {
    throw new Error('Adjustment rejected: quantity_on_hand + delta < 0'); // Req 12.2
  }

  await this.recordMovement(productId, 'ADJUSTMENT', delta, undefined, note, actorId);
}
```

`deductSale` is revised to clamp `quantity_reserved` (Req 12.4):

```typescript
async deductSale(productId: string, quantity: number, orderId: string, actorId?: string): Promise<void> {
  await pool.query(
    `UPDATE inventory
     SET quantity_on_hand  = quantity_on_hand - $1,
         quantity_reserved = LEAST(quantity_reserved, quantity_on_hand - $1),
         updated_at        = NOW()
     WHERE product_id = $2`,
    [quantity, productId],
  );
}
```

#### 4.3 Review Purchase Verification (Req 14)

```typescript
// src/reviews/review.controller.ts (POST /api/v1/products/:productId/reviews)
const verifiedRes = await pool.query(
  `SELECT 1 FROM order_items oi
   JOIN orders o ON o.id = oi.order_id
   WHERE o.user_id = $1
     AND oi.product_id = $2
     AND o.status IN ('DELIVERED','SHIPPED','PAID','PROCESSING','PACKED')
   LIMIT 1`,
  [user.id, productId],
);
const isVerifiedPurchase = verifiedRes.rows.length > 0; // Req 14.1, 14.2, 14.3

await pool.query(
  `INSERT INTO reviews (id, product_id, user_id, rating, title, body, is_verified_purchase)
   VALUES ($1,$2,$3,$4,$5,$6,$7)`,
  [randomUUID(), productId, user.id, rating, title, body, isVerifiedPurchase],
);
```

Admin moderation `PATCH` endpoint never touches `is_verified_purchase` (Req 14.4):

```typescript
await pool.query(
  `UPDATE reviews SET status = $1, updated_at = NOW() WHERE id = $2`,
  [newStatus, reviewId],
  // Note: is_verified_purchase is NOT in the SET clause
);
```

#### 4.4 Public Inventory Response Sanitisation (Req 15)

```typescript
// src/inventory/inventory.controller.ts (GET /api/v1/inventory/:productId)
@Get('/:productId')
async getLevel(ctx: StreetContext): Promise<void> {
  const user = getUser(ctx);
  const level = await this.inventorySvc.getLevel(ctx.params['productId'] ?? '');
  if (!level) { ctx.json({ error: { code: 'NOT_FOUND' } }, 404); return; }

  // Unauthenticated: public view only (Req 15.1)
  if (!user) {
    ctx.json({ inStock: level.inStock, available: level.available });
    return;
  }

  // Authenticated with inventory.read: full view (Req 15.2)
  const hasPermission = await checkPermission(user.id, 'inventory.read');
  if (hasPermission) {
    ctx.json(level); // includes onHand, reserved, available, inStock, lowStockThreshold
    return;
  }

  // Authenticated but no permission: public view
  ctx.json({ inStock: level.inStock, available: level.available });
}
```

Route path and method are unchanged (Req 15.3).

---

## Phase 5 — Operations

### Problem

1. Background jobs run on every API instance without coordination, causing duplicate payment processing.
2. No reconciliation endpoint exists to detect confirmed transactions not reflected in orders.
3. All logging is unstructured `console.log/error/warn`.
4. Many security-sensitive actions write no audit log entry.

### Design

#### 5.1 Advisory Locks for Background Jobs (Req 16)

Advisory lock keys (hardcoded `bigint`-safe integers):

```typescript
const LOCK_KEY_BLOCKCHAIN_MONITOR = 2_000_000_001n;
const LOCK_KEY_PAYMENT_EXPIRY     = 2_000_000_002n;
```

Pattern used by both jobs:

```typescript
export async function runBlockchainMonitorJob(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    // pg_try_advisory_lock returns true if lock acquired, false if contested (Req 16.1)
    const lockRes = await client.query(
      `SELECT pg_try_advisory_lock($1) AS acquired`,
      [LOCK_KEY_BLOCKCHAIN_MONITOR.toString()],
    );
    if (!lockRes.rows[0].acquired) {
      client.release();
      return; // Another instance holds the lock — skip this cycle
    }

    // ... perform job work ...

    // Req 16.3 — release lock before cycle ends
    await client.query(`SELECT pg_advisory_unlock($1)`, [LOCK_KEY_BLOCKCHAIN_MONITOR.toString()]);
  } catch (err) {
    // Req 16.4 — log and skip, do not crash
    logger.error({ jobName: 'blockchain-monitor', errorMessage: String(err), stack: (err as Error).stack });
    try { await client.query(`SELECT pg_advisory_unlock($1)`, [LOCK_KEY_BLOCKCHAIN_MONITOR.toString()]); } catch {}
  } finally {
    client.release();
  }
}
```

> Note: `pg_try_advisory_lock` (session-level, non-blocking) is used. The lock is held for the duration of one cycle and released explicitly before the function returns. It is automatically released if the client is closed without explicit unlock.

#### 5.2 Payment Reconciliation (Req 17)

New route: `GET /api/v1/admin/reconciliation` in `AdminController`:

```typescript
@Get('/reconciliation')
@ApiOperation({ summary: 'Detect confirmed-but-unmatched payment records', tags: ['admin'] })
async reconciliation(ctx: StreetContext): Promise<void> {
  const user = getUser(ctx);
  if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED' } }, 401); return; }
  // Req 17.1 — payments.read permission required
  const allowed = await checkPermission(user.id, 'payments.read');
  if (!allowed) { ctx.json({ error: { code: 'FORBIDDEN' } }, 403); return; }

  const pool = getPool();

  // Type 1: credited tx whose payment is not CONFIRMED (Req 17.1)
  const type1 = await pool.query(
    `SELECT bt.id AS tx_id, bt.transaction_hash, bt.network,
            p.id AS payment_id, p.status AS payment_status,
            p.order_id
     FROM blockchain_transactions bt
     JOIN payments p ON p.id = bt.payment_id
     WHERE bt.status = 'CONFIRMED' AND bt.credited = true
       AND p.status != 'CONFIRMED'`,
  );

  // Type 2: orders PAID with no CONFIRMED payment (Req 17.3)
  const type2 = await pool.query(
    `SELECT o.id AS order_id, o.order_number, o.status AS order_status
     FROM orders o
     WHERE o.status = 'PAID'
       AND NOT EXISTS (
         SELECT 1 FROM payments p
         WHERE p.order_id = o.id AND p.status = 'CONFIRMED'
       )`,
  );

  // Req 17.2 — return discrepancies, never auto-correct
  ctx.json({
    discrepancies: type1.rows,
    orphanPaidOrders: type2.rows,
    generatedAt: new Date().toISOString(),
  });
}
```

#### 5.3 Structured Logging (Req 18)

New thin wrapper: `src/common/logger.ts`

```typescript
// src/common/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function currentLevel(): number {
  const env = (process.env['LOG_LEVEL'] ?? 'info').toLowerCase() as LogLevel;
  return LEVELS[env] ?? LEVELS.info;
}

function emit(level: LogLevel, fields: Record<string, unknown>): void {
  if (LEVELS[level] < currentLevel()) return; // Req 18.4 — level filtering
  console.log(JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    ...fields,
  }));
}

export const logger = {
  debug: (fields: Record<string, unknown>) => emit('debug', fields),
  info:  (fields: Record<string, unknown>) => emit('info',  fields),
  warn:  (fields: Record<string, unknown>) => emit('warn',  fields),
  error: (fields: Record<string, unknown>) => emit('error', fields),
};
```

All `console.log`, `console.error`, and `console.warn` calls are replaced with `logger.*` calls. The `requestId` field is threaded from `ctx['requestId']` into any log call made within a request handler.

Payment state transitions emit structured logs (Req 18.3):

```typescript
logger.info({
  message: 'payment_transition',
  paymentId,
  orderId: String(payment['order_id']),
  event,
  previousStatus: String(payment['status']),
  newStatus,
});
```

Job errors emit structured logs (Req 18.2):

```typescript
logger.error({
  jobName: 'blockchain-monitor',
  message: 'Job cycle failed',
  errorMessage: err instanceof Error ? err.message : String(err),
  stack: err instanceof Error ? err.stack : undefined,
});
```

#### 5.4 Audit Log Coverage (Req 19)

`AuditService.log` already exists with the correct schema. Coverage gaps are filled:

| Action | Location | Fields written |
|--------|----------|----------------|
| `USER_LOGIN` | `AuthService.login` | actorId, entity=users, entityId=userId, ipAddress, requestId |
| `USER_LOGOUT` | `AuthService.logout` | same |
| `PAYMENT_CONFIRMED` / `CANCELLED` / `UNDERPAID` / `OVERPAID` | `CryptoService.processDetectedTransaction` | entity=payments, entityId=paymentId, before/after status |
| `ORDER_STATUS_CHANGED` | `OrderController PATCH` | actorId, entity=orders, entityId=orderId, before/after status |
| `INVENTORY_ADJUSTED` | `InventoryService.adjust` | actorId, entity=inventory, entityId=productId, before/after onHand, delta, note |

`requestId` is passed from the StreetJS context wherever available. Background jobs pass a synthetic `requestId` such as `job:blockchain-monitor:<cycle-timestamp>`.

`AuditService.log` signature gains an optional `requestId`:

```typescript
// Already present — no signature change needed. Confirm requestId is always passed.
await auditSvc.log({
  actorId: user.id,
  action: 'USER_LOGIN',
  entity: 'users',
  entityId: user.id,
  ipAddress: ctx.headers['x-forwarded-for'] ?? ctx.ip,
  requestId: (ctx as Record<string, unknown>)['requestId'] as string | undefined,
});
```

---

## Phase 6 — Test Coverage

### Test File Locations

All test files live under `src/__tests__/`:

```
src/__tests__/
  unit/
    auth.verifyPassword.test.ts
    inventory.adjust.test.ts
    crypto.processDetectedTransaction.test.ts
  integration/
    checkout.concurrency.test.ts
    blockchainMonitor.advisoryLock.test.ts
    inventory.response.test.ts
  e2e/
    crypto.payment.flow.test.ts
```

### Test Descriptions

**`auth.verifyPassword.test.ts`** (Req 21.1)
- Spy on `crypto.timingSafeEqual`; assert it is called during `verifyPassword`
- Assert correct password returns `true`, incorrect returns `false` without throwing
- Assert PBKDF2 failure returns `false` (no unhandled rejection)

**`checkout.concurrency.test.ts`** (Req 21.2)
- Seed a product with `quantity_on_hand = 1`, `quantity_reserved = 0`
- Fire two simultaneous `createOrder` calls (Promise.all)
- Assert exactly one resolves with an orderId, one rejects with `'Insufficient stock'`
- Assert `inventory.quantity_reserved = 1` after the successful call

**`crypto.processDetectedTransaction.test.ts`** (Req 21.3)
- Call `processDetectedTransaction` twice with identical `(network, txHash)`
- Assert `blockchain_transactions` contains exactly one row
- Assert `orders.status` is not updated on the second call

**`inventory.adjust.test.ts`** (Req 21.4)
- Call `adjust(productId, -999, 'test')` where `quantity_on_hand = 5`
- Assert `Error` is thrown with message matching `'Adjustment would result in negative'`
- Assert `quantity_on_hand` in DB is still 5

**`blockchainMonitor.advisoryLock.test.ts`** (Req 21.5)
- Hold advisory lock `2000000001` on a separate PG connection
- Call `runBlockchainMonitorJob()` and await
- Assert no exception thrown; assert no payments were modified

**`crypto.payment.flow.test.ts`** — E2E (Req 21.6)
- Create user → create order → call `createPaymentIntent`
- Call `processDetectedTransaction` with confirmed amount and confirmations ≥ threshold
- Assert `payments.status = 'CONFIRMED'`
- Assert `orders.status = 'PAID'`

**`inventory.response.test.ts`** (Req 21.7)
- `GET /api/v1/inventory/:productId` without auth header
- Assert response body does NOT contain keys `quantity_on_hand`, `quantity_reserved`, or `low_stock_threshold`
- Assert response body contains `inStock` and `available`

---

## Data Models — Changes Only

### `payments` table additions (Migration 003 + 004)

| Column | Type | Notes |
|--------|------|-------|
| `payment_index` | `BIGINT NOT NULL DEFAULT 0 UNIQUE` | HD wallet derivation index |
| `receiving_address` | `TEXT` | Derived address (denormalised) |
| `crypto_amount` | `NUMERIC(36,0)` | Changed from `NUMERIC(36,18)` |
| `crypto_amount_received` | `NUMERIC(36,0)` | Changed from `NUMERIC(36,18)` |

### `crypto_address_counter` table (Migration 004)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `INT PRIMARY KEY DEFAULT 1` | Single-row table |
| `counter` | `BIGINT NOT NULL DEFAULT 0` | Atomically incremented |

### `coupon_redemptions` table addition (Migration 003)

| Column | Type | Notes |
|--------|------|-------|
| `per_user_limit_enforced` | `BOOLEAN NOT NULL DEFAULT true` | Partial index predicate |

---

## Error Codes Reference

| Code | HTTP | Description |
|------|------|-------------|
| `CRYPTO_NOT_CONFIGURED` | 503 | `HD_WALLET_XPUB` env var not set |
| `ASSET_NOT_SUPPORTED` | 400 | BSC / disabled asset requested |
| `PAYMENT_METHOD_DISABLED` | 400 | `USDT_BEP20` payment method requested |
| `INVALID_STATUS` | 400 | Order status value not in CHECK constraint |
| `COUPON_PER_USER_LIMIT` | 400 | Coupon per-user limit exceeded |
| `ADJUSTMENT_NEGATIVE` | 400 | Inventory adjustment would go negative |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Token valid but permission denied |

---

## Component Interaction Diagram

```
CheckoutController
  └── CheckoutService (BEGIN/COMMIT/ROLLBACK via pool.connect())
        ├── CartService.getOrCreate
        ├── [SELECT FOR UPDATE inventory rows]
        ├── [SELECT FOR UPDATE coupons row]
        ├── InventoryService.reserve (within client)
        └── CartService.clearCartWithClient (within client)

CryptoController
  └── CryptoService
        └── PaymentAddressService.deriveNextAddress
              └── crypto_address_counter (UPDATE ... RETURNING)
              └── bip32 / bitcoinjs-lib (address derivation)

BlockchainMonitorJob
  ├── pg_try_advisory_lock(2000000001)
  ├── checkBitcoin / checkEthereumNative / checkEthereumERC20 / checkTron
  │     └── CryptoService.processDetectedTransaction(bigint amount)
  └── pg_advisory_unlock(2000000001)

PaymentExpiryJob
  ├── pg_try_advisory_lock(2000000002)
  ├── CryptoService.expirePayments
  └── pg_advisory_unlock(2000000002)

AuthService
  ├── verifyPassword → timingSafeEqual(Buffer, Buffer)
  ├── refresh → pool.connect() → BEGIN/FOR UPDATE/COMMIT
  └── verifyAccessToken → SELECT users.status

logger (src/common/logger.ts)
  └── JSON.stringify → console.log (with level filtering)

AuditService
  └── pool.query INSERT INTO audit_logs
```

---

## Implementation Sequence

Each phase must leave `npm run build` passing before the next phase begins (Req 20.1).

1. **Phase 1**: Refactor `CheckoutService.createOrder` + apply Migration 003 (coupon_redemptions partial index only)
2. **Phase 2**: Add `PaymentAddressService`, refactor `CryptoService`, apply full Migration 003, apply Migration 004
3. **Phase 3**: Update `AuthService` (timingSafeEqual, atomic refresh, status check)
4. **Phase 4**: Add `requirePermission`, fix `InventoryService.adjust` + `deductSale`, fix `ReviewController`, fix `InventoryController`
5. **Phase 5**: Add advisory locks to jobs, add reconciliation endpoint, add `logger.ts`, add audit calls
6. **Phase 6**: Write all tests

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Checkout Atomicity

*For any* valid checkout input that fails at any step after the transaction opens, the database SHALL contain no new `orders`, `order_items`, `order_addresses`, or `inventory_movements` rows, and all inventory reservation counts SHALL be unchanged from before the request.

**Validates: Requirements 1.1, 1.2**

---

### Property 2: Inventory Lock Prevents Oversell

*For any* product with available quantity N and any set of concurrent checkout requests each requesting quantity N, at most one checkout SHALL succeed and the inventory available count after all requests settle SHALL never be negative.

**Validates: Requirements 1.3, 1.6**

---

### Property 3: Server-Side Totals Are Authoritative

*For any* checkout input containing arbitrary client-supplied price or total values, the committed order's `subtotal_cents`, `discount_cents`, and `total_cents` SHALL equal the values computed from current database prices and SHALL NOT reflect any client-supplied amount.

**Validates: Requirements 1.7**

---

### Property 4: Coupon Concurrent Redemption Safety

*For any* coupon with `per_user_limit = 1` and any set of concurrent checkout requests by the same user using that coupon, exactly one request SHALL succeed and at most one `coupon_redemptions` row SHALL be inserted for that `(coupon_id, user_id)` pair.

**Validates: Requirements 1.4, 1.5, 13.1**

---

### Property 5: Unique HD Wallet Address Per Intent

*For any* set of payment intents created concurrently or sequentially, no two payment intents SHALL share the same `payment_index` or the same derived `receiving_address`.

**Validates: Requirements 2.1, 2.3**

---

### Property 6: BigInt Amount Precision Round-Trip

*For any* on-chain token amount expressed as a non-negative integer in smallest units (satoshis, wei, micro-USDT), converting to `bigint`, storing as `NUMERIC(36,0)`, and reading back SHALL produce a value equal to the original integer with no rounding or precision loss.

**Validates: Requirements 3.1, 3.2, 3.5**

---

### Property 7: Correct Amount Comparison With Tolerance

*For any* pair of `bigint` amounts `expected` and `received`, the payment outcome SHALL be `CONFIRMED` if and only if `|received - expected| <= expected / 1000`, `UNDERPAID` if `received < expected - expected / 1000`, and `OVERPAID` if `received > expected + expected / 1000`.

**Validates: Requirements 3.4**

---

### Property 8: Expiry Job Does Not Modify Terminal Payments

*For any* payment whose status is `CONFIRMED`, `CANCELLED`, `UNDERPAID`, `OVERPAID`, or `REFUNDED`, running the `PaymentExpiryJob` SHALL NOT change that payment's status.

**Validates: Requirements 4.3**

---

### Property 9: Cancelled Payment Not Credited

*For any* payment in `CANCELLED` or `EXPIRED` status, calling `processDetectedTransaction` with any transaction data SHALL NOT update `orders.status` and SHALL NOT set `blockchain_transactions.credited = true`.

**Validates: Requirements 4.4**

---

### Property 10: Duplicate Transaction Idempotence

*For any* `(network, transaction_hash)` pair that has already been inserted into `blockchain_transactions` with `credited = true`, calling `CryptoService.processDetectedTransaction` with the same pair SHALL result in exactly one row in `blockchain_transactions` and no change to any other row.

**Validates: Requirements 7.2, 7.4**

---

### Property 11: Suspended User Tokens Are Always Rejected

*For any* valid, non-expired JWT whose `sub` maps to a user with `status != 'active'`, `AuthService.verifyAccessToken` SHALL return `null`.

**Validates: Requirements 10.1, 10.3**

---

### Property 12: Permission Middleware Mirrors DB State

*For any* user and any permission name, `requirePermission` SHALL grant access if and only if a row exists for that `(user_id, permission_name)` combination in the joined `user_roles` / `role_permissions` / `permissions` query result. Access SHALL be denied for any permission name not present in the `permissions` table.

**Validates: Requirements 11.1, 11.2, 11.7**

---

### Property 13: Inventory Adjustment Rejects Negative Results

*For any* inventory record with `quantity_on_hand = Q` and any `delta` such that `Q + delta < 0`, `InventoryService.adjust` SHALL throw an error and the row's `quantity_on_hand` SHALL remain `Q` after the call.

**Validates: Requirements 12.1, 12.2**

---

### Property 14: Reserved Quantity Never Exceeds On-Hand Quantity

*For any* sequence of inventory operations (reserve, release, deductSale, adjust) applied to any product, the invariant `quantity_reserved <= quantity_on_hand` SHALL hold after every operation.

**Validates: Requirements 12.4**

---

### Property 15: Verified Purchase Flag Matches Order History

*For any* user and product combination, the `is_verified_purchase` flag on a newly submitted review SHALL be `true` if and only if a `DELIVERED`, `SHIPPED`, `PAID`, `PROCESSING`, or `PACKED` order for that user containing that product exists at the time of submission.

**Validates: Requirements 14.1, 14.2, 14.3**

---

### Property 16: Public Inventory Endpoint Excludes Internal Fields

*For any* product and any unauthenticated HTTP request to `GET /api/v1/inventory/:productId`, the JSON response SHALL NOT contain any of the keys `quantity_on_hand`, `quantity_reserved`, or `low_stock_threshold`.

**Validates: Requirements 15.1**

---

### Property 17: Advisory Lock Prevents Concurrent Job Execution

*For any* advisory lock key held by a second database connection, the job that attempts to acquire the same lock SHALL return without processing any records and SHALL NOT raise an unhandled exception.

**Validates: Requirements 16.1, 16.2**

---

### Property 18: Reconciliation Is Complete

*For any* `blockchain_transactions` row with `status = 'CONFIRMED'` and `credited = true` whose associated `payments` row does not have `status = 'CONFIRMED'`, the reconciliation endpoint SHALL include that row in its response.

**Validates: Requirements 17.1, 17.3**

---

### Property 19: All Log Output Is Valid Structured JSON

*For any* call to `logger.info`, `logger.warn`, or `logger.error`, the output line SHALL be parseable as a JSON object containing at minimum the keys `level`, `timestamp`, and `message`, with `timestamp` in ISO 8601 format.

**Validates: Requirements 18.1, 18.4**

---

### Property 20: Audit Log Captures Every Security-Sensitive Event

*For any* login, logout, payment state transition to CONFIRMED/CANCELLED/UNDERPAID/OVERPAID, order status change via admin endpoint, or inventory adjustment, the `audit_logs` table SHALL contain exactly one new row after the event with the correct `action`, `entity`, `entityId`, and `actor_id` values.

**Validates: Requirements 19.1, 19.2, 19.3, 19.4**
