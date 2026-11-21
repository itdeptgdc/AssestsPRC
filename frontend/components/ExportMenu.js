'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadFile } from '@/lib/api';
import { useI18n } from './providers';
import { cn } from './ui';

export const EXPORT_FORMATS = [
  { format: 'xlsx', icon: FileSpreadsheet, tone: 'bg-emerald-50 text-emerald-600', label: 'export.excel', hint: 'export.excel_hint' },
  { format: 'pdf', icon: FileText, tone: 'bg-rose-50 text-rose-600', label: 'export.pdf', hint: 'export.pdf_hint' },
];

/** Hook: download `path` as Excel or PDF, with a busy flag per format and error toasts */
export function useExport(path, name, params) {
  const { t, te } = useI18n();
  const [busy, setBusy] = useState(null);
  const run = async (format) => {
    if (busy) return;
    setBusy(format);
    const id = toast.loading(t('export.preparing'));
    try {
      await downloadFile(path, `${name}.${format}`, { ...(params || {}), format });
      toast.success(t('export.done'), { id });
    } catch (e) {
      toast.error(te(e), { id });
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

/**
 * "Export ▾" button with Excel (.xlsx) and PDF options.
 * count: optional badge on the button (e.g. number of selected rows); scope: optional line at the top of the menu
 */
export default function ExportMenu({ path, name, params, className, count, scope }) {
  const { t } = useI18n();
  const { busy, run } = useExport(path, name, params);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className={cn('btn btn-secondary', open && 'border-brand-200 text-brand-600')}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {t('common.export')}
        {count > 0 && <span className="rounded-full bg-brand-600 px-1.5 py-px text-[11px] font-bold leading-4 text-white">{count}</span>}
        <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97, pointerEvents: 'none' }} transition={{ duration: 0.12 }}
            className="absolute right-0 z-30 mt-1.5 w-64 origin-top-right rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl">
            {scope && <p className="mb-1 border-b border-slate-100 px-2.5 pb-2 pt-1 text-xs font-medium text-slate-500">{scope}</p>}
            {EXPORT_FORMATS.map(({ format, icon: Icon, tone, label, hint }) => (
              <button key={format} type="button" role="menuitem" onClick={() => { setOpen(false); run(format); }}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-slate-50">
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tone)}>
                  {busy === format ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">{t(label)}</span>
                  <span className="block text-xs text-slate-400">{t(hint)}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
