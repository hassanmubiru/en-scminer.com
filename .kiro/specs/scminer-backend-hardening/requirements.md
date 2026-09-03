# Requirements Document

## Introduction

This document defines the production hardening requirements for the SCMiner backend API. The system is built on StreetJS 1.2.8, TypeScript ESM, and PostgreSQL without an ORM. A series of correctness, security, and operational defects have been identified across six concern areas: atomic checkout and inventory, the crypto payment state machine, authentication, business logic, operations, and testing. All 54 existing API routes must remain intact and the React frontend must remain compatible after every change. Database migrations must be numbered 003 and above.

---

## Glossary

- **API**: The StreetJS 1.2.8 backend application serving `/api/v1/*` routes.
- **CheckoutService**: The service in `src/checkout/checkout.service.ts` responsible for creating orders and computing server-authoritative totals.
- **CryptoService**: The service in `src/crypto/crypto.service.ts` responsible for creating payment intents and processing detected transactions.
- **AuthService**: The service in `src/auth/auth.service.ts` responsible for user registration, login, refresh token rotation, and JWT verification.
- **InventoryService**: The service in `src/inventory/inventory.service.ts` responsible for stock reservation, release, deduction, and manual adjustment.
- **BlockchainMonitorJob**: The background job in `src/jobs/blockchain-monitor.job.ts` that polls blockchain nodes for incoming transactions.
- **PaymentExpiryJob**: The background job in `src/jobs/payment-expiry.job.ts` that transitions timed-out payment intents to `EXPIRED`.
- **PaymentIntent**: A row in the `payments` table representing a pending crypto payment obligation for a specific order.
- **HDWallet**: The self-hosted BIP32 hierarchical deterministic wallet whose child keys are derived per payment intent using a monotonically increasing `payment_index` stored in the database.
- **PaymentAddressService**: A planned service responsible for deriving unique per-intent receiving addresses from the HD wallet using the stored `payment_index`.
- **ReceivingAddress**: The blockchain address derived for exactly one PaymentIntent, used to attribute incoming transactions without ambiguity.
- **Advisory Lock**: A PostgreSQL session-level or transaction-level lock obtained via `pg_advisory_lock` / `pg_advisory_xact_lock` used to prevent concurrent job execution.
- **BigInt**: The JavaScript `bigint` primitive type used to represent all on-chain token amounts in the smallest indivisible unit (satoshi, wei, sun) without floating-point loss.
- **EARS Pattern**: Easy Approach to Requirements Syntax — one of six structured patterns (Ubiquitous, Event-driven, State-driven, Unwanted event, Optional feature, Complex) used to express each acceptance criterion.
- **Migration**: A numbered SQL file under `api/migrations/` applied sequentially to the PostgreSQL database.
- **BSC/BEP20**: Binance Smart Chain BEP-20 token network. This network has a method entry in the `payments.method` CHECK constraint and a dead code path in `CryptoService.assetToMethod` but no blockchain handler implementation.
- **USDT_BEP20**: The payment method string corresponding to BSC/BEP20, currently listed in the payments constraint but unsupported by the blockchain monitor.
- **timingSafeEqual**: Node.js `crypto.timingSafeEqual` used to compare password-derived keys in constant time to prevent timing attacks.
- **SELECT FOR UPDATE**: A PostgreSQL row-level lock clause that prevents concurrent transactions from reading a row until the holding transaction commits or rolls back.
- **Structured Log**: A log line emitted as a JSON object containing at minimum `level`, `timestamp`, `requestId`, and `message` fields.
- **Reconciliation**: The process of comparing confirmed blockchain transactions against `payments` and `orders` tables to detect discrepancies.

---

## Requirements

### Requirement 1 — Atomic Checkout Transaction

**User Story:** As a customer, I want my order to be created atomically so that a partial failure cannot leave inventory reserved without a corresponding order, or create an order without capturing all line items.

#### Acceptance Criteria

1. WHEN a customer submits a checkout request, THE CheckoutService SHALL execute the entire order creation — including stock validation, order row insertion, order item insertions, address snapshots, inventory reservation, coupon redemption, and cart clearance — within a single PostgreSQL transaction that either commits in full or rolls back completely.

2. IF any step within the checkout transaction fails, THEN THE CheckoutService SHALL roll back all writes performed during that transaction and return an error to the caller without persisting partial state.

3. WHEN a checkout transaction begins, THE CheckoutService SHALL acquire a `SELECT FOR UPDATE` lock on each `inventory` row for the products in the cart before verifying available quantity, ensuring no concurrent checkout can read the same row as available during the window between check and reservation.

4. WHEN a coupon code is supplied at checkout, THE CheckoutService SHALL re-validate the coupon's `active` flag, expiry, global usage limit, and per-user usage limit inside the same checkout transaction using a `SELECT FOR UPDATE` lock on the `coupons` row, rejecting the request if any validation fails.

5. WHEN a checkout transaction commits, THE CheckoutService SHALL increment `coupons.usage_count` and insert a `coupon_redemptions` row within the same transaction, ensuring the counter and redemption record are always consistent.

6. WHEN the cart referenced at checkout is empty or contains a product whose `inventory` record does not exist, THE CheckoutService SHALL reject the request with a 400 status before opening a database transaction.

7. THE CheckoutService SHALL compute all monetary totals (subtotal, discount, shipping, tax) server-side from current database prices and SHALL NOT accept any price or total values supplied by the client request body.

---

### Requirement 2 — Unique Per-Intent Receiving Address (HD Wallet Derivation)

**User Story:** As the platform operator, I want each crypto payment intent to receive its own unique blockchain address derived from the HD wallet so that incoming transactions can be attributed to exactly one order without ambiguity.

#### Acceptance Criteria

1. WHEN a PaymentIntent is created, THE PaymentAddressService SHALL derive a unique child key from the HD wallet using a `payment_index` value that is incremented atomically in the database, and SHALL store the derived receiving address against the PaymentIntent row.

2. THE API SHALL store the HD wallet's BIP32 extended public key in an environment variable (`HD_WALLET_XPUB`) and SHALL NOT persist private key material in the database, application code, or any migration file.

3. WHEN a migration numbered 003 or higher is applied, THE database SHALL add a `payment_index` column of type `BIGINT NOT NULL` with a `DEFAULT 0` to the `payments` table and a `UNIQUE` constraint on `payment_index` to prevent two payment intents sharing the same derivation index.

4. THE CryptoService SHALL be refactored so that `createPaymentIntent` calls `PaymentAddressService` to obtain the ReceivingAddress, and SHALL NOT read a static address from the `wallets` table as the sole receiving address for all intents of a given asset.

5. IF `HD_WALLET_XPUB` is not set at application startup, THEN THE API SHALL log an error and refuse to process payment intent creation requests, returning 503 with error code `CRYPTO_NOT_CONFIGURED`.

---

### Requirement 3 — Crypto Amount Precision (BigInt)

**User Story:** As the platform operator, I want all on-chain token amounts stored and compared using integer arithmetic so that rounding errors cannot cause a correctly-paid invoice to be marked underpaid or overpaid.

#### Acceptance Criteria

1. THE CryptoService SHALL represent all crypto amounts internally as JavaScript `bigint` values in the asset's smallest indivisible unit (satoshis for BTC, wei for ETH, micro-USDT for USDT variants) from the point of receipt until the point of database persistence.

2. WHEN a PaymentIntent is created, THE CryptoService SHALL compute the required crypto amount as a `bigint` in smallest units and store it in the `payments.crypto_amount` column as a `NUMERIC(36,0)` integer string with no decimal point.

3. WHEN a blockchain transaction is detected, THE BlockchainMonitorJob SHALL parse the on-chain amount as a `bigint` in smallest units and pass it to `CryptoService.processDetectedTransaction` as a `bigint` parameter.

4. WHEN comparing received amount to expected amount, THE CryptoService SHALL perform the comparison using `bigint` arithmetic and SHALL apply a tolerance expressed in smallest units, not as a floating-point percentage.

5. THE database migration for this change SHALL alter `payments.crypto_amount` and `payments.crypto_amount_received` to `NUMERIC(36,0)`.

---

### Requirement 4 — Payment State Machine and CANCELLED Status

**User Story:** As the platform operator, I want the payment and order state machines to be complete and enforced at the database level so that no invalid state transitions can occur and cancelled payments are properly represented.

#### Acceptance Criteria

1. WHEN a migration numbered 003 or higher is applied, THE database SHALL add `'CANCELLED'` to the `payments.status` CHECK constraint so that cancelled payment intents can be persisted without bypassing the constraint.

2. WHEN a payment intent is cancelled by the customer or by an admin before the blockchain detects a transaction, THE CryptoService SHALL transition `payments.status` to `'CANCELLED'` and SHALL NOT leave the status as `'AWAITING_PAYMENT'` or `'EXPIRED'`.

3. WHEN the PaymentExpiryJob runs, THE PaymentExpiryJob SHALL only transition payments with status `'AWAITING_PAYMENT'` to `'EXPIRED'` and SHALL NOT modify payments already in `'CANCELLED'`, `'CONFIRMED'`, `'UNDERPAID'`, `'OVERPAID'`, or `'REFUNDED'` status.

4. WHEN the BlockchainMonitorJob attempts to process a transaction for a payment whose status is `'CANCELLED'` or `'EXPIRED'`, THE BlockchainMonitorJob SHALL record a `TRANSACTION_ON_CANCELLED_OR_EXPIRED` payment event and SHALL NOT update `orders.status` or credit the payment.

5. THE API SHALL reject any `PATCH /api/v1/orders/:id/status` request that would set an order to a status not present in the `orders.status` CHECK constraint, returning 400 with error code `INVALID_STATUS`.

---

### Requirement 5 — ETH Native Transfer Detection

**User Story:** As the platform operator, I want ETH native transfers (non-ERC-20) to be detected so that customers paying with ETH can have their payments confirmed without manual intervention.

#### Acceptance Criteria

1. WHEN the BlockchainMonitorJob processes a payment with `symbol = 'ETH'` and a null `contract_address`, THE BlockchainMonitorJob SHALL scan for native ETH transfers to the ReceivingAddress using the `eth_getBalance` and transaction receipt approach or an equivalent RPC method, and SHALL NOT rely solely on `eth_getLogs` ERC-20 event scanning.

2. WHEN a native ETH transfer is detected with sufficient confirmations, THE CryptoService.processDetectedTransaction SHALL be called with the transferred amount expressed as a `bigint` in wei.

3. IF the Ethereum RPC endpoint (`ETH_RPC_URL`) is not configured, THEN THE BlockchainMonitorJob SHALL skip ETH detection for that cycle and log a structured warning, and SHALL NOT throw an unhandled exception.

---

### Requirement 6 — Disable BSC/BEP20 Dead Code Path

**User Story:** As the platform operator, I want the BSC/BEP20 payment method to be explicitly disabled so that customers cannot create payment intents for an unsupported network and receive an unmonitored address.

#### Acceptance Criteria

1. WHEN a migration numbered 003 or higher is applied, THE database SHALL update the `supported_assets` row with `network = 'BSC'` to set `enabled = false`, and the `system_settings` row for `supported_payment_methods` SHALL be updated to remove `'USDT_BEP20'`.

2. WHEN a request to create a PaymentIntent specifies an `assetId` whose `network` is `'BSC'`, THE CryptoService SHALL return an error with HTTP 400 and code `ASSET_NOT_SUPPORTED`.

3. WHEN the `POST /api/v1/orders` endpoint receives a request with `paymentMethod = 'USDT_BEP20'`, THE OrderController SHALL return HTTP 400 with error code `PAYMENT_METHOD_DISABLED`.

4. THE BlockchainMonitorJob SHALL contain no active code path that calls any BSC/BEP20 RPC endpoint, and any existing BSC branch SHALL be removed or guarded by a compile-time constant set to `false`.

---

### Requirement 7 — Duplicate Transaction Protection

**User Story:** As the platform operator, I want duplicate blockchain transaction records to be prevented at the database level so that a retry or re-scan cannot credit the same transaction twice.

#### Acceptance Criteria

1. THE `blockchain_transactions` table SHALL enforce a `UNIQUE (network, transaction_hash)` constraint so that two rows with the same network and hash cannot coexist.

2. WHEN `CryptoService.processDetectedTransaction` is called with a `(network, transaction_hash)` pair that already exists in `blockchain_transactions` and `credited = true`, THE CryptoService SHALL return immediately without modifying any row.

3. WHEN `CryptoService.processDetectedTransaction` detects a duplicate hash with `credited = false` (confirmation update), THE CryptoService SHALL update only the `confirmations` column of the existing row and SHALL NOT insert a second row or re-emit a `TRANSACTION_DETECTED` event.

4. WHEN two concurrent calls to `CryptoService.processDetectedTransaction` race with the same `(network, transaction_hash)`, THE CryptoService SHALL use an `INSERT ... ON CONFLICT DO NOTHING` or equivalent idempotent statement so that only one row is created and neither call raises an unhandled unique-constraint violation.

---

### Requirement 8 — Password Comparison Timing Safety

**User Story:** As a security-conscious operator, I want password verification to use constant-time comparison so that timing side-channels cannot be used to infer whether a submitted password matches a stored hash.

#### Acceptance Criteria

1. WHEN `AuthService.verifyPassword` compares a derived key to a stored key, THE AuthService SHALL use `crypto.timingSafeEqual` on the raw `Buffer` outputs of the two PBKDF2 derivations instead of comparing their hexadecimal string representations with the `===` operator.

2. THE AuthService SHALL derive both the candidate key and the stored key using identical PBKDF2 parameters (salt, iterations, key length, digest) before passing them to `timingSafeEqual`.

3. IF PBKDF2 derivation fails for any reason, THEN THE AuthService SHALL reject the login attempt with `UnauthorizedException` and SHALL NOT allow an exception from the crypto layer to propagate as an unhandled rejection.

---

### Requirement 9 — Atomic Refresh Token Rotation

**User Story:** As a security-conscious operator, I want refresh token rotation to be atomic so that a concurrent refresh request cannot consume the same token twice and issue two valid token pairs.

#### Acceptance Criteria

1. WHEN `AuthService.refresh` is called, THE AuthService SHALL obtain a `SELECT ... FOR UPDATE` lock on the `refresh_tokens` row identified by `token_hash` before reading `revoked_at` or `expires_at`, preventing a concurrent request from reading the same row as valid.

2. WHEN the `refresh_tokens` row is locked and found to be valid, THE AuthService SHALL mark `revoked_at = NOW()` and issue new tokens within the same database transaction, committing both the revocation and the new token insertion atomically.

3. IF the `refresh_tokens` row is already revoked when the lock is acquired, THEN THE AuthService SHALL return `UnauthorizedException` with message `'Refresh token revoked'` and SHALL invalidate all other refresh tokens for the same `user_id` as a token-theft response.

---

### Requirement 10 — Active User Check on Authentication

**User Story:** As a platform operator, I want every authenticated request to verify the user account is still active so that suspended users cannot continue to use previously issued access tokens.

#### Acceptance Criteria

1. WHEN `AuthService.verifyAccessToken` resolves a `user_id` from a JWT, THE AuthService SHALL query `users.status` for that `user_id` and SHALL return `null` if the status is not `'active'`, causing the middleware to treat the token as invalid.

2. WHEN `AuthService.login` verifies credentials, THE AuthService SHALL check `users.status = 'active'` before issuing tokens and SHALL return `UnauthorizedException` with message `'Account suspended'` if the status is not `'active'`.

3. WHEN a user's `status` is set to `'suspended'` by an admin, THE change SHALL take effect for subsequent authenticated requests without requiring a server restart.

---

### Requirement 11 — Permission-Based Authorization

**User Story:** As a platform operator, I want route authorization to check the `role_permissions` table rather than comparing role name strings so that permission grants and revocations take effect without code changes.

#### Acceptance Criteria

1. THE `requireRole` middleware function SHALL be replaced or supplemented by a `requirePermission` middleware function that accepts a `permission name` string and queries `role_permissions` joined to `user_roles` to determine whether the authenticated user holds that permission.

2. WHEN a request reaches a protected route, THE `requirePermission` middleware SHALL query: `SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = $1 AND p.name = $2` and SHALL deny access with HTTP 403 if no row is returned.

3. THE InventoryController adjust endpoint SHALL be protected by `requirePermission('inventory.write')`.

4. THE AdminController manual-confirm endpoint SHALL be protected by `requirePermission('payments.write')` in addition to the existing `super_admin` role check.

5. THE CouponController admin endpoints SHALL be protected by `requirePermission('coupons.write')`.

6. THE ReviewController moderation endpoint SHALL be protected by `requirePermission('reviews.moderate')`.

7. IF a permission name passed to `requirePermission` does not exist in the `permissions` table, THEN THE middleware SHALL treat the check as a denial and return HTTP 403, logging a structured warning with the unrecognised permission name.

---

### Requirement 12 — Inventory Adjustment Safety

**User Story:** As a platform operator, I want manual inventory adjustments to be rejected when the resulting quantity would be negative so that stock figures remain accurate and the database constraint is never violated.

#### Acceptance Criteria

1. WHEN `InventoryService.adjust` is called with a negative `delta` whose absolute value exceeds the current `quantity_on_hand`, THE InventoryService SHALL reject the operation and throw an `Error` with message `'Adjustment would result in negative on-hand quantity'` before executing any SQL.

2. WHEN `InventoryService.adjust` is called, THE InventoryService SHALL perform the update with `WHERE quantity_on_hand + $delta >= 0` and check `rowCount`; IF `rowCount` is 0, THEN THE InventoryService SHALL throw an `Error` indicating the adjustment was rejected.

3. THE InventoryService.adjust function SHALL NOT use `GREATEST(0, quantity_on_hand + delta)` in production, because silently clamping to zero conceals stock discrepancies; the caller SHALL receive an explicit error instead.

4. WHEN `InventoryService.deductSale` reduces `quantity_on_hand` below `quantity_reserved`, THE InventoryService SHALL also reduce `quantity_reserved` to `quantity_on_hand` after deduction to keep the reserved count consistent.

---

### Requirement 13 — Coupon Per-User Limit at Checkout

**User Story:** As a platform operator, I want the per-user coupon limit to be enforced atomically at checkout so that concurrent orders cannot both redeem the same coupon beyond the allowed per-user count.

#### Acceptance Criteria

1. WHEN `CheckoutService.createOrder` redeems a coupon, THE CheckoutService SHALL count existing `coupon_redemptions` rows for the `(coupon_id, user_id)` pair inside the checkout transaction under a `SELECT FOR UPDATE` lock on the `coupons` row, and SHALL reject the checkout with error `'Coupon per-user limit exceeded'` if the count is greater than or equal to `coupons.per_user_limit`.

2. THE `coupon_redemptions` table SHALL have a database-level check to prevent duplicate redemptions for the same user and coupon beyond the defined limit; a partial unique index `UNIQUE (coupon_id, user_id) WHERE per_user_limit_enforced = true` or an equivalent migration-applied constraint SHALL be added.

3. WHEN the `POST /api/v1/coupons/validate` endpoint is called by an authenticated user, THE CouponController SHALL check the `coupon_redemptions` count for that user and SHALL return `{ valid: false, reason: 'Coupon per-user limit reached' }` if the limit is already reached, without waiting for checkout.

---

### Requirement 14 — Review Purchase Verification

**User Story:** As a platform operator, I want product reviews to be marked as verified purchases only when the reviewer has a fulfilled order containing that product so that the `is_verified_purchase` flag is trustworthy.

#### Acceptance Criteria

1. WHEN a user submits a review via `POST /api/v1/products/:productId/reviews`, THE ReviewController SHALL query `order_items` joined to `orders` to check whether the authenticated user has at least one order with `status IN ('DELIVERED', 'SHIPPED', 'PAID', 'PROCESSING', 'PACKED')` containing the reviewed product.

2. IF such an order item exists, THEN THE ReviewController SHALL set `is_verified_purchase = true` on the inserted review row.

3. IF no such order item exists, THEN THE ReviewController SHALL set `is_verified_purchase = false` and SHALL still allow the review to be submitted (purchase verification does not block submission).

4. WHEN an admin approves a review via the moderation endpoint, THE ReviewController SHALL NOT alter the `is_verified_purchase` flag that was set at submission time.

---

### Requirement 15 — Public Inventory Response Sanitisation

**User Story:** As a platform operator, I want the public inventory endpoint to return only publicly appropriate stock information so that internal fields such as `quantity_reserved` and `low_stock_threshold` are not exposed to unauthenticated clients.

#### Acceptance Criteria

1. WHEN an unauthenticated request hits `GET /api/v1/inventory/:productId`, THE InventoryController SHALL return only `{ inStock: boolean, available: number }` and SHALL NOT include `quantity_on_hand`, `quantity_reserved`, or `low_stock_threshold` in the response.

2. WHEN an authenticated request from a user with `inventory.read` permission hits `GET /api/v1/inventory/:productId`, THE InventoryController SHALL return the full record including `quantity_on_hand`, `quantity_reserved`, `available`, and `low_stock_threshold`.

3. THE InventoryController SHALL NOT change the route path or HTTP method for `GET /api/v1/inventory/:productId`, preserving frontend compatibility.

---

### Requirement 16 — Advisory Locks for Background Jobs

**User Story:** As a platform operator, I want background jobs to acquire PostgreSQL advisory locks before executing so that running multiple API instances does not cause the same payment to be processed or expired by two workers simultaneously.

#### Acceptance Criteria

1. WHEN the BlockchainMonitorJob cycle begins, THE BlockchainMonitorJob SHALL attempt to acquire a PostgreSQL transaction-level advisory lock using a fixed numeric key before querying for pending payments, and SHALL skip the cycle without error if the lock cannot be acquired.

2. WHEN the PaymentExpiryJob cycle begins, THE PaymentExpiryJob SHALL attempt to acquire a PostgreSQL transaction-level advisory lock using a different fixed numeric key from the BlockchainMonitorJob, and SHALL skip the cycle without error if the lock cannot be acquired.

3. WHEN a job holds an advisory lock and the database query completes or fails, THE job SHALL release the lock before the next scheduled cycle begins, ensuring the lock is never held across cycles.

4. IF acquiring the advisory lock raises a database error (not a lock-contention failure), THEN THE job SHALL log a structured error and skip the cycle, and SHALL NOT crash the process.

---

### Requirement 17 — Payment Reconciliation

**User Story:** As a platform operator, I want a reconciliation check to detect any confirmed blockchain transactions that are not reflected in the orders table so that no revenue is silently lost due to a missed state transition.

#### Acceptance Criteria

1. THE API SHALL expose a `GET /api/v1/admin/reconciliation` endpoint accessible only to users with `payments.read` permission that queries for `blockchain_transactions` rows with `status = 'CONFIRMED'` and `credited = true` whose associated `payments` row does not have `status = 'CONFIRMED'`, returning each discrepancy as an item in the response.

2. WHEN the reconciliation endpoint finds discrepancies, THE API SHALL return the list with HTTP 200 and SHALL NOT auto-correct any records, preserving the discrepancy for manual review.

3. THE reconciliation endpoint SHALL also detect `orders` with `status = 'PAID'` whose associated `payments` table has no row with `status = 'CONFIRMED'`, reporting these as orphan-paid orders.

---

### Requirement 18 — Structured Logging

**User Story:** As a platform operator, I want all application log output to be structured JSON so that log aggregation tools can parse, filter, and alert on log data without brittle string matching.

#### Acceptance Criteria

1. THE API SHALL replace all `console.log`, `console.error`, and `console.warn` calls with a structured logger that emits JSON objects containing at minimum: `level` (one of `info`, `warn`, `error`), `timestamp` (ISO 8601), `requestId` (when available in context), and `message`.

2. WHEN an unhandled error occurs in a background job, THE job SHALL emit a structured log entry at `error` level including `jobName`, `errorMessage`, and `stack` fields.

3. WHEN a payment state transition occurs (detected, confirming, confirmed, expired, underpaid, overpaid), THE CryptoService SHALL emit a structured log entry at `info` level including `paymentId`, `orderId`, `event`, `previousStatus`, and `newStatus`.

4. WHERE the environment variable `LOG_LEVEL` is set, THE structured logger SHALL filter out log entries below the configured level, supporting values `debug`, `info`, `warn`, and `error`.

---

### Requirement 19 — Audit Log Coverage

**User Story:** As a platform operator, I want security-sensitive actions to be written to the audit log with sufficient context so that any disputed action can be traced back to an actor, time, and request.

#### Acceptance Criteria

1. WHEN a user successfully logs in or logs out, THE AuthService SHALL write an audit log entry with `action` set to `'USER_LOGIN'` or `'USER_LOGOUT'`, `entity` set to `'users'`, `entityId` set to the `user_id`, and `ipAddress` populated from the request context.

2. WHEN a PaymentIntent transitions to `CONFIRMED`, `CANCELLED`, `UNDERPAID`, or `OVERPAID`, THE CryptoService SHALL write an audit log entry with `action` set to the transition event name, `entity` set to `'payments'`, `entityId` set to the `paymentId`, and `before` / `after` status values.

3. WHEN an admin calls `PATCH /api/v1/orders/:id/status`, THE OrderController SHALL write an audit log entry with the actor's `user_id`, previous status, and new status.

4. WHEN `InventoryService.adjust` is called by an admin, THE InventoryService SHALL write an audit log entry with `actor_id`, `productId`, `delta`, `note`, `before` quantity, and `after` quantity.

5. THE AuditService.log function SHALL be called with a `requestId` field populated from the StreetJS request context on every write, enabling correlation of audit entries to HTTP requests.

---

### Requirement 20 — Build Integrity and Migration Numbering

**User Story:** As a developer, I want every phase of the hardening work to leave the TypeScript build in a passing state so that the application can be deployed incrementally without introducing compile-time regressions.

#### Acceptance Criteria

1. THE API SHALL compile without TypeScript errors after each phase of changes is applied, verified by `npm run build` completing with exit code 0.

2. ALL new database migrations SHALL be numbered 003 or higher and SHALL follow the existing naming convention `NNN_description.sql`.

3. EACH migration file SHALL be idempotent using `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, or equivalent guards so that re-running a migration on an already-updated database does not produce an error.

4. THE API SHALL preserve all 54 existing routes — no route path, HTTP method, or authentication requirement SHALL be removed or changed in a way that breaks existing frontend API calls.

5. WHEN a migration alters a column type (e.g. `crypto_amount` from `NUMERIC(36,18)` to `NUMERIC(36,0)`), THE migration SHALL include a `USING` cast clause compatible with existing data to prevent migration failure on a populated database.

---

### Requirement 21 — Test Coverage

**User Story:** As a developer, I want automated tests for the critical hardening changes so that regressions are detected before deployment.

#### Acceptance Criteria

1. THE test suite SHALL include unit tests for `AuthService.verifyPassword` that assert constant-time comparison is used and that a password mismatch returns `false` without throwing.

2. THE test suite SHALL include a concurrency integration test for `CheckoutService.createOrder` that asserts two simultaneous checkout requests for the last unit of a product result in exactly one successful order and one `'Insufficient stock'` error.

3. THE test suite SHALL include a unit test for `CryptoService.processDetectedTransaction` that asserts calling the function twice with the same `(network, transaction_hash)` does not insert a second `blockchain_transactions` row and does not update `orders.status` a second time.

4. THE test suite SHALL include a unit test for `InventoryService.adjust` that asserts a call with a `delta` that would produce a negative `quantity_on_hand` throws an error and does not modify the database row.

5. THE test suite SHALL include an integration test for the BlockchainMonitorJob that asserts the job skips all processing when the advisory lock cannot be acquired (simulated by holding the lock on a second connection).

6. THE test suite SHALL include an end-to-end test for the full crypto payment flow: create order → create payment intent → simulate confirmed transaction → assert `orders.status = 'PAID'` and `payments.status = 'CONFIRMED'`.

7. THE test suite SHALL include a test asserting that `GET /api/v1/inventory/:productId` for an unauthenticated caller does not contain `quantity_on_hand`, `quantity_reserved`, or `low_stock_threshold` fields in the response body.
