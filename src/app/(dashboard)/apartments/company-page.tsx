"use client";

import { useAuth } from '@/shared/hooks/useAuth';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApartmentsByCompany } from '@/modules/apartments/services/apartmentsService';
import { getBuildingsByCompany } from '@/modules/invoices/services/buildings/services/buildingsService';
import type { Apartment, Building } from '@/shared/types';

export default function CompanyApartmentsPage() {
  const { user, loading, isManagementCompany } = useAuth();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);

  useEffect(() => {
    if (isManagementCompany && user?.companyId) {
      getApartmentsByCompany(user.companyId).then(setApartments);
      getBuildingsByCompany(user.companyId).then(setBuildings);
    }
  }, [user, isManagementCompany]);

  if (loading) return <div className="text-white">Загрузка...</div>;
  if (!user) return <div className="text-white">Требуется вход</div>;
  if (!isManagementCompany) return <div className="text-white">Нет доступа</div>;

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-400 hover:text-white">
            ← Вернуться
          </Link>
          <h1 className="text-2xl font-bold text-white">Квартиры компании</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid gap-4">
          {apartments.map((apt) => (
            <div key={apt.id} className="rounded-xl border border-slate-700 bg-slate-800 p-6">
              <h3 className="text-lg font-semibold text-white">Квартира {apt.number}</h3>
              <div className="text-gray-400 text-sm mb-1">
                Дом: {buildings.find((b) => b.id === apt.buildingId)?.address || '—'}
              </div>
              {/* Здесь можно добавить управление жильцами, приглашения и т.д. */}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
