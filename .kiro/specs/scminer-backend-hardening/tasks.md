# Implementation Plan: SCMiner Backend Hardening

## Overview

Six-phase production hardening of the SCMiner StreetJS 1.2.8 API. Each phase is self-contained and must leave `npm run build` (run from `api/`) passing before the next phase begins. All 54 existing routes are preserved throughout. Migrations are numbered 003 and above. The implementation directory is `api/`.

---

## Tasks

### Phase 1 — Atomic Checkout & Coupon Atomicity (Tasks 1–5)

- [ ] 1. Create migration 003 skeleton with coupon_redemptions index and payments schema changes
  - [ ] 1.1 Create `api/migrations/003_production_hardening.sql`
    - Add `payment_index BIGINT NOT NULL DEFAULT 0` column to `payments` with `ADD COLUMN IF NOT EXISTS`
    - Add `CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_payment_index ON payments (payment_index)`
    - Alter `payments.crypto_amount` and `payments.crypto_amount_received` to `NUMERIC(36,0)` using `USING ROUND(...)::NUMERIC(36,0)` cast clause
    - Drop and recreate `payments_status_check` constraint inside a `DO $$ BEGIN ... END $$` block to add `'CANCELLED'` to the allowed values list
    - `UPDATE supported_assets SET enabled = false WHERE network = 'BSC'`
    - Update `system_settings` to remove `'USDT_BEP20'` from `supported_payment_methods` using `jsonb_agg` / `jsonb_array_elements` filter
    - `ALTER TABLE coupon_redemptions ADD COLUMN IF NOT EXISTS per_user_limit_enforced BOOLEAN NOT NULL DEFAULT true`
    - `CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_redemptions_per_user ON coupon_redemptions (coupon_id, user_id) WHERE per_user_limit_enforced = true`
    - All statements must be idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DO $$ BEGIN...END $$` guards)
    - _Requirements: 2.3, 3.5, 4.1, 6.1, 13.2, 20.2, 20.3_

- [ ] 2. Refactor `CheckoutService.createOrder` to use a single PostgreSQL transaction
  - [ ] 2.1 Rewrite `createOrder` in `api/src/checkout/checkout.service.ts`
    - Replace all bare `pool.query()` calls with a `pool.connect()` client wrapped in `BEGIN` / `COMMIT` / `ROLLBACK` in a try/catch/finally block
    - Move the empty-cart check before `pool.connect()` so it fires before a transaction opens (Req 1.6)
    - After `BEGIN`, lock each inventory row with `SELECT id FROM inventory WHERE product_id = $1 FOR UPDATE` before checking available quantity
    - Validate available stock `(quantity_on_hand - quantity_reserved) >= item.quantity` inside the locked transaction
    - Extract a private `_quoteWithClient(client, input, cart)` method that runs all quote SQL through the transaction client rather than the pool
    - All order row, order items, order address inserts must use the same transaction client
    - Inventory reservation (`InventoryService.reserve`) must be called via a new `reserveWithClient(client, ...)` overload or inlined SQL using the client
    - Cart clearance must call `CartService.clearCartWithClient(client, cart.id)` (add this method to `CartService` if it doesn't exist)
    - The `ROLLBACK` in `catch` must cover every error path; `client.release()` must be in `finally`
    - _Requirements: 1.1, 1.2, 1.3, 1.7_

  - [ ]* 2.2 Write property test for checkout atomicity (Property 1)
    - **Property 1: Checkout Atomicity**
    - Simulate a failure at step 7 (address insert) and assert no `orders`, `order_items`, or `inventory_movements` rows persist
    - **Validates: Requirements 1.1, 1.2**

- [ ] 3. Add coupon SELECT FOR UPDATE lock and per-user limit check inside transaction
  - [ ] 3.1 Modify coupon redemption block in `api/src/checkout/checkout.service.ts`
    - After locking inventory rows and before inserting the order, acquire `SELECT ... FOR UPDATE` on the `coupons` row using the transaction client
    - Inside the lock, re-validate `active`, `expires_at`, and `usage_limit` fields
    - Count existing `coupon_redemptions` rows for `(coupon_id, user_id)` using the same client
    - Throw `'Coupon per-user limit exceeded'` if `count >= coupon.per_user_limit`
    - Move `usage_count` increment and `coupon_redemptions` insert to run inside the same transaction (after order row insert)
    - _Requirements: 1.4, 1.5, 13.1_

  - [ ]* 3.2 Write property test for coupon concurrent redemption safety (Property 4)
    - **Property 4: Coupon Concurrent Redemption Safety**
    - Seed a coupon with `per_user_limit = 1` and fire two simultaneous checkouts for the same user
    - Assert exactly one `coupon_redemptions` row exists for that `(coupon_id, user_id)` pair after both settle
    - **Validates: Requirements 1.4, 1.5, 13.1**

- [ ] 4. Add `CartService.clearCartWithClient` and `InventoryService.reserveWithClient`
  - [ ] 4.1 Add `clearCartWithClient(client, cartId)` to `api/src/cart/cart.service.ts`
    - Accept a `pg.PoolClient` as the first argument and run the cart-clear SQL through it
    - Keep the existing `clearCart(cartId)` method intact for non-transactional use
    - _Requirements: 1.1_

  - [ ] 4.2 Add `reserveWithClient(client, productId, quantity, actorId?)` to `api/src/inventory/inventory.service.ts`
    - Accept a `pg.PoolClient` and run the reservation SQL through it; record the movement using the same client
    - Keep the existing `reserve(...)` method intact
    - _Requirements: 1.1, 1.3_

- [ ] 5. Phase 1 build verification
  - Run `npm run build` from `api/` and confirm exit code 0
  - Fix any TypeScript errors introduced in tasks 1–4 before continuing
  - _Requirements: 20.1_

---

### Phase 2 — Crypto: HD Wallet, BigInt, State Machine, ETH Native, BSC Disable, Duplicate Protection (Tasks 6–12)

- [ ] 6. Create migration 004 for HD wallet counter and receiving_address column
  - [ ] 6.1 Create `api/migrations/004_crypto_payment_attribution.sql`
    - `CREATE TABLE IF NOT EXISTS crypto_address_counter` with `id INT PRIMARY KEY DEFAULT 1`, `counter BIGINT NOT NULL DEFAULT 0`, and `CONSTRAINT single_row CHECK (id = 1)`
    - `INSERT INTO crypto_address_counter (id, counter) VALUES (1, 0) ON CONFLICT (id) DO NOTHING`
    - `ALTER TABLE payments ADD COLUMN IF NOT EXISTS receiving_address TEXT`
    - _Requirements: 2.3, 20.2, 20.3_

- [ ] 7. Implement `PaymentAddressService` for HD wallet derivation
  - [ ] 7.1 Create `api/src/crypto/payment-address.service.ts`
    - Import `BIP32Factory` from `bip32`, `* as ecc from 'tiny-secp256k1'`, and `payments` from `bitcoinjs-lib`; add these as dependencies in `api/package.json` if absent
    - Add `ethereumAddressFromPublicKey(pubkey: Uint8Array): string` helper using `keccak256` of the uncompressed public key bytes (last 20 bytes), prefixed with `0x`
    - Add `tronAddressFromPublicKey(pubkey: Uint8Array): string` helper (base58check of prefix `0x41` + keccak20 bytes)
    - Implement `deriveNextAddress(network: 'BITCOIN' | 'ETHEREUM' | 'TRON'): Promise<{ address: string; paymentIndex: bigint }>` that:
      - Reads `HD_WALLET_XPUB` from `process.env`; throws with code `CRYPTO_NOT_CONFIGURED` if absent (Req 2.2, 2.5)
      - Atomically increments `crypto_address_counter.counter` with `UPDATE ... RETURNING counter AS next_val`
      - Derives the BIP32 child at path `m/0/{counter}` using `bip32.fromBase58(xpub).derive(0).derive(Number(paymentIndex))`
      - Returns the derived address string and the `paymentIndex` as `bigint`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 7.2 Write property test for unique HD wallet address per intent (Property 5)
    - **Property 5: Unique HD Wallet Address Per Intent**
    - Call `deriveNextAddress` concurrently N times and assert all returned `paymentIndex` values are distinct and all `address` strings are distinct
    - **Validates: Requirements 2.1, 2.3**

- [ ] 8. Refactor `CryptoService` for BigInt amounts, HD wallet, and state machine fixes
  - [ ] 8.1 Update `createPaymentIntent` in `api/src/crypto/crypto.service.ts`
    - Call `PaymentAddressService.deriveNextAddress(network)` instead of querying the `wallets` table for the receiving address
    - Compute `cryptoAmountBigInt` as a `bigint` in smallest units: satoshis for BTC, wei for ETH, micro-USDT (×10⁶) for USDT
    - Store `cryptoAmountBigInt.toString()` in `payments.crypto_amount` as `NUMERIC(36,0)`
    - Store `payment_index` and `receiving_address` on the `payments` row
    - Return `receivingAddress` from the derived address rather than the `wallets` table
    - If `HD_WALLET_XPUB` is absent, catch the `CRYPTO_NOT_CONFIGURED` error and return HTTP 503 with `{ error: { code: 'CRYPTO_NOT_CONFIGURED' } }`
    - Remove the `wallets` table join from `createPaymentIntent`
    - _Requirements: 2.1, 2.4, 2.5, 3.1, 3.2_

  - [ ] 8.2 Update `processDetectedTransaction` signature and BigInt comparison in `api/src/crypto/crypto.service.ts`
    - Change the `amount` parameter type from `string` to `bigint`
    - Update internal amount comparisons to use `bigint` arithmetic with tolerance `expectedBigint / 1000n` (Req 3.4)
    - Store amounts using `.toString()` to the `NUMERIC(36,0)` columns
    - Add early-exit guard: if `payment.status` is `'CANCELLED'` or `'EXPIRED'`, record `TRANSACTION_ON_CANCELLED_OR_EXPIRED` event and return without updating any order or payment (Req 4.4)
    - _Requirements: 3.1, 3.3, 3.4, 4.4_

  - [ ]* 8.3 Write property test for BigInt amount precision round-trip (Property 6)
    - **Property 6: BigInt Amount Precision Round-Trip**
    - For a set of representative wei / satoshi values, convert to `bigint`, store as string, parse back as `bigint`, and assert equality with no loss
    - **Validates: Requirements 3.1, 3.2, 3.5**

  - [ ]* 8.4 Write property test for correct amount comparison with tolerance (Property 7)
    - **Property 7: Correct Amount Comparison With Tolerance**
    - For triples `(expected, received, expectedOutcome)` covering CONFIRMED, UNDERPAID, OVERPAID boundaries, assert the outcome matches
    - **Validates: Requirements 3.4**

- [ ] 9. Add `cancelPaymentIntent` method and tighten `expirePayments` in `CryptoService`
  - [ ] 9.1 Add `cancelPaymentIntent(paymentId, userId)` to `api/src/crypto/crypto.service.ts`
    - Set `status = 'CANCELLED'` only if current status is `'AWAITING_PAYMENT'` or `'PAYMENT_PROCESSING'`
    - Record a `PAYMENT_CANCELLED` payment event
    - _Requirements: 4.2_

  - [ ] 9.2 Tighten `expirePayments` in `api/src/crypto/crypto.service.ts`
    - Ensure the `UPDATE` only touches rows with `status = 'AWAITING_PAYMENT'` (already in the WHERE clause — confirm and leave unchanged)
    - _Requirements: 4.3_

  - [ ]* 9.3 Write property test for expiry job not modifying terminal payments (Property 8)
    - **Property 8: Expiry Job Does Not Modify Terminal Payments**
    - Seed payments with each terminal status; call `expirePayments()`; assert none changed
    - **Validates: Requirements 4.3**

  - [ ]* 9.4 Write property test for cancelled payment not credited (Property 9)
    - **Property 9: Cancelled Payment Not Credited**
    - Seed a payment with status `'CANCELLED'`; call `processDetectedTransaction`; assert `orders.status` and `blockchain_transactions.credited` are unchanged
    - **Validates: Requirements 4.4**

- [ ] 10. Add ETH native transfer detection to `BlockchainMonitorJob`
  - [ ] 10.1 Implement `checkEthereumNative` in `api/src/jobs/blockchain-monitor.job.ts`
    - Add a new async function `checkEthereumNative(paymentId, address)` that:
      - Returns early with a structured `logger.warn` if `ETH_RPC_URL` is not set (Req 5.3)
      - Scans recent blocks (last 100) using `eth_getBlockByNumber` + `eth_getTransactionReceipt` or `eth_getLogs` to find transactions whose `to` matches the receiving address and `value > 0`
      - Parses the on-chain amount as `BigInt(tx.value)` (wei) — do not convert to float
      - Calls `svc.processDetectedTransaction(paymentId, txHash, 'ETHEREUM', fromAddr, address, weiAmount, 'ETH', confirmations)` with `bigint` wei amount
    - In `checkPayment`, route `symbol === 'ETH'` to `checkEthereumNative` when `contract_address` is null; keep the existing ERC-20 log path for USDT_ERC20
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 11. Disable BSC/BEP20 dead code path
  - [ ] 11.1 Remove BSC branch from `api/src/jobs/blockchain-monitor.job.ts`
    - Delete or comment out any `else if (network === 'BSC')` branch in `checkPayment`
    - Add compile-time constant `const BSC_ENABLED = false as const` at top of file and guard any residual BSC code behind `if (BSC_ENABLED)` to make the intent explicit
    - _Requirements: 6.4_

  - [ ] 11.2 Remove BSC from `assetToMethod` in `api/src/crypto/crypto.service.ts`
    - Delete the `USDT_BEP20` branch from `assetToMethod`
    - Add a guard in `createPaymentIntent`: if `asset.network === 'BSC'`, throw HTTP 400 with `{ error: { code: 'ASSET_NOT_SUPPORTED' } }` (Req 6.2)
    - _Requirements: 6.2_

  - [ ] 11.3 Add `USDT_BEP20` method rejection to `api/src/checkout/checkout.controller.ts`
    - In the checkout endpoint handler, before calling `CheckoutService.createOrder`, check if `paymentMethod === 'USDT_BEP20'` and return HTTP 400 with `{ error: { code: 'PAYMENT_METHOD_DISABLED' } }` (Req 6.3)
    - _Requirements: 6.3_

- [ ] 12. Make `processDetectedTransaction` idempotent against duplicate transactions
  - [ ] 12.1 Rewrite the `blockchain_transactions` insert in `api/src/crypto/crypto.service.ts` to use `ON CONFLICT DO NOTHING`
    - Replace the existing `SELECT` + conditional `INSERT` with a single `INSERT ... ON CONFLICT (network, transaction_hash) DO NOTHING RETURNING id`
    - If `RETURNING id` is empty (conflict), query the existing row for `credited` flag
    - If `credited = true`, return immediately (Req 7.2)
    - If `credited = false`, update only the `confirmations` column on the existing row and return (Req 7.3)
    - Do not re-emit `TRANSACTION_DETECTED` event on an update path (Req 7.3)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 12.2 Write property test for duplicate transaction idempotence (Property 10)
    - **Property 10: Duplicate Transaction Idempotence**
    - Call `processDetectedTransaction` twice with identical `(network, txHash)`; assert `blockchain_transactions` has exactly one row and `orders.status` was not updated twice
    - **Validates: Requirements 7.2, 7.4**

- [ ] 13. Phase 2 build verification
  - Run `npm run build` from `api/` and confirm exit code 0
  - Fix any TypeScript errors (especially `bigint` / `string` mismatches in job ↔ service calls) before continuing
  - _Requirements: 20.1_

---

### Phase 3 — Authentication Security (Tasks 14–16)

- [ ] 14. Replace hex-string password comparison with `timingSafeEqual`
  - [ ] 14.1 Rewrite `verifyPassword` in `api/src/auth/auth.service.ts`
    - Import `timingSafeEqual` from `node:crypto` alongside existing imports
    - In the `pbkdf2` callback, remove `derivedKey.toString('hex') === key` comparison
    - Pass `derivedKey` (a `Buffer`) and `Buffer.from(storedHex!, 'hex')` directly to `timingSafeEqual(a, b)` — both are 32 bytes, no padding needed (Req 8.1, 8.2)
    - Wrap the callback in a try/catch; on any error, call `resolve(false)` — never reject or propagate (Req 8.3)
    - Remove the `reject` path entirely from the `Promise` constructor
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 14.2 Write unit test for `AuthService.verifyPassword` (Req 21.1)
    - Spy on `crypto.timingSafeEqual`; assert it is called during `verifyPassword`
    - Assert correct password returns `true`, incorrect returns `false` without throwing
    - Assert a simulated PBKDF2 failure also returns `false` (no unhandled rejection)
    - Create test at `api/src/__tests__/unit/auth.verifyPassword.test.ts`
    - _Requirements: 21.1_

- [ ] 15. Make refresh token rotation atomic with `SELECT FOR UPDATE`
  - [ ] 15.1 Rewrite `AuthService.refresh` in `api/src/auth/auth.service.ts`
    - Obtain a `pool.connect()` client and open `BEGIN`
    - Lock the `refresh_tokens` row: `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`
    - If the row is already revoked (`revoked_at IS NOT NULL`): revoke all other tokens for that `user_id` within the same transaction (token-theft response), then `COMMIT` and throw `UnauthorizedException('Refresh token revoked')` (Req 9.3)
    - If expired: throw `UnauthorizedException('Refresh token expired')` and `ROLLBACK`
    - On valid token: `UPDATE refresh_tokens SET revoked_at = NOW()` and issue new tokens, all within the same `COMMIT` (Req 9.2)
    - Add a private `issueTokensWithClient(client, userId, user)` helper that inserts the new `refresh_tokens` row using the transaction client
    - `ROLLBACK` in catch, `client.release()` in finally
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 16. Add active user status check to `verifyAccessToken`
  - [ ] 16.1 Update `verifyAccessToken` in `api/src/auth/auth.service.ts`
    - After successfully verifying the JWT and extracting `userId`, add: `SELECT status FROM users WHERE id = $1`
    - If no row or `status !== 'active'`, return `null` immediately (Req 10.1)
    - Wrap the entire method body in try/catch returning `null` on any error (already present — confirm)
    - Confirm that `login` already checks `status !== 'active'` before issuing tokens (already implemented — verify, no change needed if correct) (Req 10.2)
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 16.2 Write property test for suspended user tokens always rejected (Property 11)
    - **Property 11: Suspended User Tokens Are Always Rejected**
    - Issue a valid JWT for a user, set `users.status = 'suspended'`, call `verifyAccessToken`; assert it returns `null`
    - **Validates: Requirements 10.1, 10.3**

- [ ] 17. Phase 3 build verification
  - Run `npm run build` from `api/` and confirm exit code 0
  - Fix any TypeScript errors introduced in tasks 14–16 before continuing
  - _Requirements: 20.1_

---

### Phase 4 — Business Logic Correctness (Tasks 18–22)

- [ ] 18. Add `requirePermission` middleware and apply to protected routes
  - [ ] 18.1 Add `requirePermission(permissionName)` to `api/src/middleware/auth.middleware.ts`
    - Implement `export function requirePermission(permissionName: string): MiddlewareFn`
    - Query: `SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = $1 AND p.name = $2 LIMIT 1`
    - If no row: additionally query `SELECT 1 FROM permissions WHERE name = $1` to detect unknown permission names; emit `logger.warn({ message: 'Unknown permission checked', permissionName })` if not found (Req 11.7)
    - Return HTTP 403 with `{ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }` on both denial cases
    - Add a helper `checkPermission(userId, permissionName): Promise<boolean>` that runs the same join query and returns a boolean (for use in controller handlers)
    - Export `checkPermission` alongside the middleware
    - _Requirements: 11.1, 11.2, 11.7_

  - [ ] 18.2 Apply `requirePermission` to `InventoryController` adjust endpoint in `api/src/inventory/inventory.controller.ts`
    - Add `requirePermission('inventory.write')` middleware to the `PATCH /api/v1/inventory/:productId/adjust` route
    - _Requirements: 11.3_

  - [ ] 18.3 Apply `requirePermission` to `AdminController` manual-confirm endpoint in `api/src/admin/admin.controller.ts`
    - Add `requirePermission('payments.write')` check alongside the existing `super_admin` role check (both must pass)
    - _Requirements: 11.4_

  - [ ] 18.4 Apply `requirePermission` to `CouponController` admin endpoints in `api/src/coupons/coupon.controller.ts`
    - Identify all admin-only coupon mutations (create, update, delete) and add `requirePermission('coupons.write')`
    - _Requirements: 11.5_

  - [ ] 18.5 Apply `requirePermission` to `ReviewController` moderation endpoint in `api/src/reviews/review.controller.ts`
    - Add `requirePermission('reviews.moderate')` to the review approve/reject `PATCH` endpoint
    - _Requirements: 11.6_

  - [ ]* 18.6 Write property test for permission middleware mirrors DB state (Property 12)
    - **Property 12: Permission Middleware Mirrors DB State**
    - For a user with a given permission, assert `requirePermission` grants access; revoke the permission in DB, assert it now denies
    - Also assert that an unknown permission name returns 403 and emits a warning log
    - **Validates: Requirements 11.1, 11.2, 11.7**

- [ ] 19. Fix `InventoryService.adjust` to reject negative results
  - [ ] 19.1 Rewrite `adjust` in `api/src/inventory/inventory.service.ts`
    - Before any SQL, query `SELECT quantity_on_hand FROM inventory WHERE product_id = $1`
    - If no row found, throw `Error('Inventory record not found for product ...')` (Req 12.1)
    - If `Number(row.quantity_on_hand) + delta < 0`, throw `Error('Adjustment would result in negative on-hand quantity')` (Req 12.1)
    - Replace the existing `GREATEST(0, quantity_on_hand + $1)` SQL with `quantity_on_hand + $1` and add `WHERE product_id = $2 AND quantity_on_hand + $1 >= 0` as a belt-and-suspenders guard (Req 12.2, 12.3)
    - Check `result.rowCount === 0` after the UPDATE and throw `Error('Adjustment rejected: quantity_on_hand + delta < 0')` if so (Req 12.2)
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ] 19.2 Fix `deductSale` in `api/src/inventory/inventory.service.ts`
    - Replace `GREATEST(0, quantity_reserved - $1)` with `LEAST(quantity_reserved, quantity_on_hand - $1)` so that `quantity_reserved` never exceeds the post-deduction `quantity_on_hand` (Req 12.4)
    - _Requirements: 12.4_

  - [ ]* 19.3 Write property test for inventory adjustment rejecting negative results (Property 13)
    - **Property 13: Inventory Adjustment Rejects Negative Results**
    - For `quantity_on_hand = 5`, call `adjust(productId, -999, 'test')`; assert an error is thrown and `quantity_on_hand` in DB is still 5
    - **Validates: Requirements 12.1, 12.2**

  - [ ]* 19.4 Write property test for reserved quantity never exceeds on-hand (Property 14)
    - **Property 14: Reserved Quantity Never Exceeds On-Hand Quantity**
    - Run a sequence of reserve/release/deductSale/adjust operations; assert `quantity_reserved <= quantity_on_hand` after each step
    - **Validates: Requirements 12.4**

- [ ] 20. Add verified purchase flag to review submission
  - [ ] 20.1 Update review insert in `api/src/reviews/review.controller.ts` (POST `/api/v1/products/:productId/reviews`)
    - Before inserting, query: `SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.user_id = $1 AND oi.product_id = $2 AND o.status IN ('DELIVERED','SHIPPED','PAID','PROCESSING','PACKED') LIMIT 1`
    - Set `isVerifiedPurchase = verifiedRes.rows.length > 0` (Req 14.1, 14.2, 14.3)
    - Pass `isVerifiedPurchase` as the `is_verified_purchase` column value in the `INSERT`
    - Confirm that the admin moderation `PATCH` does NOT include `is_verified_purchase` in its `SET` clause (Req 14.4)
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [ ]* 20.2 Write property test for verified purchase flag matches order history (Property 15)
    - **Property 15: Verified Purchase Flag Matches Order History**
    - Submit a review for a user with a qualifying order; assert `is_verified_purchase = true`. Submit for a user without one; assert `false`
    - **Validates: Requirements 14.1, 14.2, 14.3**

- [ ] 21. Sanitise public inventory endpoint response
  - [ ] 21.1 Update `GET /api/v1/inventory/:productId` handler in `api/src/inventory/inventory.controller.ts`
    - If no authenticated user (or user lacks `inventory.read` permission): respond with `{ inStock: boolean, available: number }` only — omit `quantity_on_hand`, `quantity_reserved`, `low_stock_threshold` (Req 15.1)
    - Use `checkPermission(user.id, 'inventory.read')` for authenticated users; return full record only if they have the permission (Req 15.2)
    - Do NOT change the route path `GET /api/v1/inventory/:productId` or HTTP method (Req 15.3)
    - _Requirements: 15.1, 15.2, 15.3_

  - [ ]* 21.2 Write property test for public inventory endpoint excludes internal fields (Property 16)
    - **Property 16: Public Inventory Endpoint Excludes Internal Fields**
    - Issue `GET /api/v1/inventory/:productId` without auth; assert response does not contain keys `quantity_on_hand`, `quantity_reserved`, or `low_stock_threshold`
    - **Validates: Requirements 15.1**

- [ ] 22. Phase 4 build verification
  - Run `npm run build` from `api/` and confirm exit code 0
  - Fix any TypeScript errors introduced in tasks 18–21 before continuing
  - _Requirements: 20.1_

---

### Phase 5 — Operations (Tasks 23–27)

- [ ] 23. Add advisory locks to background jobs
  - [ ] 23.1 Add advisory lock acquisition to `api/src/jobs/blockchain-monitor.job.ts`
    - Define `const LOCK_KEY_BLOCKCHAIN_MONITOR = 2_000_000_001n` at module scope
    - At the start of `runBlockchainMonitorJob`: obtain a client with `pool.connect()`, then call `SELECT pg_try_advisory_lock($1) AS acquired` with `LOCK_KEY_BLOCKCHAIN_MONITOR.toString()`
    - If `acquired = false`: release the client and return immediately — do not throw (Req 16.1)
    - After all job work completes (or on error): call `SELECT pg_advisory_unlock($1)` before releasing the client (Req 16.3)
    - Wrap the work in try/catch; in the catch block, emit `logger.error({ jobName: 'blockchain-monitor', ... })` and attempt the advisory unlock before re-releasing (Req 16.4)
    - Replace all `console.error` calls in the file with `logger.error` (prerequisite for Req 18)
    - _Requirements: 16.1, 16.3, 16.4_

  - [ ] 23.2 Add advisory lock acquisition to `api/src/jobs/payment-expiry.job.ts`
    - Define `const LOCK_KEY_PAYMENT_EXPIRY = 2_000_000_002n` at module scope
    - Same pattern as `blockchain-monitor.job.ts`: `pg_try_advisory_lock` → skip if not acquired → unlock after work
    - Replace `console.log` / `console.error` with `logger.info` / `logger.error`
    - _Requirements: 16.2, 16.3, 16.4_

  - [ ]* 23.3 Write property test for advisory lock preventing concurrent job execution (Property 17)
    - **Property 17: Advisory Lock Prevents Concurrent Job Execution**
    - Hold advisory lock `2000000001` on a separate connection; call `runBlockchainMonitorJob()` and await; assert no payments were modified and no exception was thrown
    - Create test at `api/src/__tests__/integration/blockchainMonitor.advisoryLock.test.ts`
    - **Validates: Requirements 16.1, 16.2**

- [ ] 24. Add reconciliation endpoint to `AdminController`
  - [ ] 24.1 Add `GET /api/v1/admin/reconciliation` to `api/src/admin/admin.controller.ts`
    - Gate with `checkPermission(user.id, 'payments.read')` — return 403 if denied (Req 17.1)
    - Type 1 query: `blockchain_transactions` with `status = 'CONFIRMED' AND credited = true` whose `payments.status != 'CONFIRMED'` (Req 17.1)
    - Type 2 query: `orders` with `status = 'PAID'` with no associated `payments` row where `status = 'CONFIRMED'` (Req 17.3)
    - Return `{ discrepancies: [...], orphanPaidOrders: [...], generatedAt: string }` with HTTP 200 — never auto-correct records (Req 17.2)
    - _Requirements: 17.1, 17.2, 17.3_

  - [ ]* 24.2 Write property test for reconciliation completeness (Property 18)
    - **Property 18: Reconciliation Is Complete**
    - Insert a `blockchain_transactions` row with `status='CONFIRMED', credited=true` whose payment has `status='UNDERPAID'`; call the reconciliation endpoint; assert the discrepancy appears in the response
    - **Validates: Requirements 17.1, 17.3**

- [ ] 25. Create structured logger and replace all `console.*` calls
  - [ ] 25.1 Create `api/src/common/logger.ts`
    - Define `type LogLevel = 'debug' | 'info' | 'warn' | 'error'`
    - Define `const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }`
    - Implement `function currentLevel(): number` that reads `process.env['LOG_LEVEL']` (default `'info'`) and returns the numeric level
    - Implement `function emit(level: LogLevel, fields: Record<string, unknown>): void` that skips emission if below `currentLevel()`, then calls `console.log(JSON.stringify({ level, timestamp: new Date().toISOString(), ...fields }))`
    - Export `const logger = { debug, info, warn, error }` (Req 18.1, 18.4)
    - _Requirements: 18.1, 18.4_

  - [ ] 25.2 Replace all `console.log` / `console.error` / `console.warn` calls across the API source files
    - Files to update: `api/src/jobs/blockchain-monitor.job.ts`, `api/src/jobs/payment-expiry.job.ts`, `api/src/main.ts`, and any other source file containing bare `console.*` calls
    - Import `logger` from `'../common/logger.js'` (or appropriate relative path) in each file
    - Map: `console.log` → `logger.info`, `console.error` → `logger.error`, `console.warn` → `logger.warn`
    - Add `requestId` field to log calls inside request handlers by reading `(ctx as Record<string, unknown>)['requestId']`
    - _Requirements: 18.1, 18.2_

  - [ ] 25.3 Add payment state transition structured logs to `api/src/crypto/crypto.service.ts`
    - After each status update in `processDetectedTransaction`, emit `logger.info({ message: 'payment_transition', paymentId, orderId, event, previousStatus, newStatus })` (Req 18.3)
    - _Requirements: 18.3_

  - [ ]* 25.4 Write property test for all log output being valid structured JSON (Property 19)
    - **Property 19: All Log Output Is Valid Structured JSON**
    - Capture stdout during `logger.info`, `logger.warn`, `logger.error` calls; parse each line as JSON; assert presence of `level`, `timestamp`, `message`; assert `timestamp` is ISO 8601
    - **Validates: Requirements 18.1, 18.4**

- [ ] 26. Add audit log coverage for security-sensitive actions
  - [ ] 26.1 Add `USER_LOGIN` and `USER_LOGOUT` audit calls to `api/src/auth/auth.service.ts`
    - Update `login` method to accept `ipAddress?: string` and `requestId?: string` context params (or add a separate audit call in `AuthController` after successful login)
    - Add `auditSvc.log({ actorId: user.id, action: 'USER_LOGIN', entity: 'users', entityId: user.id, ipAddress, requestId })` after successful token issuance (Req 19.1)
    - Add `auditSvc.log({ actorId: userId, action: 'USER_LOGOUT', entity: 'users', entityId: userId, requestId })` in `logout` method (Req 19.1)
    - _Requirements: 19.1_

  - [ ] 26.2 Add payment state transition audit calls to `api/src/crypto/crypto.service.ts`
    - After status is set to `CONFIRMED`, `CANCELLED`, `UNDERPAID`, or `OVERPAID`, call `auditSvc.log({ action: eventName, entity: 'payments', entityId: paymentId, before: { status: previousStatus }, after: { status: newStatus } })` (Req 19.2)
    - Pass a synthetic `requestId` like `job:blockchain-monitor:${Date.now()}` when called from background jobs
    - _Requirements: 19.2_

  - [ ] 26.3 Add order status change audit call to `api/src/orders/order.controller.ts` (`PATCH /api/v1/orders/:id/status`)
    - Query previous status before update; after update, call `auditSvc.log({ actorId: user.id, action: 'ORDER_STATUS_CHANGED', entity: 'orders', entityId: orderId, before: { status: prev }, after: { status: next }, requestId })` (Req 19.3)
    - Add 400 rejection for status values not in the `orders.status` CHECK constraint, returning `{ error: { code: 'INVALID_STATUS' } }` (Req 4.5)
    - _Requirements: 4.5, 19.3_

  - [ ] 26.4 Add inventory adjustment audit call to `api/src/inventory/inventory.service.ts`
    - At the end of a successful `adjust`, call `auditSvc.log({ actorId, action: 'INVENTORY_ADJUSTED', entity: 'inventory', entityId: productId, before: { onHand: before }, after: { onHand: after }, ... })` (Req 19.4)
    - Pass `requestId` from a new optional context parameter
    - _Requirements: 19.4, 19.5_

  - [ ]* 26.5 Write property test for audit log capturing every security-sensitive event (Property 20)
    - **Property 20: Audit Log Captures Every Security-Sensitive Event**
    - For each of: login, logout, payment CONFIRMED, payment CANCELLED, order status change, inventory adjustment — assert exactly one new `audit_logs` row with correct `action`, `entity`, `entityId`, and `actor_id`
    - **Validates: Requirements 19.1, 19.2, 19.3, 19.4**

- [ ] 27. Phase 5 build verification
  - Run `npm run build` from `api/` and confirm exit code 0
  - Fix any TypeScript errors introduced in tasks 23–26 before continuing
  - _Requirements: 20.1_

---

### Phase 6 — Testing (Tasks 28–32)

- [ ] 28. Create test infrastructure and unit tests
  - [ ] 28.1 Set up test directory structure under `api/src/__tests__/`
    - Create subdirectories: `unit/`, `integration/`, `e2e/`
    - Confirm the test framework available via `npm test` (StreetJS test runner) and add any required test helper utilities (e.g. a `testDb.ts` helper that connects to a test database and runs migrations)
    - _Requirements: 21_

  - [ ] 28.2 Write `api/src/__tests__/unit/auth.verifyPassword.test.ts` (Req 21.1)
    - Spy on `crypto.timingSafeEqual`; call `verifyPassword` with correct and incorrect passwords
    - Assert `timingSafeEqual` is called on every invocation
    - Assert correct password resolves to `true`, wrong password resolves to `false`, no exception thrown in either case
    - Simulate PBKDF2 failure (mock `pbkdf2` to call back with an error); assert `false` is returned, not a rejection
    - _Requirements: 21.1, 8.1, 8.3_

  - [ ] 28.3 Write `api/src/__tests__/unit/inventory.adjust.test.ts` (Req 21.4)
    - Seed a product with `quantity_on_hand = 5` in the test database
    - Call `adjust(productId, -999, 'test')`; assert the thrown error message contains `'Adjustment would result in negative'`
    - Query the DB and assert `quantity_on_hand` is still 5
    - Also test a valid positive `delta` and assert `quantity_on_hand` increases correctly
    - _Requirements: 21.4, 12.1, 12.2_

  - [ ] 28.4 Write `api/src/__tests__/unit/crypto.processDetectedTransaction.test.ts` (Req 21.3)
    - Seed a payment intent in the test database
    - Call `processDetectedTransaction(...)` twice with identical `(network, txHash)` values
    - Assert `blockchain_transactions` contains exactly one row for that hash
    - Assert `orders.status` is set only by the first call; on the second call it remains unchanged
    - _Requirements: 21.3, 7.2, 7.3_

- [ ] 29. Write concurrency integration tests
  - [ ] 29.1 Write `api/src/__tests__/integration/checkout.concurrency.test.ts` (Req 21.2)
    - Seed a product with `quantity_on_hand = 1`, `quantity_reserved = 0`
    - Create two users each with a cart containing quantity 1 of that product
    - Fire two simultaneous `createOrder` calls using `Promise.all`
    - Assert exactly one resolves with an `orderId` and one rejects with a message containing `'Insufficient stock'`
    - Assert `inventory.quantity_reserved = 1` after both settle
    - _Requirements: 21.2, 1.3_

  - [ ] 29.2 Write `api/src/__tests__/integration/blockchainMonitor.advisoryLock.test.ts` (Req 21.5)
    - Acquire advisory lock `2000000001` on a separate `pg.Client` connection before calling the job
    - Call `runBlockchainMonitorJob()` and `await` it
    - Assert no exception was thrown
    - Assert no `payments` rows were modified (query payments status before and after)
    - Release the lock after the assertion
    - _Requirements: 21.5, 16.1_

- [ ] 30. Write inventory response and concurrency tests
  - [ ] 30.1 Write `api/src/__tests__/integration/inventory.response.test.ts` (Req 21.7)
    - Issue `GET /api/v1/inventory/:productId` without an `Authorization` header
    - Parse the JSON response and assert it does NOT contain keys `quantity_on_hand`, `quantity_reserved`, or `low_stock_threshold`
    - Assert it DOES contain `inStock` and `available`
    - Issue the same request with a valid token for a user with `inventory.read` permission and assert the full record is returned
    - _Requirements: 21.7, 15.1, 15.2_

  - [ ]* 30.2 Write property test for inventory oversell prevention (Property 2)
    - **Property 2: Inventory Lock Prevents Oversell**
    - Fire N concurrent checkouts each requesting the full available quantity; assert no more than one succeeds and `available` never goes negative
    - **Validates: Requirements 1.3, 1.6**

- [ ] 31. Write end-to-end crypto payment flow test
  - [ ] 31.1 Write `api/src/__tests__/e2e/crypto.payment.flow.test.ts` (Req 21.6)
    - Step 1: Create a user and seed a product with stock
    - Step 2: Create an order via `CheckoutService.createOrder` with `paymentMethod: 'ETH'`
    - Step 3: Call `CryptoService.createPaymentIntent(orderId, ethAssetId, userId)` and assert a `paymentId` and `receivingAddress` are returned
    - Step 4: Call `processDetectedTransaction(paymentId, txHash, 'ETHEREUM', from, receivingAddress, expectedAmountWei, 'ETH', confirmations)` where `confirmations >= requiredConfirmations` and amount matches within tolerance
    - Step 5: Query DB and assert `payments.status = 'CONFIRMED'` and `orders.status = 'PAID'`
    - _Requirements: 21.6_

- [ ] 32. Phase 6 final build and test verification
  - Run `npm run build` from `api/` and confirm exit code 0
  - Run `npm test` from `api/` and confirm the test suite reports no failures
  - Ensure all non-optional (`*`) test sub-tasks pass
  - _Requirements: 20.1, 21_

---

## Notes

- Tasks marked with `*` are optional (property-based and integration tests) and can be skipped for a faster MVP; they must not be auto-implemented but should be run after each phase if time permits.
- Every top-level phase ends with a build verification task; do not advance to the next phase until `npm run build` exits with code 0.
- All migrations go under `api/migrations/` numbered `003_production_hardening.sql` and `004_crypto_payment_attribution.sql`.
- BigInt arithmetic: use `bigint` from the point blockchain amounts are received (RPC/webhook) all the way through to the DB `.toString()` call — never convert through `Number()` for large values.
- The `bip32`, `tiny-secp256k1`, and `bitcoinjs-lib` packages must be added to `api/package.json` dependencies before Task 7 can be completed.
- Route paths and HTTP methods for all 54 existing routes must remain unchanged; only middleware chains and handler internals change.
- Each property test sub-task references a specific Property number from the design document's Correctness Properties section for traceability.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "4.1", "4.2", "6.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["3.2", "7.1"] },
    { "id": 4, "tasks": ["7.2", "8.1", "8.2"] },
    { "id": 5, "tasks": ["8.3", "8.4", "9.1", "9.2", "10.1", "11.1", "11.2", "11.3"] },
    { "id": 6, "tasks": ["9.3", "9.4", "12.1"] },
    { "id": 7, "tasks": ["12.2", "14.1"] },
    { "id": 8, "tasks": ["14.2", "15.1"] },
    { "id": 9, "tasks": ["15.1", "16.1"] },
    { "id": 10, "tasks": ["16.2", "18.1"] },
    { "id": 11, "tasks": ["18.2", "18.3", "18.4", "18.5", "19.1", "19.2"] },
    { "id": 12, "tasks": ["18.6", "19.3", "19.4", "20.1"] },
    { "id": 13, "tasks": ["20.2", "21.1"] },
    { "id": 14, "tasks": ["21.2", "23.1", "23.2", "25.1"] },
    { "id": 15, "tasks": ["23.3", "24.1", "25.2", "25.3"] },
    { "id": 16, "tasks": ["24.2", "25.4", "26.1", "26.2", "26.3", "26.4"] },
    { "id": 17, "tasks": ["26.5", "28.1"] },
    { "id": 18, "tasks": ["28.2", "28.3", "28.4"] },
    { "id": 19, "tasks": ["29.1", "29.2"] },
    { "id": 20, "tasks": ["30.1", "30.2", "31.1"] }
  ]
}
```
