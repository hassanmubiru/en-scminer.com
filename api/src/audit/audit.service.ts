import { Injectable } from 'streetjs';
import { randomUUID } from 'node:crypto';
import { getPool } from '../config/database.js';

@Injectable()
export class AuditService {
  async log(entry: {
    actorId?: string;
    action: string;
    entity: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    requestId?: string;
    ipAddress?: string;
  }): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO audit_logs (id, actor_id, action, entity, entity_id, before, after, request_id, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        randomUUID(),
        entry.actorId ?? null,
        entry.action,
        entry.entity,
        entry.entityId ?? null,
        entry.before ? JSON.stringify(entry.before) : null,
        entry.after  ? JSON.stringify(entry.after)  : null,
        entry.requestId  ?? null,
        entry.ipAddress  ?? null,
      ],
    );
  }

  async query(filters: {
    entity?: string;
    actorId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: unknown[]; total: number }> {
    const pool = getPool();
    const page   = Math.max(1, filters.page  ?? 1);
    const limit  = Math.min(100, filters.limit ?? 20);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (filters.entity)  { conditions.push(`entity = $${p}`);   params.push(filters.entity);  p++; }
    if (filters.actorId) { conditions.push(`actor_id = $${p}`); params.push(filters.actorId); p++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT id, actor_id, action, entity, entity_id, request_id, ip_address, created_at
         FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${p} OFFSET $${p+1}`,
        [...params, limit, offset],
      ),
      pool.query(`SELECT COUNT(*) AS total FROM audit_logs ${where}`, params),
    ]);

    return {
      items: dataRes.rows,
      total: Number((countRes.rows[0] as Record<string,unknown>)['total'] ?? 0),
    };
  }
}
