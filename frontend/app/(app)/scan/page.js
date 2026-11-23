'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight, Camera, CameraOff, ClipboardCheck, History, Keyboard, Loader2, Lock, Plus, RotateCcw, ScanBarcode, ScanLine, Search,
  ShieldAlert, Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth, useI18n } from '@/components/providers';
import { api } from '@/lib/api';
import { CAMERA_KEY, SCAN_CAPTURE, parseScan, useScannerInput } from '@/lib/scanner';
import { Button, Card, Modal, PageHeader, cn, useLocalState } from '@/components/ui';
import { ScanNotFound, ScanResult } from '@/components/ScanResult';
import { InspectionModal, RepairModal } from '@/components/ActionModals';

/** Map a camera start error to something the user can act on */
function cameraProblem(e) {
  const s = String(e?.name || e?.message || e || '');
  if (/NotAllowed|Permission|Security/i.test(s)) return 'denied';
  if (/NotFound|Overconstrained|no camera|Requested device not found/i.test(s)) return 'nocam';
  if (/NotReadable|TrackStart|Abort|Could not start/i.test(s)) return 'busy';
  return 'other';
}

export default function ScanPage() {
  const { t, te } = useI18n();
  const { can } = useAuth();
  const router = useRouter();
  // scan result: { asset } when the code is registered, { missing: code } when it is not
  const [result, setResult] = useState(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [action, setAction] = useState(null); // 'inspect' | 'repair' — opened from the result
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [camError, setCamError] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useLocalState('aqr_recent_scans', []);
  // camera ON = scan with the phone camera; OFF = scan with a Bluetooth / USB scanner device
  const [cameraOn, setCameraOn] = useLocalState(CAMERA_KEY, true);
  const [scanText, setScanText] = useState('');
  const [listening, setListening] = useState(false);
  const scanInput = useRef(null);
  const scanner = useRef(null);
  const handled = useRef(false);
  // camera needs a secure page (https or localhost)
  const [secure, setSecure] = useState(true);
  const [secureUrl, setSecureUrl] = useState('/');
  useEffect(() => {
    setSecure(window.isSecureContext);
    setSecureUrl(`https://${window.location.host}${window.location.pathname}`);
  }, []);

  // 1. check the scanned code exists  2. show the asset (or "not registered") in the result card
  const lookup = async (raw) => {
    const r = parseScan(raw);
    if (r.external) { toast.error(t('scan.not_assetqr')); return; }
    const c = r.code;
    if (!c) return;
    setBusy(true);
    try {
      const a = await api(`/assets/lookup/${encodeURIComponent(c)}`);
      setRecent((x) => [{ id: a.id, code: a.code, name: a.name }, ...(x || []).filter((y) => y.id !== a.id)].slice(0, 6));
      setResult({ asset: a });
      setResultOpen(true);
    } catch (e) {
      if (e.status === 404) {
        if (navigator.vibrate) navigator.vibrate([60, 60, 60]);
        setResult({ missing: c });
        setResultOpen(true);
      } else toast.error(te(e));
    } finally {
      handled.current = false;
      setBusy(false);
    }
  };

  // a Bluetooth / USB scanner works on this page in both modes — even while a result is open
  useScannerInput((text) => { if (navigator.vibrate) navigator.vibrate(60); setScanText(text); setAction(null); lookup(text); });

  const focusScanner = () => scanInput.current?.focus({ preventScroll: true });
  const scanNext = () => { setResultOpen(false); setCode(''); setScanText(''); if (cameraOn) start(); else setTimeout(focusScanner, 50); };
  const openAction = (kind) => { setResultOpen(false); setAction(kind); };
  const closeAction = () => { setAction(null); setResultOpen(true); };
  // after an inspection / repair, show the updated asset (status, next inspection)
  const refreshResult = async () => {
    try { const a = await api(`/assets/lookup/${encodeURIComponent(result.asset.code)}`); setResult({ asset: a }); } catch {}
  };

  const stop = async () => {
    try {
      if (scanner.current?.isScanning) await scanner.current.stop();
      scanner.current?.clear();
    } catch {}
    scanner.current = null;
    setActive(false);
  };

  const start = async () => {
    setStarting(true);
    setCamError(null);
    handled.current = false;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      setActive(true);
      await new Promise((r) => setTimeout(r, 50));
      const s = new Html5Qrcode('qr-reader', { verbose: false });
      scanner.current = s;
      await s.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (w, h) => { const m = Math.min(w, h) * 0.7; return { width: m, height: m }; } },
        (text) => {
          if (handled.current) return;
          handled.current = true;
          if (navigator.vibrate) navigator.vibrate(80);
          stop();
          lookup(text);
        },
        () => {}
      );
    } catch (e) {
      try { scanner.current?.clear(); } catch {}
      scanner.current = null;
      setActive(false);
      setCamError(cameraProblem(e));
    } finally {
      setStarting(false);
    }
  };

  const setMode = (on) => {
    setCameraOn(on);
    setCamError(null);
    if (!on) { stop(); setTimeout(focusScanner, 80); }
  };

  // scanner mode: keep the scan box focused so the scanner's "typing" lands in it
  useEffect(() => {
    if (!cameraOn && !resultOpen && !action) { const id = setTimeout(focusScanner, 120); return () => clearTimeout(id); }
    return undefined;
  }, [cameraOn, resultOpen, action]);

  useEffect(() => () => { stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const modes = [
    { on: true, icon: Camera, label: t('scan.mode_camera') },
    { on: false, icon: ScanBarcode, label: t('scan.mode_device') },
  ];

  return (
    <div>
      <PageHeader title={t('scan.title')} subtitle={t('scan.subtitle')} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="card-pad">
          {/* Camera ON / OFF */}
          <div className="mx-auto mb-4 grid max-w-md grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label={t('scan.mode')}>
            {modes.map((m) => (
              <button key={String(m.on)} type="button" role="tab" aria-selected={cameraOn === m.on} onClick={() => setMode(m.on)}
                className={cn('relative flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition',
                  cameraOn === m.on ? 'text-brand-700' : 'text-slate-500 hover:text-slate-700')}>
                {cameraOn === m.on && <motion.span layoutId="scan-mode" className="absolute inset-0 rounded-xl bg-white shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                <m.icon className="relative h-4 w-4" /><span className="relative">{m.label}</span>
              </button>
            ))}
          </div>

          {cameraOn ? (
            <>
              <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl bg-[#0f1424]">
                <div id="qr-reader" className="h-full w-full" />
                <AnimatePresence>
                  {!active && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                      <div className="bg-grid absolute inset-0 opacity-30" />
                      <div className="relative mb-6 h-40 w-40">
                        {['left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl'].map((c) => (
                          <span key={c} className={`absolute h-10 w-10 border-brand-400 ${c}`} />
                        ))}
                        <span className="absolute inset-x-3 h-0.5 animate-scan rounded-full bg-gradient-to-r from-transparent via-brand-300 to-transparent shadow-[0_0_14px_3px_rgba(129,140,248,.8)]" />
                        <ScanLine className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-white/30" />
                      </div>
                      <p className="relative font-semibold text-white">{t('scan.camera_title')}</p>
                      <p className="relative mt-1 max-w-xs text-sm text-slate-400">{t('scan.camera_text')}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
                    <Loader2 className="h-10 w-10 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="mt-5 flex justify-center">
                {active ? (
                  <Button variant="secondary" icon={CameraOff} onClick={stop}>{t('scan.stop')}</Button>
                ) : (
                  <Button icon={Camera} loading={starting} onClick={start} className="px-8 py-3">{t('scan.start')}</Button>
                )}
              </div>

              {camError ? (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-4 max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <p className="flex items-start gap-2 font-semibold"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{t(`scan.cam_${camError}_title`)}</p>
                  <p className="mt-1.5 text-rose-700/90">{t(`scan.cam_${camError}_text`)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={start} className="btn btn-secondary btn-sm"><RotateCcw className="h-3.5 w-3.5" />{t('scan.try_again')}</button>
                    {camError === 'denied' && <a href="/cert" className="btn btn-secondary btn-sm"><Lock className="h-3.5 w-3.5" />{t('scan.cert_setup')}</a>}
                    <button type="button" onClick={() => setMode(false)} className="btn btn-primary btn-sm"><ScanBarcode className="h-3.5 w-3.5" />{t('scan.use_device')}</button>
                  </div>
                </motion.div>
              ) : secure ? (
                <p className="mt-3 text-center text-xs text-slate-400">{t('scan.https_hint')}</p>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="flex items-start gap-2 font-semibold"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{t('scan.insecure_title')}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={secureUrl} className="btn btn-primary btn-sm"><Lock className="h-3.5 w-3.5" />{t('scan.open_secure')}</a>
                    <a href="/cert" className="btn btn-secondary btn-sm">{t('scan.cert_setup')}</a>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Scanner-device mode: Bluetooth / USB scanner types the code here */
            <>
              <button type="button" onClick={focusScanner}
                className="relative mx-auto flex aspect-square w-full max-w-md flex-col items-center justify-center overflow-hidden rounded-3xl bg-[#0f1424] p-8 text-center">
                <div className="bg-grid absolute inset-0 opacity-30" />
                <div className="relative mb-6 flex h-36 w-36 items-center justify-center">
                  {listening && [0, 1].map((k) => (
                    <motion.span key={k} className="absolute inset-0 rounded-full border-2 border-emerald-400/60"
                      initial={{ scale: 0.6, opacity: 0.8 }} animate={{ scale: 1.25, opacity: 0 }} transition={{ duration: 1.8, repeat: Infinity, delay: k * 0.9, ease: 'easeOut' }} />
                  ))}
                  <span className={cn('flex h-24 w-24 items-center justify-center rounded-full transition', listening ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-slate-400')}>
                    <ScanBarcode className="h-12 w-12" />
                  </span>
                </div>
                <p className="relative font-semibold text-white">{listening ? t('scan.device_ready') : t('scan.device_paused')}</p>
                <p className="relative mt-1 max-w-xs text-sm text-slate-400">{listening ? t('scan.device_text') : t('scan.device_tap')}</p>
                <span className={cn('relative mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
                  listening ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-slate-400')}>
                  <span className={cn('h-2 w-2 rounded-full', listening ? 'animate-pulse bg-emerald-400' : 'bg-slate-500')} />
                  {listening ? t('scan.listening') : t('scan.not_listening')}
                </span>
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
                    <Loader2 className="h-10 w-10 animate-spin text-white" />
                  </div>
                )}
              </button>
              <div className="mx-auto mt-4 max-w-md">
                {/* Capture box: keeps focus for the scanner. The scan is read from the physical keys by useScannerInput
                    (layout-proof), so the box itself is read-only and only shows the last scan. inputMode="none" = no phone keyboard. */}
                <input ref={scanInput} value={scanText} readOnly {...{ [SCAN_CAPTURE]: '' }} inputMode="none" autoComplete="off"
                  onFocus={() => setListening(true)} onBlur={() => setListening(false)} aria-label={t('scan.device_field')}
                  placeholder={t('scan.device_field')} className="input cursor-pointer text-center font-mono" />
              </div>
              <p className="mx-auto mt-3 max-w-md text-center text-xs text-slate-400">{t('scan.device_hint')}</p>
            </>
          )}
        </Card>

        <div className="space-y-5">
          <Card i={1} className="card-pad">
            <h3 className="section-title flex items-center gap-2"><Keyboard className="h-4 w-4 text-brand-500" />{t('scan.manual_title')}</h3>
            <p className="mt-1 text-xs text-slate-400">{t('scan.manual_text')}</p>
            <form onSubmit={(e) => { e.preventDefault(); lookup(code); }} className="mt-4 flex gap-2">
              <input className="input font-mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="P401-602-01-23-0001" />
              <Button type="submit" icon={Search} loading={busy}>{t('common.search')}</Button>
            </form>
          </Card>

          <Card i={2} className="card-pad">
            <h3 className="section-title flex items-center gap-2"><History className="h-4 w-4 text-brand-500" />{t('scan.recent')}</h3>
            {(recent || []).length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">{t('scan.no_recent')}</p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100">
                {recent.map((r) => (
                  <button key={r.id} onClick={() => lookup(r.code)} className="flex w-full items-center gap-3 py-2.5 text-left transition hover:translate-x-1">
                    <span className="font-mono text-xs font-semibold text-brand-600">{r.code}</span>
                    <span className="truncate text-sm text-slate-600">{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal open={resultOpen && !!result} onClose={() => setResultOpen(false)} size={result?.asset ? 'lg' : 'sm'} title={t('scan.result')}
        footer={result?.asset ? <>
          <Button variant="secondary" icon={ScanLine} onClick={scanNext} className="mr-auto">{t('scan.scan_next')}</Button>
          <Button onClick={() => router.push(`/assets/${result.asset.id}`)}>{t('scan.view_details')} <ArrowRight className="h-4 w-4" /></Button>
        </> : <>
          {can('assets.add') && <Button variant="secondary" icon={Plus} onClick={() => router.push('/assets/new')} className="mr-auto">{t('scan.add_asset')}</Button>}
          <Button icon={ScanLine} onClick={scanNext}>{t('scan.scan_again')}</Button>
        </>}>
        {result?.asset && (
          <ScanResult asset={result.asset}>
            {(can('inspections.add') || can('repairs.add')) && (
              <div className={can('inspections.add') && can('repairs.add') ? 'grid grid-cols-2 gap-2' : 'grid gap-2'}>
                {can('inspections.add') && <Button variant="secondary" icon={ClipboardCheck} onClick={() => openAction('inspect')}>{t('assets.inspect')}</Button>}
                {can('repairs.add') && <Button variant="secondary" icon={Wrench} onClick={() => openAction('repair')}>{t('assets.report_repair')}</Button>}
              </div>
            )}
          </ScanResult>
        )}
        {result?.missing && <ScanNotFound code={result.missing} />}
      </Modal>

      <InspectionModal open={action === 'inspect'} asset={result?.asset} onClose={closeAction} onSaved={refreshResult} />
      <RepairModal open={action === 'repair'} asset={result?.asset} onClose={closeAction} onSaved={refreshResult} />
    </div>
  );
}
