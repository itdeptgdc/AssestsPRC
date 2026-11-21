'use client';

const BASE = process.env.NEXT_PUBLIC_API_URL || '';
const TOKEN_KEY = 'aqr_token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
};

export class ApiError extends Error {
  constructor(code, status, data) {
    super(code);
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

export function buildQuery(params) {
  if (!params) return '';
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return qs ? `?${qs}` : '';
}

export async function api(path, { method = 'GET', body, params, blob } = {}) {
  const url = `${BASE}/api${path}${buildQuery(params)}`;
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (typeof FormData !== 'undefined' && body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, { method, headers, body: payload, cache: 'no-store' });
  } catch {
    throw new ApiError('network_error', 0);
  }
  if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/public')) {
    setToken(null);
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }
  if (blob && res.ok) return res.blob();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'server_error', res.status, data);
  return data;
}

export async function uploadFiles(files) {
  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append('files', f));
  const r = await api('/upload', { method: 'POST', body: fd });
  return r.files || [];
}

/** Download a file from the API; the server's file name (Content-Disposition) wins over `filename` */
export async function downloadFile(path, filename, params) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${BASE}/api${path}${buildQuery(params)}`, { headers, cache: 'no-store' });
  } catch {
    throw new ApiError('network_error', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || 'server_error', res.status, data);
  }
  const m = (res.headers.get('Content-Disposition') || '').match(/filename="?([^";]+)"?/);
  if (m) filename = m[1];
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const imgUrl = (p) => (!p ? '' : /^https?:|^data:/.test(p) ? p : `${BASE}${p}`);
