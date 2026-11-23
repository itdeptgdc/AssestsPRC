'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, Building2, LayoutGrid, Mail, MoreHorizontal, Pencil, Phone, Plus, Power, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { deptLabel } from '@/lib/format';
import { useAuth, useI18n } from '@/components/providers';
import {
  Badge, Button, ConfirmModal, CountUp, EmptyState, Field, Input, Modal, PageHeader, SearchInput, Select, Skeleton, Toggle, cn,
} from '@/components/ui';

const AVATAR = ['from-brand-500 to-violet-500', 'from-sky-500 to-cyan-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-rose-500 to-pink-500'];
const displayName = (c) => (c.employee_code ? `${c.name} - (${c.employee_code})` : c.name);

function CardMenu({ c, perm, onEdit, onToggle, onDelete }) {
  const { t } = useI18n();
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
            className="absolute left-0 z-20 mt-1.5 w-52 origin-top-left rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl">
            {perm.edit && <>
              <button className={item} onClick={go(onEdit)}><Pencil className="h-4 w-4 text-slate-400" />{t('common.edit')}</button>
              <button className={item} onClick={go(onToggle)}><Power className="h-4 w-4 text-slate-400" />{c.active ? t('location.deactivate') : t('location.activate')}</button>
            </>}
            {perm.edit && perm.del && <div className="my-1 border-t border-slate-100" />}
            {perm.del && <button className={cn(item, '!text-rose-600 hover:bg-rose-50')} onClick={go(onDelete)}><Trash2 className="h-4 w-4" />{t('common.delete')}</button>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CustodiansPage() {
  const { t, te } = useI18n();
  const { can } = useAuth();
  const router = useRouter();
  const perm = { add: can('custodians.add'), edit: can('custodians.edit'), del: can('custodians.delete') };
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const { data, loading, reload, setData } = useApi('/custodians', { q: dq });
  const { data: lk } = useApi('/lookups');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const rows = data || [];
  const totalAssets = rows.reduce((s, c) => s + Number(c.asset_count || 0), 0);
  const avg = rows.length ? totalAssets / rows.length : 0;
  const stats = [
    { k: 'total', v: rows.length, icon: Users, cls: 'bg-brand-50 text-brand-600', num: 'text-brand-600' },
    { k: 'assets', v: totalAssets, icon: Box, cls: 'bg-cyan-50 text-cyan-600', num: 'text-cyan-600' },
    { k: 'departments', v: new Set(rows.map((c) => c.department_id).filter(Boolean)).size, icon: Building2, cls: 'bg-violet-50 text-violet-600', num: 'text-violet-600' },
    { k: 'avg', v: avg, icon: LayoutGrid, cls: 'bg-orange-50 text-orange-600', num: 'text-orange-600', fmt: (n) => (Number.isInteger(avg) ? Math.round(n) : n.toFixed(1)) },
  ];

  const open = (c) => {
    setEditing(c || {});
    setForm({
      employee_code: c?.employee_code || '', name: c?.name || '', position: c?.position || '',
      department_id: c?.department_id || '', phone: c?.phone || '', email: c?.email || '', active: c?.active ?? true,
    });
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error(`${t('master.full_name')}: ${t('form.required')}`);
    setSaving(true);
    try {
      if (editing.id) await api(`/custodians/${editing.id}`, { method: 'PUT', body: form });
      else await api('/custodians', { method: 'POST', body: form });
      toast.success(t('common.saved'));
      setEditing(null);
      reload();
    } catch (e) {
      toast.error(te(e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c) => {
    setData(rows.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)));
    try {
      await api(`/custodians/${c.id}`, { method: 'PUT', body: { active: !c.active } });
      toast.success(t('common.saved'));
    } catch (e) {
      toast.error(te(e));
      reload();
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api(`/custodians/${del.id}`, { method: 'DELETE' });
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
      <PageHeader title={t('custodian.title')} subtitle={t('custodian.subtitle', { n: rows.length })}
        actions={perm.add && <Button icon={Plus} onClick={() => open(null)}>{t('custodian.add')}</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }}
            className="card flex items-center gap-4 p-4">
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', s.cls)}><s.icon className="h-5 w-5" /></span>
            <div>
              <p className={cn('text-2xl font-extrabold', s.num)}><CountUp value={s.v} format={s.fmt} /></p>
              <p className="text-xs text-slate-500">{t(`custodian.stat_${s.k}`)}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="card mb-4 p-3"><SearchInput value={q} onChange={setQ} placeholder={t('custodian.search')} /></div>

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : rows.length === 0 ? (
        <div className="card"><EmptyState icon={Users} title={t('common.no_data')} action={perm.add && <Button icon={Plus} onClick={() => open(null)}>{t('custodian.add')}</Button>} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 16) * 0.04 }}
              whileHover={{ y: -3 }} className={cn('card flex flex-col p-4 sm:p-5', !c.active && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-base font-bold text-white shadow-soft', AVATAR[i % AVATAR.length])}>
                  {(c.name || '?').trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{displayName(c)}</p>
                  <p className="truncate text-xs uppercase tracking-wide text-slate-400">
                    {c.department_name || t('custodian.no_dept')}{c.position ? ` · ${c.position}` : ''}
                  </p>
                </div>
                <Badge tone={Number(c.asset_count) > 0 ? 'brand' : 'slate'} className="shrink-0">{t('location.n_assets', { n: c.asset_count || 0 })}</Badge>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                {c.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" />{c.phone}</p>}
                {c.email && <p className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 text-slate-400" />{c.email}</p>}
                {!c.phone && !c.email && <p className="text-xs text-slate-400">{t('custodian.no_contact')}</p>}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button size="sm" variant="secondary" className="!py-2" onClick={() => router.push(`/assets?custodian_id=${c.id}`)}>{t('location.view_assets')}</Button>
                {(perm.edit || perm.del) && <CardMenu c={c} perm={perm} onEdit={() => open(c)} onToggle={() => toggle(c)} onDelete={() => setDel(c)} />}
                {!c.active && <Badge tone="gray" className="ml-auto">{t('common.inactive')}</Badge>}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('custodian.edit') : t('custodian.add')} subtitle={editing?.id ? displayName(editing) : undefined}
        footer={<>
          <Button variant="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
          <Button onClick={save} loading={saving}>{t('common.save')}</Button>
        </>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('master.full_name')} required className="sm:col-span-2">
            <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nitinai Pongsiitthisak" />
          </Field>
          <Field label={t('master.employee_code')}><Input className="font-mono" value={form.employee_code || ''} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} placeholder="20230270" /></Field>
          <Field label={t('master.position')}><Input value={form.position || ''} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="IT Officer" /></Field>
          <Field label={t('code.department')} className="sm:col-span-2">
            <Select value={form.department_id || ''} onChange={(e) => setForm({ ...form, department_id: e.target.value })} placeholder={t('form.select')}>
              {lk?.departments.map((d) => <option key={d.id} value={d.id}>{deptLabel(d)}</option>)}
            </Select>
          </Field>
          <Field label={t('master.phone')}><Input type="tel" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="089-079-5068" /></Field>
          <Field label={t('master.email')}><Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Toggle checked={!!form.active} onChange={(v) => setForm({ ...form, active: v })} label={t('common.active')} />
        </div>
      </Modal>

      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={deleting} title={t('common.delete')}
        text={del && Number(del.asset_count) > 0 ? t('custodian.delete_in_use', { n: del.asset_count }) : t('common.delete_confirm', { name: del?.name || '' })}
        confirmText={t('common.delete')} />
    </div>
  );
}
