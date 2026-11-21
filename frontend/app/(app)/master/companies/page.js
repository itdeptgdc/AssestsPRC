'use client';
import { Landmark } from 'lucide-react';
import { useI18n } from '@/components/providers';
import CrudPage from '@/components/CrudPage';

export default function CompaniesPage() {
  const { t } = useI18n();
  return (
    <CrudPage
      endpoint="/companies"
      title={t('nav.companies')}
      subtitle={t('master.companies_sub')}
      icon={Landmark}
      fields={[
        { key: 'code', label: t('master.company_code'), required: true, mono: true, placeholder: 'P' },
        { key: 'name', label: t('master.name'), required: true, placeholder: 'Poipet Resort' },
        { key: 'active', label: t('common.active'), type: 'toggle' },
      ]}
    />
  );
}
