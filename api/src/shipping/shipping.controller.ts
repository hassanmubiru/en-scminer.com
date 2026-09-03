import { Controller, Get, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { getPool } from '../config/database.js';

@Controller('/api/v1/shipping')
export class ShippingController {

  @Get('/methods')
  @ApiOperation({ summary: 'List available shipping methods', tags: ['shipping'] })
  async list(ctx: StreetContext): Promise<void> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, name, carrier, estimated_days_min, estimated_days_max,
              price_cents, free_threshold_cents
       FROM shipping_methods WHERE active = true ORDER BY price_cents`,
    );
    ctx.json({
      items: res.rows.map(r => {
        const row = r as Record<string, unknown>;
        return {
          ...row,
          price: Number(row['price_cents']) / 100,
          freeThreshold: row['free_threshold_cents'] ? Number(row['free_threshold_cents']) / 100 : null,
        };
      }),
    });
  }
}
