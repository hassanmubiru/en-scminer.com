import { Controller, Get, Post, Patch, Delete, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { CartService } from './cart.service.js';
import { getUser } from '../middleware/auth.middleware.js';
import { randomUUID } from 'node:crypto';

function getCartId(ctx: StreetContext): { userId?: string; sessionId?: string } {
  const user = getUser(ctx);
  if (user) return { userId: user.id };
  const session = ctx.headers['x-session-id'] ?? randomUUID();
  return { sessionId: session };
}

@Controller('/api/v1/cart')
export class CartController {
  constructor(private readonly svc: CartService) {}

  @Get('/')
  @ApiOperation({ summary: 'Get current cart', tags: ['cart'] })
  async get(ctx: StreetContext): Promise<void> {
    const { userId, sessionId } = getCartId(ctx);
    const cart = await this.svc.getOrCreate(userId, sessionId);
    ctx.json(cart);
  }

  @Post('/items')
  @ApiOperation({ summary: 'Add item to cart', tags: ['cart'] })
  async addItem(ctx: StreetContext): Promise<void> {
    const body = ctx.body as Record<string, unknown> | null;
    if (!body?.['productId']) {
      ctx.json({ error: { code: 'INVALID_BODY', message: 'productId required' } }, 400); return;
    }
    const { userId, sessionId } = getCartId(ctx);
    const cart = await this.svc.getOrCreate(userId, sessionId);
    try {
      const updated = await this.svc.addItem(
        cart.id, String(body['productId']), Number(body['quantity'] ?? 1),
      );
      ctx.json(updated);
    } catch (err) {
      ctx.json({ error: { code: 'ADD_ITEM_FAILED', message: err instanceof Error ? err.message : 'Failed' } }, 400);
    }
  }

  @Patch('/items/:itemId')
  @ApiOperation({ summary: 'Update cart item quantity', tags: ['cart'] })
  async updateItem(ctx: StreetContext): Promise<void> {
    const body = ctx.body as Record<string, unknown> | null;
    if (body?.['quantity'] == null) {
      ctx.json({ error: { code: 'INVALID_BODY', message: 'quantity required' } }, 400); return;
    }
    const { userId, sessionId } = getCartId(ctx);
    const cart = await this.svc.getOrCreate(userId, sessionId);
    const updated = await this.svc.updateItem(cart.id, ctx.params['itemId'] ?? '', Number(body['quantity']));
    ctx.json(updated);
  }

  @Delete('/items/:itemId')
  @ApiOperation({ summary: 'Remove item from cart', tags: ['cart'] })
  async removeItem(ctx: StreetContext): Promise<void> {
    const { userId, sessionId } = getCartId(ctx);
    const cart = await this.svc.getOrCreate(userId, sessionId);
    const updated = await this.svc.removeItem(cart.id, ctx.params['itemId'] ?? '');
    ctx.json(updated);
  }

  @Delete('/')
  @ApiOperation({ summary: 'Clear cart', tags: ['cart'] })
  async clear(ctx: StreetContext): Promise<void> {
    const { userId, sessionId } = getCartId(ctx);
    const cart = await this.svc.getOrCreate(userId, sessionId);
    await this.svc.clearCart(cart.id);
    ctx.json({ success: true });
  }
}
