import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/firebase/admin';
import { hashInvitationToken } from '@/shared/lib/invitationToken';
import { buildRateLimitKey, consumeRateLimit } from '@/shared/lib/rateLimit';
import { writeAuditEvent } from '@/shared/lib/auditLog';

type InvitationDoc = {
  email?: string;
  apartmentId?: string;
  status?: string;
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

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')?.trim();
    if (!token) {
      await writeAuditEvent({
        request,
        action: 'invitation.resolve',
        status: 'denied',
        reason: 'missing_token',
      });

      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    const tokenHash = await hashInvitationToken(token);
    const rl = consumeRateLimit(
      buildRateLimitKey(request, 'invitations:resolve', tokenHash.slice(0, 12)),
      30,
      60_000
    );

    if (!rl.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      await writeAuditEvent({
        request,
        action: 'invitation.resolve',
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

    const invitation = await getInvitationByToken(token);
    if (!invitation || !invitation.email) {
      await writeAuditEvent({
        request,
        action: 'invitation.resolve',
        status: 'denied',
        reason: 'invitation_not_found',
      });

      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.status === 'revoked') {
      await writeAuditEvent({
        request,
        action: 'invitation.resolve',
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
        action: 'invitation.resolve',
        status: 'denied',
        invitationId: invitation.id,
        targetEmail: invitation.email,
        apartmentId: invitation.apartmentId,
        reason: 'invitation_already_accepted',
      });

      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 410 });
    }

    const expiresAt = toDateOrNull(invitation.expiresAt);
    if (expiresAt && expiresAt.getTime() < Date.now()) {
      await writeAuditEvent({
        request,
        action: 'invitation.resolve',
        status: 'denied',
        invitationId: invitation.id,
        targetEmail: invitation.email,
        apartmentId: invitation.apartmentId,
        reason: 'invitation_expired',
      });

      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
    }

    let existingAccountDetected = false;
    try {
      await getFirebaseAdminAuth().getUserByEmail(invitation.email);
      existingAccountDetected = true;
    } catch {
      existingAccountDetected = false;
    }

    await writeAuditEvent({
      request,
      action: 'invitation.resolve',
      status: 'success',
      invitationId: invitation.id,
      targetEmail: invitation.email,
      apartmentId: invitation.apartmentId,
      metadata: {
        existingAccountDetected,
      },
    });

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        apartmentId: invitation.apartmentId,
        status: invitation.status ?? 'pending',
        expiresAt: expiresAt?.toISOString() ?? null,
      },
      existingAccountDetected,
    });
  } catch (error) {
    console.error('INVITATIONS_RESOLVE API error:', error);
    await writeAuditEvent({
      request,
      action: 'invitation.resolve',
      status: 'error',
      reason: error instanceof Error ? error.message : 'unknown_error',
    });

    return NextResponse.json({ error: 'Failed to resolve invitation' }, { status: 500 });
  }
}
