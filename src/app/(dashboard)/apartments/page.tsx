"use client";

import { usePageTitle } from '@/shared/context/PageTitleContext';
import { useAuth } from '@/shared/hooks/useAuth';
import ApartmentsManagementPage from './management-page';
import ResidentApartmentsPage from './resident-page';
import React from 'react';
import { useTranslations } from 'next-intl';

export default function ApartmentsPage() {
  
  const { setPageTitle } = usePageTitle();
  const th = useTranslations();
  React.useEffect(() => { setPageTitle(th('dashboard.apartments.section')); }, [setPageTitle]);
  const { user } = useAuth();
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