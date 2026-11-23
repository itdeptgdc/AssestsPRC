'use client';
/**
 * Real-time notifications: listens to /api/events (Server-Sent Events) while signed in.
 * A new department / asset code / asset → chime + toast + entry in the bell + spoken announcement
 * (female voice, full volume, in the selected language).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Building2, Package, Tags, Volume2 } from 'lucide-react';
import { getToken } from '@/lib/api';
import { useAuth, useI18n } from './providers';

const Ctx = createContext(null);
export const useRealtime = () => useContext(Ctx);

export const VOICE_KEY = 'aqr_voice'; // '0' = voice announcements off on this device
const LIST_KEY = 'aqr_live_notes';
const SEEN_KEY = 'aqr_live_seen';
const BCP47 = { th: 'th-TH', km: 'km-KH', en: 'en-US' };
const EN_FALLBACK = { department: 'New department added: {name}', asset_code: 'New asset code added: {name}', asset: 'New asset registered: {name}' };

export const LIVE_ICON = {
  department: [Building2, 'bg-sky-50 text-sky-600'],
  asset_code: [Tags, 'bg-violet-50 text-violet-600'],
  asset: [Package, 'bg-emerald-50 text-emerald-600'],
};

const read = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ---------- voice ----------
// Names of female system voices on Android / Windows / iPhone / macOS / Chrome
const FEMALE = /female|woman|girl|zira|aria|jenny|michelle|emma|ava|samantha|victoria|karen|moira|tessa|fiona|serena|susan|hazel|libby|sonia|natasha|premwadee|achara|pattara|kanya|sreymom|google\s.*(us|uk)\senglish|en-us-x-(sfg|tpc|iob|iog)|th-th-x-(mol|thc)|km-kh-x/i;
const MALE = /\bmale\b|man\b|david|mark|guy|ryan|daniel|alex|fred|george|thomas|niwat|piseth|rishi|aaron/i;

function pickVoice(lang) {
  const synth = typeof window !== 'undefined' && window.speechSynthesis;
  if (!synth) return null;
  const all = synth.getVoices();
  const code = BCP47[lang] || 'en-US';
  const base = code.slice(0, 2);
  const forLang = all.filter((v) => v.lang?.replace('_', '-').toLowerCase().startsWith(base));
  const score = (v) => (FEMALE.test(v.name) ? 4 : 0) + (MALE.test(v.name) ? -4 : 0) + (v.lang?.replace('_', '-') === code ? 2 : 0) + (v.localService ? 1 : 0);
  return forLang.sort((a, b) => score(b) - score(a))[0] || null;
}

/** Loud attention chime (Web Audio) — two bright notes */
function chime(ctxRef) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = ctxRef.current || (ctxRef.current = new AC());
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    [[880, 0], [1318.5, 0.16]].forEach(([f, d]) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + d);
      g.gain.exponentialRampToValueAtTime(0.9, now + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + d + 0.45);
      o.connect(g).connect(ctx.destination); o.start(now + d); o.stop(now + d + 0.5);
    });
  } catch { /* audio blocked */ }
}

export function RealtimeProvider({ children }) {
  const { t, lang } = useI18n();
  const { user, refresh } = useAuth() || {};
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const userId = user?.id;
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState(0);
  const [voiceOn, setVoiceOnState] = useState(true);
  const [connected, setConnected] = useState(false);
  const audio = useRef(null);
  const latest = useRef({ t, lang, voiceOn: true });
  latest.current = { t, lang, voiceOn };

  useEffect(() => { setItems(read(LIST_KEY, [])); setSeen(read(SEEN_KEY, 0)); setVoiceOnState(read(VOICE_KEY, true) !== false); }, []);

  const setVoiceOn = useCallback((v) => { setVoiceOnState(v); write(VOICE_KEY, v); }, []);

  /** Speak a message in the selected language, female voice, full volume */
  const speak = useCallback((text, langCode) => {
    const synth = window.speechSynthesis;
    if (!synth || !text) return false;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = BCP47[langCode] || 'en-US';
    const v = pickVoice(langCode);
    if (v) u.voice = v;
    u.volume = 1;   // maximum the browser allows (device volume still applies)
    u.rate = 0.95;  // clear, slightly slower
    u.pitch = 1.2;  // brighter, more female-sounding when the voice is neutral
    synth.cancel();
    synth.speak(u);
    return !!v;
  }, []);

  /** Browsers allow sound only after the user has touched the page once: unlock audio + speech then */
  useEffect(() => {
    const unlock = () => {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC && !audio.current) audio.current = new AC();
        audio.current?.resume?.();
        const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis?.speak(u);
      } catch {}
      window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    window.speechSynthesis?.getVoices(); // start loading the voice list
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  const messageFor = useCallback((e, tt) => {
    const code = e.code ? `${e.code} ` : '';
    if (e.type === 'department') return tt('live.department', { name: `${code}${e.name}` });
    if (e.type === 'asset_code') return tt('live.asset_code', { name: `${code}${e.name}` });
    return tt('live.asset', { name: e.name });
  }, []);

  const announce = useCallback((e, { test = false } = {}) => {
    const { t: tt, lang: l, voiceOn: on } = latest.current;
    const text = messageFor(e, tt);
    chime(audio);
    if (on || test) {
      setTimeout(() => {
        // no voice installed for Thai / Khmer on this device → announce in English instead of staying silent
        if (l !== 'en' && !pickVoice(l)) speak(messageFor(e, (k, v) => EN_FALLBACK[k.split('.')[1]]?.replace('{name}', v?.name ?? '') ?? k), 'en');
        else speak(text, l);
      }, 650); // after the chime
    }
    const [Icon, cls] = LIVE_ICON[e.type] || LIVE_ICON.asset;
    toast.custom((tst) => (
      <motion.div initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: tst.visible ? 1 : 0, y: tst.visible ? 0 : -16, scale: 1 }}
        className="pointer-events-auto flex w-[min(92vw,380px)] items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-2xl">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cls}`}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{text}</p>
          <p className="truncate text-xs text-slate-400">{e.by ? tt('live.by', { name: e.by }) : tt('live.just_now')}</p>
        </div>
        {(on || test) && <Volume2 className="h-4 w-4 shrink-0 animate-pulse text-brand-500" />}
      </motion.div>
    ), { duration: 6000, position: 'top-center' });
    return text;
  }, [messageFor, speak]);

  // ---------- connection (fetch stream so the sign-in token goes in a header, never in the URL) ----------
  useEffect(() => {
    if (!userId) return undefined;
    let stop = false; let ctrl; let wait = 2000;
    const run = async () => {
      while (!stop) {
        try {
          ctrl = new AbortController();
          const res = await fetch('/api/events', { headers: { Authorization: `Bearer ${getToken()}`, Accept: 'text/event-stream' }, signal: ctrl.signal, cache: 'no-store' });
          if (res.status === 401) return; // signed out
          if (!res.ok || !res.body) throw new Error('stream');
          setConnected(true); wait = 2000;
          const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf('\n\n')) >= 0) {
              const block = buf.slice(0, i); buf = buf.slice(i + 2);
              if (!/^event: notify$/m.test(block)) continue;
              const data = block.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n');
              try {
                const e = JSON.parse(data);
                // an admin changed role permissions: reload my own (menus / buttons update), no toast
                if (e.type === 'permissions') { refreshRef.current?.(); continue; }
                setItems((list) => { const next = [{ ...e, rid: `${e.at}-${e.id}` }, ...list].slice(0, 30); write(LIST_KEY, next); return next; });
                announce(e);
              } catch {}
            }
          }
        } catch { /* network drop or abort */ }
        setConnected(false);
        if (stop) break;
        await new Promise((r) => setTimeout(r, wait));
        wait = Math.min(wait * 2, 30000);
      }
    };
    run();
    return () => { stop = true; ctrl?.abort(); };
  }, [userId, announce]);

  const unread = items.filter((x) => new Date(x.at).getTime() > seen).length;
  const markSeen = useCallback(() => { const now = Date.now(); setSeen(now); write(SEEN_KEY, now); }, []);
  const clear = useCallback(() => { setItems([]); write(LIST_KEY, []); }, []);
  /** "Test voice" button in Settings */
  const test = useCallback(() => announce({ type: 'asset', name: 'Samsung desktop', by: user?.name }, { test: true }), [announce, user]);
  const hasVoice = useCallback(() => !!pickVoice(latest.current.lang), []);

  const value = useMemo(() => ({ items, unread, markSeen, clear, voiceOn, setVoiceOn, test, hasVoice, connected, messageFor }),
    [items, unread, markSeen, clear, voiceOn, setVoiceOn, test, hasVoice, connected, messageFor]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
