'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, Loader2, Package, Wrench } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '@/components/providers';
import { useApi } from '@/lib/hooks';
import { EXPORT_FORMATS, useExport } from '@/components/ExportMenu';
import { fmtMoney } from '@/lib/format';
import { Button, Card, PageLoader, Segmented } from '@/components/ui';
import { ASSET_STATUS } from '@/components/status';

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

/** Report card with "Excel" and "PDF" download buttons */
function ExportCard({ i, path, name, icon: Icon, label, cls }) {
  const { t } = useI18n();
  const { busy, run } = useExport(path, name);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} whileHover={{ y: -3 }} className="card p-4">
      <div className="flex items-center gap-4">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-soft ${cls}`}><Icon className="h-6 w-6" /></span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">{label}</p>
          <p className="text-xs text-slate-400">{t('export.choose')}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {EXPORT_FORMATS.map(({ format, icon: FIcon, tone, label: fl }) => (
          <button key={format} type="button" onClick={() => run(format)} disabled={!!busy}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:bg-slate-50 disabled:opacity-60">
            <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${tone}`}>
              {busy === format ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FIcon className="h-3.5 w-3.5" />}
            </span>
            {t(`${fl}_short`)}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export default function ReportsPage() {
  const { t, lang } = useI18n();
  const { data, loading } = useApi('/reports/summary');
  const [group, setGroup] = useState('byCategory');
  const [metric, setMetric] = useState('count');

  if (loading && !data) return <PageLoader />;
  const rows = data?.[group] || [];
  const total = rows.reduce((s, r) => s + Number(r[metric] || 0), 0);
  const status = (data?.byStatus || []).map((s) => ({ ...s, name: t(`status.${s.label}`), color: ASSET_STATUS[s.label]?.color }));
  const fmt = (v) => (metric === 'value' ? fmtMoney(v, lang) : Number(v).toLocaleString());

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-[26px]">{t('reports.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('reports.subtitle')}</p>
        </div>
      </div>

      {/* Exports */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['/reports/export/assets', 'asset-register', Package, 'reports.export_assets', 'from-brand-500 to-violet-500'],
          ['/reports/export/inspections', 'inspection-history', ClipboardCheck, 'reports.export_inspections', 'from-emerald-400 to-teal-500'],
          ['/reports/export/repairs', 'repair-jobs', Wrench, 'reports.export_repairs', 'from-amber-400 to-orange-500'],
        ].map(([path, name, Icon, label, cls], i) => <ExportCard key={path} i={i} path={path} name={name} icon={Icon} label={t(label)} cls={cls} />)}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card i={1} className="card-pad lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented id="grp" size="sm" value={group} onChange={setGroup} options={[
              { value: 'byCategory', label: t('assets.category') },
              { value: 'byDepartment', label: t('code.department') },
              { value: 'byLocation', label: t('assets.location') },
              { value: 'byYear', label: t('reports.year') },
            ]} />
            <Segmented id="metric" size="sm" value={metric} onChange={setMetric} options={[
              { value: 'count', label: t('reports.count') },
              { value: 'value', label: t('reports.value') },
            ]} />
          </div>
          <div className="mt-5 h-72">
            <ResponsiveContainer>
              <BarChart data={rows.slice(0, 12)} margin={{ top: 5, right: 5, left: metric === 'value' ? 20 : -10, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} angle={-30} textAnchor="end" interval={0} height={60}
                  tickFormatter={(v) => (String(v).length > 18 ? String(v).slice(0, 17) + '…' : v)} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => fmt(v)} cursor={{ fill: '#eef2ff' }} contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9', fontSize: 12 }} />
                <Bar dataKey={metric} name={t(`reports.${metric}`)} radius={[8, 8, 0, 0]} animationDuration={900}>
                  {rows.slice(0, 12).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card i={2} className="card-pad">
          <h3 className="section-title">{t('dashboard.by_status')}</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={status} dataKey="count" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} cornerRadius={6} stroke="none">
                  {status.map((s) => <Cell key={s.label} fill={s.color || '#94a3b8'} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5">
            {status.map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                <span className="flex-1 text-slate-600">{s.name}</span>
                <span className="font-semibold">{s.count}</span>
                <span className="w-28 text-right text-xs text-slate-400">{fmtMoney(s.value, lang)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card i={3} className="overflow-hidden">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>#</th><th>{t('reports.group')}</th><th className="text-right">{t('reports.count')}</th><th className="text-right">{t('reports.value')}</th><th className="w-1/4">{t('reports.share')}</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pct = total ? (Number(r[metric]) / total) * 100 : 0;
                return (
                  <tr key={i}>
                    <td className="text-slate-400">{i + 1}</td>
                    <td className="font-medium text-slate-700">{r.label}</td>
                    <td className="text-right">{Number(r.count).toLocaleString()}</td>
                    <td className="text-right">{fmtMoney(r.value, lang)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: i * 0.03 }} className="h-full rounded-full bg-brand-500" />
                        </div>
                        <span className="w-12 text-right text-xs text-slate-500">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
