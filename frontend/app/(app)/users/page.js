'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, KeyRound, LockKeyhole, LogOut, Plus, Settings2, ShieldAlert, ShieldCheck, Trash2, UserCog, Users, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { deptLabel, fmtDateTime } from '@/lib/format';
import { useAuth, useI18n } from '@/components/providers';
import {
  Badge, Button, ConfirmModal, CountUp, EmptyState, Field, IconButton, Input, Modal, PageHeader, PasswordInput, SearchInput, Select, Skeleton, Tabs, Toggle, cn,
} from '@/components/ui';
import RolePermissions, { RoleSummary } from '@/components/RolePermissions';

const ROLES = ['admin', 'manager', 'staff', 'viewer'];
const ROLE_TONE = { admin: 'violet', manager: 'brand', staff: 'blue', viewer: 'slate' };

export default function UsersPage() {
  const { t, te, lang } = useI18n();
  const { user: me, can } = useAuth();
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const isAdmin = can('admin');
  const { data, loading, reload, setData } = useApi('/users', { q: dq }, { enabled: can('users.view') });
  const { data: lk } = useApi('/lookups', null, { enabled: can('users.view') });
  // permission matrix: only admins may read / change it
  const { data: rolesData, setData: setRolesData } = useApi('/roles', null, { enabled: isAdmin });
  const [tab, setTab] = useState('users');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [reset, setReset] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [kick, setKick] = useState(null);
  const [del, setDel] = useState(null);

  if (!can('users.view')) return <EmptyState icon={ShieldAlert} title={t('errors.forbidden')} />;

  // non-admins never see / assign the admin role and cannot change admin accounts
  const roleOptions = isAdmin ? ROLES : ROLES.filter((r) => r !== 'admin');
  const canManage = (u) => can('users.edit') && (isAdmin || u.role !== 'admin');

  const rows = data || [];
  const stats = [
    { k: 'total', v: rows.length, icon: Users, cls: 'bg-brand-50 text-brand-600' },
    { k: 'admins', v: rows.filter((u) => u.role === 'admin').length, icon: ShieldCheck, cls: 'bg-violet-50 text-violet-600' },
    { k: 'inspectors', v: rows.filter((u) => u.role === 'staff' || u.role === 'manager').length, icon: ClipboardCheck, cls: 'bg-cyan-50 text-cyan-600' },
    { k: 'inactive', v: rows.filter((u) => !u.active).length, icon: UserX, cls: 'bg-slate-100 text-slate-500' },
  ];

  const open = (u) => {
    setEditing(u || {});
    setForm({
      name: u?.name || '', email: u?.email || '', phone: u?.phone || '', role: u?.role || 'staff',
      department_id: u?.department_id || '', active: u?.active ?? true, password: '',
    });
  };

  const save = async () => {
    if (!form.name || !form.email || (!editing.id && !form.password)) return toast.error(t('form.check_fields'));
    setSaving(true);
    try {
      const body = { ...form };
      if (editing.id) delete body.password;
      if (editing.id) await api(`/users/${editing.id}`, { method: 'PUT', body });
      else await api('/users', { method: 'POST', body });
      toast.success(t('common.saved'));
      setEditing(null);
      reload();
    } catch (e) {
      toast.error(te(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u) => {
    const active = !u.active;
    setData(rows.map((x) => (x.id === u.id ? { ...x, active } : x))); // optimistic
    try {
      await api(`/users/${u.id}`, { method: 'PUT', body: { active } });
      toast.success(active ? t('users.activated') : t('users.deactivated'));
    } catch (e) {
      toast.error(te(e));
      reload();
    }
  };

  const doReset = async () => {
    try {
      await api(`/users/${reset.id}/reset-password`, { method: 'POST', body: { password: newPw } });
      toast.success(t('users.password_reset_done'));
      setReset(null);
    } catch (e) {
      toast.error(te(e));
    }
  };

  const doKick = async () => {
    try {
      await api(`/users/${kick.id}/logout`, { method: 'POST' });
      toast.success(t('users.signed_out_done'));
      setKick(null);
    } catch (e) {
      toast.error(te(e));
    }
  };

  const doDelete = async () => {
    try {
      await api(`/users/${del.id}`, { method: 'DELETE' });
      toast.success(t('common.deleted'));
      setDel(null);
      setEditing(null);
      reload();
    } catch (e) {
      toast.error(te(e));
      setDel(null);
    }
  };

  return (
    <div>
      <PageHeader title={t('users.title')} subtitle={t('users.summary', { n: rows.length, a: rows.filter((u) => u.active).length })}
        actions={tab === 'users' && can('users.add') && <Button icon={Plus} onClick={() => open(null)}>{t('users.add')}</Button>} />

      {isAdmin && (
        <div className="mb-5">
          <Tabs value={tab} onChange={setTab} tabs={[
            { value: 'users', label: t('perm.tab_users'), icon: Users },
            { value: 'roles', label: t('perm.tab_roles'), icon: LockKeyhole },
          ]} />
        </div>
      )}

      {tab === 'roles' && isAdmin ? <RolePermissions data={rolesData} onSaved={setRolesData} /> : <>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }}
            className="card flex items-center gap-4 p-4">
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', s.cls)}><s.icon className="h-5 w-5" /></span>
            <div>
              <p className="text-2xl font-extrabold text-slate-900"><CountUp value={s.v} /></p>
              <p className="text-xs text-slate-500">{t(`users.stat_${s.k}`)}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="card mb-4 p-3"><SearchInput value={q} onChange={setQ} placeholder={t('users.search')} /></div>

      <div className="card overflow-hidden">
        {loading && !data ? <div className="space-y-3 p-5">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div> :
          rows.length === 0 ? <EmptyState icon={UserCog} title={t('common.no_data')} /> : (
            <>
              {/* Desktop */}
              <div className="table-wrap hidden md:block">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>{t('users.user')}</th>
                      <th>{t('users.role')}</th>
                      <th className="hidden lg:table-cell">{t('code.department')}</th>
                      <th className="hidden xl:table-cell">{t('users.last_login')}</th>
                      <th>{t('common.status')}</th>
                      <th className="text-right">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u, i) => {
                      const self = u.id === me.id;
                      return (
                        <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className={cn(!u.active && 'opacity-60')}>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-sm font-bold text-white">
                                {u.name.slice(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 font-medium text-slate-800">{u.name}{self && <Badge tone="green" className="!text-[10px]">{t('users.you')}</Badge>}</p>
                                <p className="truncate text-xs text-slate-400">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td><Badge tone={ROLE_TONE[u.role]}>{t(`roles.${u.role}`)}</Badge></td>
                          <td className="hidden text-slate-600 lg:table-cell">{u.department_name || '-'}</td>
                          <td className="hidden text-xs text-slate-500 xl:table-cell">{u.last_login ? fmtDateTime(u.last_login, lang) : '-'}</td>
                          <td>{self || !canManage(u) ? <Badge tone={u.active ? 'green' : 'slate'} dot>{t(u.active ? 'common.active' : 'common.inactive')}</Badge> : <Toggle checked={u.active} onChange={() => toggleActive(u)} />}</td>
                          <td>
                            <div className="flex justify-end gap-1.5">
                              {canManage(u) && <>
                                <IconButton icon={Settings2} title={t('users.edit')} onClick={() => open(u)} />
                                <IconButton icon={KeyRound} tone="amber" title={t('users.reset_password')} onClick={() => { setReset(u); setNewPw(''); }} />
                                {!self && <IconButton icon={LogOut} tone="red" title={t('users.force_signout')} onClick={() => setKick(u)} />}
                              </>}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="divide-y divide-slate-100 md:hidden">
                {rows.map((u) => {
                  const self = u.id === me.id;
                  return (
                    <div key={u.id} className={cn('p-4', !u.active && 'opacity-60')}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-sm font-bold text-white">{u.name.slice(0, 1).toUpperCase()}</div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-800">{u.name}</p>
                          <p className="truncate text-xs text-slate-400">{u.email}</p>
                        </div>
                        {!self && canManage(u) && <Toggle checked={u.active} onChange={() => toggleActive(u)} />}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone={ROLE_TONE[u.role]}>{t(`roles.${u.role}`)}</Badge>
                          {u.department_name && <Badge>{u.department_name}</Badge>}
                        </div>
                        <div className="flex gap-1.5">
                          {canManage(u) && <>
                            <IconButton icon={Settings2} onClick={() => open(u)} />
                            <IconButton icon={KeyRound} tone="amber" onClick={() => { setReset(u); setNewPw(''); }} />
                            {!self && <IconButton icon={LogOut} tone="red" onClick={() => setKick(u)} />}
                          </>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
      </div>
      <p className="mt-3 text-xs text-slate-400">* {t('users.history_note')}</p>
      </>}

      {/* Add / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('users.edit') : t('users.add')}
        footer={<>
          {editing?.id && editing.id !== me.id && can('users.delete') && (
            <Button variant="ghost" className="mr-auto text-rose-600 hover:bg-rose-50" icon={Trash2} onClick={() => setDel(editing)}>{t('common.delete')}</Button>
          )}
          <Button variant="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
          <Button onClick={save} loading={saving}>{t('common.save')}</Button>
        </>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('master.full_name')} required><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={t('auth.email')} required><Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label={t('users.role')} required>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={editing?.id === me.id}>
              {roleOptions.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('code.department')}>
            <Select value={form.department_id || ''} onChange={(e) => setForm({ ...form, department_id: e.target.value })} placeholder={t('form.select')}>
              {lk?.departments.map((d) => <option key={d.id} value={d.id}>{deptLabel(d)}</option>)}
            </Select>
          </Field>
          <Field label={t('master.phone')}><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          {!editing?.id && (
            <Field label={t('auth.password')} required hint={t('users.min6')}>
              <PasswordInput autoComplete="new-password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
          )}
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 sm:col-span-2">
            <p>{t(`users.role_desc.${form.role}`)}</p>
            {rolesData && form.role !== 'admin' && <RoleSummary perms={rolesData.permissions[form.role]} modules={rolesData.modules} />}
            {isAdmin && form.role !== 'admin' && (
              <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => { setEditing(null); setTab('roles'); }}>
                {t('perm.edit_role_link')}
              </button>
            )}
          </div>
          {editing?.id !== me.id && <Toggle checked={!!form.active} onChange={(v) => setForm({ ...form, active: v })} label={t('common.active')} />}
        </div>
      </Modal>

      {/* Reset password */}
      <Modal open={!!reset} onClose={() => setReset(null)} title={t('users.reset_password')} subtitle={reset ? `${reset.name} · ${reset.email}` : ''} size="sm"
        footer={<><Button variant="secondary" onClick={() => setReset(null)}>{t('common.cancel')}</Button><Button icon={KeyRound} onClick={doReset} disabled={newPw.length < 6}>{t('users.reset_password')}</Button></>}>
        <Field label={t('users.new_password')} hint={t('users.reset_hint')}>
          <PasswordInput autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </Field>
      </Modal>

      <ConfirmModal open={!!kick} onClose={() => setKick(null)} onConfirm={doKick} title={t('users.force_signout')}
        text={t('users.force_signout_text', { name: kick?.name || '' })} confirmText={t('users.force_signout')} />
      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={doDelete} title={t('common.delete')}
        text={del?.has_history ? t('users.history_note') : t('common.delete_confirm', { name: del?.name || '' })} confirmText={t('common.delete')} />
    </div>
  );
}
