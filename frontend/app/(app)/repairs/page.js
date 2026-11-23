'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Package, Plus, Wrench } from 'lucide-react';
import { useAuth, useI18n } from '@/components/providers';
import { useApi, useDebounce } from '@/lib/hooks';
import { imgUrl } from '@/lib/api';
import ExportMenu from '@/components/ExportMenu';
import { fmtDate, fmtMoney } from '@/lib/format';
import { Button, CountUp, EmptyState, PageHeader, Pagination, SearchInput, Select, Skeleton, Tabs } from '@/components/ui';
import { PriorityBadge, RepairStatusBadge } from '@/components/status';
import { RepairModal, RepairUpdateModal } from '@/components/ActionModals';

export default function RepairsPage() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const [status, setStatus] = useState('active');
  const [priority, setPriority] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [edit, setEdit] = useState(null);
  const dq = useDebounce(q);
  useEffect(() => setPage(1), [dq, status, priority]);
  const { data, loading, reload } = useApi('/repairs', { status: status === 'all' ? '' : status, priority, q: dq, page, limit: 20 });
  const s = data?.stats || {};
  const items = data?.items || [];

  const stats = [
    { k: 'open', v: s.open, cls: 'text-rose-600 bg-rose-50' },
    { k: 'in_progress', v: s.in_progress, cls: 'text-amber-600 bg-amber-50' },
    { k: 'waiting_parts', v: s.waiting_parts, cls: 'text-sky-600 bg-sky-50' },
    { k: 'done', v: s.done, cls: 'text-emerald-600 bg-emerald-50' },
  ];

  return (
    <div>
      <PageHeader title={t('repair.title')} subtitle={t('repair.subtitle')}
        actions={<>
          <ExportMenu path="/reports/export/repairs" name="repair-jobs" params={{ status: status === 'all' ? '' : status, priority, q: dq }} />
          {can('repairs.add') && <Button icon={Plus} onClick={() => setCreating(true)}>{t('repair.new')}</Button>}
        </>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map((x, i) => (
          <motion.div key={x.k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-4">
            <p className="text-xs text-slate-500">{t(`repairStatus.${x.k}`)}</p>
            <p className={`mt-2 inline-flex rounded-xl px-3 py-1 text-2xl font-extrabold ${x.cls}`}><CountUp value={x.v} /></p>
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="col-span-2 rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 p-4 text-white shadow-glow lg:col-span-1">
          <p className="text-xs text-white/80">{t('repair.total_cost')}</p>
          <p className="mt-2 text-2xl font-extrabold"><CountUp value={s.total_cost} format={(n) => fmtMoney(n, lang)} /></p>
        </motion.div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-3 sm:px-5">
          <Tabs value={status} onChange={setStatus} tabs={[
            { value: 'active', label: t('repair.tab_active') },
            { value: 'done', label: t('repairStatus.done') },
            { value: 'cancelled', label: t('repairStatus.cancelled') },
            { value: 'all', label: t('common.all') },
          ]} />
        </div>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row">
          <SearchInput className="flex-1" value={q} onChange={setQ} placeholder={t('repair.search')} />
          <Select className="sm:w-48" value={priority} onChange={(e) => setPriority(e.target.value)} placeholder={t('repair.all_priority')}>
            {['urgent', 'high', 'normal', 'low'].map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
          </Select>
        </div>

        {loading && !data ? <div className="space-y-3 p-5">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div> :
          items.length === 0 ? <EmptyState icon={Wrench} title={t('repair.empty')} /> : (
            <div className="divide-y divide-slate-100">
              {items.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  onClick={() => can('repairs.edit') && setEdit(r)}
                  className="flex cursor-pointer flex-col gap-3 p-4 transition hover:bg-brand-50/30 sm:flex-row sm:items-center sm:px-5">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {r.asset_images?.[0]
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={imgUrl(r.asset_images[0])} alt="" className="h-full w-full object-cover" />
                        : <div className="flex h-full w-full items-center justify-center text-slate-300"><Package className="h-5 w-5" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-800">{r.ticket_no}</span>
                        <PriorityBadge priority={r.priority} />
                      </div>
                      <p className="mt-0.5 truncate text-sm text-slate-600">{r.problem}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        <Link href={`/assets/${r.asset_id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-brand-600 hover:underline">{r.asset_code}</Link>
                        {' · '}{r.asset_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-left text-xs text-slate-400 sm:text-right">
                      <p>{fmtDate(r.reported_at, lang)}</p>
                      {r.technician && <p className="text-slate-500">{r.technician}</p>}
                      {r.cost > 0 && <p className="font-semibold text-slate-700">{fmtMoney(r.cost, lang)}</p>}
                    </div>
                    <RepairStatusBadge status={r.status} />
                  </div>
                </motion.div>
              ))}
              <Pagination page={page} total={data.total} limit={20} onChange={setPage} />
            </div>
          )}
      </div>

      <RepairModal open={creating} onClose={() => setCreating(false)} onSaved={reload} />
      <RepairUpdateModal open={!!edit} repair={edit} onClose={() => setEdit(null)} onSaved={reload} />
    </div>
  );
}
