'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, ChevronLeft, ClipboardCheck, Copy, Download, Package, Pencil, Printer, ShieldCheck, Trash2, Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth, useI18n } from '@/components/providers';
import { useApi } from '@/lib/hooks';
import { api, imgUrl } from '@/lib/api';
import { deptLabel, fmtDate, fmtDateTime, fmtMoney } from '@/lib/format';
import { Badge, Button, Card, ConfirmModal, EmptyState, InfoRow, PageLoader, Tabs, cn } from '@/components/ui';
import { AssetStatusBadge, DueBadge, RepairStatusBadge, ResultBadge, PriorityBadge, daysUntil } from '@/components/status';
import { InspectionModal, RepairModal, RepairUpdateModal } from '@/components/ActionModals';
import QrCode, { assetQrUrl, downloadQrPng } from '@/components/QrCode';
import Gallery, { VerifiedBadge } from '@/components/Gallery';

export default function AssetDetailPage({ params }) {
  const { t, te, lang } = useI18n();
  const { can } = useAuth();
  const router = useRouter();
  const { data: a, loading, error, reload } = useApi(`/assets/${params.id}`);
  const [tab, setTab] = useState('inspections');
  const [inspect, setInspect] = useState(false);
  const [repair, setRepair] = useState(false);
  const [editRepair, setEditRepair] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading && !a) return <PageLoader />;
  if (error || !a) return <EmptyState title={t('errors.not_found')} action={<Button variant="secondary" onClick={() => router.push('/assets')}>{t('form.back')}</Button>} />;

  const del = async () => {
    setDeleting(true);
    try {
      await api(`/assets/${a.id}`, { method: 'DELETE' });
      toast.success(t('common.deleted'));
      router.push('/assets');
    } catch (e) {
      toast.error(te(e));
      setDeleting(false);
    }
  };

  const days = daysUntil(a.next_inspection);
  const warrantyDays = daysUntil(a.warranty_expiry);
  const images = a.images || [];

  return (
    <div className="space-y-5">
      <Link href="/assets" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"><ChevronLeft className="h-4 w-4" />{t('form.back')}</Link>

      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[340px_1fr]">
          {/* photo gallery: directional slide + focus, slow zoom, gliding thumbnail ring, swipe, full-screen viewer */}
          <Gallery id="hero" images={images} color={a.category_color} fit="cover" thumbs="overlay" className="h-full"
            frame="aspect-[4/3] w-full lg:aspect-auto lg:h-full lg:min-h-[300px]" />

          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <VerifiedBadge />
              <AssetStatusBadge status={a.status} />
              <Badge tone="brand"><span className="h-2 w-2 rounded-full" style={{ background: a.category_color }} />{a.category_account ? `${a.category_account} · ` : ''}{a.category_name}</Badge>
              {a.type_name && <Badge>{a.type_number} · {a.type_name}</Badge>}
            </div>
            <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">{a.name}</h1>
            <button onClick={() => { navigator.clipboard?.writeText(a.code); toast.success(t('common.copied')); }}
              className="group mt-1 inline-flex items-center gap-2 font-mono text-lg font-semibold text-brand-600">
              {a.code} <Copy className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
            </button>
            <p className="mt-1 text-sm text-slate-500">{[a.brand, a.model].filter(Boolean).join(' · ')}</p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [t('assets.next_inspection'), fmtDate(a.next_inspection, lang), !['disposed', 'lost'].includes(a.status) && <DueBadge days={days} />],
                [t('assets.last_inspection'), fmtDate(a.last_inspection, lang)],
                [t('assets.cost'), fmtMoney(a.cost, lang)],
                [t('assets.warranty'), fmtDate(a.warranty_expiry, lang), a.warranty_expiry && <Badge tone={warrantyDays >= 0 ? 'green' : 'gray'} icon={ShieldCheck}>{warrantyDays >= 0 ? t('assets.in_warranty') : t('assets.expired')}</Badge>],
              ].map(([label, value, extra], i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <p className="text-[11px] text-slate-400">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
                  {extra && <div className="mt-1">{extra}</div>}
                </motion.div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {can('write') && <Button icon={ClipboardCheck} onClick={() => setInspect(true)}>{t('assets.inspect')}</Button>}
              {can('write') && <Button variant="secondary" icon={Wrench} onClick={() => setRepair(true)}>{t('assets.report_repair')}</Button>}
              {can('write') && <Button variant="secondary" icon={Pencil} onClick={() => router.push(`/assets/${a.id}/edit`)}>{t('common.edit')}</Button>}
              {can('manage') && <Button variant="ghost" icon={Trash2} className="text-rose-600 hover:bg-rose-50" onClick={() => setConfirm(true)}>{t('common.delete')}</Button>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* Info */}
          <Card i={1} className="card-pad">
            <h3 className="section-title mb-2">{t('assets.details')}</h3>
            <div className="grid gap-x-6 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
              <InfoRow label={t('code.company')}>{a.company_code && `${a.company_code} - ${a.company_name}`}</InfoRow>
              <InfoRow label={t('code.department')}>{a.department_name && deptLabel({ dept_no: a.department_no, name: a.department_name })}</InfoRow>
              <InfoRow label={t('code.year')}>{a.year_code}</InfoRow>
              <InfoRow label={t('assets.serial')} mono>{a.serial_number}</InfoRow>
              <InfoRow label={t('assets.location')}>{[a.building, a.floor, a.location_name].filter(Boolean).join(' · ')}</InfoRow>
              <InfoRow label={t('assets.custodian')}>{a.custodian_name && `${a.custodian_name}${a.custodian_code ? ` (${a.custodian_code})` : ''}`}</InfoRow>
              <InfoRow label={t('assets.purchase_date')}>{fmtDate(a.purchase_date, lang)}</InfoRow>
              <InfoRow label={t('assets.vendor')}>{a.vendor}</InfoRow>
              <InfoRow label={t('assets.po_number')}>{a.po_number}</InfoRow>
              <InfoRow label={t('assets.inspection_cycle')}>{t('form.every_months', { n: a.inspection_months })}</InfoRow>
              <InfoRow label={t('assets.created_by')}>{a.created_by_name} · {fmtDate(a.created_at, lang)}</InfoRow>
            </div>
            {a.notes && <div className="mt-3 rounded-xl bg-amber-50/60 p-3 text-sm text-slate-600">{a.notes}</div>}
          </Card>

          {/* History tabs */}
          <Card i={2} className="overflow-hidden">
            <div className="px-3 sm:px-5">
              <Tabs value={tab} onChange={setTab} tabs={[
                { value: 'inspections', label: t('nav.inspections'), icon: ClipboardCheck, count: a.inspections.length },
                { value: 'repairs', label: t('nav.repairs'), icon: Wrench, count: a.repairs.length },
                { value: 'activity', label: t('assets.activity'), icon: Activity },
              ]} />
            </div>
            <div className="p-3 sm:p-5">
              {tab === 'inspections' && (a.inspections.length === 0 ? <EmptyState icon={ClipboardCheck} title={t('inspection.empty')} /> : (
                <div className="space-y-3">
                  {a.inspections.map((x, i) => {
                    const okCount = (x.checklist || []).filter((c) => c.ok).length;
                    return (
                      <motion.div key={x.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-xl border border-slate-100 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2"><ResultBadge result={x.result} /><span className="text-sm font-medium text-slate-700">{fmtDate(x.inspected_at, lang)}</span></div>
                          <span className="text-xs text-slate-400">{x.inspector_name}</span>
                        </div>
                        {x.checklist?.length > 0 && <p className="mt-2 text-xs text-slate-500">{t('inspection.checklist')}: {okCount}/{x.checklist.length}</p>}
                        {x.notes && <p className="mt-1 text-sm text-slate-600">{x.notes}</p>}
                        {x.images?.length > 0 && (
                          <div className="mt-2 flex gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {x.images.map((s) => <a key={s} href={imgUrl(s)} target="_blank" rel="noreferrer"><img src={imgUrl(s)} alt="" className="h-14 w-14 rounded-lg object-cover" /></a>)}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ))}
              {tab === 'repairs' && (a.repairs.length === 0 ? <EmptyState icon={Wrench} title={t('repair.empty')} /> : (
                <div className="space-y-3">
                  {a.repairs.map((r, i) => (
                    <motion.button type="button" key={r.id} onClick={() => can('write') && setEditRepair({ ...r, asset_code: a.code, asset_name: a.name })}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="w-full rounded-xl border border-slate-100 p-4 text-left transition hover:border-brand-200 hover:shadow-soft">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2"><span className="font-mono text-sm font-semibold text-slate-700">{r.ticket_no}</span><PriorityBadge priority={r.priority} /></div>
                        <RepairStatusBadge status={r.status} />
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{r.problem}</p>
                      <p className="mt-1 text-xs text-slate-400">{fmtDate(r.reported_at, lang)} · {r.reported_by_name}{r.cost > 0 && ` · ${fmtMoney(r.cost, lang)}`}</p>
                    </motion.button>
                  ))}
                </div>
              ))}
              {tab === 'activity' && (a.activity.length === 0 ? <EmptyState icon={Activity} title={t('common.no_data')} /> : (
                <ol className="relative ml-2 space-y-4 border-l border-slate-200 pl-5">
                  {a.activity.map((x) => (
                    <li key={x.id} className="relative">
                      <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500 ring-2 ring-brand-100" />
                      <p className="text-sm text-slate-700"><b>{x.user_name || '-'}</b> {t(`activity.${x.action}`)} {x.details?.ticket && <span className="font-mono text-xs text-brand-600">{x.details.ticket}</span>}</p>
                      {x.details?.fields?.length > 0 && <p className="text-xs text-slate-400">{x.details.fields.join(', ')}</p>}
                      <p className="text-[11px] text-slate-400">{fmtDateTime(x.created_at, lang)}</p>
                    </li>
                  ))}
                </ol>
              ))}
            </div>
          </Card>
        </div>

        {/* QR */}
        <Card i={3} className="card-pad h-fit lg:sticky lg:top-24">
          <h3 className="section-title">{t('assets.qr_code')}</h3>
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-5">
            <motion.div initial={{ rotate: -4, scale: 0.9, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', delay: 0.2 }}
              className="keep-light rounded-2xl bg-white p-3 shadow-soft ring-1 ring-slate-100">
              <QrCode code={a.code} size={180} />
            </motion.div>
            <p className="mt-3 font-mono text-sm font-bold text-slate-800">{a.code}</p>
            <p className="mt-0.5 max-w-full break-all text-center text-[11px] text-slate-400">{assetQrUrl(a.code)}</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" icon={Download} onClick={() => downloadQrPng(a.code, a.name)}>PNG</Button>
            <Button variant="soft" icon={Printer} onClick={() => router.push(`/print?ids=${a.id}`)}>{t('common.print')}</Button>
          </div>
        </Card>
      </div>

      <InspectionModal open={inspect} asset={a} onClose={() => setInspect(false)} onSaved={reload} />
      <RepairModal open={repair} asset={a} onClose={() => setRepair(false)} onSaved={reload} />
      <RepairUpdateModal open={!!editRepair} repair={editRepair} onClose={() => setEditRepair(null)} onSaved={reload} />
      <ConfirmModal open={confirm} onClose={() => setConfirm(false)} onConfirm={del} loading={deleting}
        title={t('assets.delete_title')} text={t('assets.delete_text', { code: a.code })} confirmText={t('common.delete')} />
    </div>
  );
}
