var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Get, ApiOperation } from 'streetjs';
import { getPool } from '../config/database.js';
let ShippingController = class ShippingController {
    async list(ctx) {
        const pool = getPool();
        const res = await pool.query(`SELECT id, name, carrier, estimated_days_min, estimated_days_max,
              price_cents, free_threshold_cents
       FROM shipping_methods WHERE active = true ORDER BY price_cents`);
        ctx.json({
            items: res.rows.map(r => {
                const row = r;
                return {
                    ...row,
                    price: Number(row['price_cents']) / 100,
                    freeThreshold: row['free_threshold_cents'] ? Number(row['free_threshold_cents']) / 100 : null,
                };
            }),
        });
    }
};
__decorate([
    Get('/methods'),
    ApiOperation({ summary: 'List available shipping methods', tags: ['shipping'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "list", null);
ShippingController = __decorate([
    Controller('/api/v1/shipping')
], ShippingController);
export { ShippingController };
