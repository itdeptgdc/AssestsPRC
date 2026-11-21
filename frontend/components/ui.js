'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, animate, useAnimationControls } from 'framer-motion';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Inbox, Loader2, Search, X } from 'lucide-react';
import { useI18n } from './providers';

export const cn = clsx;

export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] } }),
};

export function Button({ variant = 'primary', size, loading, icon: Icon, children, className, ...props }) {
  return (
    <button className={cn('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)} disabled={loading || props.disabled} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, title, className, tone, ...props }) {
  const tones = {
    brand: 'hover:text-brand-600', green: 'hover:text-emerald-600 hover:border-emerald-200',
    amber: 'hover:text-amber-600 hover:border-amber-200', red: 'hover:text-rose-600 hover:border-rose-200',
  };
  return (
    <button type="button" title={title} aria-label={title} className={cn('btn-icon', tones[tone], className)} {...props}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function Card({ children, className, i = 0, ...props }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" custom={i} className={cn('card', className)} {...props}>
      {children}
    </motion.div>
  );
}

export function Field({ label, required, error, hint, children, className }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );
}

export function Input({ className, ...props }) {
  return <input className={cn('input', className)} {...props} />;
}
/** Password box with a show / hide (eye) button */
export function PasswordInput({ className, ...props }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} className={cn('input pr-11', className)} {...props} />
      <button type="button" onClick={() => setShow((s) => !s)} tabIndex={-1}
        aria-label={show ? t('common.hide_password') : t('common.show_password')} title={show ? t('common.hide_password') : t('common.show_password')}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={show ? 'off' : 'on'} initial={{ opacity: 0, scale: 0.6, rotate: -20 }} animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6, rotate: 20 }} transition={{ duration: 0.15 }} className="block">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn('input min-h-[90px] resize-y', className)} {...props} />;
}
export function Select({ className, children, placeholder, ...props }) {
  return (
    <select className={cn('input', className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
}

export function SearchInput({ value, onChange, placeholder, className }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input className="input pl-10 pr-9" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 select-none">
      <span
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-slate-300')}
      >
        <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }}
          className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow', checked ? 'right-0.5' : 'left-0.5')} />
      </span>
      {label && <span className="text-sm text-slate-600" onClick={() => onChange(!checked)}>{label}</span>}
    </label>
  );
}

export function Badge({ tone = 'slate', children, icon: Icon, className, dot }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600', brand: 'bg-brand-50 text-brand-700', green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700', red: 'bg-rose-50 text-rose-700', blue: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700', gray: 'bg-gray-100 text-gray-500', orange: 'bg-orange-50 text-orange-700',
  };
  const dots = { slate: 'bg-slate-400', brand: 'bg-brand-500', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-rose-500', blue: 'bg-sky-500', violet: 'bg-violet-500', gray: 'bg-gray-400', orange: 'bg-orange-500' };
  return (
    <span className={cn('chip', tones[tone], className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} />}
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-500', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 opacity-20 animate-ping" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 shadow-glow">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} />;
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-violet-50 text-brand-400">
        <Icon className="h-8 w-8" />
      </div>
      <p className="font-semibold text-slate-700">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-400">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  const sizes = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' };
  const panel = useAnimationControls();
  // Clicking outside does NOT close the dialog (protects unsaved input) — the panel shakes instead
  const nudge = () => panel.start({ x: [0, -10, 10, -6, 6, -2, 0], transition: { duration: 0.4 } });
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        // pointerEvents:'none' is applied the instant closing starts, so a closing (or stalled) exit
        // animation can never leave an invisible layer that blocks clicks on the page.
        <motion.div key="modal-root" className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
          initial={{ pointerEvents: 'auto' }} animate={{ pointerEvents: 'auto' }} exit={{ pointerEvents: 'none' }}>
          <motion.div className="absolute inset-0 cursor-not-allowed bg-slate-900/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.15 } }} onClick={nudge} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98, pointerEvents: 'none', transition: { duration: 0.16, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={cn('relative w-full', sizes[size])}
          >
          <motion.div animate={panel} className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:rotate-90 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 sm:px-6">{footer}</div>}
          </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, text, confirmText, loading, danger = true }) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={onClose} title={title || t('common.confirm')} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmText || t('common.confirm')}</Button>
      </>}>
      <p className="text-sm text-slate-600">{text}</p>
    </Modal>
  );
}

export function Pagination({ page, total, limit, onChange }) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row">
      <span>{t('common.showing', { from, to, total })}</span>
      <div className="flex items-center gap-1">
        <button className="btn-icon" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="h-4 w-4" /></button>
        <span className="px-3 font-medium text-slate-700">{page} / {pages}</span>
        <button className="btn-icon" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function Segmented({ value, onChange, options, size, id }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn('relative rounded-lg px-3 font-medium transition-colors', size === 'sm' ? 'py-1 text-xs' : 'py-1.5 text-sm',
            value === o.value ? 'text-brand-700' : 'text-slate-500 hover:text-slate-700')}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${id || options.map((x) => x.value).join('')}`} className="absolute inset-0 rounded-lg bg-brand-50 ring-1 ring-brand-200"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Tabs({ value, onChange, tabs }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200">
      {tabs.map((tab) => (
        <button key={tab.value} type="button" onClick={() => onChange(tab.value)}
          className={cn('relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors',
            value === tab.value ? 'text-brand-700' : 'text-slate-500 hover:text-slate-700')}>
          {tab.icon && <tab.icon className="h-4 w-4" />}
          {tab.label}
          {tab.count !== undefined && <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-500">{tab.count}</span>}
          {value === tab.value && <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
        </button>
      ))}
    </div>
  );
}

/** Animated number */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString('en-US'), duration = 1 }) {
  const ref = useRef(null);
  const prev = useRef(0);
  useEffect(() => {
    const to = Number(value) || 0;
    const controls = animate(prev.current, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => { if (ref.current) ref.current.textContent = format(v); },
    });
    prev.current = to;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span ref={ref}>{format(0)}</span>;
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'brand', i = 0, onClick, format }) {
  const tones = {
    brand: ['from-brand-500 to-violet-500', 'bg-brand-50 text-brand-600'],
    green: ['from-emerald-400 to-teal-500', 'bg-emerald-50 text-emerald-600'],
    red: ['from-rose-400 to-pink-500', 'bg-rose-50 text-rose-600'],
    amber: ['from-amber-400 to-orange-500', 'bg-amber-50 text-amber-600'],
  };
  return (
    <motion.button
      type="button"
      variants={fadeUp} initial="hidden" animate="show" custom={i}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="card group relative overflow-hidden p-5 text-left transition-shadow hover:shadow-lg"
    >
      <div className={cn('absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-10 transition-transform duration-500 group-hover:scale-150', tones[tone][0])} />
      <div className="relative flex items-start justify-between">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:rotate-6 group-hover:scale-110', tones[tone][1])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="relative mt-3 text-3xl font-extrabold tracking-tight text-slate-900"><CountUp value={value} format={format} /></p>
      {sub && <p className="relative mt-1 text-xs text-slate-400">{sub}</p>}
    </motion.button>
  );
}

/** Small key/value row used on detail pages */
export function InfoRow({ label, children, mono }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className={cn('text-sm font-medium text-slate-700 break-words', mono && 'font-mono')}>{children || '-'}</span>
    </div>
  );
}

export function useLocalState(key, initial) {
  const [v, setV] = useState(initial);
  useEffect(() => {
    try { const s = localStorage.getItem(key); if (s !== null) setV(JSON.parse(s)); } catch {}
  }, [key]);
  const set = (val) => {
    setV((p) => {
      const next = typeof val === 'function' ? val(p) : val;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  return [v, set];
}
