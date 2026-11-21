'use client';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useI18n } from '@/components/providers';
import { useApi } from '@/lib/hooks';
import { EmptyState, PageHeader, PageLoader } from '@/components/ui';
import AssetForm from '@/components/AssetForm';

export default function EditAssetPage({ params }) {
  const { t } = useI18n();
  const { data, loading, error } = useApi(`/assets/${params.id}`);
  if (loading) return <PageLoader />;
  if (error || !data) return <EmptyState title={t('errors.not_found')} />;
  return (
    <div>
      <PageHeader
        back={<Link href={`/assets/${params.id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"><ChevronLeft className="h-4 w-4" />{data.code}</Link>}
        title={t('form.edit_title')}
        subtitle={data.name}
      />
      <AssetForm asset={data} />
    </div>
  );
}
