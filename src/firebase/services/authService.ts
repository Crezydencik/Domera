/**
 * Authentication service
 * 
 * Handles all Firebase Authentication operations:
 * - User login/logout
 * - Password reset
 * - Email verification
 * - Password change
 */

import {
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  Auth,
} from 'firebase/auth';
import { auth } from '../config';

export interface AuthError {
  code: string;
  message: string;
}

/**
 * User login
 */
export const loginUser = async (email: string, password: string): Promise<void> => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    throw formatAuthError(error);
  }
};

/**
 * User logout
 */
export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    throw formatAuthError(error);
  }
};

/**
 * Send password reset email
 */
export const sendPasswordReset = async (email: string): Promise<void> => {
  try {
    const response = await fetch('/api/auth/send-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Ошибка отправки письма для сброса пароля');
    }
  } catch (error) {
    throw formatAuthError(error);
  }
};

/**
 * Update user password
 * Note: User must be authenticated and may need to re-authenticate
 */
export const updateUserPassword = async (newPassword: string): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user is currently authenticated');
    }
    await updatePassword(user, newPassword);
  } catch (error) {
    throw formatAuthError(error);
  }
};

/**
 * Get current user's ID token
 */
export const getCurrentUserToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch (error) {
    console.error('auth.user.token.get.error', error);
    return null;
  }
};

/**
 * Get current user UID
 */
export const getCurrentUserId = (): string | null => {
  return auth.currentUser?.uid || null;
};

/**
 * Get current user email
 */
export const getCurrentUserEmail = (): string | null => {
  return auth.currentUser?.email || null;
};

/**
 * Check if user is authenticated
 */
export const isUserAuthenticated = (): boolean => {
  return auth.currentUser !== null;
};

/**
 * Get auth state listener
 * Returns unsubscribe function
 */
export const onAuthStateChanged = (callback: (uid: string | null) => void) => {
  return auth.onAuthStateChanged((user) => {
    callback(user?.uid || null);
  });
};

/**
 * Format Firebase auth errors to user-friendly messages
 */
const formatAuthError = (error: any): AuthError => {
  const code = error.code || 'auth/unknown-error';
  const errors: Record<string, string> = {
    'auth/invalid-email': 'Invalid email format',
    'auth/user-not-found': 'User not found',
    'auth/wrong-password': 'Incorrect password',
    'auth/user-disabled': 'Account has been disabled',
    'auth/email-already-in-use': 'Email already in use',
    'auth/weak-password': 'Password is too weak',
    'auth/operation-not-allowed': 'Operation not allowed',
    'auth/too-many-requests': 'Too many requests. Please try later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/invalid-credential': 'Invalid login credentials',
  };

  return {
    code,
    message: errors[code] || error.message || 'Authentication error',
  };
};

export type { Auth };
