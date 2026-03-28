import { useAuth } from '@/shared/hooks/useAuth';
import { useTranslations } from 'use-intl';
import { useRouter } from 'next/navigation';
import { logout } from '@/modules/auth/services/authService';
import Loading from '../../../shared/components/ui/loading';
import Header from '../../../shared/components/layout/heder';
import { useEffect, useState } from 'react';
import { getApartmentsByResidentId, getApartment } from '@/modules/apartments/services/apartmentsService';
import { getMeterReadingsByApartmentAndPeriod } from '@/modules/meters/services/metersService';
import { getCurrentMonthYear } from '@/shared/lib/utils';
import { countDocuments, getDocument } from '@/firebase/services/firestoreService';
import { where } from 'firebase/firestore';

export default function ResidentDashboard() {
  const t = useTranslations('dashboard');
  const ts = useTranslations('system');
  const { user } = useAuth();
  const router = useRouter();
  const name = user?.displayName || user?.email || 'Lietotājs';
  const [stats, setStats] = useState<{ buildings: number; apartments: number }>({ buildings: 0, apartments: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [hasCurrentReading, setHasCurrentReading] = useState<boolean | null>(null);
  const [apartmentAddresses, setApartmentAddresses] = useState<string>('');
  useEffect(() => {
    async function checkCurrentReadingAndAddresses() {
      if (!user) return;
      let apartmentIds: string[] = [];
      if (user.apartmentIds && user.apartmentIds.length > 0) {
        apartmentIds = user.apartmentIds;
      } else if (user.apartmentId) {
        apartmentIds = [user.apartmentId];
      }
      // Получаем адреса квартир
      if (apartmentIds.length > 0) {
        const apartments = await Promise.all(apartmentIds.map(id => getApartment(id)));
        const addresses = apartments
          .filter(Boolean)
          .map(a => `${a?.address ? a.address + ', ' : ''}${a?.number ? 'кв. ' + a.number : ''}`.trim())
          .filter(Boolean)
          .join(', ');
        setApartmentAddresses(addresses);
        // Проверяем показания только по первой квартире (или можно по всем)
        const { month, year } = getCurrentMonthYear();
        const readings = await getMeterReadingsByApartmentAndPeriod(apartmentIds[0], month, year);
        setHasCurrentReading(readings.length > 0);
      } else {
        setApartmentAddresses('');
        setHasCurrentReading(null);
      }
    }
    checkCurrentReadingAndAddresses();
  }, [user?.apartmentId, user?.apartmentIds]);

  useEffect(() => {
    async function fetchStats() {
      setLoadingStats(true);
      // Если нет apartmentId или квартира не найдена — просто показываем 0
      if (!user?.apartmentId) {
        setStats({ buildings: 0, apartments: 0 });
        setLoadingStats(false);
        return;
      }
      try {
        const apartment = await getDocument('apartments', user.apartmentId);
        if (!apartment || !apartment.companyId) {
          setStats({ buildings: 0, apartments: 0 });
          setLoadingStats(false);
          return;
        }
        const [buildings, apartmentsCount] = await Promise.all([
          countDocuments('buildings', [
            where('companyId', '==', apartment.companyId)
          ]),
          countDocuments('apartments', [
            where('companyIds', 'array-contains', apartment.companyId)
          ]),
        ]);
        setStats({ buildings, apartments: apartmentsCount });
      } catch {
        setStats({ buildings: 0, apartments: 0 });
      } finally {
        setLoadingStats(false);
      }
    }
    fetchStats();
  }, [user?.apartmentId]);

  const handleLogout = async () => {
    await logout();
    await fetch('/api/auth/clear-cookies', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-blue-50">
      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Кнопка подачи/просмотра показаний */}
        {/* <div className="mb-10 flex justify-center items-center min-h-[320px]">
          {hasCurrentReading !== null && (
            <div className="w-full max-w-lg rounded-2xl shadow-md bg-white border border-blue-100 p-8 flex flex-col items-center justify-center" style={{ boxShadow: '0 4px 24px 0 rgba(34, 197, 94, 0.08)' }}>
              <div className="text-2xl font-bold text-blue-800 mb-3 text-center">
                {hasCurrentReading
                  ? t('waterBlockTitleDone')
                  : t('waterBlockTitleNew')}
              </div>
              <div className="text-gray-600 text-center mb-7 text-base">
                {hasCurrentReading
                  ? t('waterBlockDescDone')
                  : t('waterBlockDescNew')}
              </div>
              <a
                href="/dashboard/meter-readings"
                className={`w-full mt-2 h-14 flex items-center justify-center rounded-xl font-bold transition text-xl text-center shadow-sm ${hasCurrentReading ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                style={{ minHeight: 56, maxWidth: 340 }}
              >
                {hasCurrentReading ? t('waterBlockBtnDone') : t('waterBlockBtnNew')}
              </a>
            </div>
          )}
        </div> */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        </section>
      </main>
    </div>
  );
}
