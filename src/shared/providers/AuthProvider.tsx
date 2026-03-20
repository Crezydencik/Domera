'use client';

import { createContext, useContext, ReactNode, useEffect, useRef, useState } from 'react';
import { useAuthPersist } from '@/shared/hooks/useAuthPersist';
import { logout, getCurrentUser } from '@/modules/auth/services/authService';
import { onAuthStateChanged } from '@/firebase/services/authService';
import { User } from '@/shared/types';

export interface UseAuthReturn {
  user: User | null;
  uid: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isManagementCompany: boolean;
  isResident: boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<UseAuthReturn | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  useAuthPersist();

  const [uid, setUid] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshUser = async () => {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

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
        console.error('AuthProvider: Error fetching current user:', error);
        if (!isMounted) return;
        setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Авто-logout по неактивности
  const isAuthenticated = !!user && !!uid;
  useEffect(() => {
    if (!isAuthenticated) return;
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        logout();
      }, 10 * 60 * 1000); // 10 минут
    };
    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated]);

  const value: UseAuthReturn = {
    user,
    uid,
    loading,
    isAuthenticated,
    isManagementCompany: user?.role === 'ManagementCompany',
    isResident: user?.role === 'Resident',
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
