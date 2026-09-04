import { useState } from 'react';
import { useAdminFetch, adminCall } from './useAdminFetch';

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  total: number;
  subtotal: number;
  shippingAmount: number;
  discount: number;
  customer_note?: string;
  created_at: string;
  items: { product_name: string; quantity: number; unitPrice: number; subtotal: number }[];
  addresses: { type: string; first_name: string; last_name: string; line1: string; city: string; postcode: string; country_code: string }[];
  payments: { method: string; status: string; amount: number }[];
}

const STATUS_OPTIONS = ['PENDING_PAYMENT','PAID','PROCESSING','PACKED','SHIPPED','DELIVERED','CANCELLED','REFUNDED'];

function statusBadge(s: string) {
  const map: Record<string, string> = {
    PENDING_PAYMENT: 'awaiting', PAID: 'paid', PROCESSING: 'processing',
    PACKED: 'processing', SHIPPED: 'shipped', DELIVERED: 'delivered',
    CANCELLED: 'cancelled', REFUNDED: 'refunded',
  };
  return <span className={`abadge abadge-${map[s] ?? 'expired'}`}>{s.replace(/_/g,' ')}</span>;
}

export default function AdminOrders() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, loading, error, reload } = useAdminFetch<{ items: Order[]; total: number; page: number; limit: number }>(
    `/api/v1/orders?limit=20&page=${page}`,
    [page],
  );

  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState('');

  async function openDetail(id: string) {
    setDetailLoading(true);
    const { data: d } = await adminCall('GET', `/api/v1/orders/${id}`);
    setDetail(d as OrderDetail);
    setDetailLoading(false);
  }

  async function updateStatus(orderId: string, status: string) {
    setUpdating(orderId);
    const { ok, message } = await adminCall('PATCH', `/api/v1/orders/${orderId}/status`, { status });
    setUpdating('');
    if (ok) { reload(); if (detail?.id === orderId) setDetail(prev => prev ? { ...prev, status } : null); }
    else alert(message || 'Failed to update status');
  }

  const allOrders = data?.items ?? [];
  const displayed = allOrders.filter(o => {
    const matchStatus = !statusFilter || o.status === statusFilter;
    const matchSearch = !search || o.order_number.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  return (
    <div>
      <div className="admin-page-header">
        <h2>Orders</h2>
        <span style={{ color: '#888', fontSize: 13 }}>{data?.total ?? 0} total</span>
      </div>

      <div className="admin-filters">
        <input
          className="admin-search-input"
          placeholder="Search by order number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="admin-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="loading-state"><span className="spinner" /></div>
        ) : error ? (
          <div className="notice notice-error" style={{ margin: 16 }}>{error}</div>
        ) : displayed.length === 0 ? (
          <div className="admin-empty"><span className="admin-empty-icon">📦</span>No orders found.</div>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(o => (
                    <tr key={o.id}>
                      <td><strong style={{ color: 'rgb(198,19,29)' }}>#{o.order_number}</strong></td>
                      <td>{statusBadge(o.status)}</td>
                      <td><strong>${o.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
                      <td className="mono">{new Date(o.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="admin-btn admin-btn-ghost" onClick={() => openDetail(o.id)}>View</button>
                        <select
                          className="admin-select"
                          style={{ fontSize: 12, padding: '4px 8px' }}
                          value={o.status}
                          disabled={updating === o.id}
                          onChange={e => updateStatus(o.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                        </select>
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

      {/* ── Detail modal ──────────────────────────────────────────── */}
      {(detail || detailLoading) && (
        <div className="admin-modal-backdrop" onClick={() => setDetail(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              {detailLoading ? 'Loading…' : `Order #${detail?.order_number}`}
              <button className="admin-modal-close" onClick={() => setDetail(null)}>×</button>
            </div>
            {detail && (
              <div className="admin-modal-body">
                <dl>
                  {[
                    ['Status',   statusBadge(detail.status)],
                    ['Subtotal', `$${detail.subtotal?.toFixed(2)}`],
                    ['Shipping', `$${detail.shippingAmount?.toFixed(2)}`],
                    ['Discount', detail.discount > 0 ? `-$${detail.discount?.toFixed(2)}` : '—'],
                    ['Total',    <strong>${detail.total?.toFixed(2)}</strong>],
                    ['Date',     new Date(detail.created_at).toLocaleString()],
                    ['Note',     detail.customer_note || '—'],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="admin-modal-row">
                      <dt>{k}</dt><dd>{v}</dd>
                    </div>
                  ))}
                </dl>

                {detail.items?.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 18, marginBottom: 10, fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>Items</h4>
                    {detail.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '7px 0', borderBottom: '1px solid #f2f4f7' }}>
                        <span>{item.product_name} × {item.quantity}</span>
                        <span>${item.subtotal?.toFixed(2)}</span>
                      </div>
                    ))}
                  </>
                )}

                {detail.addresses?.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 18, marginBottom: 10, fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      {detail.addresses[0]?.type === 'billing' ? 'Billing' : 'Shipping'} Address
                    </h4>
                    {detail.addresses.slice(0, 1).map((a, i) => (
                      <p key={i} style={{ fontSize: 13, color: '#555', lineHeight: 1.7 }}>
                        {a.first_name} {a.last_name}<br />{a.line1}<br />{a.city}, {a.postcode} {a.country_code}
                      </p>
                    ))}
                  </>
                )}

                {detail.payments?.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 18, marginBottom: 10, fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>Payment</h4>
                    {detail.payments.map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '7px 0' }}>
                        <span>{p.method}</span>
                        <span>{statusBadge(p.status)} ${p.amount?.toFixed(2)}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
