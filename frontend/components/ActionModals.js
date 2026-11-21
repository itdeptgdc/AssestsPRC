'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { today } from '@/lib/format';
import { useI18n } from './providers';
import { Button, Field, Input, Modal, Select, Textarea, Toggle, cn } from './ui';
import ImageUploader from './ImageUploader';
import AssetPicker from './AssetPicker';

/* ---------------- Record inspection ---------------- */
export function InspectionModal({ open, onClose, asset: initialAsset, onSaved }) {
  const { t, te } = useI18n();
  const [asset, setAsset] = useState(initialAsset || null);
  const [checks, setChecks] = useState([]);
  const [result, setResult] = useState('pass');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(today());
  const [images, setImages] = useState([]);
  const [createRepair, setCreateRepair] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAsset(initialAsset || null);
    setResult('pass'); setNotes(''); setDate(today()); setImages([]); setCreateRepair(false);
  }, [open, initialAsset]);

  // Load checklist from the asset's category
  useEffect(() => {
    if (!asset) { setChecks([]); return; }
    const fromAsset = asset.category_checklist;
    if (Array.isArray(fromAsset)) {
      setChecks(fromAsset.map((item) => ({ item, ok: true })));
    } else {
      api(`/assets/${asset.id}`).then((a) => setChecks((a.category_checklist || []).map((item) => ({ item, ok: true })))).catch(() => {});
    }
  }, [asset]);

  // Auto-suggest result from checklist
  useEffect(() => {
    if (!checks.length) return;
    const failed = checks.filter((c) => !c.ok).length;
    setResult(failed === 0 ? 'pass' : failed >= Math.ceil(checks.length / 2) ? 'fail' : 'issue');
  }, [checks]);

  const save = async () => {
    if (!asset) return toast.error(t('picker.required'));
    setSaving(true);
    try {
      await api('/inspections', {
        method: 'POST',
        body: { asset_id: asset.id, result, checklist: checks, notes, inspected_at: date, images, create_repair: createRepair },
      });
      toast.success(t('inspection.saved'));
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(te(e));
    } finally {
      setSaving(false);
    }
  };

  const RESULTS = [
    { v: 'pass', icon: CheckCircle2, cls: 'peer-checked:border-emerald-400 peer-checked:bg-emerald-50 peer-checked:text-emerald-700' },
    { v: 'issue', icon: AlertTriangle, cls: 'peer-checked:border-amber-400 peer-checked:bg-amber-50 peer-checked:text-amber-700' },
    { v: 'fail', icon: XCircle, cls: 'peer-checked:border-rose-400 peer-checked:bg-rose-50 peer-checked:text-rose-700' },
  ];

  return (
    <Modal open={open} onClose={onClose} title={t('inspection.new')} subtitle={asset ? `${asset.code} · ${asset.name}` : t('inspection.new_sub')} size="lg"
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={save} loading={saving} icon={Check}>{t('inspection.save')}</Button>
      </>}>
      <div className="space-y-5">
        {!initialAsset && <Field label={t('common.asset')} required><AssetPicker value={asset} onChange={setAsset} /></Field>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('inspection.date')}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>

        {checks.length > 0 && (
          <div>
            <p className="label">{t('inspection.checklist')}</p>
            <div className="space-y-2">
              {checks.map((c, i) => (
                <motion.button type="button" key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  onClick={() => setChecks(checks.map((x, j) => (j === i ? { ...x, ok: !x.ok } : x)))}
                  className={cn('flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition',
                    c.ok ? 'border-emerald-200 bg-emerald-50/50 text-slate-700' : 'border-rose-200 bg-rose-50/60 text-rose-700')}>
                  <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition', c.ok ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white')}>
                    {c.ok ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </span>
                  <span className="flex-1">{c.item}</span>
                  <span className="text-xs font-semibold">{c.ok ? t('inspection.ok') : t('inspection.not_ok')}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="label">{t('inspection.result')}</p>
          <div className="grid grid-cols-3 gap-2">
            {RESULTS.map((r) => (
              <label key={r.v} className="cursor-pointer">
                <input type="radio" className="peer sr-only" checked={result === r.v} onChange={() => setResult(r.v)} />
                <div className={cn('flex flex-col items-center gap-1.5 rounded-xl border-2 border-slate-200 px-2 py-3 text-sm font-semibold text-slate-500 transition hover:border-slate-300', r.cls)}>
                  <r.icon className="h-5 w-5" />
                  {t(`result.${r.v}`)}
                </div>
              </label>
            ))}
          </div>
        </div>

        <Field label={t('common.notes')}><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('inspection.notes_ph')} /></Field>
        <Field label={t('common.photos')}><ImageUploader value={images} onChange={setImages} max={6} /></Field>
        {result !== 'pass' && <Toggle checked={createRepair} onChange={setCreateRepair} label={t('inspection.create_repair')} />}
      </div>
    </Modal>
  );
}

/* ---------------- Report repair ---------------- */
export function RepairModal({ open, onClose, asset: initialAsset, onSaved }) {
  const { t, te } = useI18n();
  const [asset, setAsset] = useState(initialAsset || null);
  const [form, setForm] = useState({ problem: '', priority: 'normal', technician: '', reported_at: today() });
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAsset(initialAsset || null);
    setForm({ problem: '', priority: 'normal', technician: '', reported_at: today() });
    setImages([]);
  }, [open, initialAsset]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (!asset) return toast.error(t('picker.required'));
    if (!form.problem.trim()) return toast.error(t('repair.problem_required'));
    setSaving(true);
    try {
      await api('/repairs', { method: 'POST', body: { ...form, asset_id: asset.id, images } });
      toast.success(t('repair.saved'));
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(te(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('repair.new')} subtitle={asset ? `${asset.code} · ${asset.name}` : t('repair.new_sub')}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={save} loading={saving}>{t('repair.submit')}</Button>
      </>}>
      <div className="space-y-4">
        {!initialAsset && <Field label={t('common.asset')} required><AssetPicker value={asset} onChange={setAsset} /></Field>}
        <Field label={t('repair.problem')} required><Textarea value={form.problem} onChange={set('problem')} placeholder={t('repair.problem_ph')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('repair.priority')}>
            <Select value={form.priority} onChange={set('priority')}>
              {['low', 'normal', 'high', 'urgent'].map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('repair.reported_at')}><Input type="date" value={form.reported_at} onChange={set('reported_at')} /></Field>
        </div>
        <Field label={t('repair.technician')}><Input value={form.technician} onChange={set('technician')} placeholder={t('repair.technician_ph')} /></Field>
        <Field label={t('common.photos')}><ImageUploader value={images} onChange={setImages} max={6} /></Field>
      </div>
    </Modal>
  );
}

/* ---------------- Update repair ---------------- */
export function RepairUpdateModal({ open, onClose, repair, onSaved }) {
  const { t, te } = useI18n();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (repair) setForm({
      status: repair.status, priority: repair.priority, technician: repair.technician || '',
      cost: repair.cost || 0, resolution: repair.resolution || '',
    });
  }, [repair]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setSaving(true);
    try {
      await api(`/repairs/${repair.id}`, { method: 'PUT', body: form });
      toast.success(t('common.saved'));
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(te(e));
    } finally {
      setSaving(false);
    }
  };

  if (!repair) return null;
  const STEPS = ['open', 'in_progress', 'waiting_parts', 'done'];
  const idx = STEPS.indexOf(form.status);

  return (
    <Modal open={open} onClose={onClose} title={`${t('repair.update')} · ${repair.ticket_no}`} subtitle={`${repair.asset_code} · ${repair.asset_name}`}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={save} loading={saving}>{t('common.save')}</Button>
      </>}>
      <div className="space-y-5">
        <div className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          <span className="font-semibold text-slate-700">{t('repair.problem')}:</span> {repair.problem}
        </div>

        {/* status stepper */}
        <div className="grid grid-cols-4 gap-1.5">
          {STEPS.map((s, i) => (
            <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
              className="group flex flex-col items-center gap-1.5">
              <span className={cn('h-1.5 w-full rounded-full transition-colors', i <= idx ? (form.status === 'done' ? 'bg-emerald-500' : 'bg-brand-500') : 'bg-slate-200')} />
              <span className={cn('text-center text-[11px] font-medium leading-tight sm:text-xs', form.status === s ? 'text-brand-700' : 'text-slate-400 group-hover:text-slate-600')}>
                {t(`repairStatus.${s}`)}
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('common.status')}>
            <Select value={form.status} onChange={set('status')}>
              {['open', 'in_progress', 'waiting_parts', 'done', 'cancelled'].map((s) => <option key={s} value={s}>{t(`repairStatus.${s}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('repair.priority')}>
            <Select value={form.priority} onChange={set('priority')}>
              {['low', 'normal', 'high', 'urgent'].map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('repair.technician')}><Input value={form.technician} onChange={set('technician')} /></Field>
          <Field label={t('repair.cost')}><Input type="number" min="0" step="0.01" value={form.cost} onChange={set('cost')} /></Field>
        </div>
        <Field label={t('repair.resolution')}><Textarea value={form.resolution} onChange={set('resolution')} placeholder={t('repair.resolution_ph')} /></Field>
      </div>
    </Modal>
  );
}
