/**
 * Firebase Storage service
 * 
 * Provides abstraction layer for all Firebase Storage operations
 * Handles file uploads, downloads, and deletion
 */

import {
  ref,
  uploadBytes,
  downloadURL,
  deleteObject,
  getBytes,
  Storage,
} from 'firebase/storage';
import { storage } from '../config';

/**
 * Upload file to Firebase Storage
 */
export const uploadFile = async (file: File, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await downloadURL(storageRef);
    return url;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Download file from Firebase Storage
 */
export const downloadFile = async (path: string): Promise<Blob> => {
  try {
    const storageRef = ref(storage, path);
    const bytes = await getBytes(storageRef);
    return new Blob([bytes]);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
};

/**
 * Get download URL for file
 */
export const getFileURL = async (path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    const url = await downloadURL(storageRef);
    return url;
  } catch (error) {
    console.error('Error getting file URL:', error);
    throw error;
  }
};

/**
 * Delete file from Firebase Storage
 */
export const deleteFile = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

/**
 * Upload invoice PDF
 */
export const uploadInvoicePDF = async (
  invoiceId: string,
  pdfFile: File
): Promise<string> => {
  return uploadFile(pdfFile, `invoices/${invoiceId}.pdf`);
};

/**
 * Delete invoice PDF
 */
export const deleteInvoicePDF = async (invoiceId: string): Promise<void> => {
  return deleteFile(`invoices/${invoiceId}.pdf`);
};

/**
 * Get invoice PDF URL
 */
export const getInvoicePDFUrl = async (invoiceId: string): Promise<string> => {
  return getFileURL(`invoices/${invoiceId}.pdf`);
};

export type { Storage };
