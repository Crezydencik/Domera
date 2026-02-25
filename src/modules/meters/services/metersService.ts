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
    const baseReading: MeterReading = {
      id,
      ...data,
      submittedAt: new Date(),
    };

    // attach WMETNUM (meter serial) and date metadata to the reading when stored inside apartment.groups
    const meterDocForMeta = await getDocument(FIRESTORE_COLLECTIONS.METERS, data.meterId).catch(() => null) as Meter | null;
    const meterSerialForMeta = meterDocForMeta?.serialNumber ?? '';
    const createdReading: Record<string, unknown> = {
      ...baseReading,
      WMETNUM: meterSerialForMeta,
      date: baseReading.submittedAt,
    };

    const currentReadings = Array.isArray(apartment.waterReadings) ? apartment.waterReadings : [];

    // Detect grouped structure: elements that have a 'history' array (group per meter)
    const hasGrouped = currentReadings.some((r) => typeof r === 'object' && Array.isArray((r as any).history));

    if (hasGrouped) {
      // Find group for this meterId
      const next = [...currentReadings];
      const groupIndex = next.findIndex((g) => (g as any).meterId === data.meterId);
      if (groupIndex >= 0) {
        const group = { ...(next[groupIndex] as any) };
        const existingHistory = Array.isArray(group.history) ? [...group.history] : [];
        // Server-side duplicate check: only one reading per meter per month/year
        const duplicate = existingHistory.some((h: any) => Number(h.month) === Number(data.month) && Number(h.year) === Number(data.year));
        if (duplicate) {
          throw new Error('Показание для этого счетчика уже подано за указанный месяц');
        }
        group.history = [...existingHistory, createdReading];

        // ensure group meta fields exist (wrname, wrnum, wrexdate)
        try {
          const meterDoc = (await getDocument(FIRESTORE_COLLECTIONS.METERS, data.meterId)) as Meter | null;
          if (meterDoc) {
            group.wrname = meterDoc.name ?? group.wrname ?? '';
            group.wrnum = meterDoc.serialNumber ?? group.wrnum ?? '';
            group.wrexdate = meterDoc.checkDueDate ?? group.wrexdate ?? null;
          }
        } catch (e) {
          // ignore
        }

        next[groupIndex] = group;
      } else {
        // create new group with meta
        let wrname = '';
        let wrnum = '';
        let wrexdate: unknown = null;
        try {
          const meterDoc = (await getDocument(FIRESTORE_COLLECTIONS.METERS, data.meterId)) as Meter | null;
          if (meterDoc) {
            wrname = meterDoc.name ?? '';
            wrnum = meterDoc.serialNumber ?? '';
            wrexdate = meterDoc.checkDueDate ?? null;
          }
        } catch (e) {
          // ignore
        }

        (next as any[]).push({ meterId: data.meterId, wrname, wrnum, wrexdate, history: [createdReading] });
      }

        await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, data.apartmentId, {
          waterReadings: next,
        });

        // No meter-level subcollection write — history is stored inside apartment.waterReadings groups only.
    } else {
      // Legacy flat array: migrate to grouped format so each meter keeps history
      // Build groups from existing flat readings
      const groups: Record<string, MeterReading[]> = {};
      for (const r of currentReadings) {
        if (r && typeof r === 'object' && typeof (r as any).meterId === 'string') {
          const mid = (r as any).meterId as string;
          groups[mid] = groups[mid] || [];
          groups[mid].push(r as MeterReading);
        }
      }

      // Ensure group for incoming meter
      groups[data.meterId] = groups[data.meterId] || [];
      // Server-side duplicate check for legacy data: prevent two readings for same meter/month
      const dupLegacy = groups[data.meterId].some((h) => Number(h.month) === Number(data.month) && Number(h.year) === Number(data.year));
      if (dupLegacy) {
        throw new Error('Показание для этого счетчика уже подано за указанный месяц');
      }
      groups[data.meterId].push(createdReading as MeterReading);

      // enrich groups with meter meta (wrname, wrnum, wrexdate)
      const meterIds = Object.keys(groups);
      const meterDocs = await Promise.all(
        meterIds.map(async (mid) => {
          try {
            return (await getDocument(FIRESTORE_COLLECTIONS.METERS, mid)) as Meter | null;
          } catch (e) {
            return null;
          }
        })
      );

      const next = meterIds.map((mid, idx) => {
        const md = meterDocs[idx];
        return {
          meterId: mid,
          wrname: md?.name ?? '',
          wrnum: md?.serialNumber ?? '',
          wrexdate: md?.checkDueDate ?? null,
          history: groups[mid],
        };
      });

      await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, data.apartmentId, {
        waterReadings: next,
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
    const readings = Array.isArray(apartment?.waterReadings) ? apartment.waterReadings : [];

    return readings.filter((reading) => reading.month === month && reading.year === year);
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
    const raw = Array.isArray(apartment?.waterReadings) ? apartment.waterReadings : [];

    // Normalize: if grouped by meter (objects with history arrays) then flatten
    // Preserve group-level metadata (wrnum, wrexdate) by attaching them to each flattened reading
    const flattened: MeterReading[] = [];
    for (const item of raw) {
      if (item && typeof item === 'object' && Array.isArray((item as any).history)) {
        const group = item as any;
        const groupWrnum = group.wrnum ?? group.WRNUM ?? '';
        const groupWrexdate = group.wrexdate ?? group.WREXDATE ?? null;
        for (const h of group.history) {
          const enriched = { ...(h as Record<string, unknown>) } as any;
          if (!enriched.WMETNUM && groupWrnum) enriched.WMETNUM = groupWrnum;
          if (enriched.wrexdate === undefined || enriched.wrexdate === null) enriched.wrexdate = groupWrexdate;
          flattened.push(enriched as MeterReading);
        }
      } else if (item && typeof item === 'object' && typeof (item as any).meterId === 'string') {
        // legacy single reading object
        flattened.push(item as MeterReading);
      }
    }

    return flattened;
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

    // flatten per-apartment readings and preserve group-level metadata
    return apartments.flatMap((apartment) => {
      const raw = Array.isArray(apartment.waterReadings) ? apartment.waterReadings : [];
      const flattened: MeterReading[] = [];
      for (const item of raw) {
        if (item && typeof item === 'object' && Array.isArray((item as any).history)) {
          const group = item as any;
          const groupWrnum = group.wrnum ?? group.WRNUM ?? '';
          const groupWrexdate = group.wrexdate ?? group.WREXDATE ?? null;
          for (const h of group.history) {
            const enriched = { ...(h as Record<string, unknown>) } as any;
            if (!enriched.WMETNUM && groupWrnum) enriched.WMETNUM = groupWrnum;
            if (enriched.wrexdate === undefined || enriched.wrexdate === null) enriched.wrexdate = groupWrexdate;
            flattened.push(enriched as MeterReading);
          }
        } else if (item && typeof item === 'object' && typeof (item as any).meterId === 'string') {
          flattened.push(item as MeterReading);
        }
      }
      return flattened;
    });
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
    const raw = Array.isArray(apartment?.waterReadings) ? apartment.waterReadings : [];
    const candidates: MeterReading[] = [];
    for (const item of raw) {
      if (item && typeof item === 'object' && Array.isArray((item as any).history)) {
        for (const h of (item as any).history) {
          if ((h as any).meterId === meterId) candidates.push(h as MeterReading);
        }
      } else if (item && typeof item === 'object' && (item as any).meterId === meterId) {
        candidates.push(item as MeterReading);
      }
    }

    if (candidates.length === 0) return null;

    const sorted = candidates.sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
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
    const apartment = (await getDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId)) as Apartment | null;
    if (!apartment) {
      throw new Error('Квартира не найдена');
    }

    const raw = Array.isArray(apartment.waterReadings) ? apartment.waterReadings : [];
    const hasGrouped = raw.some((r) => typeof r === 'object' && Array.isArray((r as any).history));

    if (hasGrouped) {
      const next = raw.map((item) => {
        if (item && typeof item === 'object' && Array.isArray((item as any).history)) {
          const group = { ...(item as any) };
          group.history = group.history.map((h: any) => (h.id === readingId ? { ...h, ...data } : h));
          return group;
        }
        return item;
      });

      await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId, { waterReadings: next });
      return;
    }

    const readings = raw as any[];
    const nextReadings = readings.map((reading) => (reading.id === readingId ? { ...reading, ...data } : reading));

    await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId, {
      waterReadings: nextReadings,
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
    const apartment = (await getDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId)) as Apartment | null;
    if (!apartment) {
      throw new Error('Квартира не найдена');
    }

    const raw = Array.isArray(apartment.waterReadings) ? apartment.waterReadings : [];
    const hasGrouped = raw.some((r) => typeof r === 'object' && Array.isArray((r as any).history));

    // only allow deleting readings for the current month/year
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // JS months 0-11 -> 1-12
    const currentYear = now.getFullYear();

    if (hasGrouped) {
      let found = false;
      let forbidden = false;
      const next = raw.map((item) => {
        if (item && typeof item === 'object' && Array.isArray((item as any).history)) {
          const group = { ...(item as any) };
          const newHistory: any[] = [];
          for (const h of group.history) {
            if (h && (h as any).id === readingId) {
              found = true;
              if (Number((h as any).month) !== Number(currentMonth) || Number((h as any).year) !== Number(currentYear)) {
                forbidden = true;
              }
              // skip (delete) this reading
              continue;
            }
            newHistory.push(h);
          }
          group.history = newHistory;
          return group;
        }
        return item;
      });

      if (forbidden) {
        throw new Error('Нельзя удалять показания прошлых месяцев');
      }

      if (found) {
        await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId, { waterReadings: next });
        return;
      }
      // fall through to legacy handling if not found
    }

    const readings = raw as any[];
    const idx = readings.findIndex((reading) => reading.id === readingId);
    if (idx === -1) {
      throw new Error('Показание не найдено');
    }

    const target = readings[idx];
    if (Number(target.month) !== Number(currentMonth) || Number(target.year) !== Number(currentYear)) {
      throw new Error('Нельзя удалять показания прошлых месяцев');
    }

    await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, apartmentId, {
      waterReadings: readings.filter((reading) => reading.id !== readingId),
    });
  } catch (error) {
    console.error('Error deleting meter reading:', error);
    throw error;
  }
};

export type { Meter, MeterReading };
