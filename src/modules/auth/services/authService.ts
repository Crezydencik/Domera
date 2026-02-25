/**
 * Auth module service
 * 
 * High-level authentication operations combining Firebase Auth + Firestore
 */

import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import {
  loginUser as firebaseLogin,
  logoutUser as firebaseLogout,
  getCurrentUserId,
  updateUserPassword as firebaseUpdateUserPassword,
} from '@/firebase/services/authService';
import {
  createDocument,
  setDocument,
  getDocumentsByCompany,
  getDocument,
  updateDocument,
  queryDocuments,
} from '@/firebase/services/firestoreService';
import { auth, db } from '@/firebase/config';
import { FIRESTORE_COLLECTIONS, USER_ROLES } from '@/shared/constants';
import { User, AuthCredentials, RegistrationData, PasswordReset } from '@/shared/types';
import { validateEmail, validatePassword } from '@/shared/validation';
import { addDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Register new user with email and password
 */
export const registerUser = async (
  registrationData: RegistrationData,
  role: 'ManagementCompany' | 'Resident',
  companyId: string,
  apartmentId?: string
): Promise<User> => {
  try {
    // Validate inputs
    if (!validateEmail(registrationData.email)) {
      throw new Error('Неверный формат email');
    }

    if (!validatePassword(registrationData.password)) {
      throw new Error('Пароль должен содержать минимум 6 символов');
    }

    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      registrationData.email,
      registrationData.password
    );

    // Create user document in Firestore with known ID (faster than addDoc)
    const userId = userCredential.user.uid;
    const newUser: User = {
      uid: userId,
      email: registrationData.email,
      role: role as any,
      companyId,
      apartmentId,
      createdAt: new Date(),
    };

    // Build user data object - exclude undefined fields
    const userData: any = {
      uid: userId,
      email: registrationData.email,
      role,
      companyId,
      createdAt: newUser.createdAt.toISOString(),
    };

    // Only add apartmentId if it's provided
    if (apartmentId) {
      userData.apartmentId = apartmentId;
    }

    // Use setDocument for faster operation (setDoc vs addDoc)
    await setDocument(FIRESTORE_COLLECTIONS.USERS, userId, userData);

    return newUser;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

/**
 * Login user
 */
export const login = async (credentials: AuthCredentials): Promise<User | null> => {
  try {
    if (!validateEmail(credentials.email)) {
      throw new Error('Неверный формат email');
    }

    // Firebase login
    const authResult = await firebaseLogin(credentials.email, credentials.password);
    
    // Wait a moment for auth state to update
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get current user ID
    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error('Не удалось получить ID пользователя');
    }

    // Get user document from Firestore
    let user = await getUserById(userId);
    
    // If user doesn't exist in Firestore, create a default entry
    if (!user) {
      console.log('Creating user document in Firestore for:', userId);
      const newUserData = {
        uid: userId,
        email: credentials.email,
        role: 'Resident',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      try {
        await setDocument(FIRESTORE_COLLECTIONS.USERS, userId, newUserData);
        user = { id: userId, ...newUserData, createdAt: new Date(newUserData.createdAt), updatedAt: new Date(newUserData.updatedAt) } as User;
      } catch (firestoreError) {
        console.error('Error creating user in Firestore:', firestoreError);
        // User was authenticated in Firebase but failed to create Firestore doc
        // This is not critical for login, so we can proceed
        user = { 
          id: userId, 
          uid: userId, 
          email: credentials.email,
          role: 'Resident',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as User;
      }
    }
    
    return user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
  try {
    await firebaseLogout();
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

/**
 * Get current user from Firestore
 */
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const userId = getCurrentUserId();
    if (!userId) return null;

    return await getUserById(userId);
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string | null): Promise<User | null> => {
  if (!userId) return null;

  try {
    const userDoc = await getDocument(FIRESTORE_COLLECTIONS.USERS, userId);
    if (!userDoc) return null;

    return {
      ...userDoc,
      createdAt: new Date(userDoc.createdAt),
    } as User;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const q = query(
      collection(db, FIRESTORE_COLLECTIONS.USERS),
      where('email', '==', email)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return null;

    const userDoc = querySnapshot.docs[0];
    return {
      ...userDoc.data(),
      createdAt: new Date(userDoc.data().createdAt),
    } as User;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
};

/**
 * Change user password
 */
export const changePassword = async (newPassword: string): Promise<void> => {
  try {
    if (!validatePassword(newPassword)) {
      throw new Error(
        'Пароль должен содержать минимум 8 символов, включая буквы и цифры'
      );
    }

    await firebaseUpdateUserPassword(newPassword);
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email: string): Promise<void> => {
  try {
    if (!validateEmail(email)) {
      throw new Error('Неверный формат email');
    }

    const response = await fetch('/api/auth/send-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error ?? 'Ошибка отправки письма для смены пароля');
    }
  } catch (error) {
    console.error('Error sending password reset:', error);
    throw error;
  }
};

/**
 * Get users by company
 */
export const getUsersByCompany = async (companyId: string): Promise<User[]> => {
  try {
    const users = await getDocumentsByCompany(
      FIRESTORE_COLLECTIONS.USERS,
      companyId
    );

    return users.map((doc) => ({
      ...doc,
      createdAt: new Date(doc.createdAt),
    })) as User[];
  } catch (error) {
    console.error('Error getting users by company:', error);
    return [];
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  userId: string,
  updates: Partial<User>
): Promise<void> => {
  try {
    await updateDocument(FIRESTORE_COLLECTIONS.USERS, userId, {
      ...updates,
      ...(updates.createdAt && { createdAt: updates.createdAt.toISOString() }),
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};
