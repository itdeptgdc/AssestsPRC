'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, Building2, CheckCircle2, Eye, MapPin, MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth, useI18n } from '@/components/providers';
import {
  Badge, Button, ConfirmModal, CountUp, EmptyState, Field, Input, Modal, PageHeader, SearchInput, Skeleton, Textarea, Toggle, cn,
} from '@/components/ui';

const label = (l) => [l.building, l.floor, l.name].filter(Boolean).join(' · ');

function RowMenu({ loc, perm, onEdit, onToggle, onDelete }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50';
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={cn('btn-icon', open && 'border-brand-200 text-brand-600')} aria-label={t('common.actions')}>
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.12 }}
            className="absolute right-0 z-20 mt-1.5 w-52 origin-top-right rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl">
            <button className={cn(item, 'text-slate-700')} onClick={() => { setOpen(false); router.push(`/assets?location_id=${loc.id}`); }}>
              <Eye className="h-4 w-4 text-slate-400" />{t('location.view_assets')}
            </button>
            {perm.edit && <>
              <button className={cn(item, 'text-slate-700')} onClick={() => { setOpen(false); onEdit(loc); }}>
                <Pencil className="h-4 w-4 text-slate-400" />{t('common.edit')}
              </button>
              <button className={cn(item, 'text-slate-700')} onClick={() => { setOpen(false); onToggle(loc); }}>
                <Power className="h-4 w-4 text-slate-400" />{loc.active ? t('location.deactivate') : t('location.activate')}
              </button>
            </>}
            {perm.del && <>
              <div className="my-1 border-t border-slate-100" />
              <button className={cn(item, 'text-rose-600 hover:bg-rose-50')} onClick={() => { setOpen(false); onDelete(loc); }}>
                <Trash2 className="h-4 w-4" />{t('common.delete')}
              </button>
            </>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LocationsPage() {
  const { t, te } = useI18n();
  const { can } = useAuth();
  const perm = { add: can('locations.add'), edit: can('locations.edit'), del: can('locations.delete') };
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const { data, loading, reload, setData } = useApi('/locations', { q: dq });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const rows = data || [];
  const stats = [
    { k: 'total', v: rows.length, icon: MapPin, cls: 'bg-brand-50 text-brand-600', num: 'text-brand-600' },
    { k: 'active', v: rows.filter((l) => l.active).length, icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600', num: 'text-emerald-600' },
    { k: 'buildings', v: new Set(rows.map((l) => (l.building || '').trim()).filter(Boolean)).size, icon: Building2, cls: 'bg-violet-50 text-violet-600', num: 'text-violet-600' },
    { k: 'assets', v: rows.reduce((s, l) => s + Number(l.asset_count || 0), 0), icon: Box, cls: 'bg-cyan-50 text-cyan-600', num: 'text-cyan-600' },
  ];

  const open = (l) => {
    setEditing(l || {});
    setForm({ building: l?.building || '', floor: l?.floor || '', name: l?.name || '', code: l?.code || '', description: l?.description || '', active: l?.active ?? true });
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error(`${t('location.room')}: ${t('form.required')}`);
    setSaving(true);
    try {
      const body = { ...form, room: form.name };
      if (!body.code) delete body.code; // auto-generated on create, unchanged on edit
      if (editing.id) await api(`/locations/${editing.id}`, { method: 'PUT', body });
      else await api('/locations', { method: 'POST', body });
      toast.success(t('common.saved'));
      setEditing(null);
      reload();
    } catch (e) {
      toast.error(te(e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (l) => {
    setData(rows.map((x) => (x.id === l.id ? { ...x, active: !l.active } : x)));
    try {
      await api(`/locations/${l.id}`, { method: 'PUT', body: { active: !l.active } });
      toast.success(t('common.saved'));
    } catch (e) {
      toast.error(te(e));
      reload();
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api(`/locations/${del.id}`, { method: 'DELETE' });
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
      <PageHeader title={t('location.title')} subtitle={t('location.subtitle', { n: rows.length })}
        actions={perm.add && <Button icon={Plus} onClick={() => open(null)}>{t('location.add')}</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }}
            className="card flex items-center gap-4 p-4">
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', s.cls)}><s.icon className="h-5 w-5" /></span>
            <div>
              <p className={cn('text-2xl font-extrabold', s.num)}><CountUp value={s.v} /></p>
              <p className="text-xs text-slate-500">{t(`location.stat_${s.k}`)}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="card mb-4 p-3"><SearchInput value={q} onChange={setQ} placeholder={t('location.search')} /></div>

      <div className="card">
        {loading && !data ? (
          <div className="space-y-3 p-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={MapPin} title={t('common.no_data')} action={perm.add && <Button icon={Plus} onClick={() => open(null)}>{t('location.add')}</Button>} />
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((l, i) => (
              <motion.div key={l.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 20) * 0.025 }}
                className={cn('group flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:px-5', !l.active && 'opacity-60')}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:scale-110">
                  <MapPin className="h-[18px] w-[18px]" />
                </span>
                <button type="button" onClick={() => perm.edit && open(l)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[14px] font-semibold text-slate-800">{label(l)}</p>
                  <p className="text-xs text-slate-400">
                    {Number(l.asset_count) > 0 ? t('location.n_assets', { n: l.asset_count }) : t('location.no_assets')}
                    <span className="ml-2 font-mono text-[11px] text-slate-300">{l.code}</span>
                  </p>
                </button>
                {l.active ? <Badge tone="green">{t('location.in_use')}</Badge> : <Badge tone="gray">{t('common.inactive')}</Badge>}
                <RowMenu loc={l} perm={perm} onEdit={open} onToggle={toggle} onDelete={setDel} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('location.edit') : t('location.add')}
        subtitle={form.name ? [form.building, form.floor, form.name].filter(Boolean).join(' · ') : undefined}
        footer={<>
          <Button variant="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
          <Button onClick={save} loading={saving}>{t('common.save')}</Button>
        </>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('master.building')}><Input value={form.building || ''} onChange={(e) => setForm({ ...form, building: e.target.value })} placeholder="HOD" /></Field>
          <Field label={t('master.floor')}><Input value={form.floor || ''} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="Floor-1" /></Field>
          <Field label={t('location.room')} required className="sm:col-span-2"><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="IT Server Room" /></Field>
          <Field label={t('master.code')} hint={t('location.code_hint')}><Input className="font-mono" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="LOC-014" /></Field>
          <div className="flex items-end pb-2"><Toggle checked={!!form.active} onChange={(v) => setForm({ ...form, active: v })} label={t('common.active')} /></div>
          <Field label={t('master.description')} className="sm:col-span-2"><Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
      </Modal>

      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={deleting} title={t('common.delete')}
        text={del && Number(del.asset_count) > 0 ? t('location.delete_in_use', { n: del.asset_count }) : t('common.delete_confirm', { name: del ? label(del) : '' })}
        confirmText={t('common.delete')} />
    </div>
  );
}
