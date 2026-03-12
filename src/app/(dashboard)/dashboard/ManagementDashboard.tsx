import { useAuth } from '@/shared/hooks/useAuth';
import { useEffect, useState } from 'react';
import { getBuildingsByCompany } from '@/modules/invoices/services/buildings/services/buildingsService';
import { getApartmentsByCompany } from '@/modules/apartments/services/apartmentsService';

export default function ManagementDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<{ buildings: number; apartments: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user?.companyId) {
        setStats({ buildings: 0, apartments: 0 });
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [buildings, apartments] = await Promise.all([
          getBuildingsByCompany(user.companyId),
          getApartmentsByCompany(user.companyId),
        ]);
        setStats({ buildings: buildings.length, apartments: apartments.length });
      } catch {
        setStats({ buildings: 0, apartments: 0 });
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [user?.companyId]);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 text-white">
      <header className="sticky top-0 z-20 border-b border-slate-700 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Добро пожаловать, Управляющий!</h2>
            <p className="mt-1 text-sm text-gray-400">
              Здесь вы можете управлять зданиями, квартирами и просматривать аналитические данные.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loading || !stats ? (
            <div className="col-span-2 text-center text-gray-400">Загрузка статистики...</div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">&nbsp;</span>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">🏢</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats.buildings}</p>
                <p className="mt-1 text-sm text-gray-400">Всего зданий</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">&nbsp;</span>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white">🏠</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats.apartments}</p>
                <p className="mt-1 text-sm text-gray-400">Всего квартир</p>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
