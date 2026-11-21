'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, ArrowRight, Box, CalendarClock, CheckCircle2, ClipboardCheck, Plus, ScanLine, Wallet, Wrench,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth, useI18n } from '@/components/providers';
import { useApi } from '@/lib/hooks';
import { fmtDate, fmtMoney, greetingKey, relativeTime } from '@/lib/format';
import { Button, Card, CountUp, EmptyState, Segmented, Skeleton, StatCard } from '@/components/ui';
import { ASSET_STATUS, DueBadge, PriorityBadge } from '@/components/status';

function ChartTooltip({ active, payload, label, money, lang }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 font-semibold text-slate-700">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-500">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <b className="text-slate-700">{money && p.dataKey === 'repair_cost' ? fmtMoney(p.value, lang) : p.value}</b>
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState('month');
  // greeting follows Cambodia time and refreshes every minute
  const [greetKey, setGreetKey] = useState(() => greetingKey());
  useEffect(() => {
    const id = setInterval(() => setGreetKey(greetingKey()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const { data, loading } = useApi('/dashboard', { period });

  const periods = ['week', 'month', 'quarter', 'year'].map((p) => ({ value: p, label: t(`period.${p}`) }));
  const tot = data?.totals || {};
  const statusData = (data?.byStatus || []).map((s) => ({ ...s, name: t(`status.${s.status}`), color: ASSET_STATUS[s.status]?.color || '#94a3b8' }));
  const maxCat = Math.max(1, ...(data?.byCategory || []).map((c) => c.count));
  const trend = (data?.trend || []).map((m) => ({
    ...m,
    label: new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : lang === 'km' ? 'km-KH' : 'en-GB', { month: 'short' }).format(new Date(m.month + '-01T00:00:00')),
  }));

  const greet = t(`dashboard.${greetKey}`);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-[26px]">
            {greet}, {user?.name} <motion.span className="inline-block origin-[70%_70%]" animate={{ rotate: [0, 18, -8, 14, 0] }} transition={{ duration: 1.4, delay: 0.4 }}>👋</motion.span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('dashboard.subtitle')}</p>
        </motion.div>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={ScanLine} onClick={() => router.push('/scan')}>{t('nav.scan')}</Button>
          {can('write') && <Button variant="secondary" icon={Plus} onClick={() => router.push('/assets/new')}>{t('assets.add')}</Button>}
          <div className="overflow-x-auto"><Segmented id="period" value={period} onChange={setPeriod} options={periods} /></div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard i={0} label={t('dashboard.total')} value={tot.total} sub={t('dashboard.in_system')} icon={Box} tone="brand" onClick={() => router.push('/assets')} />
        <StatCard i={1} label={t('dashboard.active')} value={tot.active} sub={t('dashboard.ready')} icon={CheckCircle2} tone="green" onClick={() => router.push('/assets?status=active')} />
        <StatCard i={2} label={t('dashboard.overdue')} value={tot.overdue} sub={t('dashboard.due_soon_n', { n: tot.due_soon || 0 })} icon={AlertTriangle} tone="red" onClick={() => router.push('/schedule')} />
        <StatCard i={3} label={t('dashboard.repair')} value={tot.repair} sub={t('dashboard.has_issue')} icon={Wrench} tone="amber" onClick={() => router.push('/repairs')} />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card i={4} className="card-pad">
          <div className="flex items-center justify-between">
            <h3 className="section-title">{t('dashboard.by_status')}</h3>
            <span className="text-xs text-slate-400">{fmtMoney(tot.total_value, lang)}</span>
          </div>
          {loading && !data ? <Skeleton className="mx-auto mt-6 h-44 w-44 rounded-full" /> : statusData.length === 0 ? (
            <EmptyState title={t('common.no_data')} />
          ) : (
            <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
              <div className="relative h-48 w-48 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusData} dataKey="count" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={900}>
                      {statusData.map((s) => <Cell key={s.status} fill={s.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip lang={lang} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-slate-900"><CountUp value={tot.total} /></span>
                  <span className="text-xs text-slate-400">{t('common.items')}</span>
                </div>
              </div>
              <div className="w-full space-y-2">
                {statusData.map((s) => (
                  <Link key={s.status} href={`/assets?status=${s.status}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-50">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 text-slate-600">{s.name}</span>
                    <span className="font-semibold text-slate-800">{s.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card i={5} className="card-pad">
          <h3 className="section-title">{t('dashboard.by_category')}</h3>
          <div className="mt-5 space-y-4">
            {loading && !data ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />) :
              (data?.byCategory || []).length === 0 ? <EmptyState title={t('common.no_data')} /> :
                data.byCategory.map((c, i) => (
                  <Link key={c.id} href={`/assets?category_id=${c.id}`} className="group block">
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="truncate text-slate-600 group-hover:text-brand-600">{c.account_code && <span className="font-mono text-xs text-slate-400">{c.account_code}</span>} {c.name}</span>
                      <span className="ml-2 shrink-0 font-semibold text-slate-800">{c.count} {t('common.pcs')}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(c.count / maxCat) * 100}%` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${c.color}, ${c.color}cc)` }} />
                    </div>
                  </Link>
                ))}
          </div>
        </Card>

        <Card i={6} className="card-pad">
          <div className="flex items-center justify-between gap-2">
            <h3 className="section-title">{t('dashboard.repair_cost')}</h3>
            <span className="chip bg-brand-50 text-brand-700">{t(`period.${period}`)}</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ['total', fmtMoney(data?.repairCost?.total, lang), Wallet],
              ['jobs', data?.repairCost?.count ?? 0, Wrench],
              ['avg', fmtMoney(data?.repairCost?.avg, lang), Activity],
            ].map(([k, v, Icon]) => (
              <div key={k} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <Icon className="h-4 w-4 text-slate-400" />
                <p className="mt-1.5 text-[11px] text-slate-400">{t(`dashboard.cost_${k}`)}</p>
                <p className="truncate text-sm font-bold text-slate-800">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 h-36">
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gIns" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip money lang={lang} />} />
                <Area type="monotone" dataKey="repair_cost" name={t('dashboard.cost_total')} stroke="#6366f1" strokeWidth={2.5} fill="url(#gCost)" animationDuration={1200} />
                <Area type="monotone" dataKey="inspections" name={t('nav.inspections')} stroke="#10b981" strokeWidth={2} fill="url(#gIns)" animationDuration={1200} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Lists row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card i={7} className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5">
            <h3 className="section-title flex items-center gap-2"><CalendarClock className="h-4 w-4 text-amber-500" />{t('dashboard.upcoming')}</h3>
            <Link href="/schedule" className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:gap-2 transition-all">{t('common.view_all')} <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {(data?.upcoming || []).length === 0 ? <EmptyState icon={CheckCircle2} title={t('dashboard.no_upcoming')} /> :
              data.upcoming.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                  <Link href={`/assets/${a.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{a.name}</p>
                      <p className="font-mono text-xs text-slate-400">{a.code}</p>
                    </div>
                    <div className="text-right">
                      <DueBadge days={a.days_left} />
                      <p className="mt-0.5 text-[11px] text-slate-400">{fmtDate(a.next_inspection, lang)}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
          </div>
        </Card>

        <Card i={8} className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5">
            <h3 className="section-title flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-500" />{t('dashboard.open_repairs')}</h3>
            <Link href="/repairs" className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:gap-2 transition-all">{t('common.view_all')} <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {(data?.openRepairs || []).length === 0 ? <EmptyState icon={CheckCircle2} title={t('dashboard.no_repairs')} /> :
              data.openRepairs.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                  <Link href={`/assets/${r.asset_id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{r.problem}</p>
                      <p className="font-mono text-xs text-slate-400">{r.ticket_no} · {r.asset_code}</p>
                    </div>
                    <PriorityBadge priority={r.priority} />
                  </Link>
                </motion.div>
              ))}
          </div>
        </Card>

        <Card i={9} className="overflow-hidden">
          <div className="px-5 pt-5">
            <h3 className="section-title flex items-center gap-2"><Activity className="h-4 w-4 text-brand-500" />{t('dashboard.activity')}</h3>
          </div>
          <div className="relative mt-3 px-5 pb-4">
            {(data?.activity || []).length === 0 ? <EmptyState icon={ClipboardCheck} title={t('common.no_data')} /> : (
              <ol className="relative space-y-4 border-l border-slate-200 pl-5">
                {data.activity.map((a, i) => (
                  <motion.li key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }} className="relative">
                    <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500 ring-2 ring-brand-100" />
                    <p className="text-sm text-slate-700">
                      <b className="font-semibold">{a.user_name || '-'}</b> {t(`activity.${a.action}`)}{' '}
                      <span className="font-mono text-xs text-brand-600">{a.details?.code || a.details?.ticket || ''}</span>
                    </p>
                    <p className="text-[11px] text-slate-400">{relativeTime(a.created_at, t)}</p>
                  </motion.li>
                ))}
              </ol>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
