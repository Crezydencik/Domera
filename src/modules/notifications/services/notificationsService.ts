import { Notification, NotificationType } from '@/shared/types';
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';
import { createDocument, queryDocuments, updateDocument } from '@/firebase/services/firestoreService';
import { toSafeErrorDetails } from '@/shared/lib/safeLog';

/**
 * Create a notification for a user
 */
export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    apartmentId?: string;
    buildingId?: string;
  }
): Promise<Notification> => {
  try {
    const notificationData = {
      userId,
      type,
      title,
      message,
      ...(options?.apartmentId && { apartmentId: options.apartmentId }),
      ...(options?.buildingId && { buildingId: options.buildingId }),
      createdAt: new Date(),
      read: false,
    };

    const id = await createDocument(FIRESTORE_COLLECTIONS.NOTIFICATIONS, notificationData);
    
    return {
      id,
      ...notificationData,
    } as Notification;
  } catch (error) {
    console.error('Error creating notification:', toSafeErrorDetails(error));
    throw error;
  }
};

/**
 * Get notifications for a user
 */
export const getUserNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const results = await queryDocuments(FIRESTORE_COLLECTIONS.NOTIFICATIONS, [
      { field: 'userId', operator: '==', value: userId },
    ]);

    return results.map(doc => ({
      id: doc.id as string,
      userId: doc.userId as string,
      type: doc.type as NotificationType,
      title: doc.title as string,
      message: doc.message as string,
      apartmentId: doc.apartmentId as string | undefined,
      buildingId: doc.buildingId as string | undefined,
      createdAt: doc.createdAt as Date,
      read: doc.read as boolean,
      readAt: doc.readAt as Date | undefined,
    }));
  } catch (error) {
    console.error('Error getting user notifications:', toSafeErrorDetails(error));
    throw error;
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    await updateDocument(FIRESTORE_COLLECTIONS.NOTIFICATIONS, notificationId, {
      read: true,
      readAt: new Date(),
    });
  } catch (error) {
    console.error('Error marking notification as read:', toSafeErrorDetails(error));
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    const notifications = await getUserNotifications(userId);
    await Promise.all(
      notifications
        .filter(n => !n.read)
        .map(n => markNotificationAsRead(n.id))
    );
  } catch (error) {
    console.error('Error marking all notifications as read:', toSafeErrorDetails(error));
    throw error;
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    // Implement delete functionality
    // Note: Firestore doesn't have a direct delete document method exposed
    // You might want to use a soft delete (update read to true) or implement via API
    // Note: soft delete via API or deleteDocument should be handled at the route level
  } catch (error) {
    console.error('Error deleting notification:', toSafeErrorDetails(error));
    throw error;
  }
};
