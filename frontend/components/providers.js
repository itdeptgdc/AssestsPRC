'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { MotionConfig } from 'framer-motion';
import { api, getToken, setToken } from '@/lib/api';
import th from '@/locales/th';
import en from '@/locales/en';
import km from '@/locales/km';
import { InstallProvider } from './InstallApp';
import ScannerListener from './ScannerListener';
import { RealtimeProvider } from './Realtime';

export const DICTS = { th, en, km };
export const LANGS = [
  { code: 'th', label: 'ไทย', short: 'TH' },
  { code: 'km', label: 'ខ្មែរ', short: 'KM' },
  { code: 'en', label: 'English', short: 'EN' },
];

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/* ---------------- i18n ---------------- */
const I18nCtx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState('th'); // Thai is the default language

  useEffect(() => {
    try {
      const saved = localStorage.getItem('aqr_lang');
      if (saved && DICTS[saved]) setLangState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
  }, [lang]);

  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem('aqr_lang', l); } catch {}
  }, []);

  const t = useCallback(
    (key, vars) => {
      let s = get(DICTS[lang], key);
      if (s === undefined) s = get(DICTS.en, key);
      if (s === undefined) return key;
      if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
      return s;
    },
    [lang]
  );

  /** Translate an API error code */
  const te = useCallback(
    (err) => {
      const code = err?.code || err?.message || 'server_error';
      const s = get(DICTS[lang], `errors.${code}`) ?? get(DICTS.en, `errors.${code}`);
      return s || get(DICTS[lang], 'errors.server_error');
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t, te }), [lang, setLang, t, te]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);

/* ---------------- theme ---------------- */
const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('system'); // 'light' | 'dark' | 'system'
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('aqr_theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') setThemeState(saved);
    } catch {}
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSystemDark(mq.matches);
    on();
    setReady(true);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    if (!ready) return; // the inline script in <head> already set the initial class
    const root = document.documentElement;
    root.classList.add('theme-transition');
    root.classList.toggle('dark', resolved === 'dark');
    const id = setTimeout(() => root.classList.remove('theme-transition'), 350);
    return () => clearTimeout(id);
  }, [resolved, ready]);

  const setTheme = useCallback((v) => {
    setThemeState(v);
    try { localStorage.setItem('aqr_theme', v); } catch {}
  }, []);
  const toggle = useCallback(() => setTheme(resolved === 'dark' ? 'light' : 'dark'), [resolved, setTheme]);

  const value = useMemo(() => ({ theme, resolved, setTheme, toggle }), [theme, resolved, setTheme, toggle]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

function ThemedToaster() {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3000,
        style: {
          borderRadius: '14px', padding: '10px 14px', fontSize: '14px',
          background: dark ? '#182238' : '#fff', color: dark ? '#e2e8f0' : '#1e293b',
          border: dark ? '1px solid #24304a' : 'none',
          boxShadow: '0 10px 30px -10px rgba(15,23,42,.25)',
        },
      }}
    />
  );
}

/* ---------------- auth ---------------- */
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ org_name: 'Asset PRC' });

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    try {
      setUser(await api('/auth/me'));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    api('/public/settings').then((s) => setSettings((p) => ({ ...p, ...s }))).catch(() => {});
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const r = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(r.token);
    setUser(r.user);
    return r.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  /** Permission helper: can('write') / can('admin') / can('manage') */
  const can = useCallback(
    (what) => {
      const role = user?.role;
      if (!role) return false;
      if (what === 'admin') return role === 'admin';
      if (what === 'manage') return role === 'admin' || role === 'manager';
      if (what === 'write') return role !== 'viewer';
      return true;
    },
    [user]
  );

  const value = useMemo(
    () => ({ user, setUser, loading, login, logout, refresh, can, settings, setSettings }),
    [user, loading, login, logout, refresh, can, settings]
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export default function Providers({ children }) {
  return (
    // reducedMotion="user": animations follow the device's "reduce motion" accessibility setting
    <MotionConfig reducedMotion="user">
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <InstallProvider>
            <RealtimeProvider>
              {children}
              <ScannerListener />
              <ThemedToaster />
            </RealtimeProvider>
          </InstallProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
    </MotionConfig>
  );
}
