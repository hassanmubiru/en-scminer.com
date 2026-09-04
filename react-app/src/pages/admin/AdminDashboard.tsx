import { useAdminFetch } from './useAdminFetch';

interface DashboardData {
  orders: { status: string; total: string }[];
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  pendingPayments: number;
  pendingReviews: number;
  newMessages: number;
}

function orderCount(orders: { status: string; total: string }[], status: string) {
  return Number(orders.find(o => o.status === status)?.total ?? 0);
}

export default function AdminDashboard() {
  const { data, loading, error } = useAdminFetch<DashboardData>('/api/v1/admin/dashboard');

  if (loading) return <div className="loading-state"><span className="spinner" /> Loading dashboard…</div>;
  if (error)   return <div className="notice notice-error">{error}</div>;
  if (!data)   return null;

  const totalOrders = data.orders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div>
      <div className="admin-page-header">
        <h2>Dashboard</h2>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────── */}
      <div className="admin-stats">
        <div className="stat-card stat-card-accent">
          <span className="stat-card-icon">💰</span>
          <span className="stat-card-value">${data.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
          <span className="stat-card-label">Total Revenue</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-icon">📦</span>
          <span className="stat-card-value">{totalOrders}</span>
          <span className="stat-card-label">Total Orders</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-icon">👥</span>
          <span className="stat-card-value">{data.totalCustomers}</span>
          <span className="stat-card-label">Customers</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-icon">🏭</span>
          <span className="stat-card-value">{data.totalProducts}</span>
          <span className="stat-card-label">Active Products</span>
        </div>
        {data.pendingPayments > 0 && (
          <div className="stat-card stat-card-warn">
            <span className="stat-card-icon">⏳</span>
            <span className="stat-card-value">{data.pendingPayments}</span>
            <span className="stat-card-label">Pending Payments</span>
          </div>
        )}
        {data.newMessages > 0 && (
          <div className="stat-card stat-card-warn">
            <span className="stat-card-icon">✉️</span>
            <span className="stat-card-value">{data.newMessages}</span>
            <span className="stat-card-label">New Messages</span>
          </div>
        )}
      </div>

      {/* ── Orders by status ──────────────────────────────────────── */}
      <div className="admin-card">
        <div className="admin-card-header">Orders by Status</div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 12 }}>
          {[
            { label: 'Pending Payment', key: 'PENDING_PAYMENT', color: '#856404', bg: '#fff3cd' },
            { label: 'Paid',            key: 'PAID',            color: '#0a3622', bg: '#d1e7dd' },
            { label: 'Processing',      key: 'PROCESSING',      color: '#084298', bg: '#cfe2ff' },
            { label: 'Shipped',         key: 'SHIPPED',         color: '#055160', bg: '#cff4fc' },
            { label: 'Delivered',       key: 'DELIVERED',       color: '#0a3622', bg: '#d1e7dd' },
            { label: 'Cancelled',       key: 'CANCELLED',       color: '#842029', bg: '#f8d7da' },
          ].map(({ label, key, color, bg }) => (
            <div key={key} style={{ background: bg, borderRadius: 6, padding: '14px 16px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'Montserrat,sans-serif' }}>
                {orderCount(data.orders, key)}
              </div>
              <div style={{ fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 4 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
