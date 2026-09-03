import { Controller, Get, ApiOperation } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { getPool } from './config/database.js';

@Controller('/health')
export class HealthController {

  @Get('/')
  @ApiOperation({ summary: 'Liveness check', tags: ['system'] })
  async live(ctx: StreetContext): Promise<void> {
    ctx.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
  }

  @Get('/ready')
  @ApiOperation({ summary: 'Readiness check — verifies database connection', tags: ['system'] })
  async ready(ctx: StreetContext): Promise<void> {
    try {
      const pool = getPool();
      await pool.query('SELECT 1');
      ctx.json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
    } catch (err) {
      ctx.json({
        status: 'not_ready',
        database: 'disconnected',
        error: err instanceof Error ? err.message : String(err),
      }, 503);
    }
  }
}
