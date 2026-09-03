import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthCtx } from '../context/AuthContext';
import { API_BASE } from '../lib/api';
import './MyAccountPage.css';

type Tab = 'dashboard' | 'orders' | 'addresses' | 'account';

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
}

export default function MyAccountPage() {
  const { user, loading, login, register, logout, getToken } = useAuthCtx();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');

  function setF(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  // Fetch orders whenever the user logs in and navigates to the orders tab
  useEffect(() => {
    if (!user || tab !== 'orders') return;
    const token = getToken();
    if (!token) return;

    setOrdersLoading(true);
    setOrdersError('');
    fetch(`${API_BASE}/api/v1/orders?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((d: Record<string, unknown>) => {
        setOrders((d['items'] as Order[]) ?? []);
      })
      .catch(() => setOrdersError('Failed to load orders.'))
      .finally(() => setOrdersLoading(false));
  }, [user, tab, getToken]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.email, form.password, form.firstName, form.lastName);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : (mode === 'login' ? 'Invalid email or password.' : 'Registration failed.'));
    } finally {
      setAuthLoading(false);
    }
  }

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!loading && !user) {
    return (
      <div className="account-page">
        <div className="page-title-banner">
          <div className="container">
            <h1>My Account</h1>
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              <span className="breadcrumb-sep">/</span>
              <span>My Account</span>
            </nav>
          </div>
        </div>

        <div className="container account-auth-wrap">
          <div className="auth-card">
            <div className="auth-tabs">
              <button className={`auth-tab${mode === 'login' ? ' active' : ''}`} onClick={() => setMode('login')}>
                Login
              </button>
              <button className={`auth-tab${mode === 'register' ? ' active' : ''}`} onClick={() => setMode('register')}>
                Register
              </button>
            </div>

            <form onSubmit={handleAuth} className="auth-form">
              {mode === 'register' && (
                <>
                  <div className="form-row-double">
                    <div className="form-row">
                      <label htmlFor="a-fname">First Name *</label>
                      <input id="a-fname" type="text" required value={form.firstName} onChange={setF('firstName')} placeholder="John" />
                    </div>
                    <div className="form-row">
                      <label htmlFor="a-lname">Last Name</label>
                      <input id="a-lname" type="text" value={form.lastName} onChange={setF('lastName')} placeholder="Smith" />
                    </div>
                  </div>
                </>
              )}
              <div className="form-row">
                <label htmlFor="a-email">Email Address *</label>
                <input id="a-email" type="email" required value={form.email} onChange={setF('email')} placeholder="you@example.com" />
              </div>
              <div className="form-row">
                <label htmlFor="a-pass">Password *</label>
                <input id="a-pass" type="password" required value={form.password} onChange={setF('password')} placeholder="••••••••"
                  minLength={mode === 'register' ? 8 : undefined} />
              </div>
              {mode === 'register' && (
                <p style={{ fontSize: 12, color: 'var(--text-muted, #888)', margin: '-8px 0 12px' }}>
                  Minimum 8 characters.
                </p>
              )}

              {authError && <div className="notice notice-error">{authError}</div>}

              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={authLoading}>
                {authLoading
                  ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> {mode === 'login' ? 'Logging in…' : 'Registering…'}</>
                  : mode === 'login' ? 'Login' : 'Create Account'}
              </button>
            </form>

            <p className="auth-switch">
              {mode === 'login'
                ? <>Don't have an account? <button className="link-btn" onClick={() => setMode('register')}>Register here</button></>
                : <>Already have an account? <button className="link-btn" onClick={() => setMode('login')}>Login here</button></>}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="loading-state" style={{ minHeight: '40vh' }}>
        <span className="spinner" /> Loading your account…
      </div>
    );
  }

  // ── Logged in ──────────────────────────────────────────────────────────────
  const displayName = [
    String(user?.['first_name'] ?? user?.['firstName'] ?? ''),
    String(user?.['last_name']  ?? user?.['lastName']  ?? ''),
  ].filter(Boolean).join(' ') || String(user?.['email'] ?? 'Customer');

  const email = String(user?.['email'] ?? '');

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard',      icon: '🏠' },
    { id: 'orders',    label: 'Orders',          icon: '📦' },
    { id: 'addresses', label: 'Addresses',       icon: '📍' },
    { id: 'account',   label: 'Account Details', icon: '👤' },
  ];

  return (
    <div className="account-page">
      <div className="page-title-banner">
        <div className="container">
          <h1>My Account</h1>
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span className="breadcrumb-sep">/</span>
            <span>My Account</span>
          </nav>
        </div>
      </div>

      <div className="container account-layout">
        {/* Sidebar */}
        <nav className="account-nav" aria-label="Account navigation">
          <div className="account-user">
            <div className="account-avatar">
              {displayName[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <strong>{displayName}</strong>
              <span>{email}</span>
            </div>
          </div>
          <ul>
            {TABS.map((t) => (
              <li key={t.id}>
                <button
                  className={`account-nav-btn${tab === t.id ? ' active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  <span>{t.icon}</span> {t.label}
                </button>
              </li>
            ))}
            <li>
              <button className="account-nav-btn logout-btn" onClick={() => logout()}>
                <span>🚪</span> Logout
              </button>
            </li>
          </ul>
        </nav>

        {/* Content */}
        <div className="account-content">

          {/* ── Dashboard ─────────────────────────────── */}
          {tab === 'dashboard' && (
            <div className="account-section">
              <h2>Dashboard</h2>
              <p>
                Hello <strong>{displayName}</strong>! From your account dashboard you can view
                your recent orders, manage your shipping and billing addresses, and edit your
                account details.
              </p>
              <div className="dashboard-cards">
                {TABS.filter((t) => t.id !== 'dashboard').map((t) => (
                  <button key={t.id} className="dashboard-card" onClick={() => setTab(t.id)}>
                    <span className="dashboard-card-icon">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Orders ────────────────────────────────── */}
          {tab === 'orders' && (
            <div className="account-section">
              <h2>Orders</h2>

              {ordersLoading && (
                <div className="loading-state"><span className="spinner" /> Loading orders…</div>
              )}

              {ordersError && (
                <div className="notice notice-error">{ordersError}</div>
              )}

              {!ordersLoading && !ordersError && orders.length === 0 && (
                <div className="empty-orders">
                  <span>📦</span>
                  <p>No orders yet. Start shopping to see your orders here.</p>
                  <Link to="/shop" className="btn btn-primary">Browse Products</Link>
                </div>
              )}

              {!ordersLoading && orders.length > 0 && (
                <div className="orders-table-wrap">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <span className="order-num">#{o.order_number}</span>
                          </td>
                          <td>{new Date(o.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                          <td>
                            <span className={`order-status-badge status-${o.status.toLowerCase().replace('_', '-')}`}>
                              {o.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="order-total">
                            ${o.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Addresses ─────────────────────────────── */}
          {tab === 'addresses' && (
            <div className="account-section">
              <h2>Addresses</h2>
              <p>The following addresses will be used on the checkout page by default.</p>
              <div className="addresses-grid">
                {['Billing Address', 'Shipping Address'].map((a) => (
                  <div key={a} className="address-card">
                    <h4>{a}</h4>
                    <p className="address-empty">You have not set up this address yet.</p>
                    <button className="btn btn-dark btn-sm">Add Address</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Account Details ───────────────────────── */}
          {tab === 'account' && (
            <div className="account-section">
              <h2>Account Details</h2>
              <form className="account-details-form" onSubmit={(e) => e.preventDefault()}>
                <div className="form-row-double">
                  <div className="form-row">
                    <label>First Name</label>
                    <input type="text" defaultValue={String(user?.['first_name'] ?? '')} />
                  </div>
                  <div className="form-row">
                    <label>Last Name</label>
                    <input type="text" defaultValue={String(user?.['last_name'] ?? '')} />
                  </div>
                </div>
                <div className="form-row">
                  <label>Email Address</label>
                  <input type="email" defaultValue={email} />
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />
                <h4 style={{ marginBottom: 16, color: 'var(--title)' }}>Change Password</h4>
                <div className="form-row">
                  <label>Current Password</label>
                  <input type="password" placeholder="Leave blank to keep current password" />
                </div>
                <div className="form-row-double">
                  <div className="form-row">
                    <label>New Password</label>
                    <input type="password" />
                  </div>
                  <div className="form-row">
                    <label>Confirm New Password</label>
                    <input type="password" />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
