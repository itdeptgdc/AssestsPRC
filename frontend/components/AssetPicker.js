'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Package, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useDebounce } from '@/lib/hooks';
import { useI18n } from './providers';
import { Spinner } from './ui';

/** Searchable asset selector */
export default function AssetPicker({ value, onChange }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const dq = useDebounce(q, 250);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api('/assets', { params: { q: dq, limit: 8 } })
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [dq, open]);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-3 py-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm"><Package className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{value.name}</p>
          <p className="font-mono text-xs text-brand-600">{value.code}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-rose-500"><X className="h-4 w-4" /></button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input className="input pl-10" placeholder={t('picker.placeholder')} value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl">
            {loading ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t('common.no_results')}</p>
            ) : (
              items.map((a) => (
                <button type="button" key={a.id} onClick={() => { onChange(a); setOpen(false); setQ(''); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-brand-50">
                  <span className="font-mono text-xs font-semibold text-brand-600">{a.code}</span>
                  <span className="truncate text-sm text-slate-700">{a.name}</span>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
