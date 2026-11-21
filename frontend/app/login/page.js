'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarClock, Eye, EyeOff, Lock, Mail, QrCode, ShieldCheck, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth, useI18n } from '@/components/providers';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import Logo, { LogoMark } from '@/components/Logo';
import { InstallButton } from '@/components/InstallApp';
import { Button } from '@/components/ui';

export default function LoginPage() {
  const { t, te } = useI18n();
  const { login, user, loading, settings } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const nextUrl = () => {
    const n = new URLSearchParams(window.location.search).get('next') || '/';
    return n.startsWith('/') && !n.startsWith('//') ? n : '/';
  };

  useEffect(() => {
    if (!loading && user) router.replace(nextUrl());
  }, [user, loading, router]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(email, password);
      toast.success(t('auth.welcome', { name: u.name }));
      router.replace(nextUrl());
    } catch (err) {
      setError(te(err));
    } finally {
      setBusy(false);
    }
  };

  const features = [
    { icon: QrCode, key: 'f1' },
    { icon: CalendarClock, key: 'f2' },
    { icon: Wrench, key: 'f3' },
    { icon: ShieldCheck, key: 'f4' },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Hero */}
      <div className="relative hidden w-1/2 overflow-hidden bg-[#0f1424] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-grid absolute inset-0 opacity-40" />
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full bg-violet-600/30 blur-3xl" />

        <Logo dark className="relative" title={settings.org_name || 'Asset PRC'} subtitle={t('app.tagline')} size={44} />

        <div className="relative">
          <div className="mb-10 flex items-end gap-6">
            {/* company logo */}
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative">
              <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-[#c9a24a]/40 via-violet-500/30 to-brand-500/30 blur-2xl" />
              <div className="keep-light relative w-64 rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-[#c9a24a]/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Poipet Resort & Casino" className="h-auto w-full" />
              </div>
            </motion.div>
            {/* animated QR scanner illustration */}
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.2 }}
              className="relative mb-2 h-28 w-28 animate-float rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
              <div className="grid h-full w-full grid-cols-5 grid-rows-5 gap-1">
                {Array.from({ length: 25 }).map((_, i) => (
                  <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6] }} transition={{ delay: 0.4 + i * 0.03 }}
                    className={`rounded-[2px] ${[0, 1, 5, 6, 3, 4, 8, 9, 15, 16, 20, 21, 12, 18, 14, 22].includes(i) ? 'bg-white' : 'bg-white/15'}`} />
                ))}
              </div>
              <span className="absolute inset-x-2 h-0.5 animate-scan rounded-full bg-gradient-to-r from-transparent via-brand-300 to-transparent shadow-[0_0_12px_2px_rgba(129,140,248,.8)]" />
            </motion.div>
          </div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="max-w-md text-4xl font-bold leading-tight text-white">
            {t('auth.hero_title')}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-4 max-w-md text-slate-400">
            {t('auth.hero_text')}
          </motion.p>
          <div className="mt-8 grid max-w-lg grid-cols-2 gap-3">
            {features.map((f, i) => (
              <motion.div key={f.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <f.icon className="h-5 w-5 text-brand-300" />
                <span className="text-sm text-slate-200">{t(`auth.${f.key}`)}</span>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} Asset PRC</p>
      </div>

      {/* Form */}
      <div className="relative flex flex-1 flex-col">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-violet-50 lg:bg-none" />
        <div className="flex items-center justify-between p-5">
          <Logo className="lg:invisible" title={settings.org_name || 'Asset PRC'} subtitle={settings.org_subtitle} size={44} />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-16">
          <motion.form onSubmit={submit} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="card w-full max-w-md p-7 sm:p-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{t('auth.title')}</h2>
                <p className="mt-1.5 text-sm text-slate-500">{t('auth.subtitle')}</p>
              </div>
              <motion.div initial={{ opacity: 0, rotate: -8, scale: 0.8 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ type: 'spring', delay: 0.25 }}>
                <LogoMark size={72} className="rounded-2xl" />
              </motion.div>
            </div>

            <div className="mt-7 space-y-4">
              <div>
                <label className="label">{t('auth.email')}</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="email" required autoComplete="email" className="input py-3 pl-10" placeholder="you@company.com"
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">{t('auth.password')}</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type={show ? 'text' : 'password'} required autoComplete="current-password" className="input py-3 pl-10 pr-11" placeholder="••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }} className="mt-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">
                {error}
              </motion.p>
            )}

            <div className="mt-3 text-right">
              <span className="text-xs text-slate-400">{t('auth.forgot_hint')}</span>
            </div>

            <Button type="submit" loading={busy} className="mt-5 w-full py-3 text-[15px]">
              {t('auth.submit')} {!busy && <ArrowRight className="h-4 w-4" />}
            </Button>
            <div className="mt-4 flex justify-center">
              <InstallButton className="w-full !py-2.5" />
            </div>
          </motion.form>
        </div>
      </div>
    </div>
  );
}
