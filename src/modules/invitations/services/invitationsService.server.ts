'use server';

/**
 * Server-only invitation service
 * 
 * Contains functions that use Firebase Admin SDK and must only run on the server.
 * Import from here only in API routes and server actions.
 */

import { getFirebaseAdminDb } from '@/firebase/admin';
import { FIRESTORE_COLLECTIONS, INVITATION_STATUSES } from '@/shared/constants';
import { User } from '@/shared/types';
import { toSafeErrorDetails } from '@/shared/lib/safeLog';
import { registerUser } from '@/modules/auth/services/authService';
import { assignResidentToApartment } from '@/modules/apartments/services/apartmentsService';
import { createNotification } from '@/modules/notifications/services/notificationsService';
import { getInvitationByToken, syncApartmentOwnerEmailIfNeeded } from './invitationsService';
import { getUserById } from '@/modules/auth/services/authService';
import { normalizeEmail } from '@/shared/lib/invitationToken';
import type { Invitation } from '@/shared/types';

/**
 * Accept invitation and create resident user
 */
export const acceptInvitation = async (
  token: string,
  password: string,
  dataSubjectConsentConfirmed: boolean
): Promise<User> => {
  try {
    if (!dataSubjectConsentConfirmed) {
      throw new Error('Необходимо согласие на обработку персональных данных');
    }

    const invitation = await getInvitationByToken(token);

    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }

    if (invitation.status !== INVITATION_STATUSES.PENDING) {
      throw new Error('Invitation already used or not active');
    }

    // Create user with Resident role first (Firebase Auth user creation cannot be in a transaction)
    const user = await registerUser(
      {
        email: invitation.email,
        password,
        token,
      },
      'Resident',
      '', // companyId отсутствует
      invitation.apartmentId
    );

    // Atomically re-check status and mark accepted to prevent double-acceptance
    const db = getFirebaseAdminDb();
    const invRef = db.collection(FIRESTORE_COLLECTIONS.INVITATIONS).doc(invitation.id);
    const now = new Date();
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(invRef);
      const currentStatus = snap.data()?.status;
      if (currentStatus !== INVITATION_STATUSES.PENDING) {
        throw new Error('Invitation already used or not active');
      }
      tx.update(invRef, {
        status: INVITATION_STATUSES.ACCEPTED,
        acceptedAt: now,
        gdpr: {
          ...(invitation.gdpr ?? {}),
          dataSubjectConsentAt: now,
        },
      });
    });

    // Assign resident to apartment
    await assignResidentToApartment(invitation.apartmentId, user.uid);

    // Sync primary owner email with accepted invitation email
    await syncApartmentOwnerEmailIfNeeded(invitation.apartmentId, invitation.email);

    // Create notification about joining apartment
    try {
      await createNotification(
        user.uid,
        'apartment-joined',
        'Присоединение к квартире',
        `Вы успешно зарегистрировались и присоединились к квартире.`,
        { apartmentId: invitation.apartmentId }
      );
    } catch (notifErr) {
      console.warn('Error creating notification:', toSafeErrorDetails(notifErr));
      // Don't throw, notification failure shouldn't block the flow
    }

    return user;
  } catch (error) {
    console.error('Error accepting invitation:', toSafeErrorDetails(error));
    throw error;
  }
};

/**
 * Accept invitation for already authenticated existing user
 */
export const acceptInvitationForAuthenticatedUser = async (
  token: string,
  authenticatedUserId: string,
  dataSubjectConsentConfirmed: boolean
): Promise<void> => {
  try {
    if (!dataSubjectConsentConfirmed) {
      throw new Error('Необходимо согласие на обработку персональных данных');
    }

    if (!authenticatedUserId) {
      throw new Error('Требуется авторизация пользователя');
    }

    const invitation = await getInvitationByToken(token);

    if (!invitation) {
      throw new Error('Приглашение недействительно или истекло');
    }

    if (invitation.status !== INVITATION_STATUSES.PENDING) {
      throw new Error('Приглашение уже использовано или недоступно');
    }

    const user = await getUserById(authenticatedUserId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    const invitationEmail = normalizeEmail(invitation.email);
    const userEmail = normalizeEmail(user.email);

    if (invitationEmail !== userEmail) {
      throw new Error('Приглашение выдано на другой email. Войдите под нужным аккаунтом.');
    }

    if (user.role === 'ManagementCompany') {
      throw new Error('Нельзя принять приглашение жильца из аккаунта управляющей компании');
    }

    // Atomically re-check invitation status and update both user + invitation in one transaction
    const db = getFirebaseAdminDb();
    const invRef = db.collection(FIRESTORE_COLLECTIONS.INVITATIONS).doc(invitation.id);
    const userRef = db.collection(FIRESTORE_COLLECTIONS.USERS).doc(user.uid);
    const now = new Date();
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(invRef);
      const currentStatus = snap.data()?.status;
      if (currentStatus !== INVITATION_STATUSES.PENDING) {
        throw new Error('Приглашение уже использовано или недоступно');
      }
      tx.update(userRef, { role: 'Resident', apartmentId: invitation.apartmentId });
      tx.update(invRef, {
        status: INVITATION_STATUSES.ACCEPTED,
        acceptedAt: now,
        gdpr: {
          ...(invitation.gdpr ?? {}),
          dataSubjectConsentAt: now,
        },
      });
    });

    await assignResidentToApartment(invitation.apartmentId, user.uid);

    // Sync primary owner email with accepted invitation email
    await syncApartmentOwnerEmailIfNeeded(invitation.apartmentId, invitation.email);

    // Create notification about joining apartment
    try {
      await createNotification(
        authenticatedUserId,
        'apartment-joined',
        'Присоединение к квартире',
        `Вы успешно присоединились к квартире.`,
        { apartmentId: invitation.apartmentId }
      );
    } catch (notifErr) {
      console.warn('Error creating notification:', toSafeErrorDetails(notifErr));
      // Don't throw, notification failure shouldn't block the flow
    }
  } catch (error) {
    console.error('Error accepting invitation for authenticated user:', toSafeErrorDetails(error));
    throw error;
  }
};
