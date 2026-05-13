const BASE_URL = '/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const search = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== '') {
        search.set(key, String(val));
      }
    }
    const qs = search.toString();
    if (qs) url += `?${qs}`;
  }

  const token = localStorage.getItem('token');

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    const err = new Error(data.error || `HTTP ${res.status}`) as Error & {
      status?: number;
      [key: string]: unknown;
    };
    err.status = res.status;
    // Propagate any additional structured fields from the error body
    // (e.g. conflictUdi) so callers can react programmatically.
    for (const [k, v] of Object.entries(data)) {
      if (k !== 'error' && k !== 'success') err[k] = v;
    }
    throw err;
  }

  return res.json();
}
