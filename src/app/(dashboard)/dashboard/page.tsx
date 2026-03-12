'use client';

import { useAuth } from '@/shared/hooks/useAuth';
import Link from 'next/link';
import ResidentDashboard from './ResidentDashboard';
import ManagementDashboard from './ManagementDashboard';


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