import { Controller, Get, Post, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { InventoryService } from './inventory.service.js';
import { getUser } from '../middleware/auth.middleware.js';

@Controller('/api/v1/inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('/:productId')
  @ApiOperation({ summary: 'Get inventory level for a product', tags: ['inventory'] })
  async getLevel(ctx: StreetContext): Promise<void> {
    const level = await this.svc.getLevel(ctx.params['productId'] ?? '');
    if (!level) { ctx.json({ error: { code: 'NOT_FOUND', message: 'Inventory record not found' } }, 404); return; }
    ctx.json(level);
  }

  @Get('/:productId/movements')
  @ApiOperation({ summary: '[Admin] Get inventory movements', tags: ['inventory'] })
  async movements(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user?.roles.some(r => ['admin','super_admin','staff'].includes(r))) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403); return;
    }
    const q = ctx.query as Record<string, string | undefined>;
    const items = await this.svc.getMovements(
      ctx.params['productId'] ?? '',
      Number(q['page'] ?? 1), Number(q['limit'] ?? 20),
    );
    ctx.json({ items });
  }

  @Post('/:productId/adjust')
  @ApiOperation({ summary: '[Admin] Manual inventory adjustment', tags: ['inventory'] })
  async adjust(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user?.roles.some(r => ['admin','super_admin'].includes(r))) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403); return;
    }
    const body = ctx.body as Record<string, unknown> | null;
    if (!body || body['delta'] == null) {
      ctx.json({ error: { code: 'INVALID_BODY', message: 'delta required' } }, 400); return;
    }
    await this.svc.adjust(
      ctx.params['productId'] ?? '',
      Number(body['delta']),
      String(body['note'] ?? 'Manual adjustment'),
      user.id,
    );
    ctx.json({ success: true });
  }
}
