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
// Now accepts userId and optional buildings array
export const createCompany = async (
  name: string,
  userId: string,
  extra?: { address?: string; phone?: string; email?: string }
): Promise<Company> => {
  try {
    const companyData: any = {
      name,
      userId,
      buildings: [], // [{ id, name }]
      createdAt: new Date(),
    };
    if (extra) {
      if (extra.address) companyData.address = extra.address;
      if (extra.phone) companyData.phone = extra.phone;
      if (extra.email) companyData.email = extra.email;
    }

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
// Accepts updates for userId and buildings
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
