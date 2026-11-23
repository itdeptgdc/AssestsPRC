'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, ClipboardCheck, Eye, FileText, Filter, Loader2, Package, Pencil, Plus, Printer, QrCode, Wrench, X } from 'lucide-react';
import { useAuth, useI18n } from '@/components/providers';
import { useApi, useDebounce } from '@/lib/hooks';
import { imgUrl } from '@/lib/api';
import ExportMenu, { useExport } from '@/components/ExportMenu';
import RowActions from '@/components/RowActions';
import { catLabel, deptLabel, fmtDate } from '@/lib/format';
import { Button, EmptyState, IconButton, PageHeader, PageLoader, Pagination, SearchInput, Select, Skeleton, cn } from '@/components/ui';
import { AssetStatusBadge, DueBadge, daysUntil } from '@/components/status';
import { InspectionModal, RepairModal } from '@/components/ActionModals';

const STATUSES = ['active', 'repair', 'broken', 'spare', 'lost', 'disposed'];

/** Styled checkbox (checked / mixed / empty) with an animated tick */
function Checkbox({ checked, mixed, onChange, label }) {
  const on = checked || mixed;
  return (
    <button type="button" role="checkbox" aria-checked={mixed ? 'mixed' : !!checked} aria-label={label} title={label}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(); }}
      className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-1',
        on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white hover:border-brand-400')}>
      {checked && (
        <motion.svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="M2.5 6.2 5 8.6 9.6 3.6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.18 }} />
        </motion.svg>
      )}
      {!checked && mixed && <span className="h-[2px] w-2 rounded bg-white" />}
    </button>
  );
}

export default function AssetsPage() {
  return <Suspense fallback={<PageLoader />}><AssetsInner /></Suspense>;
}

function AssetsInner() {
  const sp = useSearchParams();
  const searchParams = { q: sp.get('q'), status: sp.get('status'), category_id: sp.get('category_id'), inspection: sp.get('inspection'), location_id: sp.get('location_id'), department_id: sp.get('department_id'), custodian_id: sp.get('custodian_id') };
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState('');
  const [f, setF] = useState({ category_id: '', status: '', location_id: '', department_id: '', inspection: '' });
  const [sort, setSort] = useState({ key: 'code', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [inspect, setInspect] = useState(null);
  const [repair, setRepair] = useState(null);
  const dq = useDebounce(q);

  // filters from URL (?q=&status=&category_id=&inspection=) — also reacts to the global search box
  useEffect(() => {
    setQ(searchParams.q || '');
    setF((p) => ({ ...p, status: searchParams.status || '', category_id: searchParams.category_id || '', inspection: searchParams.inspection || '', location_id: searchParams.location_id || '', department_id: searchParams.department_id || '', custodian_id: searchParams.custodian_id || '' }));
    setReady(true);
  }, [searchParams.q, searchParams.status, searchParams.category_id, searchParams.inspection, searchParams.location_id, searchParams.department_id, searchParams.custodian_id]);

  // ---------- selection (kept while paging; cleared when the search / filters change) ----------
  const [sel, setSel] = useState(() => new Set());
  const [allMatching, setAllMatching] = useState(false); // "Select all N records" = everything the filters match
  useEffect(() => { setPage(1); setSel(new Set()); setAllMatching(false); }, [dq, f]);

  const { data: lk } = useApi('/lookups');
  const { data, loading, reload } = useApi('/assets', { q: dq, ...f, sort: sort.key, dir: sort.dir, page, limit: 20 }, { enabled: ready });
  const items = data?.items || [];
  const total = Number(data?.total || 0);
  const activeFilters = Object.values(f).filter(Boolean).length;

  const isSel = (id) => allMatching || sel.has(id);
  const pageSelected = items.length > 0 && items.every((a) => isSel(a.id));
  const pageSome = !pageSelected && items.some((a) => isSel(a.id));
  const selCount = allMatching ? total : sel.size;
  const MAX_TICK = 2000; // ids travel in the URL; beyond this use "Select all"
  const toggleRow = (id) => {
    if (allMatching) { // leaving "all records" mode: keep this page minus the clicked row
      setAllMatching(false);
      setSel(new Set(items.map((a) => a.id).filter((x) => x !== id)));
      return;
    }
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size >= MAX_TICK) { toast(t('assets.sel_limit')); return s; }
      else n.add(id);
      return n;
    });
  };
  const togglePage = () => {
    if (pageSelected) {
      setAllMatching(false);
      setSel((s) => { const n = new Set(allMatching ? [] : s); items.forEach((a) => n.delete(a.id)); return n; });
    } else {
      setSel((s) => { const n = new Set(s); items.forEach((a) => n.add(a.id)); return n; });
    }
  };
  const clearSel = () => { setSel(new Set()); setAllMatching(false); };
  const exportParams = !allMatching && sel.size ? { ids: [...sel].join(',') } : { q: dq, ...f };
  const report = useExport('/reports/export/asset-report', 'asset-report',
    { ...exportParams, base: typeof window !== 'undefined' ? window.location.origin : '' });
  // nothing ticked → ask the user to tick the assets first (the report is one page per asset)
  const downloadReport = () => (selCount > 0 ? report.run('pdf') : toast(t('assets.report_pick'), { icon: '☑️' }));
  const exportScope = !allMatching && sel.size ? t('assets.export_selected', { n: sel.size }) : t('assets.export_all', { n: total });

  const SortTh = ({ k, children, className }) => (
    <th className={cn('cursor-pointer select-none hover:text-brand-600', className)} onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sort.key === k && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </span>
    </th>
  );

  const Actions = ({ a }) => (
    <RowActions actions={[
      { key: 'view', icon: Eye, tone: 'slate', label: t('common.view'), onClick: () => router.push(`/assets/${a.id}`) },
      can('assets.edit') && { key: 'edit', icon: Pencil, tone: 'brand', label: t('common.edit'), onClick: () => router.push(`/assets/${a.id}/edit`) },
      can('inspections.add') && { key: 'inspect', icon: ClipboardCheck, tone: 'green', label: t('assets.inspect'), onClick: () => setInspect(a) },
      can('repairs.add') && { key: 'repair', icon: Wrench, tone: 'amber', label: t('assets.report_repair'), onClick: () => setRepair(a) },
      { key: 'qr', icon: QrCode, tone: 'violet', label: t('assets.print_qr'), onClick: () => router.push(`/print?ids=${a.id}`) },
    ]} />
  );

  return (
    <div>
      <PageHeader
        title={t('assets.title')}
        subtitle={t('assets.count', { n: data?.total ?? 0 })}
        actions={<>
          {/* ticked rows → only those; nothing ticked or "Select all" → everything the filters match */}
          {/* Asset Report: one PDF page per ticked asset */}
          <Button variant="secondary" icon={report.busy ? Loader2 : FileText} className={cn(report.busy && '[&_svg]:animate-spin')} disabled={!!report.busy}
            title={t('export.asset_report_hint')} onClick={downloadReport}>
            {t('export.asset_report')}
            {selCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 py-px text-[11px] font-bold leading-4 text-white">{selCount}</span>}
          </Button>
          <ExportMenu path="/reports/export/assets" name="asset-register" params={exportParams} count={selCount} scope={exportScope} />
          {can('print') && <Button variant="secondary" icon={Printer} onClick={() => router.push('/print')}>{t('assets.print_qr')}</Button>}
          {can('assets.add') && <Button icon={Plus} onClick={() => router.push('/assets/new')}>{t('assets.add')}</Button>}
        </>}
      />

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card mb-4 p-3 sm:p-4">
        <div className="flex gap-2">
          <SearchInput className="flex-1" value={q} onChange={setQ} placeholder={t('assets.search')} />
          <button onClick={() => setShowFilters((s) => !s)} className={cn('btn btn-secondary relative lg:hidden', showFilters && 'border-brand-300 text-brand-600')}>
            <Filter className="h-4 w-4" />
            {activeFilters > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] text-white">{activeFilters}</span>}
          </button>
        </div>
        <div className={cn('mt-3 grid-cols-2 gap-2 lg:grid lg:grid-cols-5', showFilters ? 'grid' : 'hidden')}>
          <Select value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })} placeholder={t('assets.all_categories')}>
            {lk?.categories.map((c) => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
          </Select>
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} placeholder={t('assets.all_status')}>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </Select>
          <Select value={f.location_id} onChange={(e) => setF({ ...f, location_id: e.target.value })} placeholder={t('assets.all_locations')}>
            {lk?.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
          <Select value={f.department_id} onChange={(e) => setF({ ...f, department_id: e.target.value })} placeholder={t('assets.all_departments')}>
            {lk?.departments.map((d) => <option key={d.id} value={d.id}>{deptLabel(d)}</option>)}
          </Select>
          <Select value={f.inspection} onChange={(e) => setF({ ...f, inspection: e.target.value })} placeholder={t('assets.all_inspection')}>
            <option value="overdue">{t('schedule.overdue')}</option>
            <option value="due_soon">{t('schedule.due_soon')}</option>
            <option value="ok">{t('schedule.ok')}</option>
          </Select>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card overflow-hidden">
        {loading && !data ? (
          <div className="space-y-3 p-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={Package} title={t('assets.empty')} text={t('assets.empty_text')}
            action={can('assets.add') && <Button icon={Plus} onClick={() => router.push('/assets/new')}>{t('assets.add')}</Button>} />
        ) : (
          <>
            {/* Selection bar: count, "select all N records", export / print selected, clear */}
            <AnimatePresence initial={false}>
              {selCount > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                  className="overflow-hidden border-b border-brand-100 bg-brand-50/70">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm">
                    <span className="inline-flex items-center gap-2 font-semibold text-brand-700">
                      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs text-white">{selCount}</span>
                      {allMatching ? t('assets.sel_all_done', { n: total }) : t('assets.sel_count', { n: sel.size })}
                    </span>
                    {!allMatching && pageSelected && total > sel.size && (
                      <button type="button" onClick={() => setAllMatching(true)} className="font-semibold text-brand-600 underline-offset-2 hover:underline">
                        {t('assets.sel_all_matching', { n: total })}
                      </button>
                    )}
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      {/* one PDF page per asset, like the asset detail screen */}
                      <Button size="sm" icon={report.busy ? Loader2 : FileText} className={cn('!py-1.5', report.busy && '[&_svg]:animate-spin')} disabled={!!report.busy}
                        title={t('export.asset_report_hint')} onClick={downloadReport}>{t('export.asset_report')}</Button>
                      {!allMatching && (
                        <Button size="sm" variant="secondary" icon={Printer} className="!py-1.5" onClick={() => router.push(`/print?ids=${[...sel].join(',')}`)}>{t('assets.sel_print')}</Button>
                      )}
                      <Button size="sm" variant="ghost" icon={X} className="!py-1.5" onClick={clearSel}>{t('assets.sel_clear')}</Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile: select this page */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 md:hidden">
              <Checkbox checked={pageSelected} mixed={pageSome} onChange={togglePage} label={t('assets.sel_page')} />
              <span className="text-xs font-medium text-slate-500">{t('assets.sel_page')}</span>
            </div>

            {/* Desktop table */}
            <div className="table-wrap hidden md:block">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="w-10 !pr-0"><Checkbox checked={pageSelected} mixed={pageSome} onChange={togglePage} label={t('assets.sel_page')} /></th>
                    <SortTh k="code">{t('assets.code')}</SortTh>
                    <SortTh k="name">{t('assets.name')}</SortTh>
                    <SortTh k="category">{t('assets.category')}</SortTh>
                    <SortTh k="location" className="hidden lg:table-cell">{t('assets.location')}</SortTh>
                    <SortTh k="custodian" className="hidden xl:table-cell">{t('assets.custodian')}</SortTh>
                    <SortTh k="next_inspection" className="hidden lg:table-cell">{t('assets.next_inspection')}</SortTh>
                    <SortTh k="status">{t('common.status')}</SortTh>
                    <th className="text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a, i) => (
                    <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className={cn(isSel(a.id) && '!bg-brand-50/50')}>
                      <td className="w-10 !pr-0"><Checkbox checked={isSel(a.id)} onChange={() => toggleRow(a.id)} label={t('assets.sel_row', { code: a.code })} /></td>
                      <td><Link href={`/assets/${a.id}`} className="font-mono text-[13px] font-semibold text-brand-600 hover:underline">{a.code}</Link></td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {a.images?.[0]
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={imgUrl(a.images[0])} alt="" className="h-full w-full object-cover" />
                              : <div className="flex h-full w-full items-center justify-center text-slate-300"><Package className="h-5 w-5" /></div>}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{a.name}</p>
                            <p className="truncate text-xs text-slate-400">{[a.brand, a.model].filter(Boolean).join(' · ') || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <span className="h-2 w-2 rounded-full" style={{ background: a.category_color }} />
                          <span className="max-w-[180px] truncate">{a.category_name}</span>
                        </span>
                        {a.type_name && <p className="text-xs text-slate-400">{a.type_name}</p>}
                      </td>
                      <td className="hidden text-slate-600 lg:table-cell">{a.location_name || '-'}</td>
                      <td className="hidden text-slate-600 xl:table-cell">{a.custodian_name || '-'}</td>
                      <td className="hidden lg:table-cell">
                        <p className="text-xs text-slate-500">{fmtDate(a.next_inspection, lang)}</p>
                        {!['disposed', 'lost'].includes(a.status) && <DueBadge days={daysUntil(a.next_inspection)} />}
                      </td>
                      <td><AssetStatusBadge status={a.status} /></td>
                      <td className="text-right"><Actions a={a} /></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-slate-100 md:hidden">
              {items.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className={cn('flex gap-3 p-4', isSel(a.id) && 'bg-brand-50/50')}>
                  <div className="pt-4"><Checkbox checked={isSel(a.id)} onChange={() => toggleRow(a.id)} label={t('assets.sel_row', { code: a.code })} /></div>
                  <div className="min-w-0 flex-1">
                  <Link href={`/assets/${a.id}`} className="flex gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {a.images?.[0]
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={imgUrl(a.images[0])} alt="" className="h-full w-full object-cover" />
                        : <div className="flex h-full w-full items-center justify-center text-slate-300"><Package className="h-6 w-6" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-semibold text-slate-800">{a.name}</p>
                        <AssetStatusBadge status={a.status} />
                      </div>
                      <p className="font-mono text-xs font-semibold text-brand-600">{a.code}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">{[a.category_name, a.location_name].filter(Boolean).join(' · ')}</p>
                    </div>
                  </Link>
                  <div className="mt-3 flex items-center justify-between">
                    {!['disposed', 'lost'].includes(a.status) ? <DueBadge days={daysUntil(a.next_inspection)} /> : <span />}
                    <Actions a={a} />
                  </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <Pagination page={page} total={data.total} limit={20} onChange={setPage} />
          </>
        )}
      </motion.div>

      <InspectionModal open={!!inspect} asset={inspect} onClose={() => setInspect(null)} onSaved={reload} />
      <RepairModal open={!!repair} asset={repair} onClose={() => setRepair(null)} onSaved={reload} />
    </div>
  );
}
