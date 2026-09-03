import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@streetjs/react';
import './MyAccountPage.css';

type Tab = 'dashboard' | 'orders' | 'addresses' | 'account' | 'login';

export default function MyAccountPage() {
  const { session, loading, login, register, logout } = useAuth<{ email: string; name: string }>();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  function setF(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        await register({ name: form.name, email: form.email, password: form.password });
      }
    } catch {
      setAuthError(mode === 'login' ? 'Invalid email or password.' : 'Registration failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  }

  // Not logged in — show login/register form
  if (!loading && !session) {
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
              <button
                className={`auth-tab${mode === 'login' ? ' active' : ''}`}
                onClick={() => setMode('login')}
              >
                Login
              </button>
              <button
                className={`auth-tab${mode === 'register' ? ' active' : ''}`}
                onClick={() => setMode('register')}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuth} className="auth-form">
              {mode === 'register' && (
                <div className="form-row">
                  <label htmlFor="a-name">Full Name *</label>
                  <input id="a-name" type="text" required value={form.name} onChange={setF('name')} placeholder="John Smith" />
                </div>
              )}
              <div className="form-row">
                <label htmlFor="a-email">Email Address *</label>
                <input id="a-email" type="email" required value={form.email} onChange={setF('email')} placeholder="you@example.com" />
              </div>
              <div className="form-row">
                <label htmlFor="a-pass">Password *</label>
                <input id="a-pass" type="password" required value={form.password} onChange={setF('password')} placeholder="••••••••" />
              </div>

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

  // Loading state
  if (loading) {
    return (
      <div className="loading-state" style={{ minHeight: '40vh' }}>
        <span className="spinner" /> Loading your account…
      </div>
    );
  }

  // Logged in dashboard
  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard',       icon: '🏠' },
    { id: 'orders',    label: 'Orders',           icon: '📦' },
    { id: 'addresses', label: 'Addresses',        icon: '📍' },
    { id: 'account',   label: 'Account Details',  icon: '👤' },
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
        {/* Sidebar nav */}
        <nav className="account-nav" aria-label="Account navigation">
          <div className="account-user">
            <div className="account-avatar">
              {session?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <strong>{session?.name ?? 'Customer'}</strong>
              <span>{session?.email}</span>
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

        {/* Main content */}
        <div className="account-content">
          {tab === 'dashboard' && (
            <div className="account-section">
              <h2>Dashboard</h2>
              <p>
                Hello <strong>{session?.name}</strong>! From your account dashboard you can view
                your recent orders, manage your shipping and billing addresses, and edit your
                account details and password.
              </p>
              <div className="dashboard-cards">
                {TABS.filter((t) => t.id !== 'dashboard').map((t) => (
                  <button
                    key={t.id}
                    className="dashboard-card"
                    onClick={() => setTab(t.id)}
                  >
                    <span className="dashboard-card-icon">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div className="account-section">
              <h2>Orders</h2>
              <div className="empty-orders">
                <span>📦</span>
                <p>No orders found. Start shopping to see your orders here.</p>
                <Link to="/shop" className="btn btn-primary">Browse Products</Link>
              </div>
            </div>
          )}

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

          {tab === 'account' && (
            <div className="account-section">
              <h2>Account Details</h2>
              <form className="account-details-form" onSubmit={(e) => e.preventDefault()}>
                <div className="form-row-double">
                  <div className="form-row">
                    <label>Display Name</label>
                    <input type="text" defaultValue={session?.name ?? ''} />
                  </div>
                  <div className="form-row">
                    <label>Email Address</label>
                    <input type="email" defaultValue={session?.email ?? ''} />
                  </div>
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
