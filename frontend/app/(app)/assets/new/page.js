'use client';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useI18n } from '@/components/providers';
import { PageHeader } from '@/components/ui';
import AssetForm from '@/components/AssetForm';

export default function NewAssetPage() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader
        back={<Link href="/assets" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"><ChevronLeft className="h-4 w-4" />{t('form.back')}</Link>}
        title={t('form.new_title')}
        subtitle={t('form.new_sub')}
      />
      <AssetForm />
    </div>
  );
}
