var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Get, Post, Patch, Delete, ApiOperation } from 'streetjs';
import { CartService } from './cart.service.js';
import { getUser } from '../middleware/auth.middleware.js';
import { randomUUID } from 'node:crypto';
function getCartId(ctx) {
    const user = getUser(ctx);
    if (user)
        return { userId: user.id };
    const session = ctx.headers['x-session-id'] ?? randomUUID();
    return { sessionId: session };
}
let CartController = class CartController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    async get(ctx) {
        const { userId, sessionId } = getCartId(ctx);
        const cart = await this.svc.getOrCreate(userId, sessionId);
        ctx.json(cart);
    }
    async addItem(ctx) {
        const body = ctx.body;
        if (!body?.['productId']) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'productId required' } }, 400);
            return;
        }
        const { userId, sessionId } = getCartId(ctx);
        const cart = await this.svc.getOrCreate(userId, sessionId);
        try {
            const updated = await this.svc.addItem(cart.id, String(body['productId']), Number(body['quantity'] ?? 1));
            ctx.json(updated);
        }
        catch (err) {
            ctx.json({ error: { code: 'ADD_ITEM_FAILED', message: err instanceof Error ? err.message : 'Failed' } }, 400);
        }
    }
    async updateItem(ctx) {
        const body = ctx.body;
        if (body?.['quantity'] == null) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'quantity required' } }, 400);
            return;
        }
        const { userId, sessionId } = getCartId(ctx);
        const cart = await this.svc.getOrCreate(userId, sessionId);
        const updated = await this.svc.updateItem(cart.id, ctx.params['itemId'] ?? '', Number(body['quantity']));
        ctx.json(updated);
    }
    async removeItem(ctx) {
        const { userId, sessionId } = getCartId(ctx);
        const cart = await this.svc.getOrCreate(userId, sessionId);
        const updated = await this.svc.removeItem(cart.id, ctx.params['itemId'] ?? '');
        ctx.json(updated);
    }
    async clear(ctx) {
        const { userId, sessionId } = getCartId(ctx);
        const cart = await this.svc.getOrCreate(userId, sessionId);
        await this.svc.clearCart(cart.id);
        ctx.json({ success: true });
    }
};
__decorate([
    Get('/'),
    ApiOperation({ summary: 'Get current cart', tags: ['cart'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "get", null);
__decorate([
    Post('/items'),
    ApiOperation({ summary: 'Add item to cart', tags: ['cart'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "addItem", null);
__decorate([
    Patch('/items/:itemId'),
    ApiOperation({ summary: 'Update cart item quantity', tags: ['cart'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "updateItem", null);
__decorate([
    Delete('/items/:itemId'),
    ApiOperation({ summary: 'Remove item from cart', tags: ['cart'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "removeItem", null);
__decorate([
    Delete('/'),
    ApiOperation({ summary: 'Clear cart', tags: ['cart'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "clear", null);
CartController = __decorate([
    Controller('/api/v1/cart'),
    __metadata("design:paramtypes", [CartService])
], CartController);
export { CartController };
