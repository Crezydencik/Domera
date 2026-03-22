/**
 * Add tenant to apartment by email
 */
import { getUserByEmail, registerUser } from '@/modules/auth/services/authService';
/**
 * Add or invite tenant to apartment by email (создаёт гостевой аккаунт если не найден)
 */
export const addOrInviteTenantToApartment = async (
  apartmentId: string,
  email: string
): Promise<void> => {
  let user = await getUserByEmail(email);
  if (!user) {
    // Создаём гостевой аккаунт (Resident, без пароля)
    user = await registerUser({ email, password: Math.random().toString(36).slice(-8), token: '' }, 'Resident', '', undefined);
    // Можно отправить приглашение на email здесь (реализуйте отправку письма отдельно)
  }

  const apartment = await getApartment(apartmentId);
  if (!apartment) throw new Error('Квартира не найдена');

  const tenants = Array.isArray(apartment.tenants) ? apartment.tenants : [];
  if (tenants.some((t) => t.userId === user.uid)) {
    throw new Error('Этот пользователь уже имеет доступ');
  }

  const newTenant: TenantAccess = {
    userId: user.uid,
    name: user.displayName || 'Неизвестно',
    email: user.email,
    permissions: ['submitMeter'],
    invitedAt: new Date(),
  };

  await updateApartment(apartmentId, {
    tenants: [...tenants, newTenant],
  });
};
import type { TenantAccess, Apartment, MeterReading, WaterReadings } from '@/shared/types';

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

    // Update building doc: push apartment id and number
    const apartmentsArr = Array.isArray((buildingDoc as any).apartments) ? (buildingDoc as any).apartments : [];
    apartmentsArr.push({ id, number: normalizedNumber });
    const nextApartmentIds = Array.from(
      new Set([...(Array.isArray((buildingDoc as { apartmentIds?: string[] }).apartmentIds)
        ? (buildingDoc as { apartmentIds?: string[] }).apartmentIds!
        : []), id])
    );

    await updateDocument(FIRESTORE_COLLECTIONS.BUILDINGS, data.buildingId, {
      apartmentIds: nextApartmentIds
    });

    // Fallback: если после обновления apartmentIds не появился, пробуем восстановить вручную
    setTimeout(async () => {
      try {
        const buildingDocCheck = await getDocument(FIRESTORE_COLLECTIONS.BUILDINGS, data.buildingId);
        if (!Array.isArray((buildingDocCheck as any)?.apartmentIds) || !(buildingDocCheck as any).apartmentIds.includes(id)) {
          // Собираем все квартиры этого дома
          const apartmentsCollection = collection(db, FIRESTORE_COLLECTIONS.APARTMENTS);
          const aQuery = query(apartmentsCollection, where('buildingId', '==', data.buildingId));
          const aSnap = await getDocs(aQuery);
          const ids = aSnap.docs.map((d) => d.id);
          await updateDocument(FIRESTORE_COLLECTIONS.BUILDINGS, data.buildingId, { apartmentIds: ids });
        }
      } catch (e) {
        console.error('[createApartment fallback] Ошибка восстановления apartmentIds:', e);
      }
    }, 1000);

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
 * Get all apartments assigned to a resident (by residentId field)
 */
export const getApartmentsByResidentId = async (uid: string): Promise<Apartment[]> => {
  const apartmentsCollection = collection(db, FIRESTORE_COLLECTIONS.APARTMENTS);
  const q = query(apartmentsCollection, where('residentId', '==', uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as Apartment));
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

  // Also include apartments discovered by company-owned buildings.
  // This covers legacy/partial imports where apartment.companyIds/companyId might be missing,
  // but apartment.buildingId is valid and building belongs to the company.
  try {
    const buildingsCollection = collection(db, FIRESTORE_COLLECTIONS.BUILDINGS);
    const [managedBySnap, legacySnap] = await Promise.all([
      getDocs(query(buildingsCollection, where('managedBy.companyId', '==', companyId))),
      getDocs(query(buildingsCollection, where('companyId', '==', companyId))),
    ]);

    const buildingIds = Array.from(new Set([
      ...managedBySnap.docs.map((d) => d.id),
      ...legacySnap.docs.map((d) => d.id),
    ]));

    if (buildingIds.length > 0) {
      const apartmentSnapshots = await Promise.all(
        buildingIds.map((buildingId) =>
          getDocs(query(apartmentsCollection, where('buildingId', '==', buildingId)))
        )
      );

      for (let i = 0; i < apartmentSnapshots.length; i++) {
        const snap = apartmentSnapshots[i];
        const buildingId = buildingIds[i];
        const ids = snap.docs.map((d) => d.id);

        if (ids.length > 0) {
          try {
            await updateDocument(FIRESTORE_COLLECTIONS.BUILDINGS, buildingId, { apartmentIds: ids });
          } catch {
            // best-effort consistency update only
          }
        }

        for (const ad of snap.docs) {
          uniqueById[ad.id] = { id: ad.id, ...(ad.data() as Record<string, unknown>) };
        }
      }
    }
  } catch (err) {
    console.error('Fallback apartment load failed:', err);
  }

  return mapFirestoreDocsToApartments(Object.values(uniqueById));
};

/**
 * Fetch apartments from the database
 */
export const  getApartmentsFromDatabase = async () => {
  const db = getFirestore();
  const apartmentsCollection = collection(db, 'apartments');
  const snapshot = await getDocs(apartmentsCollection);

  return snapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      buildingId: typeof data.buildingId === 'string' ? data.buildingId : '',
      companyIds: Array.isArray(data.companyIds) ? data.companyIds as string[] : [],
      companyName: typeof data.companyName === 'string' ? data.companyName : '',
      number: typeof data.number === 'string' ? data.number : '',
      residentId: typeof data.residentId === 'string' ? data.residentId : undefined,
      tenants: Array.isArray(data.tenants) ? data.tenants as TenantAccess[] : undefined,
      ownerEmail: typeof data.ownerEmail === 'string' ? data.ownerEmail : undefined,
      owner: typeof data.owner === 'string' ? data.owner : undefined,
      floor: typeof data.floor === 'string' ? data.floor : undefined,
      area: typeof data.area === 'number' ? data.area : undefined,
      managementArea: typeof data.managementArea === 'number' ? data.managementArea : undefined,
      heatingArea: typeof data.heatingArea === 'number' ? data.heatingArea : undefined,
      declaredResidents: typeof data.declaredResidents === 'number'
        ? data.declaredResidents
        : (typeof data.declaredResidents === 'string' && data.declaredResidents.trim() !== ''
          ? Number(data.declaredResidents)
          : undefined),
      waterReadings: (data.waterReadings as Apartment['waterReadings']) ?? undefined,
    };
  });
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
      tenants: [],
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
    const {
      id,
      buildingId,
      companyIds,
      number,
      residentId,
      tenants,
      waterReadings,
      companyName,
      address,
      floor,
      owner,
      ownerEmail,
      cadastralNumber,
      cadastralPart,
      apartmentType,
      commonPropertyShare,
      area,
      heatingArea,
      managementArea,
      declaredResidents,
      hotWaterMeterNumber,
      coldWaterMeterNumber,
      description,
      rooms,
      ResidencyAgreementLinks,
      residencyAgreementLinks,
    } = doc;

    const normalizedDeclaredResidents =
      typeof declaredResidents === 'number'
        ? declaredResidents
        : (typeof declaredResidents === 'string' && declaredResidents.trim() !== ''
          ? Number(declaredResidents)
          : undefined);

    return {
      id: id as string,
      buildingId: buildingId as string,
      companyIds: Array.isArray(companyIds) ? companyIds as string[] : [],
      number: number as string,
      residentId: residentId as string | undefined,
      tenants: tenants as TenantAccess[] | undefined,
      waterReadings: waterReadings as WaterReadings | undefined,
      companyName: companyName as string | undefined,
      address: typeof address === 'string' ? address : undefined,
      floor: typeof floor === 'string' ? floor : (floor != null ? String(floor) : undefined),
      owner: typeof owner === 'string' ? owner : undefined,
      ownerEmail: typeof ownerEmail === 'string' ? ownerEmail : undefined,
      cadastralNumber: typeof cadastralNumber === 'string' ? cadastralNumber : undefined,
      cadastralPart: typeof cadastralPart === 'string' ? cadastralPart : undefined,
      apartmentType: typeof apartmentType === 'string' ? apartmentType : undefined,
      commonPropertyShare: typeof commonPropertyShare === 'string' ? commonPropertyShare : undefined,
      area: typeof area === 'number' ? area : undefined,
      heatingArea: typeof heatingArea === 'number' ? heatingArea : undefined,
      managementArea: typeof managementArea === 'number' ? managementArea : undefined,
      declaredResidents: Number.isFinite(normalizedDeclaredResidents)
        ? normalizedDeclaredResidents
        : undefined,
      hotWaterMeterNumber: typeof hotWaterMeterNumber === 'string' ? hotWaterMeterNumber : undefined,
      coldWaterMeterNumber: typeof coldWaterMeterNumber === 'string' ? coldWaterMeterNumber : undefined,
      description: typeof description === 'string' ? description : undefined,
      rooms: typeof rooms === 'number' ? rooms : undefined,
      ResidencyAgreementLinks: Array.isArray(ResidencyAgreementLinks) ? ResidencyAgreementLinks as string[] : undefined,
      residencyAgreementLinks: Array.isArray(residencyAgreementLinks) ? residencyAgreementLinks as string[] : undefined,
    };
  });
};
