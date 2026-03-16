/**
 * Meters module service
 * 
 * Handles meter-related operations:
 * - Create meter for apartment
 * - Get meters by apartment
 * - Update meter
 * - Delete meter
 */

import {
  getDocument,
  updateDocument,
  queryDocuments,
  setDocument,
  documentExists,
} from '@/firebase/services/firestoreService';
import { getApartmentsByCompany } from '@/modules/apartments/services/apartmentsService';
import { DEFAULT_WATER_METER_TEMPLATES, FIRESTORE_COLLECTIONS } from '@/shared/constants';
import type { Apartment, Building, Meter, MeterReading, MeterType } from '@/shared/types';
import { where } from 'firebase/firestore';

const generateId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;

const normalizeMeterKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zа-я0-9_-]/gi, '');

const getMeterDisplayName = (meter: Meter): string => {
  const name = meter.name?.toString().trim() ?? '';
  if (!name) return meter.serialNumber?.trim() || meter.id;
  const code = name.toLowerCase();
  if (code === 'hwm') return 'ГВС';
  if (code === 'cwm') return 'ХВС';
  return name;
};

const getBuildingWaterTemplates = (building: Building | null): string[] => {
  if (!building) {
    return [...DEFAULT_WATER_METER_TEMPLATES];
  }

  // ...удалено: building.settings?.water?.meterTemplates...

  if (Array.isArray(building.waterMeterTemplates) && building.waterMeterTemplates.length > 0) {
    return building.waterMeterTemplates.filter(Boolean);
  }

  return [...DEFAULT_WATER_METER_TEMPLATES];
};

const toVirtualWaterMeter = (apartmentId: string, templateName: string): Meter => {
  const normalized = normalizeMeterKey(templateName) || 'water';
  const code = /гвс|gvs|hot|гор/i.test(templateName) ? 'hwm' : 'cwm';
  return {
    id: `house-water-${apartmentId}-${normalized}`,
    apartmentId,
    type: 'water',
    serialNumber: `HOUSE-WATER-${normalized.toUpperCase()}`,
    name: code,
  };
};

/**
 * Create new meter for apartment
 */
export const createMeter = async (data: Omit<Meter, 'id'>): Promise<Meter> => {
  return {
    id: `house-meter-static-id`,
    ...data,
  };
};

/**
 * Get meter by ID
 */
export const getMeter = async (meterId: string): Promise<Meter | null> => {
  try {
    const doc = await getDocument(FIRESTORE_COLLECTIONS.METERS, meterId);
    return doc ? (doc as Meter) : null;
  } catch (error) {
    console.error('Error getting meter:', error);
    throw error;
  }
};

/**
 * Get meters by apartment ID
 */
export const getMetersByApartment = async (apartmentId: string): Promise<Meter[]> => {
  try {
    if (!apartmentId || typeof apartmentId !== 'string') {
      console.error('Invalid apartmentId:', apartmentId);
      return [];
    }
    const apartment = (await getDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId)) as Apartment | null;
    if (!apartment) {
      return [];
    }

    if (!apartment.buildingId || typeof apartment.buildingId !== 'string') {
      console.error('Invalid buildingId:', apartment.buildingId);
      return [];
    }
    const building = (await getDocument(FIRESTORE_COLLECTIONS.BUILDINGS, apartment.buildingId)) as Building | null;
    const templates = getBuildingWaterTemplates(building);

    const legacyMetersRaw = await queryDocuments(FIRESTORE_COLLECTIONS.METERS, [
      where('apartmentId', '==', apartmentId),
    ]);

    const legacyMeters = (legacyMetersRaw as Record<string, unknown>[]).map((doc) => {
      const d = doc as Record<string, unknown>;
      const rawType = typeof d['type'] === 'string' ? (d['type'] as string) : 'water';

      const rawName = typeof d['name'] === 'string' ? (d['name'] as string) : '';
      let nameCode: string | undefined = undefined;
      if (rawName) {
        if (/гвс|gvs|hot|гор/i.test(rawName)) nameCode = 'hwm';
        else if (/хвс|cwm|cold|хол/i.test(rawName)) nameCode = 'cwm';
        else nameCode = rawName;
      }

      return {
        id: String(d['id'] ?? ''),
        apartmentId: String(d['apartmentId'] ?? ''),
        type: rawType as unknown as MeterType,
        serialNumber: String(d['serialNumber'] ?? ''),
        name: nameCode,
      } as Meter;
    });

    const normalizedLegacyWaterNames = new Set(
      legacyMeters
        .filter((meter) => meter.type === 'water')
        .map((meter) => normalizeMeterKey(getMeterDisplayName(meter)))
        .filter(Boolean)
    );

    const missingVirtualMeters = templates
      .filter((templateName) => !normalizedLegacyWaterNames.has(normalizeMeterKey(templateName)))
      .map((templateName) => toVirtualWaterMeter(apartmentId, templateName));

    return [...legacyMeters, ...missingVirtualMeters];
  } catch (error) {
    console.error('Error getting meters by apartment:', error);
    throw error;
  }
};

/**
 * Update meter
 */
export const updateMeter = async (
  meterId: string,
  data: Partial<Omit<Meter, 'id'>>,
  options?: { force?: boolean }
): Promise<void> => {
  try {
    // Fetch existing document (if any) to enforce business rules
    const existing = await getDocument(FIRESTORE_COLLECTIONS.METERS, meterId);

    // Date change: allow updating the checkDueDate value.
    // Previous strict protection (blocking changes until the stored date) removed to allow easier corrections from the UI.
    // Serial change protection remains below.

    // 2) Serial change protection (unless forced) — only allowed within 1 month before checkDueDate
    if (!options?.force && existing && data.serialNumber && existing['serialNumber'] && data.serialNumber !== existing['serialNumber']) {
      const existingDateRaw = existing['checkDueDate'];
      const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
      if (!existingDateRaw) {
        throw new Error('Изменение номера счётчика запрещено');
      }
      const existingDate = existingDateRaw instanceof Date ? existingDateRaw : new Date(String(existingDateRaw));
      if (!Number.isNaN(existingDate.getTime())) {
        const now = Date.now();
        if (now < existingDate.getTime() - oneMonthMs) {
          throw new Error('Изменение номера счётчика запрещено до месяца до срока проверки');
        }
      } else {
        throw new Error('Изменение номера счётчика запрещено');
      }
    }

    // Persist document
    const exists = await documentExists(FIRESTORE_COLLECTIONS.METERS, meterId);
    if (exists) {
      await updateDocument(FIRESTORE_COLLECTIONS.METERS, meterId, data);
    } else {
      await setDocument(FIRESTORE_COLLECTIONS.METERS, meterId, { id: meterId, ...(data as Record<string, unknown>) });
    }
  } catch (error) {
    console.error('Error updating meter:', error);
    throw error;
  }
};

/**
 * Convenience helper to set meter check due date.
 * Accepts a Date or an ISO/date string and stores it as an ISO date string (yyyy-mm-dd).
 */
export const setMeterCheckDate = async (
  meterId: string,
  date: string | Date,
  options?: { force?: boolean }
): Promise<void> => {
  if (!meterId || !date) {
    throw new Error('meterId и date обязательны');
  }

  let isoDate = '';
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) throw new Error('Invalid Date');
    isoDate = date.toISOString().slice(0, 10);
  } else {
    // try to parse string
    const d = new Date(String(date));
    if (!Number.isNaN(d.getTime())) {
      isoDate = d.toISOString().slice(0, 10);
    } else {
      // assume already yyyy-mm-dd or similar; store as-is
      isoDate = String(date);
    }
  }

  await updateMeter(meterId, { checkDueDate: isoDate }, options);
};

/**
 * Delete meter
 */
export const deleteMeter = async (meterId: string): Promise<void> => {
  void meterId;
  return Promise.resolve();
};

/**
 * Submit meter reading
 */
export const submitMeterReading = async (
  data: Omit<MeterReading, 'id'>
): Promise<MeterReading> => {
  try {
    if (!data.apartmentId || typeof data.apartmentId !== 'string') {
      throw new Error('Apartment ID must be a string');
    }
    const apartment = (await getDocument(FIRESTORE_COLLECTIONS.APARTMENTS, data.apartmentId)) as Apartment | null;
    if (!apartment) {
      throw new Error('Квартира не найдена');
    }

    const id = generateId();
    const submittedDate = new Date();
    const createdReading = {
      id,
      apartmentId: data.apartmentId,
      meterId: data.meterId,
      submittedAt: submittedDate,
      previousValue: data.previousValue,
      currentValue: data.currentValue,
      consumption: data.consumption,
      buildingId: data.buildingId,
      month: submittedDate.getMonth() + 1,
      year: submittedDate.getFullYear(),
    } as MeterReading;

    // Find named key for this meter in waterReadings
    const wr = apartment.waterReadings as Record<string, unknown> | undefined;
    const namedKey = wr && typeof wr === 'object' && !Array.isArray(wr)
      ? (['coldmeterwater', 'hotmeterwater'] as const).find(
          (k) => (wr[k] as Record<string, unknown> | undefined)?.meterId === data.meterId
        )
      : undefined;

    const meterGroup = namedKey ? (wr![namedKey] as Record<string, unknown>) : undefined;

    // Server-side duplicate check: only one reading per meter per month/year
    if (meterGroup && Array.isArray(meterGroup.history)) {
      const duplicate = (meterGroup.history as any[]).some(
        (h: any) => Number(h.month) === Number(createdReading.month) && Number(h.year) === Number(createdReading.year)
      );
      if (duplicate) {
        throw new Error('Показание для этого счетчика уже подано за указанный месяц');
      }
    }

    if (namedKey && meterGroup) {
      // Update existing named meter group
      const history = Array.isArray(meterGroup.history) ? [...(meterGroup.history as any[])] : [];
      history.push(createdReading);
      await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, data.apartmentId, {
        [`waterReadings.${namedKey}`]: {
          ...meterGroup,
          history,
          currentValue: createdReading.currentValue,
          previousValue: createdReading.previousValue,
          submittedAt: createdReading.submittedAt,
        },
      });
    } else {
      // Fallback: create as coldmeterwater if unknown, or just push in unknown key
      const fallbackKey = 'coldmeterwater';
      await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, data.apartmentId, {
        [`waterReadings.${fallbackKey}`]: {
          meterId: data.meterId,
          history: [createdReading],
          currentValue: createdReading.currentValue,
          previousValue: createdReading.previousValue,
          submittedAt: createdReading.submittedAt,
        },
      });
    }

    return createdReading;
  } catch (error) {
    console.error('Error submitting meter reading:', error);
    throw error;
  }
};

/**
 * Get meter readings by apartment and month/year
 */
export const getMeterReadingsByApartmentAndPeriod = async (
  apartmentId: string,
  month: number,
  year: number
): Promise<MeterReading[]> => {
  try {
    if (!apartmentId || typeof apartmentId !== 'string') {
      throw new Error('Apartment ID must be a string');
    }
    const apartment = (await getDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId)) as Apartment | null;
    if (!apartment) {
      return [];
    }

    const wr = apartment.waterReadings as Record<string, unknown> | undefined;
    const allReadings: MeterReading[] = [];

    if (wr && typeof wr === 'object' && !Array.isArray(wr)) {
      for (const key of ['coldmeterwater', 'hotmeterwater'] as const) {
        const md = wr[key] as Record<string, unknown> | undefined;
        if (md && Array.isArray(md.history)) {
          for (const h of md.history as MeterReading[]) allReadings.push(h);
        }
      }
    } else if (Array.isArray(wr)) {
      for (const item of wr as Record<string, unknown>[]) {
        if (Array.isArray(item.history)) {
          for (const h of item.history as MeterReading[]) allReadings.push(h);
        }
      }
    }

    return allReadings.filter(
      (r) => Number(r.month) === Number(month) && Number(r.year) === Number(year)
    );
  } catch (error) {
    console.error('Error getting meter readings:', error);
    throw error;
  }
};

/**
 * Get all meter readings by apartment
 */
export const getMeterReadingsByApartment = async (apartmentId: string): Promise<MeterReading[]> => {
  try {
    if (!apartmentId || typeof apartmentId !== 'string') {
      throw new Error('Apartment ID must be a string');
    }
    const apartment = (await getDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId)) as Apartment | null;
    if (!apartment) {
      return [];
    }

    const allReadings: MeterReading[] = [];
    const wr = apartment.waterReadings;

    if (Array.isArray(wr)) {
      // Legacy array format
      for (const item of wr) {
        if (item && typeof item === 'object') {
          const itemObj = item as Record<string, unknown>;
          if (Array.isArray(itemObj.history)) {
            for (const h of itemObj.history) {
              allReadings.push(h as MeterReading);
            }
          }
        }
      }
    } else if (wr && typeof wr === 'object') {
      // New named object format: { coldmeterwater, hotmeterwater }
      for (const key of ['coldmeterwater', 'hotmeterwater'] as const) {
        const meterData = (wr as Record<string, unknown>)[key];
        if (meterData && typeof meterData === 'object') {
          const md = meterData as Record<string, unknown>;
          if (Array.isArray(md.history)) {
            for (const h of md.history) {
              allReadings.push(h as MeterReading);
            }
          }
        }
      }
    }

    return allReadings;
  } catch (error) {
    console.error('Error getting meter readings by apartment:', error);
    throw error;
  }
};

/**
 * Get meter readings by company
 */
export const getMeterReadingsByCompany = async (companyId: string): Promise<MeterReading[]> => {
  try {
    if (!companyId || typeof companyId !== 'string') {
      throw new Error('Company ID must be a string');
    }
    // apartments store company ids in array field 'companyIds' (or legacy companyId). Use service to handle both schemas.
    const apartments = await getApartmentsByCompany(companyId);

    // Collect readings from all apartment meters
    const allReadings: MeterReading[] = [];
    for (const apartment of apartments) {
      const readings = await getMeterReadingsByApartment(apartment.id);
      allReadings.push(...readings);
    }

    return allReadings;
  } catch (error) {
    console.error('Error getting meter readings by company:', error);
    throw error;
  }
};

/**
 * Get last meter reading for a meter
 */
export const getLastMeterReading = async (
  apartmentId: string,
  meterId: string
): Promise<MeterReading | null> => {
  try {
    const apartment = (await getDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId)) as Apartment | null;
    if (!apartment) {
      return null;
    }

    const wr = apartment.waterReadings as Record<string, unknown> | undefined;
    let meterGroup: Record<string, unknown> | undefined;

    if (wr && typeof wr === 'object' && !Array.isArray(wr)) {
      // New named format
      for (const key of ['coldmeterwater', 'hotmeterwater'] as const) {
        const candidate = wr[key] as Record<string, unknown> | undefined;
        if (candidate?.meterId === meterId) { meterGroup = candidate; break; }
      }
    } else if (Array.isArray(wr)) {
      // Legacy array format
      meterGroup = (wr as Record<string, unknown>[]).find((r) => r.meterId === meterId);
    }

    if (!meterGroup || !Array.isArray(meterGroup.history) || (meterGroup.history as any[]).length === 0) {
      return null;
    }

    const history = meterGroup.history as MeterReading[];
    const sorted = [...history].sort(
      (a, b) => new Date(String(b.submittedAt)).getTime() - new Date(String(a.submittedAt)).getTime()
    );

    return sorted[0];
  } catch (error) {
    console.error('Error getting last meter reading:', error);
    throw error;
  }
};

/**
 * Update meter reading
 */
export const updateMeterReading = async (
  apartmentId: string,
  readingId: string,
  data: Partial<Omit<MeterReading, 'id'>>
): Promise<void> => {
  try {
    // Get apartment to find which meter this reading belongs to
    const apartment = (await getDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId)) as Apartment | null;
    if (!apartment) {
      throw new Error('Квартира не найдена');
    }

    // Find the reading inside waterReadings named groups
    const wr = apartment.waterReadings as Record<string, unknown> | undefined;
    let foundKey: 'coldmeterwater' | 'hotmeterwater' | null = null;
    let foundGroup: Record<string, unknown> | null = null;
    let foundReadingIndex = -1;

    if (wr && typeof wr === 'object' && !Array.isArray(wr)) {
      for (const key of ['coldmeterwater', 'hotmeterwater'] as const) {
        const md = wr[key] as Record<string, unknown> | undefined;
        if (md && Array.isArray(md.history)) {
          const idx = (md.history as MeterReading[]).findIndex((h) => h.id === readingId);
          if (idx >= 0) { foundKey = key; foundGroup = md; foundReadingIndex = idx; break; }
        }
      }
    }

    if (!foundKey || !foundGroup || foundReadingIndex === -1) {
      throw new Error('Показание не найдено');
    }

    const updatedHistory = [...(foundGroup.history as MeterReading[])];
    const oldReading = updatedHistory[foundReadingIndex];
    updatedHistory[foundReadingIndex] = { ...oldReading, ...data, id: oldReading.id } as MeterReading;

    await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId, {
      [`waterReadings.${foundKey}`]: { ...foundGroup, history: updatedHistory },
    });
  } catch (error) {
    console.error('Error updating meter reading:', error);
    throw error;
  }
};

/**
 * Delete meter reading
 */
export const deleteMeterReading = async (
  apartmentId: string,
  readingId: string
): Promise<void> => {
  try {
    // Get apartment to find which meter this reading belongs to
    const apartment = (await getDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId)) as Apartment | null;
    if (!apartment) {
      throw new Error('Квартира не найдена');
    }

    // only allow deleting readings for the current month/year
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // JS months 0-11 -> 1-12
    const currentYear = now.getFullYear();

    // Find the reading inside waterReadings named groups
    const wr = apartment.waterReadings as Record<string, unknown> | undefined;
    let foundKey: 'coldmeterwater' | 'hotmeterwater' | null = null;
    let foundGroup: Record<string, unknown> | null = null;
    let readingToDelete: MeterReading | null = null;

    if (wr && typeof wr === 'object' && !Array.isArray(wr)) {
      for (const key of ['coldmeterwater', 'hotmeterwater'] as const) {
        const md = wr[key] as Record<string, unknown> | undefined;
        if (md && Array.isArray(md.history)) {
          const found = (md.history as MeterReading[]).find((h) => h.id === readingId);
          if (found) { foundKey = key; foundGroup = md; readingToDelete = found; break; }
        }
      }
    }

    if (!foundKey || !foundGroup || !readingToDelete) {
      throw new Error('Показание не найдено');
    }

    // Check if reading is from current month/year
    const readDate = readingToDelete.submittedAt instanceof Date
      ? readingToDelete.submittedAt
      : new Date(String(readingToDelete.submittedAt));
    const readMonth = readDate.getMonth() + 1;
    const readYear = readDate.getFullYear();

    if (Number(readMonth) !== Number(currentMonth) || Number(readYear) !== Number(currentYear)) {
      throw new Error('Нельзя удалять показания прошлых месяцев');
    }

    const updatedHistory = (foundGroup.history as MeterReading[]).filter((h) => h.id !== readingId);

    await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId, {
      [`waterReadings.${foundKey}`]: { ...foundGroup, history: updatedHistory },
    });
  } catch (error) {
    console.error('Error deleting meter reading:', error);
    throw error;
  }
};

export type { Meter, MeterReading };
