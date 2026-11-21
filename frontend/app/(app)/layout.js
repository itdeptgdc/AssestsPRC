'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import Shell from '@/components/Shell';
import { PageLoader } from '@/components/ui';

export default function AppLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const here = window.location.pathname + window.location.search;
      router.replace(here === '/' ? '/login' : `/login?next=${encodeURIComponent(here)}`);
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center"><PageLoader /></div>;
  }
  return <Shell>{children}</Shell>;
}
