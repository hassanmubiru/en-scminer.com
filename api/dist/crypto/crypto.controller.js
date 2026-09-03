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
import { CryptoService } from './crypto.service.js';
import { getUser } from '../middleware/auth.middleware.js';
let CryptoController = class CryptoController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    async assets(ctx) {
        const items = await this.svc.getSupportedAssets();
        ctx.json({ items });
    }
    async createIntent(ctx) {
        const user = getUser(ctx);
        if (!user) {
            ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401);
            return;
        }
        const body = ctx.body;
        if (!body?.['orderId'] || !body?.['assetId']) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'orderId and assetId required' } }, 400);
            return;
        }
        try {
            const intent = await this.svc.createPaymentIntent(String(body['orderId']), String(body['assetId']), user.id);
            ctx.json(intent, 201);
        }
        catch (err) {
            ctx.json({ error: { code: 'INTENT_FAILED', message: err instanceof Error ? err.message : 'Failed' } }, 400);
        }
    }
    async getIntent(ctx) {
        const user = getUser(ctx);
        if (!user) {
            ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401);
            return;
        }
        try {
            const payment = await this.svc.getPaymentStatus(ctx.params['id'] ?? '', user.id);
            ctx.json(payment);
        }
        catch {
            ctx.json({ error: { code: 'NOT_FOUND', message: 'Payment intent not found' } }, 404);
        }
    }
    async pollStatus(ctx) {
        const user = getUser(ctx);
        if (!user) {
            ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401);
            return;
        }
        try {
            const payment = await this.svc.getPaymentStatus(ctx.params['id'] ?? '', user.id);
            ctx.json({
                id: payment['id'],
                status: payment['status'],
                confirmedAt: payment['status'] === 'CONFIRMED' ? payment['updated_at'] : null,
                isExpired: payment['isExpired'],
            });
        }
        catch {
            ctx.json({ error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
        }
    }
};
__decorate([
    Get('/assets'),
    ApiOperation({ summary: 'List supported crypto assets', tags: ['crypto'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CryptoController.prototype, "assets", null);
__decorate([
    Post('/payment-intents'),
    ApiOperation({ summary: 'Create crypto payment intent for an order', tags: ['crypto'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CryptoController.prototype, "createIntent", null);
__decorate([
    Get('/payment-intents/:id'),
    ApiOperation({ summary: 'Get crypto payment intent details', tags: ['crypto'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CryptoController.prototype, "getIntent", null);
__decorate([
    Get('/payment-intents/:id/status'),
    ApiOperation({ summary: 'Poll crypto payment status (for frontend polling)', tags: ['crypto'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CryptoController.prototype, "pollStatus", null);
CryptoController = __decorate([
    Controller('/api/v1/crypto'),
    __metadata("design:paramtypes", [CryptoService])
], CryptoController);
export { CryptoController };
