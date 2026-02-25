'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase/config';

export function useAuthPersist() {
  useEffect(() => {
    console.log('useAuthPersist: Initializing auth state listener');
    
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('useAuthPersist: Auth state changed, user:', user?.email);
      
      if (user) {
        try {
          // User is logged in - save to cookies via API
          const idToken = await user.getIdToken();
          
          console.log('useAuthPersist: Saving auth cookies for user:', user.uid);
          
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
          } else {
            console.log('useAuthPersist: Cookies set successfully');
          }
        } catch (err) {
          console.error('useAuthPersist: Error setting auth cookies:', err);
        }
      } else {
        console.log('useAuthPersist: User logged out, clearing cookies');
        // User is logged out - clear cookies via API
        try {
          await fetch('/api/auth/clear-cookies', {
            method: 'POST',
          });
          console.log('useAuthPersist: Cookies cleared');
        } catch (err) {
          console.error('useAuthPersist: Error clearing auth cookies:', err);
        }
      }
    });

    return () => {
      console.log('useAuthPersist: Cleanup - unsubscribing');
      unsubscribe();
    };
  }, []);
}
