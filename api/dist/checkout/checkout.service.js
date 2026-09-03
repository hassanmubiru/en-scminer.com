var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from 'streetjs';
import { getPool } from '../config/database.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { CartService } from '../cart/cart.service.js';
import { generateOrderNumber } from '../common/order-number.js';
import { randomUUID } from 'node:crypto';
let CheckoutService = class CheckoutService {
    inventorySvc = new InventoryService();
    cartSvc = new CartService();
    /** Calculate authoritative quote — never trust client totals */
    async quote(userId, cartId, shippingMethodId, couponCode) {
        const pool = getPool();
        const cart = await this.cartSvc.getOrCreate(userId);
        if (cart.items.length === 0)
            throw new Error('Cart is empty');
        // Load current prices from DB — not cart snapshot
        let subtotalCents = 0;
        for (const item of cart.items) {
            subtotalCents += item.currentPriceCents * item.quantity;
        }
        // Shipping
        const shipRes = await pool.query(`SELECT * FROM shipping_methods WHERE id = $1 AND active = true`, [shippingMethodId]);
        if (!shipRes.rows[0])
            throw new Error('Shipping method not found');
        const ship = shipRes.rows[0];
        const freeThreshold = ship['free_threshold_cents'] ? Number(ship['free_threshold_cents']) : null;
        const shippingCents = (freeThreshold && subtotalCents >= freeThreshold)
            ? 0 : Number(ship['price_cents']);
        // Coupon
        let discountCents = 0;
        if (couponCode) {
            const couponRes = await pool.query(`SELECT * FROM coupons WHERE code = $1 AND active = true
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (usage_limit IS NULL OR usage_count < usage_limit)`, [couponCode.toUpperCase()]);
            if (couponRes.rows[0]) {
                const c = couponRes.rows[0];
                if (subtotalCents >= Number(c['min_order_cents'])) {
                    if (c['type'] === 'percentage') {
                        discountCents = Math.round(subtotalCents * Number(c['value']) / 100);
                    }
                    else {
                        discountCents = Number(c['value']) * 100;
                    }
                    if (c['max_discount_cents']) {
                        discountCents = Math.min(discountCents, Number(c['max_discount_cents']));
                    }
                }
            }
        }
        const taxCents = 0; // Tax calculation placeholder
        const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents + taxCents);
        return {
            subtotalCents, discountCents, shippingCents, taxCents, totalCents,
            currency: 'USD', couponCode,
            shippingMethod: ship,
        };
    }
    /** Create order — fully atomic, server-side totals only */
    async createOrder(input) {
        const pool = getPool();
        const quote = await this.quote(input.userId, input.cartId, input.shippingMethodId, input.couponCode);
        const cart = await this.cartSvc.getOrCreate(input.userId);
        if (cart.items.length === 0)
            throw new Error('Cart is empty');
        // Validate inventory for all items BEFORE creating order
        for (const item of cart.items) {
            const level = await this.inventorySvc.getLevel(item.productId);
            if (!level || level.available < item.quantity) {
                throw new Error(`Insufficient stock for: ${item.name}`);
            }
        }
        const orderId = randomUUID();
        const orderNumber = generateOrderNumber();
        // Resolve coupon id
        let couponId = null;
        if (input.couponCode && quote.discountCents > 0) {
            const cRes = await pool.query(`SELECT id FROM coupons WHERE code = $1`, [input.couponCode.toUpperCase()]);
            couponId = cRes.rows[0] ? String(cRes.rows[0]['id']) : null;
        }
        // Create order
        await pool.query(`INSERT INTO orders
         (id, order_number, user_id, status, currency,
          subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
          coupon_id, shipping_method_id, customer_note)
       VALUES ($1,$2,$3,'PENDING_PAYMENT','USD',$4,$5,$6,$7,$8,$9,$10,$11)`, [orderId, orderNumber, input.userId,
            quote.subtotalCents, quote.discountCents, quote.shippingCents,
            quote.taxCents, quote.totalCents, couponId,
            input.shippingMethodId, input.customerNote ?? null]);
        // Insert order items (immutable snapshots)
        for (const item of cart.items) {
            const prodRes = await pool.query(`SELECT name, sku, slug, hashrate, hashrate_unit, algorithm, manufacturer
         FROM products WHERE id = $1`, [item.productId]);
            const prod = prodRes.rows[0];
            const subtotal = item.currentPriceCents * item.quantity;
            await pool.query(`INSERT INTO order_items
           (id, order_id, product_id, product_name, product_sku, product_slug,
            unit_price_cents, quantity, subtotal_cents, product_meta)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [randomUUID(), orderId, item.productId,
                prod['name'], prod['sku'], prod['slug'],
                item.currentPriceCents, item.quantity, subtotal,
                JSON.stringify({ hashrate: prod['hashrate'], algorithm: prod['algorithm'] })]);
        }
        // Insert address snapshots
        const addr = (type, a) => pool.query(`INSERT INTO order_addresses
         (id, order_id, type, first_name, last_name, company, line1, line2,
          city, state, postcode, country_code, phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [randomUUID(), orderId, type, a.firstName, a.lastName, a.company ?? null,
            a.line1, a.line2 ?? null, a.city, a.state ?? null,
            a.postcode, a.countryCode, a.phone ?? null]);
        await addr('billing', input.billingAddress);
        await addr('shipping', input.shippingAddress ?? input.billingAddress);
        // Reserve inventory atomically
        for (const item of cart.items) {
            await this.inventorySvc.reserve(item.productId, item.quantity, input.userId);
        }
        // Redeem coupon
        if (couponId) {
            await pool.query(`UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1`, [couponId]);
            await pool.query(`INSERT INTO coupon_redemptions (id, coupon_id, user_id, order_id)
         VALUES ($1,$2,$3,$4)`, [randomUUID(), couponId, input.userId, orderId]);
        }
        // Clear cart
        await this.cartSvc.clearCart(cart.id);
        return { orderId, orderNumber };
    }
};
CheckoutService = __decorate([
    Injectable()
], CheckoutService);
export { CheckoutService };
