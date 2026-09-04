import { useState, useEffect } from 'react';
import { useAdminFetch, adminCall } from './useAdminFetch';
import { API_BASE } from '../../lib/api';

interface Product {
  id: string;
  slug: string;
  name: string;
  sku: string;
  brand_name: string | null;
  price_cents: string;
  status: string;
}

interface ProductsResult {
  items: Product[];
  total: number;
}

interface InvLevel {
  onHand: number;
  reserved: number;
  available: number;
  inStock: boolean;
}

export default function AdminInventory() {
  const [page, setPage]   = useState(1);
  const [search, setSearch] = useState('');

  // Adjust modal state
  const [adjustId, setAdjustId]       = useState('');
  const [adjustName, setAdjustName]   = useState('');
  const [delta, setDelta]             = useState('');
  const [note, setNote]               = useState('');
  const [adjusting, setAdjusting]     = useState(false);
  const [msg, setMsg]                 = useState('');

  const { data, loading, error, reload } = useAdminFetch<ProductsResult>(
    `/api/v1/products?limit=20&page=${page}`,
    [page],
  );

  const [invMap, setInvMap] = useState<Record<string, InvLevel>>({});

  // Load full inventory details for each product when the product list changes
  useEffect(() => {
    if (!data?.items?.length) return;
    const token = localStorage.getItem('scminer_access_token') ?? '';
    data.items.forEach(async (p) => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/inventory/${p.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const d = await res.json() as Record<string, unknown>;
        setInvMap(prev => ({
          ...prev,
          [p.id]: {
            onHand:    Number(d['quantity_on_hand']    ?? d['available'] ?? 0),
            reserved:  Number(d['quantity_reserved']   ?? 0),
            available: Number(d['available']           ?? 0),
            inStock:   Boolean(d['inStock']            ?? false),
          },
        }));
      } catch { /* silent */ }
    });
  }, [data]);

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustId || !delta || !note.trim()) return;
    setAdjusting(true);
    setMsg('');
    const { ok, message } = await adminCall(
      'POST',
      `/api/v1/inventory/${adjustId}/adjust`,
      { delta: Number(delta), note },
    );
    setAdjusting(false);
    if (ok) {
      setMsg('Adjustment applied successfully.');
      setAdjustId('');
      setDelta('');
      setNote('');
      // Refresh inventory for this product
      const token = localStorage.getItem('scminer_access_token') ?? '';
      const res = await fetch(`${API_BASE}/api/v1/inventory/${adjustId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json() as Record<string, unknown>;
        setInvMap(prev => ({
          ...prev,
          [adjustId]: {
            onHand:    Number(d['quantity_on_hand'] ?? d['available'] ?? 0),
            reserved:  Number(d['quantity_reserved'] ?? 0),
            available: Number(d['available'] ?? 0),
            inStock:   Boolean(d['inStock'] ?? false),
          },
        }));
      }
    } else {
      setMsg(message || 'Adjustment failed. The result may be negative.');
    }
  }

  const products = (data?.items ?? []).filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  return (
    <div>
      <div className="admin-page-header">
        <h2>Inventory</h2>
      </div>

      {msg && (
        <div className={`notice ${msg.includes('fail') || msg.includes('Fail') ? 'notice-error' : 'notice-success'}`}
             style={{ marginBottom: 16 }}>
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
        {loading && <div className="loading-state"><span className="spinner" /></div>}
        {error   && <div className="notice notice-error" style={{ margin: 16 }}>{error}</div>}
        {!loading && !error && (
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
                    <th>Actions</th>
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
                        <td>{inv != null ? inv.onHand : <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}</td>
                        <td>{inv != null ? inv.reserved : '—'}</td>
                        <td>
                          {inv != null ? (
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
                  <button key={n} className={`admin-page-btn${n === page ? ' active' : ''}`}
                    onClick={() => setPage(n)}>{n}</button>
                ))}
                <button className="admin-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Adjust modal ──────────────────────────────────────────── */}
      {adjustId && (
        <div className="admin-modal-backdrop" onClick={() => { setAdjustId(''); setMsg(''); }}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              Adjust Inventory
              <button className="admin-modal-close" onClick={() => { setAdjustId(''); setMsg(''); }}>×</button>
            </div>
            <div className="admin-modal-body">
              <p style={{ marginBottom: 18, fontSize: 13, color: '#555' }}>
                Product: <strong>{adjustName}</strong>
              </p>
              {invMap[adjustId] && (
                <div style={{ display: 'flex', gap: 20, marginBottom: 20, background: '#f8f9fb', borderRadius: 6, padding: '12px 16px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{invMap[adjustId]?.onHand}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>On Hand</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{invMap[adjustId]?.reserved}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Reserved</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: (invMap[adjustId]?.available ?? 0) > 0 ? '#198754' : '#dc3545' }}>
                      {invMap[adjustId]?.available}
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>Available</div>
                  </div>
                </div>
              )}
              <form onSubmit={submitAdjust} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-row">
                  <label>Delta <span style={{ color: '#888', fontWeight: 400 }}>(positive = add stock, negative = remove)</span></label>
                  <input
                    type="number"
                    required
                    value={delta}
                    onChange={e => setDelta(e.target.value)}
                    placeholder="e.g. 10 or -2"
                    style={{ padding: '10px 14px', border: '1px solid #dde0e7', borderRadius: 6, fontSize: 14, width: '100%' }}
                  />
                </div>
                <div className="form-row">
                  <label>Reason / Note *</label>
                  <input
                    type="text"
                    required
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="e.g. Stock count correction, Damaged unit removal"
                    style={{ padding: '10px 14px', border: '1px solid #dde0e7', borderRadius: 6, fontSize: 14, width: '100%' }}
                  />
                </div>
                {msg && (
                  <div className={`notice ${msg.includes('fail') || msg.includes('Fail') ? 'notice-error' : 'notice-success'}`}>
                    {msg}
                  </div>
                )}
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={adjusting}
                  style={{ alignSelf: 'flex-start', padding: '10px 24px', fontSize: 13 }}
                >
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
