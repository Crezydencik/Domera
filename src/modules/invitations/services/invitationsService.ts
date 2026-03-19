// ...existing code...
import { Invitation, InvitationStatus, InvitationGdprMeta, TenantPermission } from '@/shared/types';
import { FIRESTORE_COLLECTIONS, INVITATION_STATUSES, INVITATION_TOKEN_EXPIRY_HOURS } from '@/shared/constants';
import { createDocument, updateDocument, queryDocuments, getDocument } from '@/firebase/services/firestoreService';
import { generateToken } from '@/shared/lib/utils';
import { validateEmail } from '@/shared/validation';
import { toSafeErrorDetails } from '@/shared/lib/safeLog';
import { hashInvitationToken, normalizeEmail } from '@/shared/lib/invitationToken';

export const syncApartmentOwnerEmailIfNeeded = async (
  apartmentId: string,
  invitationEmail: string
): Promise<void> => {
  const normalizedInvitationEmail = normalizeEmail(invitationEmail);
  const apartment = await getDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId);
  const currentOwnerEmailRaw = (apartment as { ownerEmail?: unknown } | null)?.ownerEmail;
  const currentOwnerEmail = typeof currentOwnerEmailRaw === 'string'
    ? normalizeEmail(currentOwnerEmailRaw)
    : '';

  if (currentOwnerEmail !== normalizedInvitationEmail) {
    await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId, {
      ownerEmail: normalizedInvitationEmail,
    });
  }
};

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

    await syncApartmentOwnerEmailIfNeeded(apartmentId, normalizedEmail);

    // Генерируем уникальный токен
    const token = generateToken();
    const tokenHash = await hashInvitationToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    const retentionUntil = new Date(expiresAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const invitationData: Omit<Invitation, 'id'> = {
      companyId,
      apartmentId,
      email: normalizedEmail,
      status: INVITATION_STATUSES.PENDING,
      tokenHash,
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
    console.error('Error creating invitation:', toSafeErrorDetails(error));
    throw error;
  }
};

/**
 * Get invitation by token
 *
 * NOTE: This function is exported for use in server-only context via invitationsService.server.ts
 */
export const getInvitationByToken = async (token: string): Promise<Invitation | null> => {
  if (!token || typeof token !== 'string') {
    console.warn('[getInvitationByToken] Invalid token');
    return null;
  }
  try {
    const tokenHash = await hashInvitationToken(token);

    const results = await queryDocuments(FIRESTORE_COLLECTIONS.INVITATIONS, [
      { field: 'tokenHash', operator: '==', value: tokenHash },
    ]);

    if (results.length === 0) {
      console.warn('[getInvitationByToken] No invitation found for token');
      return null;
    }

    const invitation = results.length > 0 ? {
      id: results[0].id as string,
      companyId: results[0].companyId as string,
      apartmentId: results[0].apartmentId as string,
      email: results[0].email as string,
      status: results[0].status as InvitationStatus,
      tokenHash: results[0].tokenHash as string | undefined,
      createdAt: results[0].createdAt as Date,
      expiresAt: results[0].expiresAt as Date,
      invitedByUid: results[0].invitedByUid as string,
      acceptedAt: results[0].acceptedAt as Date,
      revokedAt: results[0].revokedAt as Date,
      gdpr: results[0].gdpr as InvitationGdprMeta,
      permissions: results[0].permissions as TenantPermission[],
    } : null;
    // Check if invitation has expired
    if (invitation && invitation.expiresAt) {
      const now = new Date();
      const expiresAtDate = new Date(invitation.expiresAt);
      if (expiresAtDate < now) {
        console.warn('[getInvitationByToken] Invitation expired:', invitation.id);
        return null; // Invitation expired
      }
    }

    return invitation;
  } catch (error) {
    console.error('Error getting invitation by token:', toSafeErrorDetails(error));
    throw error;
  }
};

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
      companyId: results[0].companyId as string,
      apartmentId: results[0].apartmentId as string,
      email: results[0].email as string,
      status: results[0].status as InvitationStatus,
      tokenHash: results[0].tokenHash as string | undefined,
      createdAt: results[0].createdAt as Date,
      expiresAt: results[0].expiresAt as Date,
      invitedByUid: results[0].invitedByUid as string,
      acceptedAt: results[0].acceptedAt as Date,
      revokedAt: results[0].revokedAt as Date,
      gdpr: results[0].gdpr as InvitationGdprMeta,
      permissions: results[0].permissions as TenantPermission[],
    } : null;
  } catch (error) {
    console.error('Error getting invitation by email:', toSafeErrorDetails(error));
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
    console.error('Error revoking invitation:', toSafeErrorDetails(error));
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
    console.error('Error revoking pending invitations for apartment:', toSafeErrorDetails(error));
    throw error;
  }
};

export type { Invitation };

/**
 * Get all invitations for a company
 */
export const getInvitationsByCompany = async (companyId: string): Promise<Invitation[]> => {
  try {
    const docs = await queryDocuments(FIRESTORE_COLLECTIONS.INVITATIONS, [
      { field: 'companyId', operator: '==', value: companyId },
    ]);
    return docs as unknown as Invitation[];
  } catch (error) {
    console.error('Error getting invitations by company:', toSafeErrorDetails(error));
    throw error;
  }
};
