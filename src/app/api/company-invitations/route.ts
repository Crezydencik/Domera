import { NextRequest, NextResponse } from 'next/server';
import { queryDocuments } from '@/firebase/services/firestoreService';
import { getFirebaseAdminDb } from '@/firebase/admin';
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';
import { requireRequestAuth, toAuthErrorResponse } from '@/shared/lib/serverAuth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request, {
      allowedRoles: ['ManagementCompany', 'Accountant'],
    });

    const companyId = request.nextUrl.searchParams.get('companyId');
    const buildingId = request.nextUrl.searchParams.get('buildingId');

    if (!companyId || !buildingId) {
      return NextResponse.json({ error: 'companyId un buildingId ir obligāti' }, { status: 400 });
    }

    if (auth.companyId && auth.companyId !== companyId) {
      return NextResponse.json({ error: 'Access denied for company' }, { status: 403 });
    }

    const db = getFirebaseAdminDb();
    const buildingSnap = await db.collection('buildings').doc(buildingId).get();
    if (!buildingSnap.exists) {
      return NextResponse.json({ error: 'Building not found' }, { status: 404 });
    }

    const building = buildingSnap.data() as Record<string, unknown>;
    const buildingCompanyId =
      (typeof building.companyId === 'string' ? building.companyId : undefined) ??
      ((building.managedBy as Record<string, unknown> | undefined)?.companyId as string | undefined);

    if (!buildingCompanyId || buildingCompanyId !== companyId) {
      return NextResponse.json({ error: 'Access denied for building/company ownership' }, { status: 403 });
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
    if (error instanceof Error && error.name === 'ApiAuthError') {
      return toAuthErrorResponse(error);
    }

    console.error('Error loading company invitations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Не удалось загрузить приглашения' },
      { status: 500 }
    );
  }
}
