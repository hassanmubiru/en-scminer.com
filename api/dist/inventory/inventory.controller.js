var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Get, Post, ApiOperation } from 'streetjs';
import { InventoryService } from './inventory.service.js';
import { getUser } from '../middleware/auth.middleware.js';
let InventoryController = class InventoryController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    async getLevel(ctx) {
        const level = await this.svc.getLevel(ctx.params['productId'] ?? '');
        if (!level) {
            ctx.json({ error: { code: 'NOT_FOUND', message: 'Inventory record not found' } }, 404);
            return;
        }
        ctx.json(level);
    }
    async movements(ctx) {
        const user = getUser(ctx);
        if (!user?.roles.some(r => ['admin', 'super_admin', 'staff'].includes(r))) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403);
            return;
        }
        const q = ctx.query;
        const items = await this.svc.getMovements(ctx.params['productId'] ?? '', Number(q['page'] ?? 1), Number(q['limit'] ?? 20));
        ctx.json({ items });
    }
    async adjust(ctx) {
        const user = getUser(ctx);
        if (!user?.roles.some(r => ['admin', 'super_admin'].includes(r))) {
            ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403);
            return;
        }
        const body = ctx.body;
        if (!body || body['delta'] == null) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'delta required' } }, 400);
            return;
        }
        await this.svc.adjust(ctx.params['productId'] ?? '', Number(body['delta']), String(body['note'] ?? 'Manual adjustment'), user.id);
        ctx.json({ success: true });
    }
};
__decorate([
    Get('/:productId'),
    ApiOperation({ summary: 'Get inventory level for a product', tags: ['inventory'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getLevel", null);
__decorate([
    Get('/:productId/movements'),
    ApiOperation({ summary: '[Admin] Get inventory movements', tags: ['inventory'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "movements", null);
__decorate([
    Post('/:productId/adjust'),
    ApiOperation({ summary: '[Admin] Manual inventory adjustment', tags: ['inventory'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "adjust", null);
InventoryController = __decorate([
    Controller('/api/v1/inventory'),
    __metadata("design:paramtypes", [InventoryService])
], InventoryController);
export { InventoryController };
