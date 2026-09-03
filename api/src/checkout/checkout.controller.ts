import { Controller, Post, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { CheckoutService } from './checkout.service.js';
import { CartService } from '../cart/cart.service.js';
import { getUser } from '../middleware/auth.middleware.js';

@Controller('/api/v1/checkout')
export class CheckoutController {
  constructor(
    private readonly svc: CheckoutService,
    private readonly cartSvc: CartService,
  ) {}

  @Post('/quote')
  @ApiOperation({ summary: 'Get authoritative checkout quote (server-calculated totals)', tags: ['checkout'] })
  async quote(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401); return; }

    const body = ctx.body as Record<string, unknown> | null;
    if (!body?.['shippingMethodId']) {
      ctx.json({ error: { code: 'INVALID_BODY', message: 'shippingMethodId required' } }, 400); return;
    }
    try {
      const cart = await this.cartSvc.getOrCreate(user.id);
      const quote = await this.svc.quote(
        user.id, cart.id,
        String(body['shippingMethodId']),
        body['couponCode'] ? String(body['couponCode']) : undefined,
      );
      ctx.json(quote);
    } catch (err) {
      ctx.json({ error: { code: 'QUOTE_FAILED', message: err instanceof Error ? err.message : 'Failed' } }, 400);
    }
  }
}
