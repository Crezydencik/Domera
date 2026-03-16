import { useAuth } from '@/shared/hooks/useAuth';
import { useTranslations } from 'use-intl';
import { useRouter } from 'next/navigation';
import { logout } from '@/modules/auth/services/authService';
import Loading from '../../../shared/components/ui/loading';
import Header from '../../../shared/components/layout/heder';
import { useEffect, useState } from 'react';
import { countDocuments, getDocument } from '@/firebase/services/firestoreService';
import { where } from 'firebase/firestore';

export default function ResidentDashboard() {
  const t = useTranslations('dashboard.resident');
  const { user } = useAuth();
  const router = useRouter();
  const name = user?.displayName || user?.email || 'Lietotājs';
  const [stats, setStats] = useState<{ buildings: number; apartments: number }>({ buildings: 0, apartments: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

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
      <Header
        userName={name}
        userEmail={user?.email}
        // userAvatarUrl={user?.avatarUrl}
        onLogout={handleLogout}
        pageTitle={t('welcome', { name })}
      />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

        </section>
      </main>
    </div>
  );
}
