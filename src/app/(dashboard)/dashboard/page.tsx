
  'use client';
  import { useAuth } from '@/shared/hooks/useAuth';
  import Link from 'next/link';
  import { useTranslations } from 'use-intl';
  import dynamic from 'next/dynamic';

  const ResidentDashboard = dynamic(() => import('./ResidentDashboard'));
  const ManagementDashboard = dynamic(() => import('./ManagementDashboard'));
export default function DashboardPage() {
  const { user, loading } = useAuth();
  const t = useTranslations();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-blue-400 text-lg font-semibold">{t('dashboard.loading')}</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-white text-2xl mb-4">{t('dashboard.noUser')}</h1>
          <Link href="/login" className="text-blue-600 hover:text-blue-500">
            {t('dashboard.login')}
          </Link>
        </div>
      </div>
    );
  }

  return user.role === 'Resident' ? <ResidentDashboard /> : <ManagementDashboard />;
}
