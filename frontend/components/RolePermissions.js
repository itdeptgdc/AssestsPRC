'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth, useI18n } from './providers';
import { NAV } from './nav';
import { Badge, Button, Segmented, Skeleton, cn } from './ui';

export const ACTIONS = ['view', 'add', 'edit', 'delete'];
const EDITABLE_ROLES = ['manager', 'staff', 'viewer'];
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Square checkbox; `na` = action not applicable to this module */
function Box({ checked, onChange, disabled, label }) {
  return (
    <button type="button" role="checkbox" aria-checked={!!checked} aria-label={label} title={label} disabled={disabled} onClick={onChange}
      className={cn('mx-auto flex h-6 w-6 items-center justify-center rounded-md border-2 transition-all',
        checked ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-slate-300 bg-white hover:border-brand-400',
        disabled && 'cursor-not-allowed opacity-60 hover:border-slate-300')}>
      {checked && <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }}><Check className="h-4 w-4" strokeWidth={3} /></motion.span>}
    </button>
  );
}

/**
 * Role × tab × action matrix (admin only).
 * Toggling add / edit / delete switches View on; switching View off clears the rest.
 */
export default function RolePermissions({ data, onSaved }) {
  const { t, te } = useI18n();
  const { refresh } = useAuth();
  const [role, setRole] = useState('manager');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setDraft(clone(data.permissions)); }, [data]);

  const modules = data?.modules || {};
  const dirty = useMemo(() => !!draft && !!data && JSON.stringify(draft) !== JSON.stringify(data.permissions), [draft, data]);
  const locked = role === 'admin';

  if (!data || !draft) return <div className="card space-y-3 p-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10" />)}</div>;

  const p = draft[role];
  const update = (fn) => setDraft((d) => { const n = clone(d); fn(n[role]); return n; });

  const setCell = (rp, m, a, v) => {
    if (!modules[m]?.includes(a)) return;
    rp[m][a] = v;
    if (a === 'view' && !v) for (const x of modules[m]) rp[m][x] = false;
    if (a !== 'view' && v && modules[m].includes('view')) rp[m].view = true;
  };
  const toggle = (m, a) => update((rp) => setCell(rp, m, a, !rp[m][a]));
  const rowAll = (m) => modules[m].every((a) => p[m][a]);
  const toggleRow = (m) => { const v = !rowAll(m); update((rp) => modules[m].forEach((a) => setCell(rp, m, a, v))); };
  const colKeys = (a) => Object.keys(modules).filter((m) => modules[m].includes(a));
  const colAll = (a) => colKeys(a).every((m) => p[m][a]);
  const toggleCol = (a) => { const v = !colAll(a); update((rp) => colKeys(a).forEach((m) => setCell(rp, m, a, v))); };

  const resetRole = () => setDraft((d) => ({ ...clone(d), [role]: clone(data.defaults[role]) }));

  const save = async () => {
    setSaving(true);
    try {
      const r = await api('/roles', { method: 'PUT', body: { permissions: draft } });
      toast.success(t('perm.saved'));
      onSaved?.(r);
      refresh();
    } catch (e) {
      toast.error(te(e));
    } finally {
      setSaving(false);
    }
  };

  const countOn = (r) => Object.entries(modules).reduce((n, [m, acts]) => n + acts.filter((a) => draft[r][m]?.[a]).length, 0);
  const total = Object.values(modules).reduce((n, acts) => n + acts.length, 0);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="mr-auto">
          <p className="font-semibold text-slate-800">{t('perm.title')}</p>
          <p className="text-xs text-slate-500">{t('perm.subtitle')}</p>
        </div>
        <Segmented id="perm-role" value={role} onChange={setRole}
          options={['admin', ...EDITABLE_ROLES].map((r) => ({ value: r, label: `${t(`roles.${r}`)} · ${countOn(r)}/${total}` }))} />
      </div>

      {locked && (
        <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 p-3 text-sm text-violet-700">
          <Lock className="h-4 w-4 shrink-0" />{t('perm.admin_full')}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('perm.module')}</th>
                {ACTIONS.map((a) => (
                  <th key={a} className="w-20 text-center">
                    <button type="button" disabled={locked} onClick={() => toggleCol(a)} title={t('perm.toggle_column')}
                      className={cn('rounded-md px-2 py-0.5 transition', !locked && 'hover:bg-brand-50 hover:text-brand-700')}>
                      {t(`perm.${a}`)}
                    </button>
                  </th>
                ))}
                <th className="w-20 text-center">{t('perm.all')}</th>
              </tr>
            </thead>
            <tbody>
              {NAV.map((group, gi) => {
                const items = group.items.filter((it) => modules[it.key]);
                if (!items.length) return null;
                return [
                  group.section && (
                    <tr key={`s${gi}`} className="bg-slate-50/70">
                      <td colSpan={6} className="!py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t(`nav.section.${group.section}`)}</td>
                    </tr>
                  ),
                  ...items.map((it) => (
                    <tr key={it.key}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><it.icon className="h-4 w-4" /></span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">{t(`nav.${it.key}`)}</p>
                            {it.key === 'settings' && <p className="text-xs text-slate-400">{t('perm.settings_hint')}</p>}
                          </div>
                        </div>
                      </td>
                      {ACTIONS.map((a) => (
                        <td key={a} className="text-center">
                          {modules[it.key].includes(a)
                            ? <Box checked={p[it.key][a]} disabled={locked} onChange={() => toggle(it.key, a)} label={`${t(`nav.${it.key}`)} · ${t(`perm.${a}`)}`} />
                            : <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                      <td className="text-center">
                        <Box checked={rowAll(it.key)} disabled={locked} onChange={() => toggleRow(it.key)} label={`${t(`nav.${it.key}`)} · ${t('perm.all')}`} />
                      </td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
        <p className="mr-auto flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-brand-500" />
          {dirty ? <Badge tone="amber" dot>{t('perm.unsaved')}</Badge> : t('perm.live_hint')}
        </p>
        {!locked && <Button variant="secondary" icon={RotateCcw} onClick={resetRole}>{t('perm.reset_defaults')}</Button>}
        {dirty && <Button variant="ghost" onClick={() => setDraft(clone(data.permissions))}>{t('common.cancel')}</Button>}
        <Button icon={Save} loading={saving} disabled={!dirty} onClick={save}>{t('common.save')}</Button>
      </div>
    </div>
  );
}

/** Compact read-out of what a role can do (shown in the Add / Edit user dialog) */
export function RoleSummary({ perms, modules }) {
  const { t } = useI18n();
  if (!perms || !modules) return null;
  const visible = Object.keys(modules).filter((m) => perms[m]?.view || (m === 'settings' && perms[m]?.edit));
  if (!visible.length) return <p className="text-xs text-slate-400">{t('perm.none')}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((m) => {
        const extra = ['add', 'edit', 'delete'].filter((a) => perms[m]?.[a]).map((a) => t(`perm.${a}`)).join(' · ');
        return (
          <span key={m} className="rounded-lg bg-white px-2 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200">
            {t(`nav.${m}`)}{extra && <span className="text-brand-600"> · {extra}</span>}
          </span>
        );
      })}
    </div>
  );
}
