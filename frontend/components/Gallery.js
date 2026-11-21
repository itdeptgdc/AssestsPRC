'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Expand, ImageOff, ShieldCheck, X } from 'lucide-react';
import { imgUrl } from '@/lib/api';
import { useI18n } from './providers';
import { cn } from './ui';

const EASE = [0.22, 1, 0.36, 1]; // smooth "ease-out-expo" used for all photo transitions

/** Slide in from the side we are moving to, coming into focus (blur → sharp); the old photo drifts away */
const slide = {
  enter: (dir) => ({ x: dir >= 0 ? '22%' : '-22%', opacity: 0, scale: 1.06, filter: 'blur(8px)' }),
  center: { x: 0, opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0.6, ease: EASE } },
  exit: (dir) => ({ x: dir >= 0 ? '-14%' : '14%', opacity: 0, scale: 0.97, filter: 'blur(6px)', transition: { duration: 0.45, ease: EASE } }),
};

/** Index + direction of travel, so the animation knows which way to slide */
function useCarousel(count) {
  const [[index, dir], set] = useState([0, 0]);
  const go = useCallback((to) => set(([i]) => {
    const next = ((to % count) + count) % count;
    return [next, to > i ? 1 : -1];
  }), [count]);
  useEffect(() => { set([0, 0]); }, [count]);
  return { index: Math.min(index, Math.max(count - 1, 0)), dir, go, next: () => go(index + 1), prev: () => go(index - 1) };
}

/** Full-screen photo viewer: arrows / swipe / Esc. Closing is click-through at once (no stuck overlay). */
export function Lightbox({ images, start = 0, onClose }) {
  const n = images.length;
  const c = useCarousel(n);
  useEffect(() => { c.go(start); }, [start]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => {
      if (!['Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.stopPropagation(); // keep Esc from also closing a dialog underneath
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') c.prev();
      if (e.key === 'ArrowRight') c.next();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [c, onClose]);

  return (
    <motion.div className="fixed inset-0 z-[80] flex flex-col bg-black/95 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.2 } }}>
      <div className="flex items-center justify-between p-4 text-white" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium tabular-nums">{c.index + 1} / {n}</span>
        <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2.5 transition hover:rotate-90 hover:bg-white/20" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence initial={false} custom={c.dir}>
          <motion.div key={c.index} custom={c.dir} variants={slide} initial="enter" animate="center" exit="exit"
            drag={n > 1 ? 'x' : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.35}
            onDragEnd={(_, info) => { if (info.offset.x < -60) c.next(); else if (info.offset.x > 60) c.prev(); }}
            className="absolute inset-0 flex items-center justify-center px-3 pb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl(images[c.index])} alt="" draggable={false} className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl" />
          </motion.div>
        </AnimatePresence>
        {n > 1 && <>
          <button type="button" onClick={c.prev} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:scale-110 hover:bg-white/20" aria-label="Previous"><ChevronLeft className="h-6 w-6" /></button>
          <button type="button" onClick={c.next} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:scale-110 hover:bg-white/20" aria-label="Next"><ChevronRight className="h-6 w-6" /></button>
        </>}
      </div>
      {n > 1 && (
        <div className="no-scrollbar flex justify-center gap-2 overflow-x-auto px-4 pb-5" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          {images.map((src, k) => (
            <button key={src + k} type="button" onClick={() => c.go(k)} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl(src)} alt="" className={cn('h-full w-full object-cover transition duration-300', k === c.index ? 'opacity-100' : 'opacity-40 hover:opacity-80')} />
              {k === c.index && <motion.span layoutId="lb-ring" className="absolute inset-0 rounded-xl ring-2 ring-inset ring-white" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Product photo gallery.
 *   fit       'contain' (whole photo on a blurred backdrop — any shape looks clean) | 'cover' (fills the frame)
 *   thumbs    'below' | 'overlay' (strip over the bottom of the photo)
 *   frame     classes for the photo frame (size / aspect / rounding)
 *   overlay   extra element drawn on the photo (e.g. status badge)
 */
export default function Gallery({ images = [], color = '#6366f1', fit = 'contain', thumbs = 'below', frame = 'aspect-[4/3] rounded-2xl', overlay, id = 'g', className }) {
  const { t } = useI18n();
  const list = (images || []).filter(Boolean);
  const n = list.length;
  const c = useCarousel(n);
  const [zoom, setZoom] = useState(false);
  const dragged = useRef(false);

  if (n === 0) {
    return (
      <div className={cn('relative flex flex-col items-center justify-center overflow-hidden text-white', frame, className)}
        style={{ background: `linear-gradient(135deg, ${color}, ${color}99 55%, #0f172a)` }}>
        <div className="bg-grid absolute inset-0 opacity-20" />
        <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} className="relative"><ImageOff className="h-14 w-14 opacity-80" /></motion.span>
        <p className="relative mt-3 text-sm font-medium opacity-90">{t('scan.no_photo')}</p>
        {overlay}
      </div>
    );
  }

  const strip = n > 1 && (
    <div className={cn('no-scrollbar flex gap-2 overflow-x-auto', thumbs === 'overlay' ? 'absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/60 via-black/25 to-transparent p-3 pt-8' : 'mt-2.5')}>
      {list.map((src, k) => (
        <motion.button key={src + k} type="button" onClick={(e) => { e.stopPropagation(); c.go(k); }} whileHover={{ y: -2 }} whileTap={{ scale: 0.94 }}
          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl sm:h-14 sm:w-14" aria-label={`${k + 1} / ${n}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl(src)} alt="" className={cn('h-full w-full object-cover transition duration-300', k === c.index ? 'scale-105 opacity-100' : 'opacity-55 hover:opacity-90')} />
          {k === c.index && (
            <motion.span layoutId={`${id}-ring`} transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              className={cn('absolute inset-0 rounded-xl ring-2 ring-inset', thumbs === 'overlay' ? 'ring-white shadow-[0_0_0_3px_rgba(255,255,255,.25)]' : 'ring-brand-500')} />
          )}
        </motion.button>
      ))}
    </div>
  );

  return (
    <div className={className}>
      <div className={cn('group relative overflow-hidden bg-slate-900', frame)}>
        <AnimatePresence initial={false} custom={c.dir}>
          <motion.div key={c.index} custom={c.dir} variants={slide} initial="enter" animate="center" exit="exit"
            drag={n > 1 ? 'x' : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.3}
            onDragStart={() => { dragged.current = true; }}
            onDragEnd={(_, info) => { if (info.offset.x < -50) c.next(); else if (info.offset.x > 50) c.prev(); setTimeout(() => { dragged.current = false; }, 0); }}
            onClick={() => { if (!dragged.current) setZoom(true); }}
            className="absolute inset-0 cursor-zoom-in">
            {fit === 'contain' && (
              // blurred copy fills the frame so portrait / square photos still look clean
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl(list[c.index])} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
            )}
            {/* slow "Ken Burns" zoom while the photo is shown */}
            <motion.div className="absolute inset-0" initial={{ scale: 1 }} animate={{ scale: 1.06 }} transition={{ duration: 9, ease: 'linear' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl(list[c.index])} alt="" draggable={false} className={cn('h-full w-full select-none', fit === 'contain' ? 'object-contain' : 'object-cover')} />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {n > 1 && <>
          <button type="button" onClick={c.prev} aria-label="Previous"
            className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-700 opacity-0 shadow-lg backdrop-blur transition hover:scale-110 hover:bg-white group-hover:opacity-100 sm:block">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={c.next} aria-label="Next"
            className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-700 opacity-0 shadow-lg backdrop-blur transition hover:scale-110 hover:bg-white group-hover:opacity-100 sm:block">
            <ChevronRight className="h-5 w-5" />
          </button>
        </>}

        {/* counter / expand hint + progress dots */}
        <span className={cn('pointer-events-none absolute right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur',
          thumbs === 'overlay' && n > 1 ? 'top-3' : 'bottom-3')}>
          <Expand className="h-3.5 w-3.5" />{n > 1 ? <span className="tabular-nums">{c.index + 1} / {n}</span> : t('common.photos')}
        </span>
        {n > 1 && thumbs !== 'overlay' && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3.5 z-10 flex justify-center gap-1.5">
            {list.map((_, k) => (
              <motion.span key={k} animate={{ width: k === c.index ? 18 : 6, opacity: k === c.index ? 1 : 0.6 }} transition={{ duration: 0.35, ease: EASE }}
                className="h-1.5 rounded-full bg-white shadow" />
            ))}
          </div>
        )}
        {overlay}
        {thumbs === 'overlay' && strip}
      </div>
      {thumbs !== 'overlay' && strip}
      <AnimatePresence>{zoom && <Lightbox images={list} start={c.index} onClose={() => setZoom(false)} />}</AnimatePresence>
    </div>
  );
}

/** "Verified asset" badge with a soft light sweep */
export function VerifiedBadge({ className }) {
  const { t } = useI18n();
  return (
    <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 22, delay: 0.15 }}
      className={cn('relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-1 text-xs font-semibold text-white shadow-md shadow-emerald-500/25', className)}>
      <ShieldCheck className="h-3.5 w-3.5" />{t('scan.verified')}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-sheen bg-gradient-to-r from-transparent via-white/45 to-transparent" />
    </motion.span>
  );
}
