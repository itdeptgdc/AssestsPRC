'use client';
import { useEffect, useState } from 'react';
import { Building, Camera, CameraOff, Globe, KeyRound, Monitor, Moon, Palette, Save, ScanBarcode, Smartphone, Sun, User } from 'lucide-react';
import { CAMERA_KEY } from '@/lib/scanner';
import { BellRing, Volume2, VolumeX } from 'lucide-react';
import { useRealtime } from '@/components/Realtime';
import { LogoMark } from '@/components/Logo';
import { InstallButton, useInstall } from '@/components/InstallApp';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { LANGS, useAuth, useI18n, useTheme } from '@/components/providers';
import { Flag } from '@/components/Flags';
import { Button, Card, Field, Input, PageHeader, PasswordInput, Select, Toggle, cn, useLocalState } from '@/components/ui';

export default function SettingsPage() {
  const { t, te, lang, setLang } = useI18n();
  const { user, setUser, can, setSettings } = useAuth();
  const { theme, setTheme } = useTheme();
  const { installed } = useInstall();
  const [cameraOn, setCameraOn] = useLocalState(CAMERA_KEY, true); // per device
  const live = useRealtime();
  const [org, setOrg] = useState(null);
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [busy, setBusy] = useState('');

  useEffect(() => {
    api('/settings').then(setOrg).catch(() => {});
  }, []);

  const saveOrg = async () => {
    setBusy('org');
    try {
      const s = await api('/settings', { method: 'PUT', body: { ...org, due_soon_days: Number(org.due_soon_days) || 30, default_inspection_months: Number(org.default_inspection_months) || 6 } });
      setOrg(s);
      setSettings((p) => ({ ...p, org_name: s.org_name, org_subtitle: s.org_subtitle }));
      toast.success(t('common.saved'));
    } catch (e) { toast.error(te(e)); } finally { setBusy(''); }
  };
  const saveProfile = async () => {
    setBusy('profile');
    try {
      setUser(await api('/auth/me', { method: 'PUT', body: profile }));
      toast.success(t('common.saved'));
    } catch (e) { toast.error(te(e)); } finally { setBusy(''); }
  };
  const savePw = async () => {
    if (pw.new_password !== pw.confirm) return toast.error(t('settings.pw_mismatch'));
    setBusy('pw');
    try {
      await api('/auth/me', { method: 'PUT', body: { current_password: pw.current_password, new_password: pw.new_password } });
      setPw({ current_password: '', new_password: '', confirm: '' });
      toast.success(t('settings.pw_changed'));
    } catch (e) { toast.error(te(e)); } finally { setBusy(''); }
  };

  const Head = ({ icon: Icon, title }) => (
    <h3 className="mb-5 flex items-center gap-2.5 text-[15px] font-semibold text-slate-800">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon className="h-4 w-4" /></span>{title}
    </h3>
  );

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card i={0} className="card-pad">
          <Head icon={Globe} title={t('settings.language')} />
          <div className="grid gap-3 sm:grid-cols-3">
            {LANGS.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)}
                className={cn('flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition hover:-translate-y-0.5', lang === l.code ? 'border-brand-500 bg-brand-50/60 shadow-glow' : 'border-slate-200 hover:border-slate-300')}>
                <Flag code={l.code} className="h-8 w-12" />
                <span className="text-sm font-semibold text-slate-700">{l.label}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card i={1} className="card-pad">
          <Head icon={Palette} title={t('theme.title')} />
          <div className="grid grid-cols-3 gap-3">
            {[
              { v: 'light', icon: Sun, preview: 'keep-light bg-white border-slate-200', bar: 'bg-[#e2e8f0]' },
              { v: 'dark', icon: Moon, preview: 'bg-[#121a2e] border-[#24304a]', bar: 'bg-[#24304a]' },
              { v: 'system', icon: Monitor, preview: 'bg-gradient-to-r from-white from-50% to-[#121a2e] to-50% border-slate-200', bar: 'bg-slate-400/40' },
            ].map((o) => (
              <button key={o.v} onClick={() => setTheme(o.v)}
                className={cn('flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition hover:-translate-y-0.5', theme === o.v ? 'border-brand-500 bg-brand-50/60 shadow-glow' : 'border-slate-200 hover:border-slate-300')}>
                <span className={cn('flex h-12 w-full flex-col justify-center gap-1 rounded-lg border px-2', o.preview)}>
                  <span className={cn('h-1.5 w-2/3 rounded', o.bar)} /><span className={cn('h-1.5 w-1/2 rounded', o.bar)} />
                </span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><o.icon className="h-4 w-4" />{t(`theme.${o.v}`)}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card i={1} className="card-pad">
          <Head icon={Smartphone} title={t('install.title')} />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <LogoMark size={64} className="rounded-2xl" />
            <div className="flex-1">
              <p className="font-semibold text-slate-800">Asset PRC · Poipet Resort &amp; Casino</p>
              <p className="text-sm text-slate-500">{installed ? t('install.already') : t('install.subtitle')}</p>
            </div>
            <InstallButton />
          </div>
        </Card>

        <Card i={1} className="card-pad">
          <Head icon={ScanBarcode} title={t('scan.settings_title')} />
          <div className="flex items-start gap-4 rounded-2xl border border-slate-100 p-4">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', cameraOn ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-400')}>
              {cameraOn ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800">{t('scan.camera_setting')}</p>
              <p className="mt-0.5 text-sm text-slate-500">{cameraOn ? t('scan.camera_on_hint') : t('scan.camera_off_hint')}</p>
            </div>
            <Toggle checked={!!cameraOn} onChange={(v) => { setCameraOn(v); toast.success(v ? t('scan.camera_on') : t('scan.camera_off')); }} />
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-slate-400"><ScanBarcode className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('scan.device_always')}</p>
        </Card>

        <Card i={1} className="card-pad">
          <Head icon={BellRing} title={t('live.settings_title')} />
          <div className="flex items-start gap-4 rounded-2xl border border-slate-100 p-4">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', live?.voiceOn ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-400')}>
              {live?.voiceOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800">{t('live.voice')}</p>
              <p className="mt-0.5 text-sm text-slate-500">{t('live.voice_hint')}</p>
            </div>
            <Toggle checked={!!live?.voiceOn} onChange={(v) => live?.setVoiceOn(v)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="secondary" icon={Volume2} onClick={() => { live?.test(); if (live && !live.hasVoice()) setTimeout(() => toast(t('live.no_voice')), 900); }}>{t('live.test')}</Button>
            <span className={cn('inline-flex items-center gap-1.5 text-xs', live?.connected ? 'text-emerald-600' : 'text-slate-400')}>
              <span className={cn('h-2 w-2 rounded-full', live?.connected ? 'animate-pulse bg-emerald-500' : 'bg-slate-300')} />
              {live?.connected ? t('live.connected') : t('live.offline')}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-400">{t('live.volume_note')}</p>
        </Card>

        <Card i={1} className="card-pad">
          <Head icon={User} title={t('settings.profile')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('master.full_name')}><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
            <Field label={t('master.phone')}><Input value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
            <Field label={t('auth.email')} className="sm:col-span-2"><Input value={user?.email || ''} disabled /></Field>
          </div>
          <div className="mt-5 flex justify-end"><Button icon={Save} loading={busy === 'profile'} onClick={saveProfile}>{t('common.save')}</Button></div>
        </Card>

        <Card i={2} className="card-pad">
          <Head icon={KeyRound} title={t('settings.change_password')} />
          <div className="grid gap-4">
            <Field label={t('settings.current_password')}><PasswordInput autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('users.new_password')} hint={t('users.min6')}><PasswordInput autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
              <Field label={t('settings.confirm_password')}><PasswordInput autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
            </div>
          </div>
          <div className="mt-5 flex justify-end"><Button icon={KeyRound} loading={busy === 'pw'} onClick={savePw} disabled={!pw.current_password || !pw.new_password}>{t('settings.change_password')}</Button></div>
        </Card>

        {can('settings.edit') && org && (
          <Card i={3} className="card-pad">
            <Head icon={Building} title={t('settings.organization')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('settings.org_name')}><Input value={org.org_name || ''} onChange={(e) => setOrg({ ...org, org_name: e.target.value })} /></Field>
              <Field label={t('settings.org_subtitle')}><Input value={org.org_subtitle || ''} onChange={(e) => setOrg({ ...org, org_subtitle: e.target.value })} /></Field>
              <Field label={t('settings.due_soon_days')} hint={t('settings.due_soon_hint')}><Input type="number" min="1" value={org.due_soon_days || 30} onChange={(e) => setOrg({ ...org, due_soon_days: e.target.value })} /></Field>
              <Field label={t('settings.default_cycle')}>
                <Select value={org.default_inspection_months || 6} onChange={(e) => setOrg({ ...org, default_inspection_months: e.target.value })}>
                  {[1, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{t('form.every_months', { n: m })}</option>)}
                </Select>
              </Field>
            </div>
            <div className="mt-5 flex justify-end"><Button icon={Save} loading={busy === 'org'} onClick={saveOrg}>{t('common.save')}</Button></div>
          </Card>
        )}
      </div>
    </div>
  );
}
