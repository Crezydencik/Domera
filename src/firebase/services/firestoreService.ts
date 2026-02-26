/**
 * Firestore database service
 * 
 * Provides abstraction layer for all Firestore operations
 * Implements multi-tenant data isolation through companyId filtering
 */

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  collection,
  QueryConstraint,
  WriteBatch,
  DocumentData,
  addDoc,
  writeBatch,
  WhereFilterOp,
} from 'firebase/firestore';
import { db } from '../config';
import { FIRESTORE_COLLECTIONS } from '../../shared/constants';
import type { Building } from '@/shared/types';

export const getBuildingsFromDatabase = async (): Promise<Building[]> => {
  try {
    const buildingsCollection = collection(db, FIRESTORE_COLLECTIONS.BUILDINGS);
    const snapshot = await getDocs(buildingsCollection);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Unnamed Building',
        managedBy: data.managedBy || {},
        companyId: data.companyId || "",
      };
    });
  } catch (error) {
    console.error('Error fetching buildings:', error);
    throw error;
  }
};

/**
 * Generic document operations
 */

/**
 * Create a new document with auto-generated ID
 */
export const createDocument = async (
  collectionName: string,
  data: DocumentData
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, collectionName), data);
    return docRef.id;
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Set document with specific ID
 */
export const setDocument = async (
  collectionName: string,
  docId: string,
  data: DocumentData
): Promise<void> => {
  try {
    await setDoc(doc(db, collectionName, docId), data);
  } catch (error) {
    console.error(`Error setting document in ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Set document inside a subcollection (creates or overwrites)
 */
export const setSubDocument = async (
  collectionName: string,
  docId: string,
  subcollectionName: string,
  subDocId: string,
  data: DocumentData
): Promise<void> => {
  try {
    await setDoc(doc(db, collectionName, docId, subcollectionName, subDocId), data);
  } catch (error) {
    console.error(`Error setting subdocument ${subcollectionName}/${subDocId} in ${collectionName}/${docId}:`, error);
    throw error;
  }
};

/**
 * Add document to a subcollection (auto-generated id)
 */
export const addSubDocument = async (
  collectionName: string,
  docId: string,
  subcollectionName: string,
  data: DocumentData
): Promise<string> => {
  try {
    const ref = await addDoc(collection(db, collectionName, docId, subcollectionName), data);
    return ref.id;
  } catch (error) {
    console.error(`Error adding subdocument to ${collectionName}/${docId}/${subcollectionName}:`, error);
    throw error;
  }
};

/**
 * Get all documents from a subcollection
 */
export const getSubcollectionDocuments = async (
  collectionName: string,
  docId: string,
  subcollectionName: string
): Promise<Record<string, unknown>[]> => {
  try {
    const q = query(collection(db, collectionName, docId, subcollectionName));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
  } catch (error) {
    console.error(`Error getting subcollection documents from ${collectionName}/${docId}/${subcollectionName}:`, error);
    throw error;
  }
};

/**
 * Get single document by ID
 */
export const getDocument = async (
  collectionName: string,
  docId: string
): Promise<DocumentData | null> => {
  try {
    const docSnapshot = await getDoc(doc(db, collectionName, docId));
    return docSnapshot.exists() ? docSnapshot.data() : null;
  } catch (error) {
    console.error(`Error getting document from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Update specific fields in a document
 */
export const updateDocument = async (
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> => {
  try {
    await updateDoc(doc(db, collectionName, docId), data);
  } catch (error) {
    console.error(`Error updating document in ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Delete a document
 */
export const deleteDocument = async (
  collectionName: string,
  docId: string
): Promise<void> => {
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Get documents matching query constraints
 */
export const queryDocuments = async (
  collectionName: string,
  // Accept either an array of simple condition objects { field, operator, value }
  // or an array of firebase QueryConstraint (result of where(...)). Many modules
  // call this helper with both styles, so support both.
  conditions:
    | Array<{ field: string; operator: string; value: unknown }>
    | QueryConstraint[]
): Promise<Record<string, unknown>[]> => {
  try {
    let q;
    // detect whether caller passed simple condition objects or firebase QueryConstraints
    const first = (conditions as unknown[])[0] as unknown;
    if (Array.isArray(conditions) && conditions.length > 0 && typeof first === 'object' && first !== null && 'field' in (first as Record<string, unknown>) && typeof (first as Record<string, unknown>).field === 'string') {
      const conds = conditions as Array<{ field: string; operator: string; value: unknown }>;
      const constraints: QueryConstraint[] = conds.map((condition) => {
        if (typeof condition.field !== 'string') {
          throw new Error(`Invalid field type: ${typeof condition.field}. Field must be a string.`);
        }
        return where(condition.field, condition.operator as WhereFilterOp, condition.value);
      });
      q = query(collection(db, collectionName), ...constraints);
    } else {
      // assume these are already QueryConstraint[] (e.g., callers passed firebase where(...))
      q = query(collection(db, collectionName), ...(conditions as QueryConstraint[]));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));
  } catch (error) {
    console.error(`Error querying documents in ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Get documents by company ID (multi-tenant isolation)
 */
export const getDocumentsByCompany = async (
  collectionName: string,
  companyId: string
): Promise<DocumentData[]> => {
  try {
    const conditions = [{ field: 'companyId', operator: '==', value: companyId }];
    return queryDocuments(collectionName, conditions);
  } catch (error) {
    console.error(`Error getting documents by company from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Get documents by multiple conditions
 */
export const getDocumentsByConditions = async (
  collectionName: string,
  conditions: Array<{ field: string; operator: WhereFilterOp; value: unknown }>
): Promise<DocumentData[]> => {
  try {
    const constraints: QueryConstraint[] = conditions.map((condition) => {
      if (typeof condition.field !== 'string') {
        throw new Error(`Invalid field type: ${typeof condition.field}. Field must be a string.`);
      }
      return where(condition.field, condition.operator, condition.value);
    });
    return queryDocuments(collectionName, constraints);
  } catch (error) {
    console.error(
      `Error getting documents by conditions from ${collectionName}:`,
      error
    );
    throw error;
  }
};

/**
 * Batch write operations
 */
export const executeBatch = async (
  callback: (batch: WriteBatch) => Promise<void>
): Promise<void> => {
  try {
    const batch = writeBatch(db);
    await callback(batch);
    await batch.commit();
  } catch (error) {
    console.error('Error executing batch operation:', error);
    throw error;
  }
};

/**
 * Check if document exists
 */
export const documentExists = async (
  collectionName: string,
  docId: string
): Promise<boolean> => {
  try {
    const docSnapshot = await getDoc(doc(db, collectionName, docId));
    return docSnapshot.exists();
  } catch (error) {
    console.error(`Error checking document existence in ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Count documents matching conditions
 */
export const countDocuments = async (
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<number> => {
  try {
    const q = query(collection(db, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error(`Error counting documents in ${collectionName}:`, error);
    throw error;
  }
};

export type { DocumentData, WriteBatch };
