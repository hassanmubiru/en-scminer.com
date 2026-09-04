import { useState } from 'react';
import { useAdminFetch, adminCall } from './useAdminFetch';
import { API_BASE } from '../../lib/api';

interface Payment {
  id: string;
  order_id: string;
  order_number: string;
  method: string;
  status: string;
  amount: number;
  crypto_amount: string | null;
  crypto_amount_received: string | null;
  symbol: string | null;
  network: string | null;
  receiving_address: string | null;
  exchange_rate: string | null;
  expires_at: string | null;
  created_at: string;
}

interface PaymentEvent {
  event: string;
  data: Record<string, unknown>;
  created_at: string;
}

interface PaymentDetail extends Payment {
  events: PaymentEvent[];
  idempotency_key: string | null;
  customer_email?: string;
  customer_name?: string;
}

// All valid admin-settable statuses
const UPDATABLE_STATUSES = [
  'AWAITING_PAYMENT',
  'MANUAL_REVIEW',
  'CONFIRMED',
  'CANCELLED',
  'REFUNDED',
  'FAILED',
];

function paymentBadge(s: string) {
  const map: Record<string, string> = {
    AWAITING_PAYMENT: 'awaiting',
    PAYMENT_DETECTED: 'awaiting',
    CONFIRMING:       'processing',
    CONFIRMED:        'confirmed',
    UNDERPAID:        'warn',
    OVERPAID:         'warn',
    MANUAL_REVIEW:    'review',
    EXPIRED:          'expired',
    CANCELLED:        'cancelled',
    FAILED:           'failed',
    REFUNDED:         'refunded',
  };
  return <span className={`abadge abadge-${map[s] ?? 'expired'}`}>{s.replace(/_/g, ' ')}</span>;
}

function timeAgo(dt: string) {
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dt).toLocaleDateString();
}

function isExpired(dt: string | null) {
  return dt ? new Date(dt) < new Date() : false;
}

export default function AdminPayments() {
  const { data, loading, error, reload } = useAdminFetch<{ items: Payment[] }>(
    '/api/v1/admin/payments/pending',
  );

  const [selected, setSelected]   = useState<PaymentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirming, setConfirming] = useState('');
  const [newStatus, setNewStatus]  = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [updating, setUpdating]    = useState(false);
  const [toast, setToast]          = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  async function openDetail(p: Payment) {
    setDetailLoading(true);
    setSelected(null);
    setNewStatus('');
    setStatusNote('');
    const token = localStorage.getItem('scminer_access_token') ?? '';
    try {
      // Fetch payment events via admin endpoint — fetch the order detail for customer info
      const [evRes, ordRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/crypto/payment-intents/${p.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
        fetch(`${API_BASE}/api/v1/orders/${p.order_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
      ]);

      const evData  = evRes?.ok  ? await evRes.json()  as Record<string, unknown> : {};
      const ordData = ordRes?.ok ? await ordRes.json() as Record<string, unknown> : {};

      // Extract customer name from billing address
      const addresses = ordData['addresses'] as Array<Record<string, unknown>> | undefined;
      const billing = addresses?.find(a => a['type'] === 'billing') ?? addresses?.[0];

      setSelected({
        ...p,
        events:            (evData['events'] as PaymentEvent[]) ?? [],
        idempotency_key:   evData['idempotency_key'] as string | null ?? null,
        customer_email:    ordData['user_email'] as string | undefined,
        customer_name: billing
          ? `${billing['first_name'] ?? ''} ${billing['last_name'] ?? ''}`.trim()
          : undefined,
      });
    } finally {
      setDetailLoading(false);
    }
  }

  async function manualConfirm(id: string, orderNumber: string) {
    if (!confirm(`Manually confirm payment for order #${orderNumber}?\n\nThis marks the order PAID. Action is audited.`)) return;
    setConfirming(id);
    const { ok, message } = await adminCall('PATCH', `/api/v1/admin/payments/${id}/manual-confirm`);
    setConfirming('');
    if (ok) {
      showToast('Payment confirmed. Order marked PAID.');
      reload();
      setSelected(null);
    } else {
      alert(message || 'Failed — super_admin role required.');
    }
  }

  async function updateStatus(paymentId: string) {
    if (!newStatus) return;
    setUpdating(true);
    // Use order status update + payment status update via admin endpoint
    const { ok, message } = await adminCall(
      'PATCH',
      `/api/v1/admin/payments/${paymentId}/status`,
      { status: newStatus, note: statusNote || undefined },
    );
    setUpdating(false);
    if (ok) {
      showToast(`Status updated to ${newStatus}.`);
      reload();
      setSelected(null);
    } else {
      // Fallback: endpoint may not exist yet — just close
      showToast(message || `Could not update via API. Use Confirm button for CONFIRMED.`);
    }
  }

  const payments = data?.items ?? [];

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Toast ─────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 2000,
          background: '#1a3a1a', color: '#90ee90', padding: '12px 20px',
          borderRadius: 8, fontWeight: 600, fontSize: 13,
          boxShadow: '0 4px 16px rgba(0,0,0,.25)',
          animation: 'fadeIn .2s ease',
        }}>
          ✓ {toast}
        </div>
      )}

      <div className="admin-page-header">
        <h2>Payments</h2>
        <span style={{ color: '#888', fontSize: 13 }}>
          {payments.length} requiring attention
        </span>
      </div>

      {/* ── Summary strip ─────────────────────────────────────── */}
      {payments.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {['AWAITING_PAYMENT','CONFIRMING','UNDERPAID','OVERPAID','MANUAL_REVIEW'].map(s => {
            const count = payments.filter(p => p.status === s).length;
            if (!count) return null;
            return (
              <div key={s} style={{
                background: '#fff', border: '1px solid #eef0f4', borderRadius: 8,
                padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {paymentBadge(s)}
                <span style={{ fontWeight: 700, color: '#242424' }}>{count}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="admin-card">
        {loading && <div className="loading-state"><span className="spinner" /></div>}
        {error   && <div className="notice notice-error" style={{ margin: 16 }}>{error}</div>}
        {!loading && payments.length === 0 && (
          <div className="admin-empty">
            <span className="admin-empty-icon">✅</span>
            No payments require attention right now.
          </div>
        )}
        {!loading && payments.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Asset</th>
                  <th>Status</th>
                  <th>USD Amount</th>
                  <th>Expected Crypto</th>
                  <th>Received Crypto</th>
                  <th>Expires / Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => {
                  const expired = isExpired(p.expires_at);
                  return (
                    <tr key={p.id} style={{ background: confirming === p.id ? '#f0fff4' : undefined }}>
                      <td>
                        <strong style={{ color: 'rgb(198,19,29)', fontFamily: 'Montserrat,sans-serif' }}>
                          #{p.order_number}
                        </strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{p.symbol ?? p.method}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>{p.network}</div>
                      </td>
                      <td>{paymentBadge(p.status)}</td>
                      <td><strong>${p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
                      <td className="mono">
                        {p.crypto_amount
                          ? <span>{p.crypto_amount} <span style={{ color: '#888', fontSize: 11 }}>{p.symbol}</span></span>
                          : '—'}
                      </td>
                      <td className="mono">
                        {p.crypto_amount_received
                          ? <span style={{ color: p.crypto_amount_received < (p.crypto_amount ?? '0') ? '#dc3545' : '#198754' }}>
                              {p.crypto_amount_received} <span style={{ fontSize: 11 }}>{p.symbol}</span>
                            </span>
                          : <span style={{ color: '#bbb' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {p.expires_at ? (
                          <span style={{ color: expired ? '#dc3545' : '#e67e00', fontWeight: 600 }}>
                            {expired ? 'Expired' : new Date(p.expires_at).toLocaleTimeString()}
                          </span>
                        ) : (
                          <span style={{ color: '#888' }}>{timeAgo(p.created_at)}</span>
                        )}
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="admin-btn admin-btn-ghost"
                          onClick={() => openDetail(p)}
                        >
                          View
                        </button>
                        <button
                          className="admin-btn admin-btn-success"
                          disabled={confirming === p.id || p.status === 'CONFIRMED'}
                          onClick={() => manualConfirm(p.id, p.order_number)}
                          title="Manual confirm — super_admin only"
                        >
                          {confirming === p.id ? '…' : '✓ Confirm'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail drawer ─────────────────────────────────────── */}
      {(selected || detailLoading) && (
        <div className="admin-modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="admin-modal"
            style={{ maxWidth: 680 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              {detailLoading ? (
                <span>Loading payment details…</span>
              ) : (
                <span>Payment — Order #{selected?.order_number}</span>
              )}
              <button className="admin-modal-close" onClick={() => setSelected(null)}>×</button>
            </div>

            {detailLoading && (
              <div className="loading-state" style={{ padding: 40 }}>
                <span className="spinner" /> Loading…
              </div>
            )}

            {selected && !detailLoading && (
              <div className="admin-modal-body">

                {/* ── Core details ─────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  {[
                    { label: 'Status',         value: paymentBadge(selected.status) },
                    { label: 'Method',         value: `${selected.symbol ?? selected.method} (${selected.network ?? ''})` },
                    { label: 'USD Amount',     value: `$${selected.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
                    { label: 'Exchange Rate',  value: selected.exchange_rate ? `1 ${selected.symbol} = $${Number(selected.exchange_rate).toLocaleString()}` : '—' },
                    { label: 'Expected Crypto',value: selected.crypto_amount ? `${selected.crypto_amount} ${selected.symbol}` : '—' },
                    { label: 'Received Crypto',value: selected.crypto_amount_received ? `${selected.crypto_amount_received} ${selected.symbol}` : '—' },
                    { label: 'Created',        value: new Date(selected.created_at).toLocaleString() },
                    { label: 'Expires',        value: selected.expires_at ? new Date(selected.expires_at).toLocaleString() : '—' },
                    ...(selected.customer_name ? [{ label: 'Customer', value: selected.customer_name }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: '#f8f9fb', borderRadius: 6, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 13, color: '#242424', fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* ── Receiving address ────────────────────── */}
                {selected.receiving_address && (
                  <div style={{ marginBottom: 20, background: '#f0f2f5', borderRadius: 6, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                      Receiving Address ({selected.network})
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <code style={{ fontSize: 12, color: '#242424', wordBreak: 'break-all', flex: 1 }}>
                        {selected.receiving_address}
                      </code>
                      <button
                        className="admin-btn admin-btn-ghost"
                        style={{ flexShrink: 0 }}
                        onClick={() => { navigator.clipboard.writeText(selected.receiving_address!); showToast('Address copied'); }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Amount comparison ────────────────────── */}
                {selected.crypto_amount && (
                  <div style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ border: '1px solid #eef0f4', borderRadius: 6, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>EXPECTED</div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', color: '#242424' }}>
                        {selected.crypto_amount}
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>{selected.symbol}</div>
                    </div>
                    <div style={{
                      border: `1px solid ${selected.crypto_amount_received ? (Number(selected.crypto_amount_received) >= Number(selected.crypto_amount) * 0.999 ? '#198754' : '#dc3545') : '#eef0f4'}`,
                      borderRadius: 6, padding: '12px 14px', textAlign: 'center',
                      background: selected.crypto_amount_received ? (Number(selected.crypto_amount_received) >= Number(selected.crypto_amount) * 0.999 ? '#f0fff4' : '#fff5f5') : '#f8f9fb',
                    }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>RECEIVED</div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', color: selected.crypto_amount_received ? (Number(selected.crypto_amount_received) >= Number(selected.crypto_amount) * 0.999 ? '#198754' : '#dc3545') : '#bbb' }}>
                        {selected.crypto_amount_received ?? '—'}
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>{selected.symbol}</div>
                    </div>
                  </div>
                )}

                {/* ── Status update ────────────────────────── */}
                <div style={{ marginBottom: 20, border: '1px solid #eef0f4', borderRadius: 6, padding: '16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#242424', marginBottom: 12 }}>
                    Update Status
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    {UPDATABLE_STATUSES.map(s => (
                      <button
                        key={s}
                        onClick={() => setNewStatus(s === newStatus ? '' : s)}
                        style={{
                          padding: '7px 14px', borderRadius: 20, border: '2px solid',
                          borderColor: newStatus === s ? 'rgb(198,19,29)' : '#dde0e7',
                          background: newStatus === s ? 'rgba(198,19,29,.08)' : '#fff',
                          color: newStatus === s ? 'rgb(198,19,29)' : '#555',
                          fontWeight: newStatus === s ? 700 : 400,
                          fontSize: 12, cursor: 'pointer', transition: 'all .15s',
                        }}
                      >
                        {s.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                  {newStatus && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        placeholder="Optional note / reason"
                        value={statusNote}
                        onChange={e => setStatusNote(e.target.value)}
                        style={{ flex: 1, minWidth: 180, padding: '8px 12px', border: '1px solid #dde0e7', borderRadius: 6, fontSize: 13 }}
                      />
                      <button
                        className="admin-btn admin-btn-primary"
                        disabled={updating}
                        onClick={() => {
                          if (newStatus === 'CONFIRMED') {
                            manualConfirm(selected.id, selected.order_number);
                          } else {
                            updateStatus(selected.id);
                          }
                        }}
                      >
                        {updating ? 'Saving…' : `Set ${newStatus.replace(/_/g,' ')}`}
                      </button>
                    </div>
                  )}
                  {newStatus === 'CONFIRMED' && (
                    <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
                      ⚠ Manual confirmation requires super_admin. This action is audited.
                    </p>
                  )}
                </div>

                {/* ── Payment event timeline ───────────────── */}
                {selected.events.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                      Event Timeline
                    </div>
                    <div style={{ borderLeft: '2px solid #eef0f4', paddingLeft: 16 }}>
                      {selected.events.map((ev, i) => (
                        <div key={i} style={{ marginBottom: 14, position: 'relative' }}>
                          <div style={{
                            position: 'absolute', left: -22, top: 3,
                            width: 10, height: 10, borderRadius: '50%',
                            background: ev.event.includes('CONFIRM') ? '#198754'
                              : ev.event.includes('FAIL') || ev.event.includes('EXPIRE') ? '#dc3545'
                              : 'rgb(198,19,29)',
                            border: '2px solid #fff',
                          }} />
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#242424', fontFamily: 'Courier New, monospace' }}>
                            {ev.event}
                          </div>
                          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                            {new Date(ev.created_at).toLocaleString()}
                          </div>
                          {ev.data && Object.keys(ev.data).length > 0 && (
                            <pre style={{ fontSize: 11, color: '#666', background: '#f8f9fb', padding: '6px 8px', borderRadius: 4, marginTop: 4, overflow: 'auto', maxHeight: 80 }}>
                              {JSON.stringify(ev.data, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
