var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from 'streetjs';
import { randomUUID } from 'node:crypto';
import { getPool } from '../config/database.js';
let InventoryService = class InventoryService {
    async reserve(productId, quantity, actorId) {
        const pool = getPool();
        const result = await pool.query(`UPDATE inventory
       SET quantity_reserved = quantity_reserved + $1, updated_at = NOW()
       WHERE product_id = $2
         AND (quantity_on_hand - quantity_reserved) >= $1
       RETURNING id`, [quantity, productId]);
        if (result.rows.length === 0) {
            throw new Error(`Insufficient stock for product ${productId}`);
        }
        await this.recordMovement(productId, 'RESERVATION', -quantity, undefined, undefined, actorId);
    }
    async release(productId, quantity, referenceId, actorId) {
        const pool = getPool();
        await pool.query(`UPDATE inventory
       SET quantity_reserved = GREATEST(0, quantity_reserved - $1), updated_at = NOW()
       WHERE product_id = $2`, [quantity, productId]);
        await this.recordMovement(productId, 'RELEASE', quantity, referenceId, undefined, actorId);
    }
    async deductSale(productId, quantity, orderId, actorId) {
        const pool = getPool();
        await pool.query(`UPDATE inventory
       SET quantity_on_hand    = quantity_on_hand - $1,
           quantity_reserved   = GREATEST(0, quantity_reserved - $1),
           updated_at          = NOW()
       WHERE product_id = $2`, [quantity, productId]);
        await this.recordMovement(productId, 'SALE', -quantity, orderId, undefined, actorId);
    }
    async adjust(productId, delta, note, actorId) {
        const pool = getPool();
        await pool.query(`UPDATE inventory
       SET quantity_on_hand = GREATEST(0, quantity_on_hand + $1), updated_at = NOW()
       WHERE product_id = $2`, [delta, productId]);
        await this.recordMovement(productId, 'ADJUSTMENT', delta, undefined, note, actorId);
    }
    async getLevel(productId) {
        const pool = getPool();
        const res = await pool.query(`SELECT quantity_on_hand, quantity_reserved,
              (quantity_on_hand - quantity_reserved) AS available
       FROM inventory WHERE product_id = $1`, [productId]);
        if (!res.rows[0])
            return null;
        const r = res.rows[0];
        const available = Number(r['available']);
        return {
            onHand: Number(r['quantity_on_hand']),
            reserved: Number(r['quantity_reserved']),
            available,
            inStock: available > 0,
        };
    }
    async getMovements(productId, page = 1, limit = 20) {
        const pool = getPool();
        const offset = (page - 1) * limit;
        const res = await pool.query(`SELECT type, quantity_delta, reference_id, note, created_at
       FROM inventory_movements WHERE product_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [productId, limit, offset]);
        return res.rows;
    }
    async recordMovement(productId, type, delta, referenceId, note, actorId) {
        const pool = getPool();
        await pool.query(`INSERT INTO inventory_movements (id, product_id, type, quantity_delta, reference_id, note, actor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`, [randomUUID(), productId, type, delta, referenceId ?? null, note ?? null, actorId ?? null]);
    }
};
InventoryService = __decorate([
    Injectable()
], InventoryService);
export { InventoryService };
