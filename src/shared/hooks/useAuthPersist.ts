
// Позволяет использовать alias @ для импорта из src
'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { toSafeErrorDetails } from '@/shared/lib/safeLog';

export function useAuthPersist() {
  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // User is logged in - save to cookies via API
          const idToken = await user.getIdToken();

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
          }
        } catch (err) {
                    console.error('useAuthPersist: Error setting auth cookies:', toSafeErrorDetails(err));
        }
      } else {
        // User is logged out - clear cookies via API
        try {
          await fetch('/api/auth/clear-cookies', {
            method: 'POST',
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
