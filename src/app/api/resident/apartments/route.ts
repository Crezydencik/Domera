import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/firebase/admin';
import { requireRequestAuth, toAuthErrorResponse } from '@/shared/lib/serverAuth';
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';
import { normalizeEmail } from '@/shared/lib/invitationToken';

type ResidentBuildingPayload = { id: string } & Record<string, unknown>;

const toOptionalString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const toSerializable = (value: unknown): unknown => {
  if (value == null) return value;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toSerializable(item));
  }

  if (typeof value === 'object') {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate().toISOString();
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [key, toSerializable(nestedValue)])
    );
  }

  return value;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request, {
      allowedRoles: ['Resident'],
    });

    const db = getFirebaseAdminDb();
    const userSnap = await db.collection(FIRESTORE_COLLECTIONS.USERS).doc(auth.uid).get();
    const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};

    const normalizedEmail = normalizeEmail(
      toOptionalString(auth.email) ?? toOptionalString(userData.email) ?? ''
    );

    const apartmentIds = new Set<string>();
    const pushApartmentId = (value: unknown) => {
      const apartmentId = toOptionalString(value);
      if (apartmentId) apartmentIds.add(apartmentId);
    };

    pushApartmentId(auth.apartmentId);
    pushApartmentId(userData.apartmentId);

    if (Array.isArray(userData.apartmentIds)) {
      for (const apartmentId of userData.apartmentIds) {
        pushApartmentId(apartmentId);
      }
    }

    const apartmentsById = await Promise.all(
      Array.from(apartmentIds).map(async (apartmentId) => {
        const apartmentSnap = await db.collection(FIRESTORE_COLLECTIONS.APARTMENTS).doc(apartmentId).get();
        if (!apartmentSnap.exists) return null;
        return {
          id: apartmentSnap.id,
          ...(apartmentSnap.data() as Record<string, unknown>),
        };
      })
    );

    const residentApartmentsSnap = await db
      .collection(FIRESTORE_COLLECTIONS.APARTMENTS)
      .where('residentId', '==', auth.uid)
      .get();

    const ownerApartmentsSnap = normalizedEmail
      ? await db
          .collection(FIRESTORE_COLLECTIONS.APARTMENTS)
          .where('ownerEmail', '==', normalizedEmail)
          .get()
      : null;

    const mergedApartments = new Map<string, Record<string, unknown>>();

    for (const apartment of apartmentsById) {
      if (apartment?.id) {
        mergedApartments.set(apartment.id, apartment);
      }
    }

    for (const doc of residentApartmentsSnap.docs) {
      mergedApartments.set(doc.id, {
        id: doc.id,
        ...(doc.data() as Record<string, unknown>),
      });
    }

    if (ownerApartmentsSnap) {
      for (const doc of ownerApartmentsSnap.docs) {
        mergedApartments.set(doc.id, {
          id: doc.id,
          ...(doc.data() as Record<string, unknown>),
        });
      }
    }

    const apartments = Array.from(mergedApartments.values());
    const buildingIds = Array.from(
      new Set(
        apartments
          .map((apartment) => toOptionalString(apartment.buildingId))
          .filter((value): value is string => Boolean(value))
      )
    );

    const buildings = (
      await Promise.all(
        buildingIds.map(async (buildingId) => {
          const buildingSnap = await db.collection(FIRESTORE_COLLECTIONS.BUILDINGS).doc(buildingId).get();
          if (!buildingSnap.exists) return null;
          return {
            id: buildingSnap.id,
            ...(buildingSnap.data() as Record<string, unknown>),
          };
        })
      )
    ).filter((building): building is ResidentBuildingPayload => Boolean(building));

    return NextResponse.json({
      apartments: toSerializable(apartments),
      buildings: toSerializable(buildings),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiAuthError') {
      return toAuthErrorResponse(error);
    }

    console.error('resident.apartments.get.error', error);
    return NextResponse.json({ error: 'Failed to load resident apartments' }, { status: 500 });
  }
}
