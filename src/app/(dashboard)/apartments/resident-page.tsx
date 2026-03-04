"use client";

import { useAuth } from '@/shared/hooks/useAuth';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApartment } from '@/modules/apartments/services/apartmentsService';
import { getBuilding } from '@/modules/invoices/services/buildings/services/buildingsService';
import type { Apartment, Building } from '@/shared/types';
import { useTranslations } from 'use-intl';
import Loading from '../../../shared/components/ui/loading';
import Header from '../../../shared/components/layout/heder';

export default function ResidentApartmentsPage() {
  const { user, loading, isResident } = useAuth();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const t = useTranslations('dashboard.apartments');

  useEffect(() => {
    if (isResident && user?.apartmentId) {
      getApartment(user.apartmentId).then(setApartment);
    }
  }, [user, isResident]);

  useEffect(() => {
    if (apartment?.buildingId) { 
      getBuilding(apartment.buildingId).then(setBuilding);
    }
  }, [apartment]);

  if (loading) return <Loading text={t('loading')} />;
  if (!user) return <div className="text-white">{t('loginRequired')}</div>;
  if (!isResident) return <div className="text-white">{t('noAccess')}</div>;

  return (
      <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-blue-50">
        <Header userName={user?.displayName || user?.email || undefined} />
        <div className="w-full bg-white border-b border-gray-200 py-8 px-6 text-center">
          <h1 className="text-3xl font-bold text-blue-800 mb-2">Laipni lūdzam, {user?.displayName || user?.email || ''}!</h1>
          <p className="text-gray-500 text-lg">Šeit jūs varat pārvaldīt mājas, dzīvokļus un skatīt analītiku.</p>
        </div>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white border border-blue-100 rounded-lg p-8 shadow">
          <h2 className="text-xl font-bold text-white mb-4">{apartment?.number || '—'}</h2>
          <div className="mb-2 text-gray-400">{building?.address || '—'}</div>
          <div className="mb-2 text-gray-400">{building?.managedBy?.companyName || '—'}</div>
        </div>
      </main>
    </div>
  );
}
