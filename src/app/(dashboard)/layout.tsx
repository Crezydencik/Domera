"use client";

import { AdminSidebar } from '@/shared/components/layout/AdminSidebar';
import { useAuth } from '@/shared/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from '../../shared/components/ui/loading';
import { useTranslations } from 'use-intl';
// ...existing code...

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations('dashboard'); 
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
        <Loader text={t('loading')} />
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <AdminSidebar user={user} />
      <div className="md:pl-72">
        {/* Верхний хедер полностью убран */}
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}
