'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Fetch JSON from the API; re-runs when path/params change. */
export function useApi(path, params, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState(null);
  const key = path + JSON.stringify(params || {});
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!enabled || !path) return;
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await api(path, { params });
      if (my === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (my === seq.current) setError(e);
    } finally {
      if (my === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}

export function useDebounce(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export function useMediaQuery(q) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}
