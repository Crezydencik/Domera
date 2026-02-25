/**
 * Invoices module service
 * 
 * Handles invoice-related operations:
 * - Create invoice
 * - Get invoices by apartment/company
 * - Update invoice status
 * - Delete invoice
 * - Upload invoice PDF
 */

import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
} from '@/firebase/services/firestoreService';
import { uploadFile, deleteFile } from '@/firebase/services/storageService';
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';
import { Invoice } from '@/shared/types';
import { query, where, collection, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebase/config';

/**
 * Create new invoice
 */
export const createInvoice = async (data: Omit<Invoice, 'id'>): Promise<Invoice> => {
  try {
    const id = await createDocument(FIRESTORE_COLLECTIONS.INVOICES, {
      ...data,
      createdAt: new Date(),
    });

    return {
      id,
      ...data,
      createdAt: new Date(),
    };
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
};

/**
 * Get invoice by ID
 */
export const getInvoice = async (invoiceId: string): Promise<Invoice | null> => {
  try {
    const doc = await getDocument(FIRESTORE_COLLECTIONS.INVOICES, invoiceId);
    return doc ? (doc as Invoice) : null;
  } catch (error) {
    console.error('Error getting invoice:', error);
    throw error;
  }
};

/**
 * Get invoices by apartment ID
 */
export const getInvoicesByApartment = async (apartmentId: string): Promise<Invoice[]> => {
  try {
    const invoices = await queryDocuments(FIRESTORE_COLLECTIONS.INVOICES, [
      where('apartmentId', '==', apartmentId),
    ]);
    return invoices as Invoice[];
  } catch (error) {
    console.error('Error getting invoices by apartment:', error);
    throw error;
  }
};

/**
 * Get invoices by company ID
 */
export const getInvoicesByCompany = async (companyId: string): Promise<Invoice[]> => {
  try {
    const invoices = await queryDocuments(FIRESTORE_COLLECTIONS.INVOICES, [
      where('companyId', '==', companyId),
    ]);
    return invoices as Invoice[];
  } catch (error) {
    console.error('Error getting invoices by company:', error);
    throw error;
  }
};

/**
 * Get invoices by building (via apartment)
 */
export const getInvoicesByBuilding = async (buildingId: string): Promise<Invoice[]> => {
  try {
    // This would require a more complex query or indexing
    // For now, we'd need to get apartments by building first
    const invoices = await queryDocuments(FIRESTORE_COLLECTIONS.INVOICES, [
      where('buildingId', '==', buildingId),
    ]);
    return invoices as Invoice[];
  } catch (error) {
    console.error('Error getting invoices by building:', error);
    throw error;
  }
};

/**
 * Update invoice status
 */
export const updateInvoiceStatus = async (
  invoiceId: string,
  status: 'pending' | 'paid' | 'overdue'
): Promise<void> => {
  try {
    await updateDocument(FIRESTORE_COLLECTIONS.INVOICES, invoiceId, { status });
  } catch (error) {
    console.error('Error updating invoice status:', error);
    throw error;
  }
};

/**
 * Update invoice
 */
export const updateInvoice = async (
  invoiceId: string,
  data: Partial<Omit<Invoice, 'id'>>
): Promise<void> => {
  try {
    await updateDocument(FIRESTORE_COLLECTIONS.INVOICES, invoiceId, data);
  } catch (error) {
    console.error('Error updating invoice:', error);
    throw error;
  }
};

/**
 * Delete invoice
 */
export const deleteInvoice = async (invoiceId: string): Promise<void> => {
  try {
    await deleteDocument(FIRESTORE_COLLECTIONS.INVOICES, invoiceId);
  } catch (error) {
    console.error('Error deleting invoice:', error);
    throw error;
  }
};

/**
 * Upload invoice with PDF
 * Creates invoice record and uploads PDF to storage
 */
export const uploadInvoiceWithPDF = async (
  invoiceData: Omit<Invoice, 'id' | 'pdfUrl' | 'createdAt'>,
  file: File
): Promise<Invoice> => {
  try {
    // Upload PDF first
    const pdfUrl = await uploadInvoicePDF(
      invoiceData.companyId,
      invoiceData.apartmentId,
      invoiceData.month,
      invoiceData.year,
      file
    );

    // Create invoice record with PDF URL
    const invoice = await createInvoice({
      ...invoiceData,
      pdfUrl,
    });

    return invoice;
  } catch (error) {
    console.error('Error uploading invoice with PDF:', error);
    throw error;
  }
};

/**
 * Delete invoice and its PDF
 */
export const deleteInvoiceWithPDF = async (invoice: Invoice): Promise<void> => {
  try {
    // Delete PDF from storage
    await deleteInvoicePDF(
      invoice.companyId,
      invoice.apartmentId,
      invoice.month,
      invoice.year
    );

    // Delete invoice record
    await deleteInvoice(invoice.id);
  } catch (error) {
    console.error('Error deleting invoice with PDF:', error);
    throw error;
  }
};

export type { Invoice };
