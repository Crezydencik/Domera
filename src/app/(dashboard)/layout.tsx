"use client";

import { AdminSidebar } from '@/shared/components/layout/AdminSidebar';
import Header from '@/shared/components/layout/heder';
import { useAuth } from '@/shared/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageTitleProvider, usePageTitle } from '@/shared/context/PageTitleContext';
import { Loader } from '../../shared/components/ui/loading';
import { useTranslations } from 'use-intl';
// ...existing code...

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pageTitle } = usePageTitle();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <Loader text={t('loading')} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <AdminSidebar user={user} open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="md:pl-72">
        <Header
          userName={user.name || user.email || t('user')}
          userEmail={user.email}
          pageTitle={pageTitle || t('resident.welcome', { name: user.name || user.email || t('user') } )}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageTitleProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </PageTitleProvider>
  );
}
