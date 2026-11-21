'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, CalendarCheck, CalendarClock, ClipboardCheck, Layers, Package } from 'lucide-react';
import { useAuth, useI18n } from '@/components/providers';
import { useApi, useDebounce } from '@/lib/hooks';
import { imgUrl } from '@/lib/api';
import { catLabel, fmtDate } from '@/lib/format';
import { Button, CountUp, EmptyState, PageHeader, SearchInput, Select, Skeleton, cn } from '@/components/ui';
import { DueBadge } from '@/components/status';
import { InspectionModal } from '@/components/ActionModals';

export default function SchedulePage() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const [filter, setFilter] = useState('upcoming');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [inspect, setInspect] = useState(null);
  const dq = useDebounce(q);
  const { data: lk } = useApi('/lookups');
  const { data, loading, reload } = useApi('/inspections/schedule', { filter, q: dq, category_id: category });
  const c = data?.counts || {};

  const tiles = [
    { k: 'overdue', icon: AlertTriangle, value: c.overdue, cls: 'from-rose-500 to-pink-500' },
    { k: 'due_soon', icon: CalendarClock, value: c.due_soon, cls: 'from-amber-400 to-orange-500' },
    { k: 'upcoming', icon: CalendarCheck, value: (Number(c.overdue) || 0) + (Number(c.due_soon) || 0), cls: 'from-brand-500 to-violet-500' },
    { k: 'all', icon: Layers, value: c.total, cls: 'from-slate-500 to-slate-700' },
  ];

  return (
    <div>
      <PageHeader title={t('schedule.title')} subtitle={t('schedule.subtitle', { n: data?.days || 30 })}
        actions={can('write') && <Button icon={ClipboardCheck} onClick={() => setInspect({})}>{t('inspection.new')}</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((x, i) => (
          <motion.button key={x.k} onClick={() => setFilter(x.k)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }}
            className={cn('relative overflow-hidden rounded-2xl p-4 text-left text-white shadow-soft transition bg-gradient-to-br', x.cls, filter === x.k ? 'ring-4 ring-offset-2 ring-brand-200' : 'opacity-90 hover:opacity-100')}>
            <x.icon className="absolute -right-2 -top-2 h-16 w-16 opacity-15" />
            <p className="text-xs font-medium text-white/80">{t(`schedule.${x.k}`)}</p>
            <p className="mt-1 text-3xl font-extrabold"><CountUp value={x.value} /></p>
          </motion.button>
        ))}
      </div>

      <div className="card mb-4 flex flex-col gap-2 p-3 sm:flex-row">
        <SearchInput className="flex-1" value={q} onChange={setQ} placeholder={t('assets.search')} />
        <Select className="sm:w-64" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t('assets.all_categories')}>
          {lk?.categories.map((x) => <option key={x.id} value={x.id}>{catLabel(x)}</option>)}
        </Select>
      </div>

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (data?.items || []).length === 0 ? (
        <div className="card"><EmptyState icon={CalendarCheck} title={t('schedule.empty')} text={t('schedule.empty_text')} /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}
              className={cn('card group flex gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lg', a.days_left < 0 && 'border-rose-200 bg-rose-50/30')}>
              <Link href={`/assets/${a.id}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                {a.images?.[0]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={imgUrl(a.images[0])} alt="" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center text-slate-300"><Package className="h-6 w-6" /></div>}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/assets/${a.id}`} className="block truncate font-semibold text-slate-800 hover:text-brand-600">{a.name}</Link>
                <p className="font-mono text-xs text-brand-600">{a.code}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">{[a.category_name, a.location_name].filter(Boolean).join(' · ')}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <DueBadge days={a.days_left} />
                    <span className="mt-0.5 text-[11px] text-slate-400">{fmtDate(a.next_inspection, lang)}</span>
                  </div>
                  {can('write') && <Button size="sm" variant="soft" icon={ClipboardCheck} onClick={() => setInspect(a)}>{t('assets.inspect')}</Button>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <InspectionModal open={!!inspect} asset={inspect?.id ? inspect : null} onClose={() => setInspect(null)} onSaved={reload} />
    </div>
  );
}
