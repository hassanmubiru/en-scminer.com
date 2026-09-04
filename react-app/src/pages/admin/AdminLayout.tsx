import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthCtx } from '../../context/AuthContext';
import './admin.css';

const NAV = [
  { to: '/admin',           label: 'Dashboard',  icon: '📊', exact: true },
  { to: '/admin/orders',    label: 'Orders',      icon: '📦' },
  { to: '/admin/customers', label: 'Customers',   icon: '👥' },
  { to: '/admin/payments',  label: 'Payments',    icon: '💳' },
  { to: '/admin/inventory', label: 'Inventory',   icon: '🏭' },
  { to: '/admin/audit',     label: 'Audit Log',   icon: '🔍' },
];

export default function AdminLayout() {
  const { user, loading, logout } = useAuthCtx();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const roles = user ? (user as Record<string, unknown>)['roles'] as string[] ?? [] : [];
  const isAdmin = roles.some(r => ['admin', 'super_admin'].includes(r));

  // Redirect to admin login if not authenticated or not an admin
  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) {
      navigate('/admin/login', { replace: true });
    }
  }, [user, loading, isAdmin, navigate]);

  if (loading || !isAdmin) {
    return (
      <div className="admin-loading">
        <span className="spinner" /> Loading…
      </div>
    );
  }

  const isSuperAdmin = roles.includes('super_admin');
  const displayName = [
    String((user as Record<string, unknown>)['first_name'] ?? ''),
    String((user as Record<string, unknown>)['last_name']  ?? ''),
  ].filter(Boolean).join(' ') || 'Admin';

  return (
    <div className={`admin-shell${collapsed ? ' admin-collapsed' : ''}`}>
      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-logo">⚙</span>
          {!collapsed && <span className="admin-brand-name">SCMiner Admin</span>}
        </div>

        <nav className="admin-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          {!collapsed && (
            <div className="admin-user-info">
              <div className="admin-avatar">{displayName[0]?.toUpperCase()}</div>
              <div>
                <div className="admin-user-name">{displayName}</div>
                <div className="admin-user-role">{isSuperAdmin ? 'Super Admin' : 'Admin'}</div>
              </div>
            </div>
          )}
          <button className="admin-logout-btn" onClick={() => { logout(); navigate('/'); }} title="Logout">
            🚪
          </button>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────── */}
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="admin-collapse-btn"
            onClick={() => setCollapsed(c => !c)}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <div className="admin-topbar-title">
            SCMiner Administration
          </div>
          <a href="/" className="admin-store-link" target="_blank" rel="noopener noreferrer">
            ↗ View Store
          </a>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
