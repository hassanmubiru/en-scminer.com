import { Controller, Get, Post, Patch, ApiOperation, Injectable } from 'streetjs';
import type { StreetContext } from 'streetjs';
import { getPool } from '../config/database.js';
import { getUser } from '../middleware/auth.middleware.js';
import { randomUUID } from 'node:crypto';

@Controller('/api/v1/contact')
export class ContactController {

  @Post('/')
  @ApiOperation({ summary: 'Submit a contact message', tags: ['contact'] })
  async submit(ctx: StreetContext): Promise<void> {
    const b = ctx.body as Record<string, unknown> | null;
    if (!b?.['name'] || !b?.['email'] || !b?.['subject'] || !b?.['message']) {
      ctx.json({ error: { code: 'INVALID_BODY', message: 'name, email, subject, message required' } }, 400); return;
    }

    const email = String(b['email']);
    if (!email.includes('@')) {
      ctx.json({ error: { code: 'INVALID_EMAIL', message: 'Valid email address required' } }, 400); return;
    }

    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO contact_messages (id, name, email, phone, company, subject, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, b['name'], email, b['phone'] ?? null, b['company'] ?? null, b['subject'], b['message']],
    );
    ctx.json({ id, message: 'Your message has been received. We will respond within 24 hours.' }, 201);
  }

  @Get('/')
  @ApiOperation({ summary: '[Admin] List contact messages', tags: ['contact'] })
  async list(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user?.roles.some(r => ['admin','super_admin','staff'].includes(r))) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403); return;
    }
    const pool = getPool();
    const q = ctx.query as Record<string, string | undefined>;
    const page  = Math.max(1, Number(q['page']  ?? 1));
    const limit = Math.min(100, Number(q['limit'] ?? 20));
    const offset = (page - 1) * limit;
    const status = q['status'];

    const where = status ? `WHERE status = $3` : '';
    const params: unknown[] = status ? [limit, offset, status] : [limit, offset];

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT * FROM contact_messages ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, params),
      pool.query(`SELECT COUNT(*) AS total FROM contact_messages ${where}`, status ? [status] : []),
    ]);
    ctx.json({
      items: dataRes.rows,
      total: Number((countRes.rows[0] as Record<string,unknown>)['total'] ?? 0),
      page, limit,
    });
  }

  @Patch('/:id/status')
  @ApiOperation({ summary: '[Admin] Update message status', tags: ['contact'] })
  async updateStatus(ctx: StreetContext): Promise<void> {
    const user = getUser(ctx);
    if (!user?.roles.some(r => ['admin','super_admin','staff'].includes(r))) {
      ctx.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403); return;
    }
    const b = ctx.body as Record<string, unknown> | null;
    const status = String(b?.['status'] ?? '');
    if (!['NEW','IN_PROGRESS','RESOLVED','SPAM'].includes(status)) {
      ctx.json({ error: { code: 'INVALID_STATUS', message: 'Invalid status value' } }, 400); return;
    }
    const pool = getPool();
    await pool.query(
      `UPDATE contact_messages SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, ctx.params['id']],
    );
    ctx.json({ success: true });
  }
}
