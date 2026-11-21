'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, CalendarCheck, CalendarClock, Check, Copy, Hash, MapPin, SearchX, ShieldCheck, Tag, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/format';
import { useI18n } from './providers';
import { AssetStatusBadge, DueBadge, daysUntil } from './status';
import Gallery from './Gallery';

/** Product photo gallery for result cards (kept as a named export for existing imports) */
export const PhotoGallery = (props) => <Gallery id="scan" {...props} />;

function CopyCode({ code }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setDone(true); toast.success(t('scan.copied')); setTimeout(() => setDone(false), 1500);
    } catch { /* clipboard blocked (http) — ignore */ }
  };
  return (
    <button type="button" onClick={copy} title={t('scan.copy')} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-brand-50 hover:text-brand-600">
      {done ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

/** "Verified asset" result card shown after a successful QR scan (in-app scanner and public QR page) */
export function ScanResult({ asset: a, children }) {
  const { t, lang } = useI18n();
  const due = a.next_inspection ? daysUntil(a.next_inspection) : null;
  const rows = [
    [Tag, t('assets.category'), [a.category_code && `${a.category_code} · ${a.category_name}`, a.type_name].filter(Boolean).join('  ›  ') || a.category_name],
    [Building2, t('code.department'), a.department_name && (a.department_no ? `${a.department_no} · ${a.department_name}` : a.department_name)],
    [MapPin, t('assets.location'), [a.building, a.floor, a.location_name].filter(Boolean).join(' · ')],
    [User, t('assets.custodian'), a.custodian_name],
    [CalendarCheck, t('assets.last_inspection'), a.last_inspection && fmtDate(a.last_inspection, lang)],
    [CalendarClock, t('assets.next_inspection'), a.next_inspection && fmtDate(a.next_inspection, lang), due !== null && <DueBadge days={due} />],
  ];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3">
        <motion.span initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.05 }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
          <ShieldCheck className="h-5 w-5" />
        </motion.span>
        <div className="min-w-0">
          <p className="font-bold text-emerald-800">{t('scan.verified')}</p>
          <p className="truncate text-xs text-emerald-700/80">{t('scan.verified_sub')}</p>
        </div>
      </motion.div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.08 }}>
          <PhotoGallery images={a.images} color={a.category_color}
            overlay={<span className="absolute left-3 top-3"><AssetStatusBadge status={a.status} /></span>} />
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 }} className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 font-mono text-sm font-bold tracking-wide text-brand-700">
              <Hash className="h-3.5 w-3.5" />{a.code}
            </span>
            <CopyCode code={a.code} />
          </div>
          <h2 className="mt-2 text-xl font-bold leading-snug text-slate-900 sm:text-2xl">{a.name}</h2>
          {(a.brand || a.model) && <p className="mt-0.5 text-sm text-slate-500">{[a.brand, a.model].filter(Boolean).join(' · ')}</p>}
          {a.company_name && <p className="mt-0.5 text-xs text-slate-400">{a.company_name}</p>}

          <div className="mt-4 space-y-2">
            {rows.map(([Icon, label, value, extra], k) => (
              <motion.div key={k} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 + k * 0.04 }}
                className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5">
                <Icon className="h-4 w-4 shrink-0 text-brand-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-400">{label}</p>
                  <p className="truncate text-sm font-medium text-slate-700">{value || '—'}</p>
                </div>
                {extra}
              </motion.div>
            ))}
          </div>
          {children && <div className="mt-4">{children}</div>}
        </motion.div>
      </div>
    </div>
  );
}

/** Shown when the scanned code is not a registered asset */
export function ScanNotFound({ code, children }) {
  const { t } = useI18n();
  return (
    <div className="py-2 text-center">
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1, x: [0, -8, 8, -5, 5, 0] }}
        transition={{ scale: { type: 'spring', stiffness: 380, damping: 18 }, x: { delay: 0.25, duration: 0.45 } }}
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500 ring-8 ring-rose-50/60">
        <SearchX className="h-8 w-8" />
      </motion.div>
      <h3 className="mt-4 text-lg font-bold text-slate-900">{t('scan.unregistered')}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{t('scan.unregistered_sub')}</p>
      <div className="mx-auto mt-4 inline-flex max-w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2">
        <span className="text-xs text-slate-400">{t('scan.scanned_code')}</span>
        <span className="truncate font-mono text-sm font-bold text-slate-700">{code}</span>
      </div>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
