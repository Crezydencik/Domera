"use client";

import { AdminSidebar } from '@/shared/components/layout/AdminSidebar';
import { useAuth } from '@/shared/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
// ...existing code...

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        Загрузка...
      </div>
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
