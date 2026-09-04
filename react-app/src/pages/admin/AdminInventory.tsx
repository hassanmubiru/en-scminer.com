import { useState } from 'react';
import { useAdminFetch, adminCall } from './useAdminFetch';
import { API_BASE } from '../../lib/api';

interface InventoryItem {
  id: string;
  slug: string;
  name: string;
  sku: string;
  brand_name: string | null;
  category_name: string | null;
  price_cents: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  status: string;
}

interface ProductsResult {
  items: InventoryItem[];
  total: number;
}

export default function AdminInventory() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [adjustId, setAdjustId]   = useState('');
  const [adjustName, setAdjustName] = useState('');
  const [delta, setDelta]         = useState('');
  const [note, setNote]           = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [msg, setMsg]             = useState('');

  // We use the products endpoint + inventory info
  const { data, loading, error, reload } = useAdminFetch<ProductsResult>(
    `/api/v1/products?limit=20&page=${page}&status=active`,
    [page],
  );

  // Fetch inventory for each product
  const [invMap, setInvMap] = useState<Record<string, { onHand: number; reserved: number; available: number }>>({});

  async function loadInventory(productId: string) {
    const token = localStorage.getItem('scminer_access_token') ?? '';
    const res = await fetch(`${API_BASE}/api/v1/inventory/${productId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const d = await res.json() as Record<string, unknown>;
      setInvMap(prev => ({
        ...prev,
        [productId]: {
          onHand:    Number(d['quantity_on_hand'] ?? d['available'] ?? 0),
          reserved:  Number(d['quantity_reserved'] ?? 0),
          available: Number(d['available'] ?? 0),
        },
      }));
    }
  }

  // Load inventory when products load
  useState(() => {
    if (data?.items) {
      data.items.forEach(p => loadInventory(p.id));
    }
  });

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustId || !delta || !note.trim()) return;
    setAdjusting(true);
    setMsg('');
    const { ok, message } = await adminCall('POST', `/api/v1/inventory/${adjustId}/adjust`, {
      delta: Number(delta),
      note,
    });
    setAdjusting(false);
    if (ok) {
      setMsg('Adjustment applied.');
      setAdjustId('');
      setDelta('');
      setNote('');
      reload();
    } else {
      setMsg(message || 'Adjustment failed.');
    }
  }

  const products = (data?.items ?? []).filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  return (
    <div>
      <div className="admin-page-header">
        <h2>Inventory</h2>
      </div>

      {msg && (
        <div className={`notice ${msg.includes('failed') || msg.includes('Failed') ? 'notice-error' : 'notice-success'}`} style={{ marginBottom: 16 }}>
          {msg}
        </div>
      )}

      <div className="admin-filters">
        <input
          className="admin-search-input"
          placeholder="Search by name or SKU…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-card" style={{ marginBottom: 24 }}>
        {loading ? (
          <div className="loading-state"><span className="spinner" /></div>
        ) : error ? (
          <div className="notice notice-error" style={{ margin: 16 }}>{error}</div>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Price</th>
                    <th>On Hand</th>
                    <th>Reserved</th>
                    <th>Available</th>
                    <th>Adjust</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const inv = invMap[p.id];
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#242424', fontSize: 13 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>{p.brand_name}</div>
                        </td>
                        <td className="mono">{p.sku}</td>
                        <td>${(Number(p.price_cents) / 100).toLocaleString()}</td>
                        <td>{inv ? inv.onHand : <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}</td>
                        <td>{inv ? inv.reserved : '—'}</td>
                        <td>
                          {inv ? (
                            <span style={{ fontWeight: 700, color: inv.available > 0 ? '#198754' : '#dc3545' }}>
                              {inv.available}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          <button
                            className="admin-btn admin-btn-ghost"
                            onClick={() => { setAdjustId(p.id); setAdjustName(p.name); setMsg(''); }}
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* ── Adjust modal ──────────────────────────────────────────── */}
      {adjustId && (
        <div className="admin-modal-backdrop" onClick={() => setAdjustId('')}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              Adjust Inventory
              <button className="admin-modal-close" onClick={() => setAdjustId('')}>×</button>
            </div>
            <div className="admin-modal-body">
              <p style={{ marginBottom: 18, fontSize: 13, color: '#555' }}>
                Product: <strong>{adjustName}</strong>
              </p>
              <form onSubmit={submitAdjust} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-row">
                  <label>Delta (positive = add, negative = remove)</label>
                  <input
                    type="number"
                    required
                    value={delta}
                    onChange={e => setDelta(e.target.value)}
                    placeholder="e.g. 10 or -2"
                    style={{ padding: '10px 14px', border: '1px solid #dde0e7', borderRadius: 6, fontSize: 14 }}
                  />
                </div>
                <div className="form-row">
                  <label>Reason / Note *</label>
                  <input
                    type="text"
                    required
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="e.g. Stock count correction"
                    style={{ padding: '10px 14px', border: '1px solid #dde0e7', borderRadius: 6, fontSize: 14 }}
                  />
                </div>
                {msg && <div className={`notice ${msg.includes('fail') ? 'notice-error' : 'notice-success'}`}>{msg}</div>}
                <button type="submit" className="admin-btn admin-btn-primary" disabled={adjusting} style={{ alignSelf: 'flex-start', padding: '10px 24px' }}>
                  {adjusting ? 'Saving…' : 'Apply Adjustment'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
