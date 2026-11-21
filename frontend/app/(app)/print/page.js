'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckSquare, Printer, Square } from 'lucide-react';
import { useAuth, useI18n } from '@/components/providers';
import { useApi, useDebounce } from '@/lib/hooks';
import { api } from '@/lib/api';
import { catLabel } from '@/lib/format';
import { Button, EmptyState, PageHeader, PageLoader, SearchInput, Segmented, Select, Skeleton, cn } from '@/components/ui';
import QrCode from '@/components/QrCode';

function Label({ a, template, org }) {
  if (template === 'small') {
    return (
      <div className="keep-light print-break flex flex-col items-center rounded-xl border border-slate-300 bg-white p-2 text-center">
        <QrCode code={a.code} size={96} />
        <p className="mt-1 font-mono text-[10px] font-bold leading-tight text-slate-900">{a.code}</p>
      </div>
    );
  }
  return (
    <div className="keep-light print-break flex items-center gap-3 overflow-hidden rounded-xl border border-slate-300 bg-white p-3">
      <QrCode code={a.code} size={template === 'card' ? 104 : 88} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="h-5 w-5 shrink-0 object-contain" />
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{a.company_name || org}</span>
        </div>
        <p className="font-mono text-[13px] font-bold leading-tight text-slate-900">{a.code}</p>
        <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-snug text-slate-700">{a.name}</p>
        {template === 'card' && (
          <p className="mt-0.5 truncate text-[10px] text-slate-500">{[a.department_code || a.department_name, a.location_name].filter(Boolean).join(' · ')}</p>
        )}
      </div>
    </div>
  );
}

export default function PrintPage() {
  return <Suspense fallback={<PageLoader />}><PrintInner /></Suspense>;
}

function PrintInner() {
  const sp = useSearchParams();
  const searchParams = { ids: sp.get('ids') };
  const { t } = useI18n();
  const { settings } = useAuth();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [template, setTemplate] = useState('card');
  const dq = useDebounce(q);
  const { data: lk } = useApi('/lookups');
  const { data, loading } = useApi('/assets', { q: dq, category_id: category, limit: 200 });
  const items = data?.items || [];

  // preselect from ?ids=1,2,3
  useEffect(() => {
    const ids = String(searchParams.ids || '').split(',').map(Number).filter(Boolean);
    if (!ids.length) return;
    Promise.all(ids.map((id) => api(`/assets/${id}`).catch(() => null))).then((list) => {
      const ok = list.filter(Boolean);
      setSelected(ok.map((a) => a.id));
      setSelectedItems(Object.fromEntries(ok.map((a) => [a.id, a])));
    });
  }, [searchParams.ids]);

  const toggle = (a) => {
    setSelected((s) => (s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id]));
    setSelectedItems((m) => ({ ...m, [a.id]: a }));
  };
  const allSelected = items.length > 0 && items.every((a) => selected.includes(a.id));
  const toggleAll = () => {
    if (allSelected) setSelected((s) => s.filter((id) => !items.some((a) => a.id === id)));
    else {
      setSelected((s) => [...new Set([...s, ...items.map((a) => a.id)])]);
      setSelectedItems((m) => ({ ...m, ...Object.fromEntries(items.map((a) => [a.id, a])) }));
    }
  };
  const printList = useMemo(() => selected.map((id) => selectedItems[id]).filter(Boolean), [selected, selectedItems]);
  const grid = template === 'small' ? 'grid-cols-3 sm:grid-cols-5 print:grid-cols-6' : template === 'card' ? 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-3';

  return (
    <div>
      <div className="no-print">
        <PageHeader title={t('print.title')} subtitle={t('print.subtitle')}
          actions={<Button icon={Printer} disabled={!printList.length} onClick={() => window.print()}>{t('print.print_n', { n: printList.length })}</Button>} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr] print:block">
        {/* Selector */}
        <div className="no-print card flex max-h-[75vh] flex-col overflow-hidden">
          <div className="space-y-2 border-b border-slate-100 p-3">
            <SearchInput value={q} onChange={setQ} placeholder={t('assets.search')} />
            <Select value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t('assets.all_categories')}>
              {lk?.categories.map((x) => <option key={x.id} value={x.id}>{catLabel(x)}</option>)}
            </Select>
            <button onClick={toggleAll} className="flex items-center gap-2 px-1 text-sm font-medium text-brand-600">
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}{t('print.select_all')} ({items.length})
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {loading && !data ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="m-2 h-10" />) :
              items.map((a) => {
                const on = selected.includes(a.id);
                return (
                  <button key={a.id} onClick={() => toggle(a)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition', on ? 'bg-brand-50' : 'hover:bg-slate-50')}>
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300')}>
                      {on && <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></motion.svg>}
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-brand-600">{a.code}</p>
                      <p className="truncate text-sm text-slate-700">{a.name}</p>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
            <Segmented id="tpl" value={template} onChange={setTemplate} options={[
              { value: 'card', label: t('print.tpl_card') },
              { value: 'label', label: t('print.tpl_label') },
              { value: 'small', label: t('print.tpl_small') },
            ]} />
            {printList.length > 0 && <button onClick={() => setSelected([])} className="text-sm text-slate-500 hover:text-rose-600">{t('print.clear')}</button>}
          </div>
          <div className="print-area card min-h-[300px] p-4 print:border-0 print:p-0 print:shadow-none">
            {printList.length === 0 ? (
              <EmptyState icon={Printer} title={t('print.empty')} text={t('print.empty_text')} />
            ) : (
              <div className={cn('grid gap-3', grid)}>
                {printList.map((a) => <Label key={a.id} a={a} template={template} org={settings.org_name} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
