/**
 * Projects module service
 *
 * Handles project-related operations:
 * - Create project
 * - Get projects by company
 * - Update project
 * - Delete project
 */

import {
  createDocument,
  getDocument,
  getDocumentsByCompany,
  updateDocument,
  deleteDocument,
} from '@/firebase/services/firestoreService';
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';
import type { Project } from '@/shared/types';

/**
 * Create new project
 */
export const createProject = async (
  data: Omit<Project, 'id' | 'createdAt'>
): Promise<Project> => {
  try {
    const projectData: Omit<Project, 'id'> = {
      ...data,
      createdAt: new Date(),
    };

    const id = await createDocument(FIRESTORE_COLLECTIONS.PROJECTS, projectData);

    return {
      id,
      ...projectData,
    };
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
};

/**
 * Get project by ID
 */
export const getProject = async (projectId: string): Promise<Project | null> => {
  try {
    const doc = await getDocument(FIRESTORE_COLLECTIONS.PROJECTS, projectId);
    return doc ? ({ id: projectId, ...doc } as Project) : null;
  } catch (error) {
    console.error('Error getting project:', error);
    throw error;
  }
};

/**
 * Get all projects for a company
 */
export const getProjectsByCompany = async (companyId: string): Promise<Project[]> => {
  try {
    const projects = await getDocumentsByCompany(FIRESTORE_COLLECTIONS.PROJECTS, companyId);
    return projects as Project[];
  } catch (error) {
    console.error('Error getting projects by company:', error);
    throw error;
  }
};

/**
 * Update project
 */
export const updateProject = async (
  projectId: string,
  data: Partial<Omit<Project, 'id'>>
): Promise<void> => {
  try {
    await updateDocument(FIRESTORE_COLLECTIONS.PROJECTS, projectId, data);
  } catch (error) {
    console.error('Error updating project:', error);
    throw error;
  }
};

/**
 * Delete project
 */
export const deleteProject = async (projectId: string): Promise<void> => {
  try {
    await deleteDocument(FIRESTORE_COLLECTIONS.PROJECTS, projectId);
  } catch (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
};

export type { Project };
