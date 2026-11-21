'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { api, getToken } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { ScanNotFound, ScanResult } from '@/components/ScanResult';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import Logo from '@/components/Logo';
import { PageLoader } from '@/components/ui';

/** Public page opened by scanning a QR label (no login required) */
export default function PublicAssetPage({ params }) {
  const { t } = useI18n();
  const code = decodeURIComponent(params.code);
  const [a, setA] = useState(null);
  const [state, setState] = useState('loading');
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!getToken());
    api(`/public/asset/${encodeURIComponent(code)}`)
      .then((d) => { setA(d); setState('ok'); })
      .catch(() => setState('missing'));
  }, [code]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-violet-50">
      <div className="mx-auto flex max-w-3xl items-center justify-between p-4">
        <Logo title="Asset PRC" subtitle={t('app.tagline')} />
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <ThemeToggle />
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 pb-10">
        {state === 'loading' && <PageLoader />}
        {state === 'missing' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6 sm:p-8">
            <ScanNotFound code={code} />
          </motion.div>
        )}
        {state === 'ok' && a && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-4 sm:p-6">
            <ScanResult asset={a}>
              <Link href={authed ? `/assets/${a.id}` : `/login?next=${encodeURIComponent(`/assets/${a.id}`)}`} className="btn btn-primary w-full py-3">
                {authed ? t('public.open_system') : t('public.login_to_manage')} <ArrowRight className="h-4 w-4" />
              </Link>
            </ScanResult>
          </motion.div>
        )}
      </div>
    </div>
  );
}
