import { Controller, Get, Post, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { CryptoService } from './crypto.service.js';
import { getUser } from '../middleware/auth.middleware.js';

@Controller('/api/v1/crypto')
export class CryptoController {
  constructor(private readonly svc: CryptoService) {}

  @Get('/assets')
  @ApiOperation({ summary: 'List supported crypto assets', tags: ['crypto'] })
  async assets(ctx: StreetContext): Promise<void> {
    const items = await this.svc.getSupportedAssets();
    ctx.json({ items });
  }

  @Post('/payment-intents')
  @ApiOperation({ summary: 'Create crypto payment intent for an order', tags: ['crypto'] })
  async createIntent(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401); return; }

    const body = ctx.body as Record<string, unknown> | null;
    if (!body?.['orderId'] || !body?.['assetId']) {
      ctx.json({ error: { code: 'INVALID_BODY', message: 'orderId and assetId required' } }, 400); return;
    }

    try {
      const intent = await this.svc.createPaymentIntent(
        String(body['orderId']), String(body['assetId']), user.id,
      );
      ctx.json(intent, 201);
    } catch (err) {
      ctx.json({ error: { code: 'INTENT_FAILED', message: err instanceof Error ? err.message : 'Failed' } }, 400);
    }
  }

  @Get('/payment-intents/:id')
  @ApiOperation({ summary: 'Get crypto payment intent details', tags: ['crypto'] })
  async getIntent(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401); return; }

    try {
      const payment = await this.svc.getPaymentStatus(ctx.params['id'] ?? '', user.id);
      ctx.json(payment);
    } catch {
      ctx.json({ error: { code: 'NOT_FOUND', message: 'Payment intent not found' } }, 404);
    }
  }

  @Get('/payment-intents/:id/status')
  @ApiOperation({ summary: 'Poll crypto payment status (for frontend polling)', tags: ['crypto'] })
  async pollStatus(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user) { ctx.json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }, 401); return; }

    try {
      const payment = await this.svc.getPaymentStatus(ctx.params['id'] ?? '', user.id);
      ctx.json({
        id:     payment['id'],
        status: payment['status'],
        confirmedAt: payment['status'] === 'CONFIRMED' ? payment['updated_at'] : null,
        isExpired: payment['isExpired'],
      });
    } catch {
      ctx.json({ error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
    }
  }
}
