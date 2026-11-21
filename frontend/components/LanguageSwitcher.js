'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { LANGS, useI18n } from './providers';
import { Flag } from './Flags';
import { cn } from './ui';

export default function LanguageSwitcher({ dark, compact }) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANGS.find((l) => l.code === lang) || LANGS[0];

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-10 items-center gap-2 rounded-xl border px-2.5 text-sm font-medium transition',
          dark ? 'border-white/15 bg-white/10 text-white hover:bg-white/20' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:shadow-soft'
        )}
      >
        <Flag code={current.code} className="h-4 w-6" />
        {!compact && <span className="hidden sm:inline">{current.label}</span>}
        <ChevronDown className={cn('h-3.5 w-3.5 opacity-60 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-48 origin-top-right overflow-hidden rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl"
          >
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                  lang === l.code ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50')}
              >
                <Flag code={l.code} className="h-4 w-6" />
                <span className="flex-1 text-left">{l.label}</span>
                <span className="text-[10px] font-bold text-slate-400">{l.short}</span>
                {lang === l.code && <Check className="h-4 w-4 text-brand-600" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
