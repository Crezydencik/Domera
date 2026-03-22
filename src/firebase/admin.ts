import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const isPlaceholderServiceAccount = (value: Record<string, unknown>): boolean => {
  const projectId = typeof value.project_id === 'string' ? value.project_id : '';
  const privateKey = typeof value.private_key === 'string' ? value.private_key : '';
  const clientEmail = typeof value.client_email === 'string' ? value.client_email : '';

  return (
    projectId.includes('your-project-id') ||
    privateKey.includes('YOUR_PRIVATE_KEY') ||
    clientEmail.includes('example.iam.gserviceaccount.com')
  );
};

const readServiceAccountFromFile = () => {
  const serviceAccountPath = join(process.cwd(), 'src', 'firebase', 'firebase-service-account.json');
  if (existsSync(serviceAccountPath)) {
    const content = readFileSync(serviceAccountPath, 'utf-8');
    return JSON.parse(content);
  }

  return null;
};

const getServiceAccount = () => {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (!isPlaceholderServiceAccount(parsed)) {
        return parsed;
      }
      console.warn('firebase.admin.service_account.placeholder_ignored');
    } catch (error) {
      console.warn('firebase.admin.service_account.parse_failed');
    }
  }

  const fileServiceAccount = readServiceAccountFromFile();
  if (fileServiceAccount) {
    return fileServiceAccount;
  }

  throw new Error(
    'Firebase Admin не настроен. Добавьте FIREBASE_SERVICE_ACCOUNT_JSON или файл firebase-service-account.json'
  );
};

const getFirebaseAdminApp = (): App => {
  const existing = getApps();
  if (existing.length > 0) {
    return existing[0]!;
  }

  const serviceAccount = getServiceAccount();

  return initializeApp({
    credential: cert(serviceAccount),
  });
};

export const getFirebaseAdminAuth = () => getAuth(getFirebaseAdminApp());
export const getFirebaseAdminDb = () => getFirestore(getFirebaseAdminApp());
