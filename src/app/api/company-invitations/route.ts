import { NextRequest, NextResponse } from 'next/server';
import { queryDocuments } from '@/firebase/services/firestoreService';
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get('companyId');
    const buildingId = request.nextUrl.searchParams.get('buildingId');

    if (!companyId || !buildingId) {
      return NextResponse.json({ error: 'companyId un buildingId ir obligāti' }, { status: 400 });
    }

    const invitations = await queryDocuments(FIRESTORE_COLLECTIONS.COMPANY_INVITATIONS, [
      { field: 'companyId', operator: '==', value: companyId },
    ]);

    const filtered = invitations.filter((item) => String(item.buildingId ?? '') === buildingId);

    const sorted = [...filtered].sort((a, b) => {
      const aTs = a.createdAt ? new Date(a.createdAt as string | Date).getTime() : 0;
      const bTs = b.createdAt ? new Date(b.createdAt as string | Date).getTime() : 0;
      return bTs - aTs;
    });

    return NextResponse.json({ invitations: sorted });
  } catch (error) {
    console.error('Error loading company invitations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Не удалось загрузить приглашения' },
      { status: 500 }
    );
  }
}
