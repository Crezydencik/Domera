/**
 * Add tenant to apartment by email
 */
import { getUserByEmail } from '@/modules/auth/services/authService';
import type { TenantAccess, Apartment, MeterReading } from '@/shared/types';

export const addTenantToApartment = async (
  apartmentId: string,
  email: string
): Promise<void> => {
  const user = await getUserByEmail(email);
  if (!user) throw new Error('Пользователь с таким email не найден');

  const apartment = await getApartment(apartmentId);
  if (!apartment) throw new Error('Квартира не найдена');

  const tenants = Array.isArray(apartment.tenants) ? apartment.tenants : [];
  if (tenants.some((t) => t.userId === user.uid)) {
    throw new Error('Этот пользователь уже имеет доступ');
  }

  const newTenant: TenantAccess = {
    userId: user.uid,
    name: user.displayName || 'Неизвестно', // Added name property
    email: user.email,
    permissions: ['viewDocuments', 'submitMeter'],
    invitedAt: new Date(),
  };

  await updateApartment(apartmentId, {
    tenants: [...tenants, newTenant],
  });
};

/**
 * Remove tenant access from apartment by userId
 */
export const removeTenantFromApartment = async (
  apartmentId: string,
  userId: string
): Promise<void> => {
  try {
    if (!apartmentId || !userId) throw new Error('apartmentId and userId are required');
    const apartment = await getApartment(apartmentId);
    if (!apartment) throw new Error('Квартира не найдена');

    const tenants = Array.isArray(apartment.tenants) ? apartment.tenants : [];
    const next = tenants.filter((t) => t.userId !== userId);

    await updateApartment(apartmentId, { tenants: next });
  } catch (error) {
    console.error('Error removing tenant from apartment:', error);
    throw error;
  }
};
/**
 * Apartments module service
 * 
 * Handles all apartment-related operations:
 * - Create apartment
 * - Get apartments by building/company
 * - Update apartment (assign resident)
 * - Delete apartment
 */

import { createDocument, getDocument, updateDocument, deleteDocument } from '@/firebase/services/firestoreService';
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';
import { validateApartmentNumber } from '@/shared/validation';
import { where, query, collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getFirestore } from 'firebase/firestore'; // Added missing import for getFirestore

/**
 * Create new apartment
 */
// Новый createApartment: companyId УК обязателен, companyIds = [companyId]
export const createApartment = async (
  data: Omit<Apartment, 'id' | 'companyIds'>,
  companyId: string
): Promise<Apartment> => {
  try {
    if (!companyId) {
      throw new Error('Не выбрана управляющая компания');
    }
    const normalizedNumber = data.number.trim();
    const validation = validateApartmentNumber(normalizedNumber);

    if (!validation.isValid) {
      throw new Error(validation.errors[0] ?? 'Некорректный номер квартиры');
    }

    const apartmentsCollection = collection(db, FIRESTORE_COLLECTIONS.APARTMENTS);
    const apartmentsQuery = query(
      apartmentsCollection,
      where('companyIds', 'array-contains', companyId),
      where('buildingId', '==', data.buildingId)
    );

    const querySnapshot = await getDocs(apartmentsQuery);
    const existingApartments = querySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));

    const hasDuplicateNumber = existingApartments.some((doc) => {
      const apartment = mapFirestoreDocsToApartments([doc])[0];
      return apartment.number.trim().toLowerCase() === normalizedNumber.toLowerCase();
    });

    if (hasDuplicateNumber) {
      throw new Error('Квартира с таким номером уже существует в этом доме');
    }

    const buildingDoc = await getDocument(FIRESTORE_COLLECTIONS.BUILDINGS, data.buildingId);
    if (!buildingDoc) {
      throw new Error('Дом не найден');
    }

    // Проверяем, что УК совпадает с домом
    const buildingCompanyId = (buildingDoc as { companyId?: string }).companyId;
    if (!buildingCompanyId || buildingCompanyId !== companyId) {
      throw new Error('УК не совпадает с домом');
    }

    const id = await createDocument(FIRESTORE_COLLECTIONS.APARTMENTS, {
      ...data,
      companyIds: [companyId],
      number: normalizedNumber,
      waterReadings: Array.isArray(data.waterReadings) ? data.waterReadings : [],
    });

    const nextApartmentIds = Array.from(
      new Set([...(Array.isArray((buildingDoc as { apartmentIds?: string[] }).apartmentIds)
        ? (buildingDoc as { apartmentIds?: string[] }).apartmentIds!
        : []), id])
    );

    await updateDocument(FIRESTORE_COLLECTIONS.BUILDINGS, data.buildingId, {
      apartmentIds: nextApartmentIds,
    });

    return {
      id,
      ...data,
      companyIds: [companyId],
      number: normalizedNumber,
      waterReadings: Array.isArray(data.waterReadings) ? data.waterReadings : [],
    };
  } catch (error) {
    console.error('Error creating apartment:', error);
    throw error;
  }
};

/**
 * Get apartment by ID
 */
export const getApartment = async (apartmentId: string): Promise<Apartment | null> => {
  try {
    const doc = await getDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId);
    if (!doc) return null;
    // ensure returned object includes id (getDocument returns only data)
    return { id: apartmentId, ...(doc as Record<string, unknown>) } as Apartment;
  } catch (error) {
    console.error('Error getting apartment:', error);
    throw error;
  }
};

/**
 * Get apartments by building ID
 */
export const getApartmentsByBuilding = async (buildingId: string): Promise<Apartment[]> => {
  const apartmentsCollection = collection(db, FIRESTORE_COLLECTIONS.APARTMENTS);
  const apartmentsQuery = query(apartmentsCollection, where('buildingId', '==', buildingId));
  const querySnapshot = await getDocs(apartmentsQuery);
  return mapFirestoreDocsToApartments(querySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })));
};

/**
 * Get apartments by company ID
 */
export const getApartmentsByCompany = async (companyId: string): Promise<Apartment[]> => {
  const apartmentsCollection = collection(db, FIRESTORE_COLLECTIONS.APARTMENTS);

  // Try to fetch apartments that explicitly list the company in companyIds (new schema)
  const byArrayQuery = query(apartmentsCollection, where('companyIds', 'array-contains', companyId));
  const byArraySnapshot = await getDocs(byArrayQuery);

  // Also fetch apartments that use legacy single companyId field (old schema)
  const byLegacyQuery = query(apartmentsCollection, where('companyId', '==', companyId));
  const byLegacySnapshot = await getDocs(byLegacyQuery);

  const docs = [
    ...byArraySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })),
    ...byLegacySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })),
  ];

  // Deduplicate by id
  const uniqueById: Record<string, Record<string, unknown>> = {};
  for (const d of docs) {
    uniqueById[d.id as string] = d;
  }

  const mapped = mapFirestoreDocsToApartments(Object.values(uniqueById));

  // If no apartments were found by company, attempt to find buildings for the company
  // and populate apartments by buildingId. Also update building.apartmentIds if missing.
  if (mapped.length === 0) {
    try {
      const buildingsCollection = collection(db, FIRESTORE_COLLECTIONS.BUILDINGS);
      // try nested managedBy.companyId first (per current schema), fallback to companyId
      const bQuery = query(buildingsCollection, where('managedBy.companyId', '==', companyId));
      const bSnap = await getDocs(bQuery);
      if (bSnap.empty) {
        // fallback
        const bQuery2 = query(buildingsCollection, where('companyId', '==', companyId));
        const bSnap2 = await getDocs(bQuery2);
        // use bSnap2
        for (const bDoc of bSnap2.docs) {
          const bId = bDoc.id;
          const aQuery = query(apartmentsCollection, where('buildingId', '==', bId));
          const aSnap = await getDocs(aQuery);
          const ids = aSnap.docs.map((d) => d.id);
          if (ids.length > 0) {
            // try to update building document with apartmentIds
            try {
              await updateDocument(FIRESTORE_COLLECTIONS.BUILDINGS, bId, { apartmentIds: ids });
            } catch (e) {
              // ignore update errors (may be permission issues)
            }
          }
        }
        // try to load apartments again across those buildings
        const loaded: Apartment[] = [];
        for (const bDoc of bSnap2.docs) {
          const bId = bDoc.id;
          const aQuery = query(apartmentsCollection, where('buildingId', '==', bId));
          const aSnap = await getDocs(aQuery);
          for (const ad of aSnap.docs) loaded.push(mapFirestoreDocsToApartments([{ id: ad.id, ...(ad.data() as Record<string, unknown>) }])[0]);
        }
        if (loaded.length > 0) return loaded;
      } else {
        for (const bDoc of bSnap.docs) {
          const bId = bDoc.id;
          const aQuery = query(apartmentsCollection, where('buildingId', '==', bId));
          const aSnap = await getDocs(aQuery);
          const ids = aSnap.docs.map((d) => d.id);
          if (ids.length > 0) {
            try {
              await updateDocument(FIRESTORE_COLLECTIONS.BUILDINGS, bId, { apartmentIds: ids });
            } catch (e) {}
          }
        }

        const loaded: Apartment[] = [];
        for (const bDoc of bSnap.docs) {
          const bId = bDoc.id;
          const aQuery = query(apartmentsCollection, where('buildingId', '==', bId));
          const aSnap = await getDocs(aQuery);
          for (const ad of aSnap.docs) loaded.push(mapFirestoreDocsToApartments([{ id: ad.id, ...(ad.data() as Record<string, unknown>) }])[0]);
        }
        if (loaded.length > 0) return loaded;
      }
    } catch (err) {
      console.error('Fallback apartment load failed:', err);
    }
  }

  return mapped;
};

/**
 * Fetch apartments from the database
 */
export const  getApartmentsFromDatabase = async () => {
  const db = getFirestore();
  const apartmentsCollection = collection(db, 'apartments');
  const snapshot = await getDocs(apartmentsCollection);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    buildingId: doc.data().buildingId || '',
    companyIds: doc.data().companyIds || [],
    companyName: doc.data().companyName || '', // Include companyName
    number: doc.data().number || '',
    // Add other properties as needed
  }));
};

/**
 * Assign resident to apartment
 */
export const assignResidentToApartment = async (
  apartmentId: string,
  residentId: string
): Promise<void> => {
  try {
    await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId, {
      residentId,
    });
  } catch (error) {
    console.error('Error assigning resident to apartment:', error);
    throw error;
  }
};

/**
 * Unassign resident from apartment
 */
export const unassignResidentFromApartment = async (apartmentId: string): Promise<void> => {
  try {
    await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId, {
      residentId: null, // Remove the residentId field
    });
  } catch (error) {
    console.error('Error unassigning resident from apartment:', error);
    throw error;
  }
};

/**
 * Update apartment
 */
export const updateApartment = async (
  apartmentId: string,
  data: Partial<Omit<Apartment, 'id'>>
): Promise<void> => {
  try {
    await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId, data);
  } catch (error) {
    console.error('Error updating apartment:', error);
    throw error;
  }
};

/**
 * Delete apartment
 */
export const deleteApartment = async (apartmentId: string): Promise<void> => {
  try {
    const apartment = await getApartment(apartmentId);

    if (!apartment) {
      throw new Error('Квартира не найдена');
    }

    if (apartment.residentId) {
      throw new Error('Нельзя удалить квартиру: сначала отвяжите жильца');
    }

    await deleteDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId);

    if (apartment.buildingId) {
      const buildingDoc = await getDocument(FIRESTORE_COLLECTIONS.BUILDINGS, apartment.buildingId);

      if (buildingDoc) {
        const currentIds = Array.isArray((buildingDoc as { apartmentIds?: string[] }).apartmentIds)
          ? (buildingDoc as { apartmentIds?: string[] }).apartmentIds!
          : [];

        await updateDocument(FIRESTORE_COLLECTIONS.BUILDINGS, apartment.buildingId, {
          apartmentIds: currentIds.filter((id) => id !== apartmentId),
        });
      }
    }
  } catch (error) {
    console.error('Error deleting apartment:', error);
    throw error;
  }
};

// Utility function to map Firestore documents to Apartment type
const mapFirestoreDocsToApartments = (docs: Record<string, unknown>[]): Apartment[] => {
  return docs.map((doc) => {
    const { id, buildingId, companyIds, number, residentId, tenants, waterReadings, companyName } = doc;
    return {
      id: id as string,
      buildingId: buildingId as string,
      companyIds: companyIds as string[],
      number: number as string,
      residentId: residentId as string | undefined,
      tenants: tenants as TenantAccess[] | undefined,
      waterReadings: waterReadings as MeterReading[] | undefined,
      companyName: companyName as string | undefined,
    };
  });
};
