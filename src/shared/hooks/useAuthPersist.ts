
// Позволяет использовать alias @ для импорта из src
'use client';

import { useEffect, useRef } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { toSafeErrorDetails } from '@/shared/lib/safeLog';

export function useAuthPersist() {
  const lastPersistedToken = useRef<string | null>(null);

  useEffect(() => {
    // Listen to ID token changes (includes auth state changes + token refresh)
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (user) {
        try {
          // User is logged in - save session cookie via API
          const idToken = await user.getIdToken();
          if (!idToken || lastPersistedToken.current === idToken) {
            return;
          }

          // Call API to set auth cookies
          const response = await fetch('/api/auth/set-cookies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.uid,
              email: user.email,
              idToken,
            }),
          });
          
          if (!response.ok) {
            console.error('useAuthPersist: Failed to set cookies:', response.status);
            return;
          }

          lastPersistedToken.current = idToken;
        } catch (err) {
                    console.error('useAuthPersist: Error setting auth cookies:', toSafeErrorDetails(err));
        }
      } else {
        // User is logged out - clear cookies via API
        lastPersistedToken.current = null;
        try {
          await fetch('/api/auth/clear-cookies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revokeSession: true }),
          });
        } catch (err) {
                    console.error('useAuthPersist: Error clearing auth cookies:', toSafeErrorDetails(err));
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);
}
