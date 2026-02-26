'use client';

import { useAuth } from '@/shared/hooks/useAuth';
import Link from 'next/link';
import { useTranslations } from 'use-intl';

import Loading from '../../../shared/components/ui/loading';
import { useEffect, useState } from 'react';
import { countDocuments } from '@/firebase/services/firestoreService';



function ResidentDashboard() {
  const t = useTranslations('dashboard.resident');
  const { user } = useAuth();
  const name = user?.displayName || user?.email || 'Lietotājs';
  const [stats, setStats] = useState<{ buildings: number; apartments: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user?.companyId) return;
      setLoadingStats(true);
      try {
        const [buildings, apartments] = await Promise.all([
          countDocuments('buildings', [
            // @ts-expect-error
            window.firebaseWhere('companyId', '==', user.companyId)
          ]),
          countDocuments('apartments', [
            // @ts-expect-error
            window.firebaseWhere('companyIds', 'array-contains', user.companyId)
          ]),
        ]);
        setStats({ buildings, apartments });
      } catch {
        setStats({ buildings: 0, apartments: 0 });
      } finally {
        setLoadingStats(false);
      }
    }
    fetchStats();
  }, [user?.companyId]);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 text-white">
      <header className="sticky top-0 z-20 border-b border-slate-700 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{t('welcome', { name })}</h2>
            <p className="mt-1 text-sm text-gray-400">
              {t('intro')}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loadingStats ? (
            <div className="col-span-2 flex items-center justify-center h-32">
              <Loading text={t('loadingStats', { ns: 'dashboard' })} />
            </div>
          ) : (
            <>
            
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">+0.0%</span>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">●</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats?.apartments ?? 0}</p>
                <p className="mt-1 text-sm text-gray-400">{t('totalApartments')}</p>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}


function ManagementDashboard() {
  const t = useTranslations('dashboard.management');
  const { user } = useAuth();
  const name = user?.displayName || user?.email || t('user');
  const [stats, setStats] = useState<{ buildings: number; apartments: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user?.companyId) {
        console.log('Нет companyId у пользователя:', user);
        setLoadingStats(false);
        return;
      }
      setLoadingStats(true);
      try {
        const [buildings, apartments] = await Promise.all([
          countDocuments('buildings', [
            // @ts-expect-error
            window.firebaseWhere('companyId', '==', user.companyId)
          ]),
          countDocuments('apartments', [
            // @ts-expect-error
            window.firebaseWhere('companyIds', 'array-contains', user.companyId)
          ]),
        ]);
        setStats({ buildings, apartments });
      } catch (err) {
        console.error('Ошибка загрузки статистики:', err);
        setStats({ buildings: 0, apartments: 0 });
      } finally {
        setLoadingStats(false);
      }
    }
    fetchStats();
  }, [user?.companyId]);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 text-white">
      <header className="sticky top-0 z-20 border-b border-slate-700 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{t('welcome', { name: name })}</h2>
            <p className="mt-1 text-sm text-gray-400">
                  {t('intro')}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loadingStats ? (
            <div className="col-span-2 flex items-center justify-center h-32">
              <Loading text={t('loadingStats', { ns: 'dashboard' })} />
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">+0.0%</span>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">●</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats?.buildings ?? 0}</p>
                <p className="mt-1 text-sm text-gray-400">{t('totalBuildings')}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">+0.0%</span>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">●</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats?.apartments ?? 0}</p>
                <p className="mt-1 text-sm text-gray-400">{t('totalApartments')}</p>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const t = useTranslations();

  if (loading) {
    return (
      <Loading text={t('loading')} />
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-white text-2xl mb-4">Требуется вход</h1>
          <Link href="/login" className="text-blue-600 hover:text-blue-500">
            Перейти на страницу входа
          </Link>
        </div>
      </div>
    );
  }

  return user.role === 'Resident' ? <ResidentDashboard /> : <ManagementDashboard />;
}
