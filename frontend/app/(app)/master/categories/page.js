'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import RowActions from '@/components/RowActions';
import { Check, Clock, Eye, GripVertical, Hash, MoreHorizontal, Package, Pencil, Plus, Power, Tag, Tags, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth, useI18n } from '@/components/providers';
import { Button, ConfirmModal, EmptyState, Field, Input, Modal, PageHeader, SearchInput, Select, Skeleton, Tabs, Textarea, Toggle, cn } from '@/components/ui';

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

function TypesEditor({ category, onChange }) {
  const { t, te } = useI18n();
  const [types, setTypes] = useState(category.types || []);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const nextNumber = String(Math.max(0, ...types.map((x) => Number(x.number) || 0)) + 1).padStart(2, '0');
  const [number, setNumber] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const row = await api('/asset-types', { method: 'POST', body: { category_id: category.id, number: (number || nextNumber).padStart(2, '0'), name: name.trim() } });
      setTypes([...types, row].sort((a, b) => a.number.localeCompare(b.number)));
      setName(''); setNumber('');
      onChange();
    } catch (e) {
      toast.error(te(e));
    } finally {
      setBusy(false);
    }
  };
  const [edit, setEdit] = useState(null);      // { id, number, name } while a row is being edited
  const [confirmId, setConfirmId] = useState(null); // row asking "Delete this type?"
  const sortTypes = (list) => [...list].sort((a, b) => a.number.localeCompare(b.number));

  const remove = async (id) => {
    try {
      await api(`/asset-types/${id}`, { method: 'DELETE' });
      setTypes(types.filter((x) => x.id !== id));
      setConfirmId(null);
      toast.success(t('common.deleted'));
      onChange();
    } catch (e) {
      toast.error(te(e));
    }
  };
  const save = async () => {
    const number = String(edit.number || '').replace(/\D/g, '').padStart(2, '0').slice(-2);
    if (!edit.name.trim() || number === '00') return;
    setBusy(true);
    try {
      const row = await api(`/asset-types/${edit.id}`, { method: 'PUT', body: { number, name: edit.name.trim() } });
      setTypes(sortTypes(types.map((x) => (x.id === row.id ? row : x))));
      setEdit(null);
      toast.success(t('common.saved'));
      onChange();
    } catch (e) {
      toast.error(te(e));
    } finally {
      setBusy(false);
    }
  };
  const editKeys = (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { e.stopPropagation(); setEdit(null); } };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{t('category.types_hint')}</p>
      <div className="space-y-2">
        {types.length === 0 && <p className="rounded-xl bg-slate-50 py-4 text-center text-sm text-slate-400">{t('category.no_types')}</p>}
        {types.map((x) => {
          const editing = edit?.id === x.id;
          const asking = confirmId === x.id;
          return (
            <motion.div layout key={x.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              className={cn('group flex min-h-[52px] items-center gap-3 rounded-xl border bg-white px-3 py-2 transition-colors',
                editing ? 'border-brand-300 ring-2 ring-brand-100' : asking ? 'border-rose-200 bg-rose-50/40' : 'border-slate-100 hover:border-slate-200')}>
              {editing ? (
                <>
                  <Input autoFocus className="!h-9 w-16 !px-2 text-center font-mono font-bold" maxLength={2} value={edit.number}
                    onChange={(e) => setEdit({ ...edit, number: e.target.value.replace(/\D/g, '') })} onKeyDown={editKeys} />
                  <Input className="!h-9 flex-1" value={edit.name} placeholder={t('category.type_name_ph')}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })} onKeyDown={editKeys} />
                  <RowActions actions={[
                    { key: 'save', icon: Check, label: t('common.save'), tone: 'green', onClick: save },
                    { key: 'cancel', icon: X, label: t('common.cancel'), tone: 'slate', onClick: () => setEdit(null) },
                  ]} />
                </>
              ) : (
                <>
                  <span className="flex h-7 min-w-[36px] items-center justify-center rounded-lg bg-brand-50 px-2 font-mono text-sm font-bold text-brand-700">{x.number}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{asking ? <span className="text-rose-600">{t('category.type_delete_q')} <span className="text-slate-500">({x.name})</span></span> : x.name}</span>
                  {asking ? (
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="secondary" className="!py-1.5" onClick={() => setConfirmId(null)}>{t('common.cancel')}</Button>
                      <Button size="sm" className="!bg-none !bg-rose-600 !py-1.5 !shadow-none hover:!bg-rose-700" icon={Trash2} onClick={() => remove(x.id)}>{t('common.delete')}</Button>
                    </div>
                  ) : (
                    <RowActions actions={[
                      { key: 'edit', icon: Pencil, label: t('common.edit'), tone: 'brand', onClick: () => { setConfirmId(null); setEdit({ id: x.id, number: x.number, name: x.name }); } },
                      { key: 'delete', icon: Trash2, label: t('common.delete'), tone: 'rose', onClick: () => { setEdit(null); setConfirmId(x.id); } },
                    ]} />
                  )}
                </>
              )}
            </motion.div>
          );
        })}
        {edit && <p className="px-1 text-[11px] text-slate-400">{t('category.type_number_note')}</p>}
      </div>
      <div className="flex gap-2">
        <Input className="w-20 font-mono" maxLength={2} placeholder={nextNumber} value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))} />
        <Input className="flex-1" placeholder={t('category.type_name_ph')} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
        <Button type="button" icon={Plus} loading={busy} onClick={add}>{t('common.add')}</Button>
      </div>
    </div>
  );
}

function ChecklistEditor({ value, onChange }) {
  const { t } = useI18n();
  const [item, setItem] = useState('');
  const add = () => { if (item.trim()) { onChange([...value, item.trim()]); setItem(''); } };
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">{t('category.checklist_hint')}</p>
      {value.map((c, i) => (
        <motion.div layout key={i} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2">
          <GripVertical className="h-4 w-4 text-slate-300" />
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-[11px] font-bold text-emerald-600">{i + 1}</span>
          <input className="flex-1 bg-transparent text-sm text-slate-700 outline-none" value={c} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-lg p-1 text-slate-400 hover:text-rose-500"><X className="h-4 w-4" /></button>
        </motion.div>
      ))}
      <div className="flex gap-2">
        <Input placeholder={t('category.checklist_ph')} value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
        <Button type="button" variant="soft" icon={Plus} onClick={add}>{t('common.add')}</Button>
      </div>
    </div>
  );
}

function CardMenu({ c, perm, onEdit, onTypes, onToggle, onDelete }) {
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
            <button className={item} onClick={go(() => router.push(`/assets?category_id=${c.id}`))}><Eye className="h-4 w-4 text-slate-400" />{t('location.view_assets')}</button>
            {perm.edit && <>
              <button className={item} onClick={go(onEdit)}><Pencil className="h-4 w-4 text-slate-400" />{t('common.edit')}</button>
              <button className={item} onClick={go(onTypes)}><Hash className="h-4 w-4 text-slate-400" />{t('category.types')}</button>
              <button className={item} onClick={go(onToggle)}><Power className="h-4 w-4 text-slate-400" />{c.active ? t('location.deactivate') : t('location.activate')}</button>
            </>}
            {perm.del && <>
              <div className="my-1 border-t border-slate-100" />
              <button className={cn(item, '!text-rose-600 hover:bg-rose-50')} onClick={go(onDelete)}><Trash2 className="h-4 w-4" />{t('common.delete')}</button>
            </>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CategoriesPage() {
  const { t, te } = useI18n();
  const { can } = useAuth();
  const perm = { add: can('categories.add'), edit: can('categories.edit'), del: can('categories.delete') };
  const writable = perm.edit;
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const { data, loading, reload, setData } = useApi('/categories', { q: dq });
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState('info');
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const open = (row, startTab = 'info') => {
    setEditing(row || {});
    setTab(startTab);
    setForm({
      code: row?.code || '', account_code: row?.account_code || '', name: row?.name || '', description: row?.description || '',
      inspection_months: row?.inspection_months || 6, color: row?.color || COLORS[0],
      checklist: row?.checklist || [], active: row?.active ?? true,
    });
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) return toast.error(t('form.check_fields'));
    setSaving(true);
    try {
      // A 3-digit asset code (e.g. "400") is also the number used inside generated asset codes (P401-400-01-23-0001)
      const code = form.code.trim();
      const body = { ...form, code, account_code: /^\d{3}$/.test(code) ? code : null, inspection_months: Number(form.inspection_months) || 6 };
      const row = editing?.id
        ? await api(`/categories/${editing.id}`, { method: 'PUT', body })
        : await api('/categories', { method: 'POST', body });
      toast.success(t('common.saved'));
      reload();
      if (!editing?.id) { setEditing({ ...row, types: [] }); setTab('types'); } else setEditing(null);
    } catch (e) {
      toast.error(te(e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c) => {
    setData((data || []).map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)));
    try {
      await api(`/categories/${c.id}`, { method: 'PUT', body: { active: !c.active } });
    } catch (e) {
      toast.error(te(e));
      reload();
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api(`/categories/${del.id}`, { method: 'DELETE' });
      toast.success(t('common.deleted'));
      setDel(null);
      reload();
    } catch (e) {
      toast.error(te(e));
    } finally {
      setDeleting(false);
    }
  };

  const rows = data || [];

  return (
    <div>
      <PageHeader title={t('category.title')} subtitle={t('category.subtitle', { n: rows.length })}
        actions={perm.add && <Button icon={Plus} onClick={() => open(null)}>{t('category.add')}</Button>} />

      <div className="card mb-4 p-3"><SearchInput value={q} onChange={setQ} placeholder={t('common.search_ph')} /></div>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-52" />)}</div>
      ) : rows.length === 0 ? (
        <div className="card"><EmptyState icon={Tags} title={t('common.no_data')} /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {rows.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 16) * 0.03 }}
              whileHover={{ y: -4 }} className={cn('card relative flex flex-col p-4 sm:p-5', !c.active && 'opacity-60')}>
              <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl" style={{ background: c.color }} />
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <span className="inline rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold leading-6 text-brand-700 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
                    {c.code}
                  </span>
                </div>
                {(perm.edit || perm.del) && (
                  <>
                    {perm.edit && <button type="button" onClick={() => open(c, 'types')} title={t('category.types')}
                      className="btn-icon relative shrink-0">
                      <Tag className="h-4 w-4" />
                      {(c.types || []).length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-600 px-1 text-[9px] font-bold text-white">{c.types.length}</span>}
                    </button>}
                    <CardMenu c={c} perm={perm} onEdit={() => open(c)} onTypes={() => open(c, 'types')} onToggle={() => toggle(c)} onDelete={() => setDel(c)} />
                  </>
                )}
              </div>
              <h3 className="mt-3 font-semibold leading-snug text-slate-800">{c.name}</h3>
              {c.description && <p className="mt-1 text-xs text-slate-400">{c.description}</p>}
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />{t('category.n_assets', { n: c.asset_count })}</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t('form.every_months', { n: c.inspection_months })}</span>
                {c.account_code && c.account_code !== c.code && <span className="flex items-center gap-1 font-mono"><Hash className="h-3.5 w-3.5" />{c.account_code}</span>}
              </div>
              {writable && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" className="flex-1 !py-2" onClick={() => open(c, 'checklist')}>Checklist</Button>
                  <Button size="sm" variant="secondary" className="!py-2" onClick={() => open(c)}>{t('common.edit')}</Button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} size="lg"
        title={editing?.id ? editing.name : t('category.add')}
        subtitle={editing?.id ? editing.code : undefined}
        footer={tab !== 'types' ? <>
          {editing?.id && perm.del && <Button variant="ghost" className="mr-auto text-rose-600 hover:bg-rose-50" icon={Trash2} onClick={() => { setDel(editing); setEditing(null); }}>{t('common.delete')}</Button>}
          <Button variant="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
          <Button onClick={save} loading={saving}>{t('common.save')}</Button>
        </> : <Button variant="secondary" onClick={() => setEditing(null)}>{t('common.close')}</Button>}>
        <div className="-mt-2 mb-5">
          <Tabs value={tab} onChange={setTab} tabs={[
            { value: 'info', label: t('category.tab_info') },
            { value: 'checklist', label: 'Checklist', count: form.checklist?.length },
            ...(editing?.id ? [{ value: 'types', label: t('category.types'), count: editing.types?.length }] : []),
          ]} />
        </div>
        {tab === 'info' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('category.code')} required hint={t('category.account_hint')} className="sm:col-span-2">
              <Input className="font-mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="602" />
            </Field>
            <Field label={t('category.name')} required className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="CUMPUTER HARDWARE(ฮาร์ดแวร์คอมพิวเตอร์)" />
            </Field>
            <Field label={t('master.description')} className="sm:col-span-2"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label={t('assets.inspection_cycle')}>
              <Select value={form.inspection_months} onChange={(e) => setForm({ ...form, inspection_months: e.target.value })}>
                {[1, 2, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{t('form.every_months', { n: m })}</option>)}
              </Select>
            </Field>
            <Field label={t('category.color')}>
              <div className="flex flex-wrap gap-2 pt-1">
                {COLORS.map((col) => (
                  <button key={col} type="button" onClick={() => setForm({ ...form, color: col })}
                    className={cn('h-8 w-8 rounded-full transition hover:scale-110', form.color === col && 'ring-4 ring-offset-2')} style={{ background: col, '--tw-ring-color': `${col}55` }} />
                ))}
              </div>
            </Field>
            <div className="flex items-end pb-2"><Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label={t('common.active')} /></div>
          </div>
        )}
        {tab === 'checklist' && <ChecklistEditor value={form.checklist || []} onChange={(v) => setForm({ ...form, checklist: v })} />}
        {tab === 'types' && editing?.id && <TypesEditor category={editing} onChange={reload} />}
      </Modal>

      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={deleting}
        title={t('common.delete')}
        text={del && Number(del.asset_count) > 0 ? t('category.delete_in_use', { n: del.asset_count }) : t('common.delete_confirm', { name: del?.name || '' })}
        confirmText={t('common.delete')} />
    </div>
  );
}
