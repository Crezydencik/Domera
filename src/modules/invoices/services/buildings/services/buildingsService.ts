/**
 * Buildings module service
 * 
 * Handles all building-related operations:
 * - Create building
 * - Get buildings by company
 * - Update building
 * - Delete building
 */

import {
  createDocument,
  getDocument,
  getDocumentsByCompany,
  updateDocument,
  deleteDocument,
} from '@/firebase/services/firestoreService';
import {
  DEFAULT_WATER_METER_TEMPLATES,
  FIRESTORE_COLLECTIONS,
  METER_READING_RULES,
} from '@/shared/constants';
import { Building } from '@/shared/types';

/**
 * Create new building
 */
export const createBuilding = async (
  data: Omit<Building, 'id'>,
  companyId: string
): Promise<Building> => {
  try {
    const existingBuildings = await getBuildingsByCompany(data.companyId);

    if (existingBuildings.length > 0) {
      throw new Error('У одного управляющего может быть только один дом');
    }

    const buildingData = {
      ...data,
      managedBy: {
        companyId: data.managedBy?.companyId || data.companyId,
        companyName: data.managedBy?.companyName,
        managerUid: data.managedBy?.managerUid,
        managerEmail: data.managedBy?.managerEmail,
      },
      apartmentIds: Array.isArray(data.apartmentIds) ? data.apartmentIds : [],
      apartments: [], // [{ id, number }]
      waterMeterTemplates:
        Array.isArray(data.waterMeterTemplates) && data.waterMeterTemplates.length > 0
          ? data.waterMeterTemplates
          : [...DEFAULT_WATER_METER_TEMPLATES],
      waterSubmissionOpenDay:
        typeof data.waterSubmissionOpenDay === 'number' &&
        data.waterSubmissionOpenDay >= 1 &&
        data.waterSubmissionOpenDay <= 31
          ? data.waterSubmissionOpenDay
          : METER_READING_RULES.SUBMISSION_OPEN_DAY,
      createdAt: new Date(),
    };

    const id = await createDocument(FIRESTORE_COLLECTIONS.BUILDINGS, buildingData);

    // Update company doc: push building id and name
    const companyDoc = await getDocument(FIRESTORE_COLLECTIONS.COMPANIES, companyId);
    if (companyDoc) {
      const buildings = Array.isArray(companyDoc.buildings) ? companyDoc.buildings : [];
      buildings.push({ id, name: buildingData.name });
      await updateDocument(FIRESTORE_COLLECTIONS.COMPANIES, companyId, { buildings });
    }

    return {
      id,
      ...buildingData,
    };
  } catch (error) {
    console.error('Error creating building:', error);
    throw error;
  }
};

/**
 * Get building by ID
 */
export const getBuilding = async (buildingId: string): Promise<Building | null> => {
  try {
    const doc = await getDocument(FIRESTORE_COLLECTIONS.BUILDINGS, buildingId);
    return doc ? (doc as Building) : null;
  } catch (error) {
    console.error('Error getting building:', error);
    throw error;
  }
};

/**
 * Get all buildings for a company
 */
export const getBuildingsByCompany = async (companyId: string): Promise<Building[]> => {
  try {
    const buildings = await getDocumentsByCompany(FIRESTORE_COLLECTIONS.BUILDINGS, companyId);
    return buildings as Building[];
  } catch (error) {
    console.error('Error getting buildings by company:', error);
    throw error;
  }
};

/**
 * Update building
 */
export const updateBuilding = async (
  buildingId: string,
  data: Partial<Omit<Building, 'id'>>
): Promise<void> => {
  try {
    await updateDocument(FIRESTORE_COLLECTIONS.BUILDINGS, buildingId, data);
  } catch (error) {
    console.error('Error updating building:', error);
    throw error;
  }
};

/**
 * Delete building
 */
export const deleteBuilding = async (buildingId: string): Promise<void> => {
  try {
    await deleteDocument(FIRESTORE_COLLECTIONS.BUILDINGS, buildingId);
  } catch (error) {
    console.error('Error deleting building:', error);
    throw error;
  }
};

export type { Building };
