import { NextRequest, NextResponse } from 'next/server';
import { getDocument, updateDocument } from '@/firebase/services/firestoreService';
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';
import { requireRequestAuth, toAuthErrorResponse } from '@/shared/lib/serverAuth';
import { writeAuditEvent } from '@/shared/lib/auditLog';

interface AcceptInvitationPayload {
  invitationId: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request);
    const payload = (await request.json()) as AcceptInvitationPayload;

    if (!payload.invitationId) {
      await writeAuditEvent({
        request,
        action: 'company_invitation.accept',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        reason: 'missing_invitation_id',
      });

      return NextResponse.json({ error: 'invitationId ir obligāts' }, { status: 400 });
    }

    const invitation = await getDocument(FIRESTORE_COLLECTIONS.COMPANY_INVITATIONS, payload.invitationId);
    if (!invitation) {
      await writeAuditEvent({
        request,
        action: 'company_invitation.accept',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        invitationId: payload.invitationId,
        reason: 'invitation_not_found',
      });

      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const invitationEmail = String(invitation.email ?? '').trim().toLowerCase();
    const authEmail = (auth.email ?? '').trim().toLowerCase();

    if (!invitationEmail || !authEmail || invitationEmail !== authEmail) {
      await writeAuditEvent({
        request,
        action: 'company_invitation.accept',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        invitationId: payload.invitationId,
        targetEmail: invitationEmail,
        reason: 'email_mismatch',
      });

      return NextResponse.json({ error: 'You cannot accept this invitation' }, { status: 403 });
    }

    await updateDocument(FIRESTORE_COLLECTIONS.COMPANY_INVITATIONS, payload.invitationId, {
      status: 'accepted',
      acceptedAt: new Date(),
      acceptedByUid: auth.uid,
    });

    await writeAuditEvent({
      request,
      action: 'company_invitation.accept',
      status: 'success',
      actorUid: auth.uid,
      actorRole: auth.role,
      companyId: typeof invitation.companyId === 'string' ? invitation.companyId : undefined,
      invitationId: payload.invitationId,
      targetEmail: invitationEmail,
      metadata: {
        buildingId: typeof invitation.buildingId === 'string' ? invitation.buildingId : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiAuthError') {
      await writeAuditEvent({
        request,
        action: 'company_invitation.accept',
        status: 'denied',
        reason: error.message,
      });

      return toAuthErrorResponse(error);
    }

    console.error('Error accepting company invitation:', error);
    await writeAuditEvent({
      request,
      action: 'company_invitation.accept',
      status: 'error',
      reason: error instanceof Error ? error.message : 'unknown_error',
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Не удалось обновить статус приглашения' },
      { status: 500 }
    );
  }
}
