import { useState } from 'react';
import { useAdminFetch, adminCall } from './useAdminFetch';

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
  expires_at: string | null;
  created_at: string;
}

function paymentBadge(s: string) {
  const map: Record<string, string> = {
    AWAITING_PAYMENT: 'awaiting', PAYMENT_DETECTED: 'awaiting',
    CONFIRMING: 'processing', CONFIRMED: 'confirmed',
    UNDERPAID: 'warn', OVERPAID: 'warn',
    MANUAL_REVIEW: 'review', EXPIRED: 'expired',
    CANCELLED: 'cancelled', FAILED: 'failed', REFUNDED: 'refunded',
  };
  return <span className={`abadge abadge-${map[s] ?? 'expired'}`}>{s.replace(/_/g,' ')}</span>;
}

export default function AdminPayments() {
  const { data, loading, error, reload } = useAdminFetch<{ items: Payment[] }>(
    '/api/v1/admin/payments/pending',
  );

  const [confirming, setConfirming] = useState('');
  const [successId, setSuccessId] = useState('');

  async function manualConfirm(id: string, orderNumber: string) {
    if (!confirm(`Manually confirm payment for order #${orderNumber}?\n\nThis will mark the order as PAID. This action is audited.`)) return;
    setConfirming(id);
    const { ok, message } = await adminCall('PATCH', `/api/v1/admin/payments/${id}/manual-confirm`);
    setConfirming('');
    if (ok) { setSuccessId(id); reload(); }
    else alert(message || 'Failed to confirm payment');
  }

  const payments = data?.items ?? [];

  return (
    <div>
      <div className="admin-page-header">
        <h2>Payments</h2>
        <span style={{ color: '#888', fontSize: 13 }}>Requiring attention</span>
      </div>

      {successId && (
        <div className="notice notice-success" style={{ marginBottom: 16 }}>
          Payment confirmed successfully. Order marked as PAID.
        </div>
      )}

      <div className="admin-card">
        {loading ? (
          <div className="loading-state"><span className="spinner" /></div>
        ) : error ? (
          <div className="notice notice-error" style={{ margin: 16 }}>{error}</div>
        ) : payments.length === 0 ? (
          <div className="admin-empty">
            <span className="admin-empty-icon">✅</span>
            No payments require attention right now.
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Crypto Expected</th>
                  <th>Crypto Received</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} style={successId === p.id ? { background: '#f0fff4' } : {}}>
                    <td><strong style={{ color: 'rgb(198,19,29)' }}>#{p.order_number}</strong></td>
                    <td>{p.method}</td>
                    <td>{paymentBadge(p.status)}</td>
                    <td><strong>${p.amount.toFixed(2)}</strong></td>
                    <td className="mono">
                      {p.crypto_amount ? `${p.crypto_amount} ${p.symbol ?? ''}` : '—'}
                    </td>
                    <td className="mono">
                      {p.crypto_amount_received ? `${p.crypto_amount_received} ${p.symbol ?? ''}` : '—'}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {p.expires_at ? new Date(p.expires_at).toLocaleString() : '—'}
                    </td>
                    <td>
                      <button
                        className="admin-btn admin-btn-success"
                        disabled={confirming === p.id}
                        onClick={() => manualConfirm(p.id, p.order_number)}
                        title="Manually confirm this payment (super_admin only)"
                      >
                        {confirming === p.id ? '…' : '✓ Confirm'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payments.some(p => p.receiving_address) && (
        <div style={{ marginTop: 20 }}>
          <div className="admin-card">
            <div className="admin-card-header">Receiving Addresses</div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Order</th><th>Network</th><th>Address</th></tr></thead>
                <tbody>
                  {payments.filter(p => p.receiving_address).map(p => (
                    <tr key={p.id}>
                      <td>#{p.order_number}</td>
                      <td>{p.network}</td>
                      <td className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{p.receiving_address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
