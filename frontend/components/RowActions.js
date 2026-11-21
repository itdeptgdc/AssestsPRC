'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from './ui';

/**
 * Row action toolbar: one rounded group with dividers; each icon gets its own colour on hover
 * and a small tooltip. actions: [{ key, icon, label, onClick, tone: 'brand'|'green'|'amber'|'violet'|'slate' }]
 */
const TONES = {
  slate: 'hover:bg-slate-100 hover:text-slate-800',
  brand: 'hover:bg-brand-50 hover:text-brand-600',
  green: 'hover:bg-emerald-50 hover:text-emerald-600',
  amber: 'hover:bg-amber-50 hover:text-amber-600',
  violet: 'hover:bg-violet-50 hover:text-violet-600',
  rose: 'hover:bg-rose-50 hover:text-rose-600',
};

function ActionButton({ icon: Icon, label, onClick, tone = 'slate' }) {
  const [tip, setTip] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
      <motion.button type="button" whileTap={{ scale: 0.88 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
        aria-label={label} onFocus={() => setTip(true)} onBlur={() => setTip(false)}
        className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300', TONES[tone])}>
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
      </motion.button>
      <AnimatePresence>
        {tip && (
          <motion.span role="tooltip" initial={{ opacity: 0, y: 4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.95 }} transition={{ duration: 0.12 }} style={{ x: '-50%' }}
            className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg">
            {label}
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RowActions({ actions, className }) {
  const list = actions.filter(Boolean);
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm', className)}>
      {list.map((a, i) => (
        <div key={a.key} className="flex items-center">
          {i > 0 && <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden />}
          <ActionButton {...a} />
        </div>
      ))}
    </div>
  );
}
