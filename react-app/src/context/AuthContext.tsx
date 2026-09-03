/**
 * AuthContext — lightweight token storage that bridges @streetjs/react's useAuth
 * with the raw fetch calls in CheckoutPage (and any future pages).
 *
 * Stores the JWT access token in localStorage under 'scminer_access_token'.
 * The token is written on login/register success and cleared on logout.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { API_BASE } from '../lib/api';

const TOKEN_KEY = 'scminer_access_token';

interface AuthState {
  token: string | null;
  user: Record<string, unknown> | null;
  loading: boolean;
}

interface AuthCtx extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => string | null;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: localStorage.getItem(TOKEN_KEY),
    user: null,
    loading: true,
  });

  // On mount: restore session from saved token
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) { setState(s => ({ ...s, loading: false })); return; }

    fetch(`${API_BASE}/auth/session`, {
      headers: { Authorization: `Bearer ${saved}` },
    })
      .then(r => r.json())
      .then((d: Record<string, unknown>) => {
        const u = d['user'] as Record<string, unknown> | null;
        if (u) {
          setState({ token: saved, user: u, loading: false });
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setState({ token: null, user: null, loading: false });
        }
      })
      .catch(() => {
        setState(s => ({ ...s, loading: false }));
      });
  }, []);

  async function login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error((data['error'] as Record<string,unknown>)?.['message'] as string ?? 'Login failed');
    const tokens = data['tokens'] as Record<string, unknown>;
    const token = tokens['accessToken'] as string;
    localStorage.setItem(TOKEN_KEY, token);
    setState({ token, user: data['user'] as Record<string, unknown>, loading: false });
  }

  async function register(email: string, password: string, firstName: string, lastName = '') {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, firstName, lastName }),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error((data['error'] as Record<string,unknown>)?.['message'] as string ?? 'Registration failed');
    const tokens = data['tokens'] as Record<string, unknown>;
    const token = tokens['accessToken'] as string;
    localStorage.setItem(TOKEN_KEY, token);
    setState({ token, user: data['user'] as Record<string, unknown>, loading: false });
  }

  async function logout() {
    const token = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setState({ token: null, user: null, loading: false });
    if (token) {
      fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      }).catch(() => {});
    }
  }

  return (
    <Ctx.Provider value={{
      ...state,
      login,
      register,
      logout,
      getToken: () => localStorage.getItem(TOKEN_KEY),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuthCtx(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuthCtx must be inside AuthProvider');
  return ctx;
}
