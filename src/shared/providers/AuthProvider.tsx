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
    // Определяем, управляющая ли компания
    const isManagementCompany = user?.role === 'ManagementCompany';
    // 40 минут для управляющей компании, 10 минут для остальных
    const sessionTimeoutMs = isManagementCompany ? 40 * 60 * 1000 : 10 * 60 * 1000;
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        logout();
      }, sessionTimeoutMs);
    };
    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated, user]);

  // Корректное определение isResident: только если не управляющая компания и не владелец
  const isManagementCompany = user?.role === 'ManagementCompany';
  // Можно добавить сюда проверку на ownerEmail, если есть в user
  const isResident =
    user?.role === 'Resident' &&
    !isManagementCompany;

  const value: UseAuthReturn = {
    user,
    uid,
    loading,
    isAuthenticated,
    isManagementCompany,
    isResident,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
