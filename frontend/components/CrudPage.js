'use client';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth, useI18n } from './providers';
import { Badge, Button, ConfirmModal, EmptyState, Field, IconButton, Input, Modal, PageHeader, SearchInput, Select, Skeleton, Textarea, Toggle } from './ui';

/**
 * Generic master-data page.
 * fields: [{ key, label, type: 'text'|'textarea'|'select'|'number'|'toggle', required, options, span, list, render, mono }]
 */
export default function CrudPage({ endpoint, title, subtitle, icon, fields, defaults = {}, canWrite = 'manage' }) {
  const { t, te } = useI18n();
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const { data, loading, reload } = useApi(endpoint, { q: dq });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const writable = can(canWrite);
  const listFields = useMemo(() => fields.filter((f) => f.list !== false), [fields]);

  const open = (row) => {
    setEditing(row || {});
    const f = { active: true, ...defaults };
    for (const fd of fields) f[fd.key] = row?.[fd.key] ?? f[fd.key] ?? '';
    setForm(f);
  };

  const save = async () => {
    for (const f of fields) {
      if (f.required && !String(form[f.key] ?? '').trim()) return toast.error(`${f.label}: ${t('form.required')}`);
    }
    setSaving(true);
    try {
      if (editing?.id) await api(`${endpoint}/${editing.id}`, { method: 'PUT', body: form });
      else await api(endpoint, { method: 'POST', body: form });
      toast.success(t('common.saved'));
      setEditing(null);
      reload();
    } catch (e) {
      toast.error(te(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api(`${endpoint}/${del.id}`, { method: 'DELETE' });
      toast.success(t('common.deleted'));
      setDel(null);
      reload();
    } catch (e) {
      toast.error(te(e));
    } finally {
      setDeleting(false);
    }
  };

  const renderCell = (f, row) => {
    if (f.render) return f.render(row);
    if (f.type === 'toggle') return row[f.key] ? <Badge tone="green" dot>{t('common.active')}</Badge> : <Badge tone="gray" dot>{t('common.inactive')}</Badge>;
    if (f.type === 'select') return f.options?.find((o) => String(o.value) === String(row[f.key]))?.label || '-';
    return <span className={f.mono ? 'font-mono text-[13px] font-semibold text-brand-600' : ''}>{row[f.key] || '-'}</span>;
  };

  const rows = data || [];
  const Icon = icon;

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle || t('common.n_items', { n: rows.length })}
        actions={writable && <Button icon={Plus} onClick={() => open(null)}>{t('common.add')}</Button>} />

      <div className="card mb-4 p-3"><SearchInput value={q} onChange={setQ} placeholder={t('common.search_ph')} /></div>

      <div className="card overflow-hidden">
        {loading && !data ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}</div> :
          rows.length === 0 ? <EmptyState icon={Icon} title={t('common.no_data')} action={writable && <Button icon={Plus} onClick={() => open(null)}>{t('common.add')}</Button>} /> : (
            <>
              <div className="table-wrap hidden md:block">
                <table className="tbl">
                  <thead>
                    <tr>
                      {listFields.map((f) => <th key={f.key}>{f.label}</th>)}
                      <th className="text-right">{t('nav.assets')}</th>
                      {writable && <th className="text-right">{t('common.actions')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 20) * 0.015 }}>
                        {listFields.map((f) => <td key={f.key} className="text-slate-700">{renderCell(f, row)}</td>)}
                        <td className="text-right"><Badge tone={row.asset_count > 0 ? 'brand' : 'slate'}>{row.asset_count ?? 0}</Badge></td>
                        {writable && (
                          <td>
                            <div className="flex justify-end gap-1.5">
                              <IconButton icon={Pencil} title={t('common.edit')} onClick={() => open(row)} />
                              <IconButton icon={Trash2} tone="red" title={t('common.delete')} onClick={() => setDel(row)} />
                            </div>
                          </td>
                        )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-slate-100 md:hidden">
                {rows.map((row) => (
                  <div key={row.id} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      {listFields.slice(0, 3).map((f, i) => (
                        <div key={f.key} className={i === 0 ? 'text-sm font-semibold' : 'truncate text-xs text-slate-500'}>{renderCell(f, row)}</div>
                      ))}
                    </div>
                    <Badge tone="brand">{row.asset_count ?? 0}</Badge>
                    {writable && <IconButton icon={Pencil} onClick={() => open(row)} />}
                  </div>
                ))}
              </div>
            </>
          )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('common.edit') : t('common.add')} subtitle={title}
        footer={<>
          {editing?.id && <Button variant="ghost" className="mr-auto text-rose-600 hover:bg-rose-50" icon={Trash2} onClick={() => { setDel(editing); setEditing(null); }}>{t('common.delete')}</Button>}
          <Button variant="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
          <Button onClick={save} loading={saving}>{t('common.save')}</Button>
        </>}>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <Field key={f.key} label={f.type === 'toggle' ? undefined : f.label} required={f.required} className={f.span === 2 || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              {f.type === 'textarea' ? (
                <Textarea value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              ) : f.type === 'select' ? (
                <Select value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={t('form.select')}>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : f.type === 'toggle' ? (
                <Toggle checked={!!form[f.key]} onChange={(v) => setForm({ ...form, [f.key]: v })} label={f.label} />
              ) : (
                <Input type={f.type || 'text'} value={form[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              )}
            </Field>
          ))}
        </div>
      </Modal>

      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={deleting}
        title={t('common.delete')} text={t('common.delete_confirm', { name: del?.name || del?.code || '' })} confirmText={t('common.delete')} />
    </div>
  );
}
