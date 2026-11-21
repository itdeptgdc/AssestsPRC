'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useI18n, useTheme } from './providers';
import { cn } from './ui';

/** Animated light/dark switch for the header */
export default function ThemeToggle({ className }) {
  const { resolved, toggle } = useTheme();
  const { t } = useI18n();
  const dark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? t('theme.to_light') : t('theme.to_dark')}
      aria-label={dark ? t('theme.to_light') : t('theme.to_dark')}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-brand-200 hover:text-brand-600 active:scale-95',
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? 'moon' : 'sun'}
          initial={{ y: 18, rotate: -90, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: -18, rotate: 90, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex"
        >
          {dark ? <Moon className="h-[18px] w-[18px] text-brand-300" /> : <Sun className="h-[18px] w-[18px] text-amber-500" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
