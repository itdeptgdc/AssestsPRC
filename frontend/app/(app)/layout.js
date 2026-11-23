'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { useAuth, useI18n } from '@/components/providers';
import Shell from '@/components/Shell';
import { firstAllowed, requiredPerm } from '@/components/nav';
import { EmptyState, PageLoader } from '@/components/ui';

export default function AppLayout({ children }) {
  const { user, loading, can } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const need = requiredPerm(pathname);
  const allowed = !need || can(need);

  useEffect(() => {
    if (!loading && !user) {
      const here = window.location.pathname + window.location.search;
      router.replace(here === '/' ? '/login' : `/login?next=${encodeURIComponent(here)}`);
    }
  }, [loading, user, router]);

  // dashboard hidden for this role → open the first page they may see
  useEffect(() => {
    if (user && !allowed && pathname === '/') router.replace(firstAllowed(can));
  }, [user, allowed, pathname, can, router]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center"><PageLoader /></div>;
  }
  return (
    <Shell>
      {allowed ? children : pathname === '/' ? <PageLoader /> : <EmptyState icon={ShieldAlert} title={t('errors.forbidden')} text={t('perm.no_access')} />}
    </Shell>
  );
}
