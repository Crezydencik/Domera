"use client";
import { useAuth } from '@/shared/hooks/useAuth';
import ApartmentsManagementPage from './management-page';
import ResidentApartmentsPage from './resident-page';

export default function ApartmentsPage() {
  const { user } = useAuth(); // Получение текущего пользователя из контекста аутентификации

  const isManagementCompany = user?.role === 'ManagementCompany';

  return (
    <div>
      {isManagementCompany ? (
        <ApartmentsManagementPage />
      ) : (
        <ResidentApartmentsPage />
      )}
    </div>
  );
}
