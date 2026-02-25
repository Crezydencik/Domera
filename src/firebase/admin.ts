import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const getServiceAccount = () => {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    return JSON.parse(rawJson);
  }

  const serviceAccountPath = join(process.cwd(), 'firebase-service-account.json');
  if (existsSync(serviceAccountPath)) {
    const content = readFileSync(serviceAccountPath, 'utf-8');
    return JSON.parse(content);
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
