import { useState } from 'react';
import { useAdminFetch, adminCall } from './useAdminFetch';

interface Customer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  company: string | null;
  status: string;
  created_at: string;
}

export default function AdminCustomers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState('');

  const { data, loading, error, reload } = useAdminFetch<{ items: Customer[]; total: number }>(
    `/api/v1/admin/customers?limit=20&page=${page}`,
    [page],
  );

  async function toggleStatus(id: string, current: string) {
    const next = current === 'active' ? 'suspended' : 'active';
    if (!confirm(`${next === 'suspended' ? 'Suspend' : 'Reactivate'} this account?`)) return;
    setUpdating(id);
    const { ok, message } = await adminCall('PATCH', `/api/v1/admin/customers/${id}/status`, { status: next });
    setUpdating('');
    if (ok) reload();
    else alert(message || 'Failed');
  }

  const customers = (data?.items ?? []).filter(c =>
    !search ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.first_name + ' ' + c.last_name).toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  return (
    <div>
      <div className="admin-page-header">
        <h2>Customers</h2>
        <span style={{ color: '#888', fontSize: 13 }}>{data?.total ?? 0} total</span>
      </div>

      <div className="admin-filters">
        <input
          className="admin-search-input"
          placeholder="Search by email or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="loading-state"><span className="spinner" /></div>
        ) : error ? (
          <div className="notice notice-error" style={{ margin: 16 }}>{error}</div>
        ) : customers.length === 0 ? (
          <div className="admin-empty"><span className="admin-empty-icon">👥</span>No customers found.</div>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e8ecf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#555', flexShrink: 0 }}>
                            {(c.first_name || c.email)[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#242424', fontSize: 13 }}>{c.first_name} {c.last_name}</div>
                            {c.company && <div style={{ fontSize: 11, color: '#888' }}>{c.company}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="mono">{c.email}</td>
                      <td>{c.phone || '—'}</td>
                      <td>
                        <span className={`abadge abadge-${c.status === 'active' ? 'active' : 'suspended'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="mono">{new Date(c.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      <td>
                        <button
                          className={`admin-btn ${c.status === 'active' ? 'admin-btn-warn' : 'admin-btn-success'}`}
                          disabled={updating === c.id}
                          onClick={() => toggleStatus(c.id, c.status)}
                        >
                          {c.status === 'active' ? 'Suspend' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="admin-pagination">
                <button className="admin-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(n => (
                  <button key={n} className={`admin-page-btn${n === page ? ' active' : ''}`} onClick={() => setPage(n)}>{n}</button>
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
