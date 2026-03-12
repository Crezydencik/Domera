import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAuth } from '../../../shared/hooks/useAuth';
import { useEffect, useState } from 'react';
import { getApartmentsFromDatabase } from '../../../modules/apartments/services/apartmentsService';


export default function ResidentDashboard() {
  const t = useTranslations('dashboard.resident');
  const { user } = useAuth();
  const name = user?.displayName || user?.email || 'Lietotājs';
  const [apartmentCount, setApartmentCount] = useState<number>(0);

  useEffect(() => {
    if (user?.uid) {
      getApartmentsFromDatabase().then((apartments) => {
        const count = apartments.filter((a) => a.id === user.uid).length;
        setApartmentCount(count);
      });
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
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
          {[{ title: t('totalApartments'), value: apartmentCount.toString(), change: '', color: 'bg-emerald-500' }].map((card) => (
            <div key={card.title} className="rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">{card.change}</span>
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${card.color} text-white`}>●</span>
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="mt-1 text-sm text-gray-400">{card.title}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
