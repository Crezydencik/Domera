"use client";

import { useAuth } from '@/shared/hooks/useAuth';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApartment } from '@/modules/apartments/services/apartmentsService';
import { getBuilding } from '@/modules/invoices/services/buildings/services/buildingsService';
import type { Apartment, Building } from '@/shared/types';

export default function ResidentApartmentsPage() {
  const { user, loading, isResident } = useAuth();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);

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

  if (loading) return <div className="text-white">Загрузка...</div>;
  if (!user) return <div className="text-white">Требуется авторизация</div>;
  if (!isResident) return <div className="text-white">Нет доступа</div>;

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-400 hover:text-white">
            ← Назад
          </Link>
          <h1 className="text-2xl font-bold text-white">Моя квартира</h1>
        </div>
      </header>
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
