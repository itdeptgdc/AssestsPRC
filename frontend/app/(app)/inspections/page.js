'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, ClipboardCheck, X } from 'lucide-react';
import { useAuth, useI18n } from '@/components/providers';
import { useApi, useDebounce } from '@/lib/hooks';
import { imgUrl } from '@/lib/api';
import ExportMenu from '@/components/ExportMenu';
import { fmtDate } from '@/lib/format';
import { Button, EmptyState, Input, Modal, PageHeader, Pagination, SearchInput, Select, Skeleton } from '@/components/ui';
import { ResultBadge } from '@/components/status';
import { InspectionModal } from '@/components/ActionModals';

export default function InspectionsPage() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [result, setResult] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState(null);
  const dq = useDebounce(q);
  useEffect(() => setPage(1), [dq, result, from, to]);
  const { data, loading, reload } = useApi('/inspections', { q: dq, result, from, to, page, limit: 20 });
  const items = data?.items || [];

  return (
    <div>
      <PageHeader title={t('inspection.title')} subtitle={t('inspection.subtitle', { n: data?.total ?? 0 })}
        actions={<>
          <ExportMenu path="/reports/export/inspections" name="inspection-history" params={{ q: dq, result, from, to }} />
          {can('inspections.add') && <Button icon={ClipboardCheck} onClick={() => setCreating(true)}>{t('inspection.new')}</Button>}
        </>} />

      <div className="card mb-4 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_160px_160px]">
        <SearchInput value={q} onChange={setQ} placeholder={t('inspection.search')} />
        <Select value={result} onChange={(e) => setResult(e.target.value)} placeholder={t('inspection.all_results')}>
          {['pass', 'issue', 'fail'].map((r) => <option key={r} value={r}>{t(`result.${r}`)}</option>)}
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title={t('common.from')} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} title={t('common.to')} />
      </div>

      <div className="card overflow-hidden">
        {loading && !data ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div> :
          items.length === 0 ? <EmptyState icon={ClipboardCheck} title={t('inspection.empty')} /> : (
            <>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>{t('inspection.date')}</th>
                      <th>{t('common.asset')}</th>
                      <th>{t('inspection.result')}</th>
                      <th className="hidden md:table-cell">{t('inspection.checklist')}</th>
                      <th className="hidden md:table-cell">{t('inspection.inspector')}</th>
                      <th className="hidden lg:table-cell">{t('assets.next_inspection')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((x, i) => {
                      const ok = (x.checklist || []).filter((c) => c.ok).length;
                      const total = (x.checklist || []).length;
                      return (
                        <motion.tr key={x.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="cursor-pointer" onClick={() => setView(x)}>
                          <td className="whitespace-nowrap text-slate-600">{fmtDate(x.inspected_at, lang)}</td>
                          <td>
                            <Link href={`/assets/${x.asset_id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs font-semibold text-brand-600 hover:underline">{x.asset_code}</Link>
                            <p className="max-w-[220px] truncate text-sm text-slate-700">{x.asset_name}</p>
                          </td>
                          <td><ResultBadge result={x.result} /></td>
                          <td className="hidden md:table-cell">
                            {total > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(ok / total) * 100}%` }} />
                                </div>
                                <span className="text-xs text-slate-500">{ok}/{total}</span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="hidden text-slate-600 md:table-cell">{x.inspector_name || '-'}</td>
                          <td className="hidden text-slate-600 lg:table-cell">{fmtDate(x.next_inspection, lang)}</td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} total={data.total} limit={20} onChange={setPage} />
            </>
          )}
      </div>

      <InspectionModal open={creating} onClose={() => setCreating(false)} onSaved={reload} />

      <Modal open={!!view} onClose={() => setView(null)} title={view ? `${view.asset_code}` : ''} subtitle={view?.asset_name}>
        {view && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <ResultBadge result={view.result} />
              <span className="text-sm text-slate-600">{fmtDate(view.inspected_at, lang)} · {view.inspector_name}</span>
            </div>
            <div className="space-y-2">
              {(view.checklist || []).map((c, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  {c.ok ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-rose-500" />}
                  <span className="text-slate-700">{c.item}</span>
                </div>
              ))}
            </div>
            {view.notes && <p className="rounded-xl bg-amber-50/60 p-3 text-sm text-slate-600">{view.notes}</p>}
            {view.images?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {view.images.map((s) => <a key={s} href={imgUrl(s)} target="_blank" rel="noreferrer"><img src={imgUrl(s)} alt="" className="h-20 w-20 rounded-xl object-cover" /></a>)}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
