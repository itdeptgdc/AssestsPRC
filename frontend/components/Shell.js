'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import ScanIcon from './ScanIcon';
import {
  AlertTriangle, Bell, Building2, CalendarClock, Download, LayoutDashboard, LogOut, Menu, Package, RefreshCw, ScanLine, Search, Wrench, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth, useI18n } from './providers';
import { NAV, canSee, isActive, pageTitleKey } from './nav';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';
import Logo, { LogoMark } from './Logo';
import { InstallBanner, InstallButton, useInstall } from './InstallApp';
import { LIVE_ICON, useRealtime } from './Realtime';
import { fmtDateTime } from '@/lib/format';
import { cn } from './ui';

const W_OPEN = 264;
const W_CLOSED = 84;

/* ---------- "menu fold / unfold" icon: three lines + an arrow that flips; lines shift on hover ---------- */
const spring = { type: 'spring', stiffness: 420, damping: 28 };
function FoldIcon({ collapsed, hover }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="currentColor" strokeWidth="2">
        <motion.line x1="11" y1="6" y2="6" x2="21" initial={{ x1: 11 }} animate={{ x1: hover ? 13 : 11 }} transition={spring} />
        <motion.line x1="11" y1="12" y2="12" x2="21" initial={{ x1: 11 }} animate={{ x1: hover ? (collapsed ? 11 : 15) : 11 }} transition={spring} />
        <motion.line x1="11" y1="18" y2="18" x2="21" initial={{ x1: 11 }} animate={{ x1: hover ? 13 : 11 }} transition={spring} />
      </g>
      {/* arrow: points left when open (fold), right when collapsed (unfold) */}
      <motion.path
        d="M7.5 8 3.5 12l4 4"
        className="stroke-brand-600"
        strokeWidth="2.2"
        animate={{ rotate: collapsed ? 180 : 0, x: hover ? (collapsed ? 1 : -1) : 0 }}
        style={{ originX: '5.5px', originY: '12px' }}
        transition={spring}
      />
    </svg>
  );
}

function HeaderToggle({ collapsed, onToggle, label }) {
  const [hover, setHover] = useState(false);
  return (
    <motion.button
      type="button" onClick={onToggle} whileTap={{ scale: 0.9 }}
      onHoverStart={() => setHover(true)} onHoverEnd={() => setHover(false)}
      title={`${label} (Ctrl+B)`} aria-label={label} aria-expanded={!collapsed}
      className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-brand-300 hover:text-slate-900 hover:shadow-[0_6px_18px_-8px_rgba(79,70,229,.45)] lg:flex"
    >
      <FoldIcon collapsed={collapsed} hover={hover} />
    </motion.button>
  );
}

/** Round handle on the sidebar's right edge */
function EdgeToggle({ collapsed, onToggle, width, label }) {
  return (
    <motion.button
      type="button" onClick={onToggle} whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
      title={`${label} (Ctrl+B)`} aria-label={label}
      className="no-print fixed top-[22px] z-40 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_4px_14px_-4px_rgba(15,23,42,.35)] transition-[left,color] duration-300 ease-[cubic-bezier(.22,1,.36,1)] hover:text-brand-600 lg:flex"
      style={{ left: width - 14 }}
    >
      <motion.svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        animate={{ rotate: collapsed ? 180 : 0 }} transition={spring}>
        <path d="m14.5 6-6 6 6 6" />
      </motion.svg>
    </motion.button>
  );
}

/* ---------- sidebar ---------- */
function SidebarContent({ onNavigate, collapsed = false, idPrefix = 'd' }) {
  const { t } = useI18n();
  const { user, logout, settings, can } = useAuth();
  const install = useInstall();
  const pathname = usePathname();
  const [tip, setTip] = useState(null); // {label, top} — tooltip when collapsed

  const showTip = (e, label) => {
    if (!collapsed) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2 });
  };

  return (
    <div className="flex h-full flex-col bg-[#0f1424] text-slate-300">
      <div className={cn('flex h-[72px] items-center', collapsed ? 'justify-center px-2' : 'px-5')}>
        <Logo dark collapsed={collapsed} title={settings.org_name || 'Asset PRC'} subtitle={t('app.workspace')} size={42} />
      </div>

      <nav className="scroll-dark flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 pb-4" onMouseLeave={() => setTip(null)}>
        {NAV.map((group, gi) => {
          const items = group.items.filter((it) => canSee(can, it));
          if (!items.length) return null;
          return (
            <div key={gi}>
              {group.section && (collapsed
                ? <div className="mx-auto mb-2 h-px w-8 bg-white/10" />
                : <p className="mb-1.5 truncate px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t(`nav.section.${group.section}`)}</p>)}
              <div className="space-y-0.5">
                {items.map((it) => {
                  const active = isActive(pathname, it.href);
                  const label = t(`nav.${it.key}`);
                  return (
                    <Link key={it.href} href={it.href} onClick={onNavigate} aria-label={label}
                      onMouseEnter={(e) => showTip(e, label)} onMouseLeave={() => setTip(null)}
                      className={cn('group relative flex items-center rounded-xl py-2.5 text-[14px] font-medium transition-colors',
                        collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                        active ? 'text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>
                      {active && (
                        <motion.span layoutId={`nav-active-${idPrefix}${collapsed ? '-c' : ''}`} className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 shadow-glow"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                      )}
                      <it.icon className="relative h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110" />
                      {!collapsed && <span className="relative truncate">{label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* tooltip for collapsed mode (fixed so the scroll container never clips it) */}
      <AnimatePresence>
        {collapsed && tip && (
          <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
            className="pointer-events-none fixed z-[70] whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl ring-1 ring-white/10"
            style={{ left: W_CLOSED + 6, top: tip.top, y: '-50%' }}>
            {tip.label}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2 border-t border-white/5 p-3">
        {!install?.installed && (collapsed ? (
          <button onClick={install?.install} title={t('install.button')} className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-brand-200 transition hover:bg-white/10">
            <Download className="h-4 w-4" />
          </button>
        ) : <InstallButton variant="sidebar" />)}
        <div className={cn('flex items-center rounded-xl p-2', collapsed ? 'flex-col gap-2' : 'gap-3')}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-sm font-bold text-white" title={user?.name}>
            {(user?.name || '?').slice(0, 1).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{t(`roles.${user?.role}`)}</p>
            </div>
          )}
          <button onClick={logout} title={t('auth.logout')} className="rounded-lg p-2 text-slate-500 transition hover:bg-white/10 hover:text-rose-400">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- refresh current page data ---------- */
function RefreshButton({ onRefresh }) {
  const { t } = useI18n();
  const [spinning, setSpinning] = useState(false);
  const click = () => {
    if (spinning) return;
    setSpinning(true);
    onRefresh();
    setTimeout(() => {
      setSpinning(false);
      toast.success(t('common.refreshed'), { id: 'refreshed', duration: 1500 });
    }, 700);
  };
  return (
    <motion.button type="button" onClick={click} whileTap={{ scale: 0.88 }} title={t('common.refresh')} aria-label={t('common.refresh')}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-brand-200 hover:text-brand-600">
      <motion.span className="flex" animate={spinning ? { rotate: 360 } : { rotate: 0 }}
        transition={spinning ? { duration: 0.7, ease: 'easeInOut' } : { duration: 0 }}>
        <RefreshCw className="h-[18px] w-[18px]" />
      </motion.span>
    </motion.button>
  );
}

/* ---------- notifications ---------- */
function Notifications({ refreshKey }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ count: 0, items: [] });
  const ref = useRef(null);
  const pathname = usePathname();

  useEffect(() => { api('/notifications').then(setData).catch(() => {}); }, [pathname, refreshKey]);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const ICON = { overdue: [AlertTriangle, 'bg-rose-50 text-rose-500'], due_soon: [CalendarClock, 'bg-amber-50 text-amber-500'], repair: [Wrench, 'bg-orange-50 text-orange-500'] };
  // real-time "new item" notifications (department / asset code / asset)
  const live = useRealtime();
  const liveItems = live?.items || [];
  const total = data.count + (live?.unread || 0);
  const liveHref = (e) => (e.type === 'asset' ? `/assets/${e.ref}` : e.type === 'department' ? '/master/departments' : '/master/categories');
  const toggle = () => setOpen((o) => { if (!o) live?.markSeen(); return !o; });

  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} aria-label={t('notifications.title')} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-brand-200 hover:text-brand-600">
        <Bell key={liveItems[0]?.rid || 'bell'} className={cn('h-[18px] w-[18px]', total > 0 && 'origin-top animate-[wiggle_1s_ease-in-out_2]')} />
        {total > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
            className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="font-semibold text-slate-800">{t('notifications.title')}</p>
              <span className="text-xs text-slate-400">{data.items.length + liveItems.length}</span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-1.5">
              {liveItems.length > 0 && (
                <div className="mb-1 border-b border-slate-100 pb-1">
                  <div className="flex items-center justify-between px-3 pb-1 pt-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('live.recent')}</p>
                    <button type="button" onClick={live.clear} className="text-[11px] font-medium text-brand-600 hover:underline">{t('live.clear')}</button>
                  </div>
                  {liveItems.map((e) => {
                    const [Icon, cls] = LIVE_ICON[e.type] || LIVE_ICON.asset;
                    return (
                      <Link key={e.rid} href={liveHref(e)} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50">
                        <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', cls)}><Icon className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-700">{live.messageFor(e, t)}</p>
                          <p className="truncate text-xs text-slate-400">{[e.code && e.type === 'asset' ? e.code : null, e.by && t('live.by', { name: e.by }), fmtDateTime(e.at, lang)].filter(Boolean).join(' · ')}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
              {data.items.length === 0 && liveItems.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">{t('notifications.empty')}</p>
              ) : data.items.map((n, i) => {
                const [Icon, cls] = ICON[n.type];
                return (
                  <Link key={i} href={`/assets/${n.type === 'repair' ? n.asset_id : n.id}`} onClick={() => setOpen(false)}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50">
                    <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', cls)}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700">{n.type === 'repair' ? `${n.ticket_no} · ${n.code}` : `${n.code} · ${n.name}`}</p>
                      <p className="truncate text-xs text-slate-400">
                        {n.type === 'overdue' && t('notifications.overdue', { n: Math.abs(n.days_left) })}
                        {n.type === 'due_soon' && t('notifications.due_soon', { n: n.days_left })}
                        {n.type === 'repair' && n.problem}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GlobalSearch() {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/assets?q=${encodeURIComponent(q.trim())}`); }} className="relative hidden md:block">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('topbar.search')}
        className="h-10 w-56 rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-3 text-sm outline-none transition-all focus:w-80 focus:border-brand-300 focus:bg-white focus:ring-4 focus:ring-brand-100 lg:w-72" />
    </form>
  );
}

/* ---------- Android-style bottom navigation (Material 3) ---------- */
function MobileNav({ onMenu }) {
  const { t } = useI18n();
  const { can } = useAuth();
  const pathname = usePathname();
  // short one-line labels for the phone bar (the sidebar keeps the full names)
  const items = [
    { href: '/', icon: LayoutDashboard, label: t('mnav.dashboard'), key: 'dashboard' },
    { href: '/assets', icon: Package, label: t('mnav.assets'), key: 'assets' },
    { href: '/scan', icon: ScanLine, label: t('nav.scan'), center: true, key: 'scan' },
    { href: '/master/departments', icon: Building2, label: t('mnav.departments'), key: 'departments' },
  ];
  // every item = 32px icon row + one label line, so all labels sit on the same baseline
  const label = (text, active) => (
    <span className={cn('block w-full truncate px-0.5 text-center text-[10.5px] leading-4', active ? 'font-semibold text-brand-700' : 'font-medium text-slate-500')}>{text}</span>
  );
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 select-none border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgba(15,23,42,.15)] backdrop-blur-lg lg:hidden">
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-end pb-2">
        {items.map((it) => {
          if (!canSee(can, it)) return <span key={it.href} aria-hidden />; // keep the 5-slot layout
          const active = isActive(pathname, it.href);
          if (it.center) {
            return (
              <Link key={it.href} href={it.href} aria-label={it.label} className="flex min-w-0 flex-col items-center gap-1">
                {/* raised action button: anchored to the icon row and rising above the bar */}
                {/* centring lives on a plain flex wrapper: framer-motion's tap transform would overwrite a CSS translate and make the button jump sideways */}
                <span className="relative flex h-8 w-full items-end justify-center">
                  <motion.span whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 600, damping: 30 }}
                    className={cn('relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 via-indigo-500 to-violet-600 text-white ring-4 ring-[var(--bg)] transition-shadow',
                      active ? 'shadow-glow' : 'shadow-lg shadow-brand-500/30')}>
                    {/* soft top highlight for depth */}
                    <span aria-hidden className="pointer-events-none absolute inset-x-2 top-1 h-4 rounded-full bg-white/25 blur-[6px]" />
                    <ScanIcon className="h-6 w-6" />
                  </motion.span>
                </span>
                {label(it.label, active)}
              </Link>
            );
          }
          return (
            <Link key={it.href} href={it.href} aria-label={it.label} className="flex min-w-0 flex-col items-center gap-1">
              <motion.span whileTap={{ scale: 0.88 }} className="relative flex h-8 w-14 max-w-full items-center justify-center">
                {active && <motion.span layoutId="m3-pill" className="absolute inset-0 rounded-full bg-brand-100" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <it.icon className={cn('relative h-5 w-5', active ? 'text-brand-700' : 'text-slate-500')} />
              </motion.span>
              {label(it.label, active)}
            </Link>
          );
        })}
        <button type="button" onClick={onMenu} aria-label={t('nav.menu')} className="flex min-w-0 flex-col items-center gap-1">
          <motion.span whileTap={{ scale: 0.88 }} className="flex h-8 w-14 max-w-full items-center justify-center"><Menu className="h-5 w-5 text-slate-500" /></motion.span>
          {label(t('nav.menu'), false)}
        </button>
      </div>
    </nav>
  );
}

export default function Shell({ children }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // remounts the page content so every list / chart re-fetches from the server
  const refresh = useCallback(() => { setRefreshKey((k) => k + 1); router.refresh(); }, [router]);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('aqr_sidebar') === 'collapsed'); } catch {}
  }, []);
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try { localStorage.setItem('aqr_sidebar', !c ? 'collapsed' : 'open'); } catch {}
      return !c;
    });
  }, []);

  // keyboard shortcut: Ctrl/⌘ + B
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggle(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  useEffect(() => { setDrawer(false); }, [pathname]);

  // closed drawer: remove from tab order / screen readers; Esc closes it
  const drawerRef = useRef(null);
  useEffect(() => {
    const el = drawerRef.current;
    if (!el) return;
    if (drawer) el.removeAttribute('inert'); else el.setAttribute('inert', '');
    if (!drawer) return;
    const onKey = (e) => e.key === 'Escape' && setDrawer(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  const width = collapsed ? W_CLOSED : W_OPEN;

  return (
    <div className="min-h-screen" style={{ '--sb': `${width}px` }}>
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(.22,1,.36,1)] lg:block" style={{ width }}>
        <SidebarContent collapsed={collapsed} />
      </aside>
      <EdgeToggle collapsed={collapsed} onToggle={toggle} width={width} label={collapsed ? t('nav.expand') : t('nav.collapse')} />

      {/* Mobile drawer — always mounted; when closed it is click-through + not focusable,
          so an interrupted animation can never leave an invisible layer over the app */}
      <div ref={drawerRef} aria-hidden={!drawer} className={cn('no-print fixed inset-0 z-50 lg:hidden', !drawer && 'pointer-events-none')}>
        <motion.div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" initial={false}
          animate={{ opacity: drawer ? 1 : 0 }} transition={{ duration: 0.2 }} onClick={() => setDrawer(false)} />
        <motion.aside initial={false} animate={{ x: drawer ? 0 : '-105%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          drag={drawer ? 'x' : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0.4, right: 0 }} onDragEnd={(_, info) => info.offset.x < -80 && setDrawer(false)}
          className="absolute inset-y-0 left-0 w-[290px] max-w-[85vw] overflow-hidden rounded-r-3xl pt-[env(safe-area-inset-top)] shadow-2xl">
          <SidebarContent idPrefix="m" onNavigate={() => setDrawer(false)} />
          <button onClick={() => setDrawer(false)} className="absolute right-3 top-6 rounded-lg p-1.5 text-slate-400 hover:bg-white/10" aria-label="close"><X className="h-5 w-5" /></button>
        </motion.aside>
      </div>

      <div className="transition-[padding] duration-300 ease-[cubic-bezier(.22,1,.36,1)] lg:pl-[var(--sb)] print:pl-0">
        {/* Top app bar */}
        <header className="no-print sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6">
            {/* desktop collapse toggle */}
            <HeaderToggle collapsed={collapsed} onToggle={toggle} label={collapsed ? t('nav.expand') : t('nav.collapse')} />
            {/* mobile: app logo instead of hamburger (menu lives in bottom nav) */}
            <Link href="/" className="lg:hidden"><LogoMark size={36} /></Link>
            <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold text-slate-800 sm:text-[15px]">{t(`nav.${pageTitleKey(pathname)}`)}</h2>
            <GlobalSearch />
            <RefreshButton onRefresh={refresh} />
            <LanguageSwitcher />
            <ThemeToggle />
            <Notifications refreshKey={refreshKey} />
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-6 lg:pb-10 print:p-0">
          <InstallBanner />
          <motion.div key={`${pathname}#${refreshKey}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
            {children}
          </motion.div>
        </main>
      </div>
      <MobileNav onMenu={() => setDrawer(true)} />
    </div>
  );
}
