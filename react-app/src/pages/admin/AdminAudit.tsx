import { useState } from 'react';
import { useAdminFetch } from './useAdminFetch';

interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
}

interface AuditResult {
  items: AuditEntry[];
  total: number;
}

function fmt(val: unknown): string {
  if (val == null) return '—';
  try { return JSON.stringify(val, null, 2); }
  catch { return String(val); }
}

export default function AdminAudit() {
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = [`page=${page}`, `limit=25`, entityFilter ? `entity=${entityFilter}` : '']
    .filter(Boolean).join('&');

  const { data, loading, error } = useAdminFetch<AuditResult>(
    `/api/v1/admin/audit?${query}`,
    [page, entityFilter],
  );

  const ENTITIES = ['users', 'orders', 'payments', 'inventory', 'coupons', 'system_settings'];
  const entries = data?.items ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / 25);

  return (
    <div>
      <div className="admin-page-header">
        <h2>Audit Log</h2>
        <span style={{ color: '#888', fontSize: 13 }}>{data?.total ?? 0} entries</span>
      </div>

      <div className="admin-filters">
        <select className="admin-select" value={entityFilter}
          onChange={e => { setEntityFilter(e.target.value); setPage(1); }}>
          <option value="">All Entities</option>
          {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="admin-card">
        {loading && <div className="loading-state"><span className="spinner" /></div>}
        {error   && <div className="notice notice-error" style={{ margin: 16 }}>{error}</div>}
        {!loading && !error && entries.length === 0 && (
          <div className="admin-empty">
            <span className="admin-empty-icon">🔍</span>No audit entries found.
          </div>
        )}
        {!loading && entries.length > 0 && (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Entity ID</th>
                    <th>Actor</th>
                    <th></th>
                  </tr>
                </thead>
                {entries.map(e => (
                  <tbody key={e.id}>
                    <tr style={{ cursor: 'pointer' }}
                        onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                      <td className="mono" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                      <td>
                        <code style={{ fontSize: 12, color: '#242424', background: '#f0f2f5', padding: '2px 6px', borderRadius: 3 }}>
                          {e.action}
                        </code>
                      </td>
                      <td>
                        <span className="abadge abadge-processing" style={{ fontSize: 10 }}>{e.entity}</span>
                      </td>
                      <td className="mono" style={{ fontSize: 11 }}>
                        {e.entity_id ? e.entity_id.slice(0, 8) + '…' : '—'}
                      </td>
                      <td className="mono" style={{ fontSize: 11 }}>
                        {e.actor_id ? e.actor_id.slice(0, 8) + '…' : 'system'}
                      </td>
                      <td>
                        {(e.before != null || e.after != null) && (
                          <button className="admin-btn admin-btn-ghost" style={{ fontSize: 11 }}>
                            {expanded === e.id ? 'Hide ▲' : 'Details ▼'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === e.id && (
                      <tr style={{ background: '#f8f9fb' }}>
                        <td colSpan={6} style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase' }}>Before</p>
                              <pre style={{ fontSize: 12, color: '#555', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, background: '#fff', border: '1px solid #eef0f4', borderRadius: 4, padding: 10 }}>
                                {fmt(e.before)}
                              </pre>
                            </div>
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase' }}>After</p>
                              <pre style={{ fontSize: 12, color: '#198754', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, background: '#fff', border: '1px solid #eef0f4', borderRadius: 4, padding: 10 }}>
                                {fmt(e.after)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                ))}
              </table>
            </div>

            {totalPages > 1 && (
              <div className="admin-pagination">
                <button className="admin-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(n => (
                  <button key={n} className={`admin-page-btn${n === page ? ' active' : ''}`}
                    onClick={() => setPage(n)}>{n}</button>
                ))}
                <button className="admin-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
