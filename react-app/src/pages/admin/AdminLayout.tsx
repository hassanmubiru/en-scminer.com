import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
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

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth <= 768;
}

export default function AdminLayout() {
  const { user, loading, logout } = useAuthCtx();
  const navigate  = useNavigate();
  const location  = useLocation();

  // On mobile the sidebar starts collapsed (hidden). On desktop it starts open.
  const [collapsed, setCollapsed] = useState(() => isMobile());

  const roles    = user ? (user as Record<string, unknown>)['roles'] as string[] ?? [] : [];
  const isAdmin  = roles.some(r => ['admin', 'super_admin'].includes(r));

  // Redirect if not admin
  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) navigate('/admin/login', { replace: true });
  }, [user, loading, isAdmin, navigate]);

  // Close sidebar on mobile when route changes (user tapped a nav link)
  useEffect(() => {
    if (isMobile()) setCollapsed(true);
  }, [location.pathname]);

  // Close sidebar when viewport grows past mobile threshold
  useEffect(() => {
    function handleResize() {
      if (!isMobile()) setCollapsed(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar when clicking the scrim (the ::before pseudo-element overlay)
  function handleShellClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isMobile() || collapsed) return;
    const target = e.target as HTMLElement;
    // If click landed on the shell itself (not inside sidebar or main), close
    if (target.classList.contains('admin-shell')) setCollapsed(true);
  }

  if (loading || !isAdmin) {
    return (
      <div className="admin-loading">
        <span className="spinner" /> Loading…
      </div>
    );
  }

  const isSuperAdmin  = roles.includes('super_admin');
  const displayName   = [
    String((user as Record<string, unknown>)['first_name'] ?? ''),
    String((user as Record<string, unknown>)['last_name']  ?? ''),
  ].filter(Boolean).join(' ') || 'Admin';

  // Current page title for mobile topbar
  const currentPage = NAV.find(n =>
    n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to + '/') || location.pathname === n.to,
  )?.label ?? 'Admin';

  return (
    <div
      className={`admin-shell${collapsed ? ' admin-collapsed' : ''}`}
      onClick={handleShellClick}
    >
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
          <button
            className="admin-logout-btn"
            onClick={() => { logout(); navigate('/admin/login'); }}
            title="Logout"
          >
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
            aria-expanded={!collapsed}
          >
            ☰
          </button>
          <div className="admin-topbar-title">
            {/* Show current page name on mobile, brand name on desktop */}
            <span className="hide-desktop" style={{ fontWeight: 700, color: '#242424' }}>
              {currentPage}
            </span>
            <span className="hide-mobile">
              SCMiner Administration
            </span>
          </div>
          <a href="/" className="admin-store-link" target="_blank" rel="noopener noreferrer">
            ↗ Store
          </a>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
