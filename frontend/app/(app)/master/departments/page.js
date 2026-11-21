'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, Building2, CheckCircle2, Eye, Mail, MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth, useI18n } from '@/components/providers';
import {
  Button, ConfirmModal, CountUp, EmptyState, Field, Input, Modal, PageHeader, SearchInput, Skeleton, Toggle, cn,
} from '@/components/ui';

/** Badge text: department code, or the first letter of the name when no code is set */
const badge = (d) => d.code || (d.name || '?').trim().charAt(0).toUpperCase();

/** Shared column layout for the header and rows on large screens (email column from xl) */
const GRID = 'lg:grid-cols-[5.5rem_6rem_minmax(0,2fr)_minmax(0,1.2fr)_4.5rem_7.5rem] lg:gap-4 xl:grid-cols-[5.5rem_6rem_minmax(0,2fr)_minmax(0,1.2fr)_4.5rem_minmax(0,1.5fr)_7.5rem]';

function RowMenu({ d, writable, onEdit, onDelete }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50';
  const go = (fn) => () => { setOpen(false); fn(); };
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={cn('btn-icon', open && 'border-brand-200 text-brand-600')} aria-label={t('common.actions')}>
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.12 }}
            className="absolute right-0 z-20 mt-1.5 w-52 origin-top-right rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl">
            <button className={item} onClick={go(() => router.push(`/assets?department_id=${d.id}`))}><Eye className="h-4 w-4 text-slate-400" />{t('location.view_assets')}</button>
            {writable && <>
              <button className={item} onClick={go(onEdit)}><Pencil className="h-4 w-4 text-slate-400" />{t('common.edit')}</button>
              <div className="my-1 border-t border-slate-100" />
              <button className={cn(item, '!text-rose-600 hover:bg-rose-50')} onClick={go(onDelete)}><Trash2 className="h-4 w-4" />{t('common.delete')}</button>
            </>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DepartmentsPage() {
  const { t, te } = useI18n();
  const { can } = useAuth();
  const writable = can('manage');
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const { data, loading, reload, setData } = useApi('/departments', { q: dq });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const rows = data || [];
  const stats = [
    { k: 'total', v: rows.length, icon: Building2, cls: 'bg-brand-50 text-brand-600', num: 'text-brand-600' },
    { k: 'active', v: rows.filter((d) => d.active).length, icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600', num: 'text-emerald-600' },
    { k: 'assets', v: rows.reduce((s, d) => s + Number(d.asset_count || 0), 0), icon: Box, cls: 'bg-cyan-50 text-cyan-600', num: 'text-cyan-600' },
    { k: 'custodians', v: rows.reduce((s, d) => s + Number(d.custodian_count || 0), 0), icon: Users, cls: 'bg-violet-50 text-violet-600', num: 'text-violet-600' },
  ];

  const open = (d) => {
    setEditing(d || {});
    setForm({ code: d?.code || '', name: d?.name || '', head: d?.head || '', email: d?.email || '', dept_no: d?.dept_no || '', active: d?.active ?? true });
  };

  const save = async () => {
    if (!form.dept_no) return toast.error(`${t('dept.no')}: ${t('form.required')}`);
    if (!/^\d{3}$/.test(form.dept_no)) return toast.error(t('dept.no_invalid'));
    if (!form.name.trim()) return toast.error(`${t('dept.name')}: ${t('form.required')}`);
    setSaving(true);
    try {
      if (editing.id) await api(`/departments/${editing.id}`, { method: 'PUT', body: form });
      else await api('/departments', { method: 'POST', body: form });
      toast.success(t('common.saved'));
      setEditing(null);
      reload();
    } catch (e) {
      toast.error(te(e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (d) => {
    setData(rows.map((x) => (x.id === d.id ? { ...x, active: !d.active } : x)));
    try {
      await api(`/departments/${d.id}`, { method: 'PUT', body: { active: !d.active } });
      toast.success(!d.active ? t('dept.activated') : t('dept.deactivated'));
    } catch (e) {
      toast.error(te(e));
      reload();
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api(`/departments/${del.id}`, { method: 'DELETE' });
      toast.success(t('common.deleted'));
      setDel(null);
      reload();
    } catch (e) {
      toast.error(te(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader title={t('dept.title')} subtitle={t('dept.subtitle', { n: rows.length })}
        actions={writable && <Button icon={Plus} onClick={() => open(null)}>{t('dept.add')}</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }}
            className="card flex items-center gap-4 p-4">
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', s.cls)}><s.icon className="h-5 w-5" /></span>
            <div>
              <p className={cn('text-2xl font-extrabold', s.num)}><CountUp value={s.v} /></p>
              <p className="text-xs text-slate-500">{t(`dept.stat_${s.k}`)}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="card mb-4 p-3"><SearchInput value={q} onChange={setQ} placeholder={t('dept.search')} /></div>

      <div className="card">
        {loading && !data ? (
          <div className="space-y-3 p-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Building2} title={t('common.no_data')} action={writable && <Button icon={Plus} onClick={() => open(null)}>{t('dept.add')}</Button>} />
        ) : (
          <div className="divide-y divide-slate-100">
            {/* column header (desktop) */}
            <div className={cn(GRID, 'hidden rounded-t-2xl bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:grid')}>
              <span>{t('dept.code')}</span>
              <span>{t('dept.no_short')}</span>
              <span>{t('dept.name')}</span>
              <span>{t('dept.head')}</span>
              <span className="text-center">{t('dept.col_assets')}</span>
              <span className="hidden xl:block">{t('dept.col_email')}</span>
              <span className="text-right">{t('dept.col_status')}</span>
            </div>
            {rows.map((d, i) => (
              <motion.div key={d.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 20) * 0.02 }}
                className={cn(GRID, 'group flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:px-5 lg:grid', !d.active && 'opacity-60')}>
                <span className={cn('flex h-11 shrink-0 items-center justify-center justify-self-start rounded-xl bg-brand-50 px-2 font-bold text-brand-600 transition group-hover:scale-105',
                  badge(d).length > 4 ? 'min-w-[3.5rem] text-[10px]' : 'w-11 text-[13px]')}>
                  {badge(d)}
                </span>
                <span className="hidden font-mono text-sm font-semibold text-slate-700 lg:block">
                  {d.dept_no || <span className="font-sans font-normal text-slate-300">—</span>}
                </span>
                <button type="button" onClick={() => writable && open(d)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[14px] font-semibold text-slate-800">{d.name}</p>
                  {/* mobile / tablet: details under the name */}
                  <p className="truncate text-xs text-slate-500 lg:hidden">
                    {t('dept.head')}: {d.head || '—'} · {t('location.n_assets', { n: d.asset_count })}
                    {d.dept_no && <span className="ml-1.5 font-mono text-slate-400">· {d.dept_no}</span>}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-slate-400 lg:hidden">
                    {d.email ? <><Mail className="h-3 w-3" />{d.email}</> : t('dept.no_email')}
                  </p>
                </button>
                <span className="hidden truncate text-sm text-slate-600 lg:block">{d.head || <span className="text-slate-300">—</span>}</span>
                <span className="hidden text-center text-sm font-semibold text-slate-700 lg:block">{Number(d.asset_count || 0)}</span>
                <span className="hidden min-w-0 items-center gap-1 truncate text-sm text-slate-500 xl:flex">
                  {d.email ? <><Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate">{d.email}</span></> : <span className="text-slate-300">—</span>}
                </span>
                <div className="flex shrink-0 items-center justify-end gap-3">
                  {writable ? <Toggle checked={!!d.active} onChange={() => toggle(d)} /> : null}
                  <RowMenu d={d} writable={writable} onEdit={() => open(d)} onDelete={() => setDel(d)} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('dept.edit') : t('dept.add')} subtitle={editing?.id ? editing.name : undefined}
        footer={<>
          <Button variant="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
          <Button onClick={save} loading={saving}>{t('common.save')}</Button>
        </>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('dept.code')} hint={t('dept.code_hint')}>
            <Input className="font-mono" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="IT" />
          </Field>
          <Field label={t('dept.no')} hint={t('dept.no_hint')} required>
            <Input className="font-mono" maxLength={3} inputMode="numeric" value={form.dept_no || ''} onChange={(e) => setForm({ ...form, dept_no: e.target.value.replace(/\D/g, '') })} placeholder="504" />
          </Field>
          <Field label={t('dept.name')} required className="sm:col-span-2">
            <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="INFORMATION TECHNOLOGY" />
          </Field>
          <Field label={t('dept.head')}><Input value={form.head || ''} onChange={(e) => setForm({ ...form, head: e.target.value })} placeholder="IT Manager" /></Field>
          <Field label={t('dept.email')}><Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="it@company.com" /></Field>
          <Toggle checked={!!form.active} onChange={(v) => setForm({ ...form, active: v })} label={t('common.active')} />
        </div>
      </Modal>

      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={deleting} title={t('common.delete')}
        text={del && Number(del.asset_count) > 0 ? t('dept.delete_in_use', { n: del.asset_count }) : t('common.delete_confirm', { name: del?.name || '' })}
        confirmText={t('common.delete')} />
    </div>
  );
}
