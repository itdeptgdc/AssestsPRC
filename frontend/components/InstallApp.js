'use client';
/* "Download app" — installs Asset PRC as a Progressive Web App (home-screen icon, full screen, own window). */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Download, MonitorSmartphone, MoreVertical, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { useI18n } from './providers';
import { Button, Modal, cn } from './ui';
import { LogoMark } from './Logo';

const Ctx = createContext(null);

export function InstallProvider({ children }) {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  // sw: 'pending' | 'ok' | 'cert' (page certificate not trusted → browser blocks one-tap install) | 'fail'
  const [env, setEnv] = useState({ ios: false, android: false, secure: true, standalone: false, sw: 'pending' });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setEnv((p) => ({
      ...p,
      ios: /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1),
      android: /android/i.test(ua),
      secure: window.isSecureContext,
      standalone,
    }));
    setInstalled(standalone);

    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); setOpen(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // service worker (needed for installability; browsers only allow it on HTTPS or localhost)
    // A page whose certificate the device does not trust can't register it — that is exactly when Chrome also
    // refuses one-tap install, so the result tells us whether to offer "Install" or "set up the certificate first".
    if ('serviceWorker' in navigator && window.isSecureContext && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js')
        .then(() => setEnv((p) => ({ ...p, sw: 'ok' })))
        .catch((err) => setEnv((p) => ({ ...p, sw: /ssl|certificate|security/i.test(`${err?.name} ${err?.message}`) ? 'cert' : 'fail' })));
    } else setEnv((p) => ({ ...p, sw: 'fail' }));
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  /** Opens the browser's own "Install app" dialog. Returns false when the browser does not offer it right now. */
  const prompt = useCallback(async () => {
    if (!deferred) return false;
    setOpen(false);
    deferred.prompt();
    const choice = await deferred.userChoice.catch(() => null);
    if (choice?.outcome === 'accepted') setInstalled(true);
    setDeferred(null); // a prompt can be used once; the browser offers a new one later
    return true;
  }, [deferred]);

  /** "Install" anywhere in the app: one-tap install when possible, otherwise the install dialog with guidance */
  const install = useCallback(async () => {
    if (!(await prompt())) setOpen(true);
  }, [prompt]);

  const value = useMemo(() => ({ install, prompt, installed, canPrompt: !!deferred, env, open, setOpen }), [install, prompt, installed, deferred, env, open]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <InstallModal />
    </Ctx.Provider>
  );
}

export const useInstall = () => useContext(Ctx);

function Step({ n, icon: Icon, children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{n}</span>
      <span className="flex flex-1 flex-wrap items-center gap-1.5 pt-0.5 text-sm text-slate-700">{children}{Icon && <Icon className="h-4 w-4 text-brand-600" />}</span>
    </li>
  );
}

function InstallModal() {
  const { t } = useI18n();
  const { open, setOpen, env, installed, canPrompt, prompt } = useInstall();
  const [nudge, setNudge] = useState(0); // highlights the steps when there is nothing to automate

  // what the Install button can do on this device right now: one-tap install, or the 3 steps
  const mode = installed ? 'done' : canPrompt ? 'prompt' : env.ios ? 'share' : 'manual';
  const label = mode === 'share' ? t('install.ios_button') : t('install.install_now');

  const onInstall = async () => {
    if (mode === 'prompt') { await prompt(); return; }
    if (mode === 'share' && navigator.share) {
      // iPhone / iPad: Apple has no install dialog — the Share sheet holds "Add to Home Screen"
      try { await navigator.share({ title: 'Asset PRC', url: `${window.location.origin}/` }); } catch { /* closed */ }
      return;
    }
    setNudge((n) => n + 1);
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={t('install.title')} subtitle={t('install.subtitle')} size="sm"
      footer={mode === 'done' ? <Button onClick={() => setOpen(false)}>{t('common.close')}</Button> : <>
        <Button variant="secondary" onClick={() => setOpen(false)} className="mr-auto">{t('common.close')}</Button>
        <Button icon={mode === 'share' ? Share : Download} onClick={onInstall} className="px-6">{label}</Button>
      </>}>
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-brand-50 to-violet-50 p-4">
          <LogoMark size={56} />
          <div>
            <p className="font-bold text-slate-900">Asset PRC</p>
            <p className="text-xs text-slate-500">Poipet Resort &amp; Casino</p>
          </div>
        </div>

        {installed ? (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="h-5 w-5" />{t('install.already')}</p>
        ) : canPrompt ? (
          <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />{t('install.ready')}
          </p>
        ) : (
          // the 3 steps (iPhone always; other browsers until they offer one-tap install). "Install" pulses them.
          <motion.ol key={nudge} className="space-y-3 rounded-2xl" initial={nudge ? { x: 0 } : false}
            animate={nudge ? { x: [0, -8, 8, -5, 5, 0], backgroundColor: ['rgba(99,102,241,0)', 'rgba(99,102,241,.08)', 'rgba(99,102,241,0)'] } : {}}
            transition={{ duration: 0.6 }}>
            {env.ios ? <>
              <Step n={1} icon={Share}>{t('install.ios_1')}</Step>
              <Step n={2} icon={PlusSquare}>{t('install.ios_2')}</Step>
              <Step n={3}>{t('install.ios_3')}</Step>
            </> : env.android ? <>
              <Step n={1} icon={MoreVertical}>{t('install.android_1')}</Step>
              <Step n={2} icon={Smartphone}>{t('install.android_2')}</Step>
              <Step n={3}>{t('install.android_3')}</Step>
            </> : <>
              <Step n={1} icon={MoreVertical}>{t('install.android_1')}</Step>
              <Step n={2} icon={MonitorSmartphone}>{t('install.android_2')}</Step>
              <Step n={3}>{t('install.desktop_2')}</Step>
            </>}
          </motion.ol>
        )}
      </div>
    </Modal>
  );
}

/** Button used in sidebar / login / settings */
export function InstallButton({ variant = 'card', className }) {
  const { t } = useI18n();
  const ctx = useInstall();
  if (!ctx || ctx.installed) return null;
  if (variant === 'sidebar') {
    return (
      <button type="button" onClick={ctx.install} className={cn('group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-r from-brand-600/20 to-violet-600/20 px-3 py-2.5 text-left transition hover:from-brand-600/30 hover:to-violet-600/30', className)}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-200 transition group-hover:scale-110"><Download className="h-4 w-4" /></span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">{t('install.button')}</span>
          <span className="block truncate text-[11px] text-slate-400">{t('install.button_sub')}</span>
        </span>
      </button>
    );
  }
  // type="button": on the login page this sits inside the sign-in form and must not submit it
  return (
    <Button type="button" variant="secondary" icon={Download} onClick={ctx.install} className={className}>{t('install.button')}</Button>
  );
}

/** Dismissible "Install app" banner for phones */
export function InstallBanner() {
  const { t } = useI18n();
  const ctx = useInstall();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { setHidden(localStorage.getItem('aqr_install_dismissed') === '1'); } catch { setHidden(false); }
  }, []);
  const dismiss = () => { setHidden(true); try { localStorage.setItem('aqr_install_dismissed', '1'); } catch {} };
  const show = ctx && !ctx.installed && !hidden;
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden lg:hidden">
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-600 to-violet-600 p-3 text-white shadow-glow">
            <LogoMark size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t('install.banner_title')}</p>
              <p className="truncate text-xs text-white/80">{t('install.banner_text')}</p>
            </div>
            <button type="button" onClick={ctx.install} className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-brand-700 active:scale-95">{t('install.get')}</button>
            <button onClick={dismiss} className="rounded-lg p-1 text-white/70 hover:bg-white/10" aria-label="close"><X className="h-4 w-4" /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
