var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Post, ApiOperation } from 'streetjs';
import { CheckoutService } from './checkout.service.js';
import { CartService } from '../cart/cart.service.js';
import { getUser } from '../middleware/auth.middleware.js';
let CheckoutController = class CheckoutController {
    svc;
    cartSvc;
    constructor(svc, cartSvc) {
        this.svc = svc;
        this.cartSvc = cartSvc;
    }
    async quote(ctx) {
        const user = getUser(ctx);
        if (!user) {
            ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401);
            return;
        }
        const body = ctx.body;
        if (!body?.['shippingMethodId']) {
            ctx.json({ error: { code: 'INVALID_BODY', message: 'shippingMethodId required' } }, 400);
            return;
        }
        try {
            const cart = await this.cartSvc.getOrCreate(user.id);
            const quote = await this.svc.quote(user.id, cart.id, String(body['shippingMethodId']), body['couponCode'] ? String(body['couponCode']) : undefined);
            ctx.json(quote);
        }
        catch (err) {
            ctx.json({ error: { code: 'QUOTE_FAILED', message: err instanceof Error ? err.message : 'Failed' } }, 400);
        }
    }
};
__decorate([
    Post('/quote'),
    ApiOperation({ summary: 'Get authoritative checkout quote (server-calculated totals)', tags: ['checkout'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CheckoutController.prototype, "quote", null);
CheckoutController = __decorate([
    Controller('/api/v1/checkout'),
    __metadata("design:paramtypes", [CheckoutService,
        CartService])
], CheckoutController);
export { CheckoutController };
