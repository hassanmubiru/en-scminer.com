import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthCtx } from '../../context/AuthContext';
import './admin.css';

export default function AdminLogin() {
  const { user, loading, login } = useAuthCtx();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already logged in as admin, go straight to dashboard
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    const roles = (user as Record<string, unknown>)['roles'] as string[] | undefined;
    if (roles?.some(r => ['admin', 'super_admin'].includes(r))) {
      navigate('/admin', { replace: true });
    }
  }, [user, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      // useEffect above will handle redirect once user state updates
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <span className="spinner" /> Checking session…
      </div>
    );
  }

  return (
    <div className="admin-gate">
      <div className="admin-gate-card" style={{ maxWidth: 400 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⚙</div>
          <h2 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, color: '#242424', marginBottom: 6 }}>
            SCMiner Admin
          </h2>
          <p style={{ color: '#888', fontSize: 13 }}>Sign in with your admin credentials</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 5 }}>
              Email Address
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@scminer.com"
              style={{
                width: '100%', padding: '11px 14px',
                border: '1px solid #dde0e7', borderRadius: 6,
                fontSize: 14, color: '#242424',
                outline: 'none', transition: 'border-color .2s',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgb(198,19,29)')}
              onBlur={e => (e.target.style.borderColor = '#dde0e7')}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '11px 14px',
                border: '1px solid #dde0e7', borderRadius: 6,
                fontSize: 14, color: '#242424',
                outline: 'none', transition: 'border-color .2s',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgb(198,19,29)')}
              onBlur={e => (e.target.style.borderColor = '#dde0e7')}
            />
          </div>

          {error && (
            <div style={{
              background: '#ffebee', color: '#c62828',
              borderLeft: '4px solid #e53935',
              padding: '10px 14px', borderRadius: 4, fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', padding: '13px',
              background: submitting ? '#888' : 'rgb(198,19,29)',
              color: '#fff', border: 'none', borderRadius: 6,
              fontSize: 14, fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
              fontFamily: 'Montserrat,sans-serif', letterSpacing: '.04em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background .2s',
            }}
          >
            {submitting && <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderTopColor: '#fff' }} />}
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#aaa' }}>
          Not an admin?{' '}
          <a href="/" style={{ color: 'rgb(198,19,29)', fontWeight: 600 }}>Return to store</a>
        </p>
      </div>
    </div>
  );
}
