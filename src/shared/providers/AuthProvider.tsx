'use client';


import { ReactNode, useEffect, useRef } from 'react';
import { useAuthPersist } from '@/shared/hooks/useAuthPersist';
import { logout } from '@/modules/auth/services/authService';
import { useAuth } from '@/shared/hooks/useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize auth persistence

  useAuthPersist();

  // Получаем статус авторизации
  const { isAuthenticated } = useAuth();

  // Таймер для авто-logout
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Сбросить таймер
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        logout();
      }, 10 * 60 * 1000); // 10 минут
    };

    // Список событий активности
    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    // Запустить таймер при монтировании
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated]);

  return <>{children}</>;
}
