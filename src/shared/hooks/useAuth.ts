/**
 * useAuth hook
 * 
 * Custom hook for authentication state management
 */

'use client';

import { useEffect, useState } from 'react';
import { User } from '../types';
import { onAuthStateChanged } from '../../firebase/services/authService';
import { getCurrentUser } from '../../modules/auth/services/authService';

export interface UseAuthReturn {
  user: User | null;
  uid: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isManagementCompany: boolean;
  isResident: boolean;
}

/**
 * Hook to get current user and auth status
 */
export const useAuth = (): UseAuthReturn => {
  const [uid, setUid] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(async (nextUid) => {
      if (!isMounted) return;

      setUid(nextUid);

      if (!nextUid) {
        setUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const currentUser = await getCurrentUser();
        if (!isMounted) return;
        setUser(currentUser);
      } catch (error) {
        console.error('Error fetching current user:', error);
        if (!isMounted) return;
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return {
    user,
    uid,
    loading,
    isAuthenticated: !!user && !!uid,
    isManagementCompany: user?.role === 'ManagementCompany',
    isResident: user?.role === 'Resident',
  };
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
