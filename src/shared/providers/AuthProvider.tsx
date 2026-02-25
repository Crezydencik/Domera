'use client';

import { ReactNode } from 'react';
import { useAuthPersist } from '@/shared/hooks/useAuthPersist';

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize auth persistence
  useAuthPersist();

  return <>{children}</>;
}
