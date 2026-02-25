'use client';

import { useAuth } from '@/shared/hooks/useAuth';
import Link from 'next/link';

function ResidentDashboard() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 text-white">
      <header className="sticky top-0 z-20 border-b border-slate-700 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Добро пожаловать, Резидент!</h2>
            <p className="mt-1 text-sm text-gray-400">
              Здесь вы можете просматривать информацию о вашем жилье и управлять своими счетами.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[{ title: 'Всего зданий', value: '1', change: '+0.0%', color: 'bg-emerald-500' }].map((card) => (
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

function ManagementDashboard() {
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
          {[{ title: 'Всего зданий', value: '1', change: '+0.0%', color: 'bg-emerald-500' }].map((card) => (
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

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="text-gray-400 mt-4">Загрузка...</p>
        </div>
      </div>
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
