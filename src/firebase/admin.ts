import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const getServiceAccount = () => {
  const envValue = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (envValue) {
    // Если начинается с { — это JSON, иначе — путь к файлу
    if (envValue.trim().startsWith('{')) {
      return JSON.parse(envValue);
    } else {
      // Путь может быть относительным или абсолютным
      const path = envValue.startsWith('.') || envValue.startsWith('/')
        ? join(process.cwd(), envValue)
        : envValue;
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf-8');
        return JSON.parse(content);
      } else {
        throw new Error(`Файл сервисного аккаунта не найден по пути: ${path}`);
      }
    }
  }

  // Fallback: ищем файл по умолчанию
  const serviceAccountPath = join(process.cwd(), 'src/firebase/firebase-service-account.json');
  if (existsSync(serviceAccountPath)) {
    const content = readFileSync(serviceAccountPath, 'utf-8');
    return JSON.parse(content);
  }

  throw new Error(
    'Firebase Admin не настроен. Добавьте FIREBASE_SERVICE_ACCOUNT_JSON (JSON или путь) или файл src/firebase/firebase-service-account.json'
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
