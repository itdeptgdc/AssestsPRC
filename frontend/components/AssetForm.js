'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Hash, Info, MapPin, PenLine, QrCode, Save, ShoppingCart, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { catLabel, currentYear, deptLabel, yearCode, yearOptions } from '@/lib/format';
import { useI18n } from './providers';
import { Button, Field, Input, PageLoader, Select, Textarea, Toggle, cn } from './ui';
import ImageUploader from './ImageUploader';

const STATUSES = ['active', 'repair', 'broken', 'spare', 'lost', 'disposed'];
const CYCLES = [1, 3, 6, 12, 24];

const EMPTY = {
  company_id: '', department_id: '', category_id: '', type_id: '', year_code: String(currentYear()).slice(2), // default: current year (Cambodia time)
  name: '', brand: '', model: '', serial_number: '',
  purchase_date: '', cost: '', vendor: '', po_number: '', warranty_expiry: '',
  location_id: '', custodian_id: '', status: 'active', inspection_months: 6, next_inspection: '',
  images: [], notes: '',
};

function Section({ icon: Icon, title, children, i }) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="card card-pad">
      <h3 className="mb-5 flex items-center gap-2.5 text-[15px] font-semibold text-slate-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon className="h-4 w-4" /></span>
        {title}
      </h3>
      {children}
    </motion.section>
  );
}

export default function AssetForm({ asset }) {
  const { t, te } = useI18n();
  const router = useRouter();
  const editing = !!asset;
  const { data: lk, loading } = useApi('/lookups');
  const [form, setForm] = useState(EMPTY);
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [regenerate, setRegenerate] = useState(false);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (asset) {
      const f = { ...EMPTY };
      for (const k of Object.keys(EMPTY)) f[k] = asset[k] ?? EMPTY[k];
      setForm(f);
      setManualCode(asset.code);
    }
  }, [asset]);

  // defaults once lookups arrive (new asset)
  useEffect(() => {
    if (!lk || editing) return;
    setForm((f) => ({ ...f, company_id: f.company_id || lk.companies[0]?.id || '' }));
  }, [lk, editing]);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const on = (k) => (e) => set(k, e.target.value);

  const types = useMemo(() => (lk?.types || []).filter((x) => String(x.category_id) === String(form.category_id)), [lk, form.category_id]);
  const category = lk?.categories.find((c) => String(c.id) === String(form.category_id));
  const company = lk?.companies.find((c) => String(c.id) === String(form.company_id));
  const dept = lk?.departments.find((c) => String(c.id) === String(form.department_id));
  const type = types.find((c) => String(c.id) === String(form.type_id));

  // category change → reset type, adopt its inspection cycle
  const changeCategory = (id) => {
    const c = lk?.categories.find((x) => String(x.id) === String(id));
    setForm((f) => ({ ...f, category_id: id, type_id: '', inspection_months: c?.inspection_months || f.inspection_months }));
    setErrors((e) => ({ ...e, category_id: undefined }));
  };

  // purchase date → year code (00 when before 2000 = fully depreciated / unknown)
  const changePurchaseDate = (v) => {
    set('purchase_date', v);
    if (v && !editing) {
      setForm((f) => ({ ...f, purchase_date: v, year_code: yearCode(Number(v.slice(0, 4))) }));
    }
  };

  // Live code preview from the API (next run number)
  const parts = { company_id: form.company_id, department_id: form.department_id, category_id: form.category_id, type_id: form.type_id, year_code: form.year_code };
  const dParts = useDebounce(JSON.stringify(parts), 250);
  useEffect(() => {
    if (manual || (editing && !regenerate)) return;
    const p = JSON.parse(dParts);
    if (!p.company_id || !p.department_id || !p.category_id) { setPreview(null); return; }
    api('/assets/next-code', { params: p }).then(setPreview).catch(() => setPreview(null));
  }, [dParts, manual, editing, regenerate]);

  const codeChips = [
    { k: 'company', v: company?.code, label: t('code.company') },
    { k: 'dept', v: dept ? dept.dept_no || '000' : null, label: t('code.department') },
    { k: 'account', v: category ? category.account_code || '170' : null, label: t('code.account') },
    { k: 'type', v: type?.number || (form.category_id ? '00' : null), label: t('code.type') },
    { k: 'year', v: form.year_code, label: t('code.year') },
    { k: 'run', v: preview?.run ? String(preview.run).padStart(4, '0') : null, label: t('code.run') },
  ];

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = t('form.required');
    if (!form.category_id) e.category_id = t('form.required');
    if (!manual && (!editing || regenerate)) {
      if (!form.company_id) e.company_id = t('form.required');
      if (!form.department_id) e.department_id = t('form.required');
    }
    if (manual && !manualCode.trim()) e.code = t('form.required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) { toast.error(t('form.check_fields')); return; }
    setSaving(true);
    try {
      const body = { ...form };
      if (manual) Object.assign(body, { code_mode: 'manual', code: manualCode.trim() });
      if (editing && regenerate && !manual) body.regenerate_code = true;
      const saved = editing
        ? await api(`/assets/${asset.id}`, { method: 'PUT', body })
        : await api('/assets', { method: 'POST', body });
      toast.success(editing ? t('common.saved') : t('form.created', { code: saved.code }));
      router.push(`/assets/${saved.id}`);
    } catch (e) {
      toast.error(te(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !lk) return <PageLoader />;

  return (
    <form onSubmit={submit} className="space-y-5 pb-24">
      {/* Asset code builder */}
      <Section icon={Hash} title={t('form.section_code')} i={0}>
        <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#141a33] via-[#1e1b4b] to-[#312e81] p-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-brand-200"><Sparkles className="h-3.5 w-3.5" />{t('form.code_preview')}</p>
            <Toggle checked={manual} onChange={setManual} label={<span className="text-xs text-brand-100">{t('form.manual_code')}</span>} />
          </div>
          <AnimatePresence mode="wait">
            {manual ? (
              <motion.div key="m" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3">
                <input value={manualCode} onChange={(e) => setManualCode(e.target.value.toUpperCase())} placeholder="P401-602-01-23-0001"
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-mono text-xl font-bold tracking-wider text-white outline-none placeholder:text-white/30 focus:border-brand-300" />
                {errors.code && <p className="mt-1 text-xs text-rose-300">{errors.code}</p>}
              </motion.div>
            ) : (
              <motion.div key="a" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p className="mt-3 break-all font-mono text-2xl font-bold tracking-wider sm:text-3xl">
                  {editing && !regenerate ? asset.code : preview?.code || <span className="text-white/30">P___-___-__-__-____</span>}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {codeChips.map((c, i) => (
                    <motion.div key={c.k} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                      className={cn('rounded-xl border px-3 py-1.5 text-center', c.v ? 'border-white/20 bg-white/10' : 'border-dashed border-white/20')}>
                      <p className="font-mono text-sm font-bold">{c.v || '—'}</p>
                      <p className="text-[10px] text-brand-200">{c.label}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {editing && !manual && (
            <div className="mt-4 border-t border-white/10 pt-3">
              <Toggle checked={regenerate} onChange={setRegenerate} label={<span className="text-xs text-brand-100">{t('form.regenerate_code')}</span>} />
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('code.company')} required={!manual} error={errors.company_id}>
            <Select value={form.company_id} onChange={on('company_id')} placeholder={t('form.select')}>
              {lk.companies.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
            </Select>
          </Field>
          <Field label={t('code.department')} required={!manual} error={errors.department_id}>
            <Select value={form.department_id} onChange={on('department_id')} placeholder={t('form.select')}>
              {lk.departments.map((d) => <option key={d.id} value={d.id}>{deptLabel(d)}</option>)}
            </Select>
          </Field>
          <Field label={t('code.account')} required error={errors.category_id}>
            <Select value={form.category_id} onChange={(e) => changeCategory(e.target.value)} placeholder={t('form.select')}>
              {lk.categories.map((c) => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
            </Select>
          </Field>
          <Field label={t('code.type')} hint={form.category_id && types.length === 0 ? t('form.no_types') : undefined}>
            <Select value={form.type_id} onChange={on('type_id')} placeholder={types.length ? t('form.select') : '00'} disabled={!types.length}>
              {types.map((x) => <option key={x.id} value={x.id}>{x.number} - {x.name}</option>)}
            </Select>
          </Field>
          <Field label={t('code.year')} hint={t('form.year_hint')}>
            <Select value={form.year_code} onChange={on('year_code')}>
              <option value="00">00 - {t('form.year_unknown')}</option>
              {yearOptions().map((y) => <option key={y.year} value={y.value}>{y.value} - {y.year}</option>)}
            </Select>
          </Field>
        </div>
      </Section>

      {/* General */}
      <Section icon={Info} title={t('form.section_general')} i={1}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('assets.name')} required error={errors.name} className="sm:col-span-2 lg:col-span-1">
            <Input value={form.name} onChange={on('name')} placeholder={t('form.name_ph')} />
          </Field>
          <Field label={t('assets.brand')}><Input value={form.brand || ''} onChange={on('brand')} placeholder={t('form.brand_ph')} /></Field>
          <Field label={t('assets.model')}><Input value={form.model || ''} onChange={on('model')} placeholder={t('form.model_ph')} /></Field>
          <Field label={t('assets.serial')}><Input value={form.serial_number || ''} onChange={on('serial_number')} placeholder="S/N" /></Field>
        </div>
      </Section>

      {/* Purchase */}
      <Section icon={ShoppingCart} title={t('form.section_purchase')} i={2}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('assets.purchase_date')}><Input type="date" value={form.purchase_date || ''} onChange={(e) => changePurchaseDate(e.target.value)} /></Field>
          <Field label={t('assets.cost')}><Input type="number" min="0" step="0.01" value={form.cost} onChange={on('cost')} placeholder="0.00" /></Field>
          <Field label={t('assets.vendor')}><Input value={form.vendor || ''} onChange={on('vendor')} placeholder={t('form.vendor_ph')} /></Field>
          <Field label={t('assets.po_number')}><Input value={form.po_number || ''} onChange={on('po_number')} placeholder="PO-2025-xxxx" /></Field>
          <Field label={t('assets.warranty')}><Input type="date" value={form.warranty_expiry || ''} onChange={on('warranty_expiry')} /></Field>
        </div>
      </Section>

      {/* Placement */}
      <Section icon={MapPin} title={t('form.section_placement')} i={3}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('assets.location')}>
            <Select value={form.location_id || ''} onChange={on('location_id')} placeholder={t('form.select')}>
              {lk.locations.map((l) => <option key={l.id} value={l.id}>{[l.building, l.floor, l.name].filter(Boolean).join(' · ')}</option>)}
            </Select>
          </Field>
          <Field label={t('assets.custodian')}>
            <Select value={form.custodian_id || ''} onChange={on('custodian_id')} placeholder={t('form.select')}>
              {lk.custodians.map((c) => <option key={c.id} value={c.id}>{c.name}{c.employee_code ? ` (${c.employee_code})` : ''}</option>)}
            </Select>
          </Field>
          <Field label={t('common.status')} required>
            <Select value={form.status} onChange={on('status')}>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('assets.inspection_cycle')}>
            <Select value={form.inspection_months} onChange={on('inspection_months')}>
              {[...new Set([...CYCLES, Number(form.inspection_months)])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{t('form.every_months', { n: m })}</option>)}
            </Select>
          </Field>
          <Field label={t('assets.next_inspection')} hint={!form.next_inspection ? t('form.next_auto') : undefined}>
            <Input type="date" value={form.next_inspection || ''} onChange={on('next_inspection')} />
          </Field>
        </div>
      </Section>

      {/* Extra */}
      <Section icon={PenLine} title={t('form.section_extra')} i={4}>
        <div className="space-y-4">
          <Field label={t('common.photos')}><ImageUploader value={form.images || []} onChange={(v) => set('images', v)} /></Field>
          <Field label={t('common.notes')}><Textarea value={form.notes || ''} onChange={on('notes')} placeholder={t('form.notes_ph')} /></Field>
        </div>
      </Section>

      {/* Sticky actions */}
      <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-30 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-lg transition-[left] duration-300 lg:bottom-0 lg:left-[var(--sb)]">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
          <p className="hidden items-center gap-2 text-sm text-slate-500 sm:flex"><Building2 className="h-4 w-4" />{company?.name || ''}</p>
          <div className="flex flex-1 justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving} icon={editing ? Save : QrCode}>{editing ? t('common.save') : t('form.save_generate')}</Button>
          </div>
        </div>
      </div>
    </form>
  );
}
