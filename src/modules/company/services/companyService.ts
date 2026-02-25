/**
 * Company module service
 * 
 * Handles company-related operations:
 * - Create company
 * - Get company
 * - Update company
 */

import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
} from '@/firebase/services/firestoreService';
import { query, where, collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';
import { Company } from '@/shared/types';

/**
 * Create new company
 */
export const createCompany = async (name: string): Promise<Company> => {
  try {
    const companyData = {
      name,
      createdAt: new Date(),
    };

    const id = await createDocument(FIRESTORE_COLLECTIONS.COMPANIES, companyData);

    return {
      id,
      ...companyData,
    };
  } catch (error) {
    console.error('Error creating company:', error);
    throw error;
  }
};

/**
 * Get company by ID
 */
export const getCompany = async (companyId: string): Promise<Company | null> => {
  try {
    const doc = await getDocument(FIRESTORE_COLLECTIONS.COMPANIES, companyId);
    return doc ? (doc as Company) : null;
  } catch (error) {
    console.error('Error getting company:', error);
    throw error;
  }
};

/**
 * Update company
 */
export const updateCompany = async (
  companyId: string,
  data: Partial<Omit<Company, 'id'>>
): Promise<void> => {
  try {
    await updateDocument(FIRESTORE_COLLECTIONS.COMPANIES, companyId, data);
  } catch (error) {
    console.error('Error updating company:', error);
    throw error;
  }
};

export type { Company };
