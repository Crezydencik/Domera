import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/firebase/admin';
import { requireRequestAuth, toAuthErrorResponse } from '@/shared/lib/serverAuth';
import { hashInvitationToken, normalizeEmail } from '@/shared/lib/invitationToken';
import { buildRateLimitKey, consumeRateLimit } from '@/shared/lib/rateLimit';
import { writeAuditEvent } from '@/shared/lib/auditLog';

interface AcceptInvitationPayload {
  token: string;
  password?: string;
  gdprConsent: boolean;
}

type InvitationDoc = {
  email?: string;
  apartmentId?: string;
  status?: string;
  gdpr?: Record<string, unknown>;
  expiresAt?: Date | Timestamp | string;
};

const toDateOrNull = (value: InvitationDoc['expiresAt']): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getInvitationByToken = async (token: string) => {
  const db = getFirebaseAdminDb();
  const tokenHash = await hashInvitationToken(token);

  const snapshot = await db
    .collection('invitations')
    .where('tokenHash', '==', tokenHash)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...(doc.data() as InvitationDoc) };
};

const markInvitationAccepted = async (invitationId: string, gdpr: Record<string, unknown> = {}) => {
  const db = getFirebaseAdminDb();
  await db.collection('invitations').doc(invitationId).set(
    {
      status: 'accepted',
      acceptedAt: new Date(),
      gdpr: {
        ...gdpr,
        dataSubjectConsentAt: new Date(),
      },
    },
    { merge: true }
  );
};

const assignUserToApartment = async (uid: string, apartmentId: string) => {
  const db = getFirebaseAdminDb();

  await db.collection('users').doc(uid).set(
    {
      uid,
      role: 'Resident',
      apartmentId,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  await db.collection('apartments').doc(apartmentId).set(
    {
      residentId: uid,
    },
    { merge: true }
  );
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as AcceptInvitationPayload;

    if (!payload?.token) {
      await writeAuditEvent({
        request,
        action: 'invitation.accept',
        status: 'denied',
        reason: 'missing_token',
      });

      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    const tokenHash = await hashInvitationToken(payload.token);
    const rl = consumeRateLimit(
      buildRateLimitKey(request, 'invitations:accept', tokenHash.slice(0, 12)),
      10,
      60_000
    );

    if (!rl.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      await writeAuditEvent({
        request,
        action: 'invitation.accept',
        status: 'rate_limited',
        reason: 'too_many_requests',
      });

      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
          },
        }
      );
    }

    if (!payload.gdprConsent) {
      await writeAuditEvent({
        request,
        action: 'invitation.accept',
        status: 'denied',
        reason: 'missing_gdpr_consent',
      });

      return NextResponse.json({ error: 'GDPR consent is required' }, { status: 400 });
    }

    const invitation = await getInvitationByToken(payload.token);
    if (!invitation || !invitation.email || !invitation.apartmentId) {
      await writeAuditEvent({
        request,
        action: 'invitation.accept',
        status: 'denied',
        reason: 'invalid_invitation',
      });

      return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 });
    }

    if (invitation.status === 'revoked') {
      await writeAuditEvent({
        request,
        action: 'invitation.accept',
        status: 'denied',
        invitationId: invitation.id,
        targetEmail: invitation.email,
        apartmentId: invitation.apartmentId,
        reason: 'invitation_revoked',
      });

      return NextResponse.json({ error: 'Invitation revoked' }, { status: 410 });
    }

    if (invitation.status === 'accepted') {
      await writeAuditEvent({
        request,
        action: 'invitation.accept',
        status: 'denied',
        invitationId: invitation.id,
        targetEmail: invitation.email,
        apartmentId: invitation.apartmentId,
        reason: 'invitation_already_accepted',
      });

      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 409 });
    }

    if (invitation.status && invitation.status !== 'pending') {
      await writeAuditEvent({
        request,
        action: 'invitation.accept',
        status: 'denied',
        invitationId: invitation.id,
        targetEmail: invitation.email,
        apartmentId: invitation.apartmentId,
        reason: 'invitation_not_pending',
      });

      return NextResponse.json({ error: 'Invitation is not pending' }, { status: 409 });
    }

    const expiresAt = toDateOrNull(invitation.expiresAt);
    if (expiresAt && expiresAt.getTime() < Date.now()) {
      await writeAuditEvent({
        request,
        action: 'invitation.accept',
        status: 'denied',
        invitationId: invitation.id,
        targetEmail: invitation.email,
        apartmentId: invitation.apartmentId,
        reason: 'invitation_expired',
      });

      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
    }

    let authContext: Awaited<ReturnType<typeof requireRequestAuth>> | null = null;
    try {
      authContext = await requireRequestAuth(request);
    } catch {
      authContext = null;
    }

    if (authContext?.uid) {
      const invitationEmail = normalizeEmail(invitation.email);
      const userEmail = normalizeEmail(authContext.email ?? '');

      if (!userEmail || invitationEmail !== userEmail) {
        await writeAuditEvent({
          request,
          action: 'invitation.accept',
          status: 'denied',
          actorUid: authContext.uid,
          actorRole: authContext.role,
          invitationId: invitation.id,
          targetEmail: invitation.email,
          apartmentId: invitation.apartmentId,
          reason: 'email_mismatch',
        });

        return NextResponse.json(
          { error: 'Invitation belongs to a different email' },
          { status: 403 }
        );
      }

      if (authContext.role === 'ManagementCompany') {
        await writeAuditEvent({
          request,
          action: 'invitation.accept',
          status: 'denied',
          actorUid: authContext.uid,
          actorRole: authContext.role,
          invitationId: invitation.id,
          targetEmail: invitation.email,
          apartmentId: invitation.apartmentId,
          reason: 'management_role_not_allowed',
        });

        return NextResponse.json(
          { error: 'Management company account cannot accept resident invitation' },
          { status: 403 }
        );
      }

      await assignUserToApartment(authContext.uid, invitation.apartmentId);
      await markInvitationAccepted(invitation.id, invitation.gdpr);

      await writeAuditEvent({
        request,
        action: 'invitation.accept',
        status: 'success',
        actorUid: authContext.uid,
        actorRole: authContext.role,
        invitationId: invitation.id,
        targetEmail: invitation.email,
        apartmentId: invitation.apartmentId,
        metadata: {
          mode: 'authenticated',
        },
      });

      return NextResponse.json({ success: true, mode: 'authenticated' });
    }

    if (!payload.password || payload.password.length < 6) {
      await writeAuditEvent({
        request,
        action: 'invitation.accept',
        status: 'denied',
        invitationId: invitation.id,
        targetEmail: invitation.email,
        apartmentId: invitation.apartmentId,
        reason: 'weak_or_missing_password',
      });

      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const adminAuth = getFirebaseAdminAuth();
    const normalizedEmail = normalizeEmail(invitation.email);

    try {
      await adminAuth.getUserByEmail(normalizedEmail);
      await writeAuditEvent({
        request,
        action: 'invitation.accept',
        status: 'denied',
        invitationId: invitation.id,
        targetEmail: invitation.email,
        apartmentId: invitation.apartmentId,
        reason: 'account_already_exists',
      });

      return NextResponse.json(
        { error: 'Account already exists. Please log in to accept invitation.' },
        { status: 409 }
      );
    } catch {
      // expected when account does not exist
    }

    const createdUser = await adminAuth.createUser({
      email: normalizedEmail,
      password: payload.password,
      emailVerified: false,
    });

    await assignUserToApartment(createdUser.uid, invitation.apartmentId);
    await markInvitationAccepted(invitation.id, invitation.gdpr);

    await writeAuditEvent({
      request,
      action: 'invitation.accept',
      status: 'success',
      actorUid: createdUser.uid,
      actorRole: 'Resident',
      invitationId: invitation.id,
      targetEmail: invitation.email,
      apartmentId: invitation.apartmentId,
      metadata: {
        mode: 'registration',
      },
    });

    return NextResponse.json({ success: true, mode: 'registration' });
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiAuthError') {
      await writeAuditEvent({
        request,
        action: 'invitation.accept',
        status: 'denied',
        reason: error.message,
      });

      return toAuthErrorResponse(error);
    }

    console.error('INVITATIONS_ACCEPT API error:', error);
    await writeAuditEvent({
      request,
      action: 'invitation.accept',
      status: 'error',
      reason: error instanceof Error ? error.message : 'unknown_error',
    });

    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
