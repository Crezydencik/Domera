import { NextRequest, NextResponse } from 'next/server';
import { updateDocument } from '@/firebase/services/firestoreService';
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';

interface AcceptInvitationPayload {
  invitationId: string;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as AcceptInvitationPayload;

    if (!payload.invitationId) {
      return NextResponse.json({ error: 'invitationId ir obligāts' }, { status: 400 });
    }

    await updateDocument(FIRESTORE_COLLECTIONS.COMPANY_INVITATIONS, payload.invitationId, {
      status: 'accepted',
      acceptedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error accepting company invitation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Не удалось обновить статус приглашения' },
      { status: 500 }
    );
  }
}
