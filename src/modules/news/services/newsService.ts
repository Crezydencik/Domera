/**
 * News module service
 *
 * Handles news-related operations:
 * - Create news
 * - Get news by company
 * - Update news
 * - Delete news
 */

import {
  createDocument,
  getDocument,
  getDocumentsByCompany,
  updateDocument,
  deleteDocument,
} from '@/firebase/services/firestoreService';
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';
import type { NewsItem } from '@/shared/types';

/**
 * Create news item
 */
export const createNews = async (
  data: Omit<NewsItem, 'id' | 'createdAt'>
): Promise<NewsItem> => {
  try {
    const newsData: Omit<NewsItem, 'id'> = {
      ...data,
      createdAt: new Date(),
    };

    const id = await createDocument(FIRESTORE_COLLECTIONS.NEWS, newsData);

    return {
      id,
      ...newsData,
    };
  } catch (error) {
    console.error('Error creating news:', error);
    throw error;
  }
};

/**
 * Get news by ID
 */
export const getNews = async (newsId: string): Promise<NewsItem | null> => {
  try {
    const doc = await getDocument(FIRESTORE_COLLECTIONS.NEWS, newsId);
    return doc ? ({ id: newsId, ...doc } as NewsItem) : null;
  } catch (error) {
    console.error('Error getting news item:', error);
    throw error;
  }
};

/**
 * Get all news for a company
 */
export const getNewsByCompany = async (companyId: string): Promise<NewsItem[]> => {
  try {
    const news = await getDocumentsByCompany(FIRESTORE_COLLECTIONS.NEWS, companyId);
    return news as NewsItem[];
  } catch (error) {
    console.error('Error getting news by company:', error);
    throw error;
  }
};

/**
 * Update news item
 */
export const updateNews = async (
  newsId: string,
  data: Partial<Omit<NewsItem, 'id'>>
): Promise<void> => {
  try {
    await updateDocument(FIRESTORE_COLLECTIONS.NEWS, newsId, data);
  } catch (error) {
    console.error('Error updating news:', error);
    throw error;
  }
};

/**
 * Delete news item
 */
export const deleteNews = async (newsId: string): Promise<void> => {
  try {
    await deleteDocument(FIRESTORE_COLLECTIONS.NEWS, newsId);
  } catch (error) {
    console.error('Error deleting news item:', error);
    throw error;
  }
};

export type { NewsItem };
