// ...existing code...
import { Invitation, User, InvitationStatus, InvitationGdprMeta, TenantPermission } from '@/shared/types';
import { FIRESTORE_COLLECTIONS, INVITATION_STATUSES, INVITATION_TOKEN_EXPIRY_HOURS } from '@/shared/constants';
import { createDocument, updateDocument, queryDocuments } from '@/firebase/services/firestoreService';
import { generateToken } from '@/shared/lib/utils';
import { registerUser } from '@/modules/auth/services/authService';
import { assignResidentToApartment } from '@/modules/apartments/services/apartmentsService';
import { getUserById } from '@/modules/auth/services/authService';
import { validateEmail } from '@/shared/validation';
// Удалён неиспользуемый импорт
// Удалён дублирующий импорт

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export interface CreateInvitationOptions {
  invitedByUid?: string;
  legalBasisConfirmed: boolean;
  privacyNoticeVersion?: string;
  baseUrl?: string;
  permissions?: import('@/shared/types').TenantPermission[];
}

export interface InvitationDispatchResult {
  invitation: Invitation;
  invitationLink: string;
  mailtoLink: string;
  reusedExisting: boolean;
}

const buildInvitationLink = (token: string, baseUrl?: string): string => {
  const origin = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return `${origin}/accept-invitation?token=${encodeURIComponent(token)}`;
};

// buildInvitationEmail больше не используется

/**
 * Create invitation for a new resident
 */
export const createInvitation = async (
  companyId: string,
  apartmentId: string,
  email: string,
  options: CreateInvitationOptions
): Promise<InvitationDispatchResult> => {
  try {
    const normalizedEmail = normalizeEmail(email);

    if (!validateEmail(normalizedEmail)) {
      throw new Error('Неверный формат email');
    }

    if (!options.legalBasisConfirmed) {
      throw new Error('Не подтверждено правовое основание обработки персональных данных');
    }

    // Генерируем уникальный токен
    const token = generateToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    const retentionUntil = new Date(expiresAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const invitationData: Omit<Invitation, 'id'> = {
      apartmentId,
      email: normalizedEmail,
      status: INVITATION_STATUSES.PENDING,
      token,
      createdAt: now,
      expiresAt,
      ...(options.invitedByUid ? { invitedByUid: options.invitedByUid } : {}),
      ...(options.permissions ? { permissions: options.permissions } : {}),
      gdpr: {
        lawfulBasis: 'contract',
        processingPurpose: 'resident-invitation',
        legalBasisConfirmedAt: now,
        privacyNoticeVersion: options.privacyNoticeVersion ?? 'v1',
        retentionUntil,
      },
    };

    // Сохраняем приглашение
    const id = await createDocument(FIRESTORE_COLLECTIONS.INVITATIONS, invitationData);
    const invitation: Invitation = {
      id,
      ...invitationData,
    };

    // Генерируем ссылку для принятия приглашения
    const invitationLink = buildInvitationLink(token, options.baseUrl);
    // buildInvitationEmail возвращает subject/body, но они не используются

    // Здесь должна быть интеграция с email-сервисом
    // Например, через API или сторонний сервис
    // TODO: реализовать отправку email

    return {
      invitation,
      invitationLink,
      mailtoLink: '', // mailtoLink больше не нужен
      reusedExisting: false,
    };
  } catch (error) {
    console.error('Error creating invitation:', error);
    throw error;
  }
};

/**
 * Get invitation by token
 */
export const getInvitationByToken = async (token: string): Promise<Invitation | null> => {
  if (!token || typeof token !== 'string') {
    console.warn('[getInvitationByToken] Invalid token:', token);
    return null;
  }
  try {
    console.log('[getInvitationByToken] token:', token);
    const results = await queryDocuments(FIRESTORE_COLLECTIONS.INVITATIONS, [
      { field: 'token', operator: '==', value: token },
    ]);
    console.log('[getInvitationByToken] queryDocuments results:', results);

    if (results.length === 0) {
      console.warn('[getInvitationByToken] No invitation found for token:', token);
      return null;
    }

    const invitation = results.length > 0 ? {
      id: results[0].id as string,
      apartmentId: results[0].apartmentId as string,
      email: results[0].email as string,
      status: results[0].status as InvitationStatus,
      token: results[0].token as string,
      createdAt: results[0].createdAt as Date,
      expiresAt: results[0].expiresAt as Date,
      invitedByUid: results[0].invitedByUid as string,
      acceptedAt: results[0].acceptedAt as Date,
      revokedAt: results[0].revokedAt as Date,
      gdpr: results[0].gdpr as InvitationGdprMeta,
      permissions: results[0].permissions as TenantPermission[],
    } : null;
    console.log('[getInvitationByToken] Found invitation:', invitation);

    // Check if invitation has expired
    if (invitation && invitation.expiresAt) {
      const now = new Date();
      const expiresAtDate = new Date(invitation.expiresAt);
      console.log('[getInvitationByToken] expiresAt:', expiresAtDate, 'now:', now);
      if (expiresAtDate < now) {
        console.warn('[getInvitationByToken] Invitation expired:', invitation.id);
        return null; // Invitation expired
      }
    }

    return invitation;
  } catch (error) {
    console.error('Error getting invitation by token:', error);
    throw error;
  }
};

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

    // Create user with Resident role
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

    // Mark invitation as accepted
    await updateDocument(FIRESTORE_COLLECTIONS.INVITATIONS, invitation.id, {
      status: INVITATION_STATUSES.ACCEPTED,
      acceptedAt: new Date(),
      gdpr: {
        ...(invitation.gdpr ?? {}),
        dataSubjectConsentAt: new Date(),
      },
    });

    // Assign resident to apartment
    await assignResidentToApartment(invitation.apartmentId, user.uid);

    return user;
  } catch (error) {
    console.error('Error accepting invitation:', error);
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
    // Разрешаем повторное принятие приглашения, даже если оно уже принято

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

    await updateDocument(FIRESTORE_COLLECTIONS.USERS, user.uid, {
      role: 'Resident',
      apartmentId: invitation.apartmentId,
    });

    await updateDocument(FIRESTORE_COLLECTIONS.INVITATIONS, invitation.id, {
      status: INVITATION_STATUSES.ACCEPTED,
      acceptedAt: new Date(),
      gdpr: {
        ...(invitation.gdpr ?? {}),
        dataSubjectConsentAt: new Date(),
      },
    });

    await assignResidentToApartment(invitation.apartmentId, user.uid);
  } catch (error) {
    console.error('Error accepting invitation for authenticated user:', error);
    throw error;
  }
};

/**
 * Get invitations by company
 */
// Функция getInvitationsByCompany удалена

/**
 * Get pending invitations by company
 */
// Функция getPendingInvitationsByCompany удалена

/**
 * Get invitation by email
 */
export const getInvitationByEmail = async (email: string): Promise<Invitation | null> => {
  try {
    const normalizedEmail = normalizeEmail(email);
    const results = await queryDocuments(FIRESTORE_COLLECTIONS.INVITATIONS, [
      { field: 'email', operator: '==', value: normalizedEmail },
    ]);
    return results.length > 0 ? {
      id: results[0].id as string,
      apartmentId: results[0].apartmentId as string,
      email: results[0].email as string,
      status: results[0].status as InvitationStatus,
      token: results[0].token as string,
      createdAt: results[0].createdAt as Date,
      expiresAt: results[0].expiresAt as Date,
      invitedByUid: results[0].invitedByUid as string,
      acceptedAt: results[0].acceptedAt as Date,
      revokedAt: results[0].revokedAt as Date,
      gdpr: results[0].gdpr as InvitationGdprMeta,
      permissions: results[0].permissions as TenantPermission[],
    } : null;
  } catch (error) {
    console.error('Error getting invitation by email:', error);
    throw error;
  }
};

/**
 * Revoke pending invitation (GDPR: right to object / withdraw processing)
 */
export const revokeInvitation = async (invitationId: string): Promise<void> => {
  try {
    await updateDocument(FIRESTORE_COLLECTIONS.INVITATIONS, invitationId, {
      status: 'revoked',
      revokedAt: new Date(),
    });
  } catch (error) {
    console.error('Error revoking invitation:', error);
    throw error;
  }
};

/**
 * Revoke all pending invitations for apartment
 */
export const revokePendingInvitationsForApartment = async (
  apartmentId: string
): Promise<number> => {
  try {
    const invitations = await queryDocuments(FIRESTORE_COLLECTIONS.INVITATIONS, [
      { field: 'apartmentId', operator: '==', value: apartmentId },
      { field: 'status', operator: '==', value: INVITATION_STATUSES.PENDING },
    ]);
    await Promise.all(invitations.map((inv) => revokeInvitation(String(inv.id))));
    return invitations.length;
  } catch (error) {
    console.error('Error revoking pending invitations for apartment:', error);
    throw error;
  }
};

export type { Invitation };
