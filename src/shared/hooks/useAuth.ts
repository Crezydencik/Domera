/**
 * useAuth hook
 *
 * Читает из общего AuthContext (AuthProvider).
 * Данные загружаются один раз на уровне провайдера и доступны во всех компонентах.
 */

'use client';

import { useContext, useEffect } from 'react';
import { AuthContext, UseAuthReturn } from '../providers/AuthProvider';

export type { UseAuthReturn };

/**
 * Hook to get current user and auth status
 */
export const useAuth = (): UseAuthReturn => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
};

/**
 * Hook to check if user has access to a resource
 */
export const useHasCompanyAccess = (requiredCompanyId: string): boolean => {
  const { user, loading } = useAuth();

  if (loading) return false;

  return user?.companyId === requiredCompanyId;
};

/**
 * Hook to check if user is resident of an apartment
 */
export const useIsResidentOfApartment = (apartmentId: string): boolean => {
  const { user, loading } = useAuth();

  if (loading) return false;

  return user?.role === 'Resident' && user?.apartmentId === apartmentId;
};

/**
 * Hook to require authentication
 */
export const useRequireAuth = (redirectUrl: string = '/login'): boolean => {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = redirectUrl;
      }
    }
  }, [loading, isAuthenticated, redirectUrl]);

  return isAuthenticated && !loading;
};

/**
 * Hook to require specific role
 */
export const useRequireRole = (
  requiredRole: 'ManagementCompany' | 'Resident' | 'Accountant',
  redirectUrl: string = '/login'
): boolean => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user?.role !== requiredRole) {
      if (typeof window !== 'undefined') {
        window.location.href = redirectUrl;
      }
    }
  }, [loading, user, requiredRole, redirectUrl]);

  return user?.role === requiredRole && !loading;
};
