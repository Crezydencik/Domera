"use client";

import { useAuth } from '@/shared/hooks/useAuth';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApartment } from '@/modules/apartments/services/apartmentsService';
import { getBuilding } from '@/modules/invoices/services/buildings/services/buildingsService';
import type { Apartment, Building } from '@/shared/types';
import { useTranslations } from 'use-intl';
import Loading from '../../../shared/components/ui/loading';
import Header from '../../../shared/components/layout/header';
import Heder from '../../../shared/components/layout/heder';

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
      <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800">
        <Header userName={user?.displayName || user?.email || undefined} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
          <h2 className="text-xl font-bold text-white mb-4">{apartment?.number || '—'}</h2>
          <div className="mb-2 text-gray-400">{building?.address || '—'}</div>
          <div className="mb-2 text-gray-400">{building?.managedBy?.companyName || '—'}</div>
        </div>
      </main>
    </div>
  );
}
