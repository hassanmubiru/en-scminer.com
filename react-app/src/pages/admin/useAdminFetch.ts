import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../lib/api';

/** Generic admin fetch hook — always sends the Bearer token from localStorage */
export function useAdminFetch<T>(
  path: string,
  deps: unknown[] = [],
) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const token = () => localStorage.getItem('scminer_access_token') ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await res.json() as T;
      if (!res.ok) throw new Error((d as Record<string,unknown>)?.['message'] as string ?? 'Request failed');
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

/** One-shot admin API call (POST/PATCH/DELETE) */
export async function adminCall(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; data: unknown; message: string }> {
  const token = localStorage.getItem('scminer_access_token') ?? '';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json() as Record<string,unknown>;
  const message = (data['error'] as Record<string,unknown>)?.['message'] as string ?? '';
  return { ok: res.ok, data, message };
}
