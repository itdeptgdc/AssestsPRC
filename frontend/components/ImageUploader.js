'use client';
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ImagePlus, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { imgUrl, uploadFiles } from '@/lib/api';
import { useI18n } from './providers';
import { cn } from './ui';

export default function ImageUploader({ value = [], onChange, max = 10 }) {
  const { t, te } = useI18n();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const add = async (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/')).slice(0, max - value.length);
    if (!list.length) return;
    setBusy(true);
    try {
      const urls = await uploadFiles(list);
      onChange([...value, ...urls]);
    } catch (e) {
      toast.error(te(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
      className={cn('rounded-2xl border-2 border-dashed p-3 transition', drag ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200 bg-slate-50/50')}
    >
      <div className="flex flex-wrap gap-3">
        <AnimatePresence>
          {value.map((src, i) => (
            <motion.div key={src} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="group relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl(src)} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white opacity-90 transition hover:bg-rose-600 sm:opacity-0 sm:group-hover:opacity-100">
                <X className="h-3.5 w-3.5" />
              </button>
              {i === 0 && <span className="absolute bottom-1 left-1 rounded-md bg-brand-600/90 px-1.5 text-[10px] font-semibold text-white">{t('form.cover')}</span>}
            </motion.div>
          ))}
        </AnimatePresence>
        {value.length < max && (
          <button type="button" onClick={() => input.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-500">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            <span className="text-[11px]">{t('form.add_photo')}</span>
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">{t('form.photo_hint')}</p>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
    </div>
  );
}
