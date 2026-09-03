var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from 'streetjs';
import { randomUUID } from 'node:crypto';
import { getPool } from '../config/database.js';
let CartService = class CartService {
    async getOrCreate(userId, sessionId) {
        const pool = getPool();
        let cartId = null;
        if (userId) {
            const res = await pool.query(`SELECT id FROM carts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [userId]);
            cartId = res.rows[0] ? String(res.rows[0]['id']) : null;
        }
        else if (sessionId) {
            const res = await pool.query(`SELECT id FROM carts WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`, [sessionId]);
            cartId = res.rows[0] ? String(res.rows[0]['id']) : null;
        }
        if (!cartId) {
            cartId = randomUUID();
            await pool.query(`INSERT INTO carts (id, user_id, session_id) VALUES ($1,$2,$3)`, [cartId, userId ?? null, sessionId ?? null]);
        }
        return this.loadCart(cartId);
    }
    async addItem(cartId, productId, quantity) {
        const pool = getPool();
        // Get current price from products table — never trust client price
        const productRes = await pool.query(`SELECT price_cents, status FROM products WHERE id = $1`, [productId]);
        if (!productRes.rows[0])
            throw new Error('Product not found');
        const prod = productRes.rows[0];
        if (prod['status'] !== 'active')
            throw new Error('Product not available');
        const priceCents = Number(prod['price_cents']);
        // Upsert cart item
        await pool.query(`INSERT INTO cart_items (id, cart_id, product_id, quantity, unit_price_snapshot_cents)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (cart_id, product_id) DO UPDATE
       SET quantity = cart_items.quantity + EXCLUDED.quantity,
           unit_price_snapshot_cents = EXCLUDED.unit_price_snapshot_cents,
           updated_at = NOW()`, [randomUUID(), cartId, productId, quantity, priceCents]);
        await pool.query(`UPDATE carts SET updated_at = NOW() WHERE id = $1`, [cartId]);
        return this.loadCart(cartId);
    }
    async updateItem(cartId, itemId, quantity) {
        const pool = getPool();
        if (quantity <= 0) {
            await pool.query(`DELETE FROM cart_items WHERE id = $1 AND cart_id = $2`, [itemId, cartId]);
        }
        else {
            await pool.query(`UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2 AND cart_id = $3`, [quantity, itemId, cartId]);
        }
        await pool.query(`UPDATE carts SET updated_at = NOW() WHERE id = $1`, [cartId]);
        return this.loadCart(cartId);
    }
    async removeItem(cartId, itemId) {
        const pool = getPool();
        await pool.query(`DELETE FROM cart_items WHERE id = $1 AND cart_id = $2`, [itemId, cartId]);
        return this.loadCart(cartId);
    }
    async clearCart(cartId) {
        const pool = getPool();
        await pool.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);
    }
    /** Merge guest cart into authenticated cart on login */
    async mergeGuestCart(guestSessionId, userId) {
        const pool = getPool();
        const guestRes = await pool.query(`SELECT id FROM carts WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`, [guestSessionId]);
        if (!guestRes.rows[0])
            return;
        const guestCartId = String(guestRes.rows[0]['id']);
        const authCart = await this.getOrCreate(userId);
        const guestCart = await this.loadCart(guestCartId);
        for (const item of guestCart.items) {
            await this.addItem(authCart.id, item.productId, item.quantity);
        }
        await pool.query(`DELETE FROM carts WHERE id = $1`, [guestCartId]);
    }
    async loadCart(cartId) {
        const pool = getPool();
        const cartRes = await pool.query(`SELECT currency FROM carts WHERE id = $1`, [cartId]);
        const currency = cartRes.rows[0] ? String(cartRes.rows[0]['currency']) : 'USD';
        const itemsRes = await pool.query(`SELECT ci.id, ci.product_id, ci.quantity, ci.unit_price_snapshot_cents,
              p.name, p.slug, p.price_cents AS current_price_cents,
              pi.url AS image
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN LATERAL (
         SELECT url FROM product_images WHERE product_id = p.id
         ORDER BY is_primary DESC, sort_order LIMIT 1
       ) pi ON true
       WHERE ci.cart_id = $1
       ORDER BY ci.created_at`, [cartId]);
        const items = itemsRes.rows.map((r) => {
            const row = r;
            return {
                id: String(row['id']),
                productId: String(row['product_id']),
                quantity: Number(row['quantity']),
                unitPriceSnapshotCents: Number(row['unit_price_snapshot_cents']),
                currentPriceCents: Number(row['current_price_cents']),
                name: String(row['name']),
                slug: String(row['slug']),
                image: row['image'] ? String(row['image']) : null,
            };
        });
        const subtotalCents = items.reduce((sum, i) => sum + i.currentPriceCents * i.quantity, 0);
        return {
            id: cartId,
            currency,
            items,
            subtotalCents,
            itemCount: items.reduce((s, i) => s + i.quantity, 0),
        };
    }
};
CartService = __decorate([
    Injectable()
], CartService);
export { CartService };
