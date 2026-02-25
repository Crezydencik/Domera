# Domera - Руководство по разработке

## 🚀 Быстрый старт

### Установка

```bash
# Установить зависимости
npm install

# Скопировать переменные окружения
cp .env.example .env.local

# Заполнить Firebase конфигурацию в .env.local
# Получить значения с Firebase Console

# Запустить сервер разработки
npm run dev
```

Приложение будет доступно на `http://localhost:3000`

## 📝 Создание новой страницы

### 1. Страница для ManagementCompany (закрытая маршрут)

```typescript
// app/(dashboard)/buildings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { Building } from '@/shared/types';
import { getBuildingsByCompany } from '@/modules/buildings/services/buildingsService';

export default function BuildingsPage() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBuildings = async () => {
      if (!user) return;
      try {
        const data = await getBuildingsByCompany(user.companyId);
        setBuildings(data);
      } catch (error) {
        console.error('Error fetching buildings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBuildings();
  }, [user]);

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="container">
      <h1>Мои дома</h1>
      <ul>
        {buildings.map((building) => (
          <li key={building.id}>
            <h2>{building.name}</h2>
            <p>{building.address}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 2. Страница для Resident (защищённая маршрут)

```typescript
// app/(dashboard)/meter-readings/page.tsx
'use client';

import { useAuth } from '@/shared/hooks/useAuth';
import { isMeterSubmissionAllowed } from '@/shared/lib/utils';

export default function MeterReadingsPage() {
  const { user } = useAuth();
  const canSubmit = isMeterSubmissionAllowed(25); // День 25 числа

  if (!canSubmit) {
    return (
      <div className="alert">
        Передача показаний доступна с 25 числа
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Показания счётчиков</h1>
      {/* Форма для ввода показаний */}
    </div>
  );
}
```

## 🔧 Создание нового сервиса

```typescript
// modules/buildings/services/buildingsService.ts
import { Building } from '@/shared/types';
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';
import {
  createDocument,
  queryDocuments,
} from '@/firebase/services/firestoreService';
import { where } from 'firebase/firestore';

/**
 * Создать новый дом
 */
export const createBuilding = async (
  companyId: string,
  name: string,
  address: string
): Promise<Building> => {
  const building = await createDocument(FIRESTORE_COLLECTIONS.BUILDINGS, {
    companyId,
    name,
    address,
  });

  return {
    id: building,
    companyId,
    name,
    address,
  };
};

/**
 * Получить дома компании
 */
export const getBuildingsByCompany = async (companyId: string): Promise<Building[]> => {
  const buildings = await queryDocuments(FIRESTORE_COLLECTIONS.BUILDINGS, [
    where('companyId', '==', companyId),
  ]);

  return buildings as Building[];
};
```

## 🎨 Создание компонента

```typescript
// modules/buildings/components/BuildingForm.tsx
'use client';

import { useState } from 'react';
import { Building } from '@/shared/types';
import { validateBuildingForm } from '@/shared/validation';
import { createBuilding } from '../services/buildingsService';

interface BuildingFormProps {
  onSubmit?: (building: Building) => void;
  onError?: (error: string) => void;
}

export function BuildingForm({ onSubmit, onError }: BuildingFormProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Валидация
    const validation = validateBuildingForm(name, address);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setLoading(true);
    try {
      const building = await createBuilding(
        // Получить companyId из контекста
        '',
        name,
        address
      );
      onSubmit?.(building);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Название дома</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />
        {errors.name && <span className="error">{errors.name}</span>}
      </div>

      <div>
        <label>Адрес</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={loading}
        />
        {errors.address && <span className="error">{errors.address}</span>}
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Сохранение...' : 'Сохранить'}
      </button>
    </form>
  );
}
```

## 🔐 Защита маршрутов

### Middleware для проверки аутентификации

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/firebase/config';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Защищённые маршруты
  const protectedRoutes = ['/dashboard', '/buildings', '/invoices'];
  const isProtected = protectedRoutes.some((route) => path.startsWith(route));

  if (isProtected) {
    // Проверить наличие auth token в cookie или header
    const authToken = request.cookies.get('auth_token');

    if (!authToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/buildings/:path*', '/invoices/:path*'],
};
```

## ✅ Чеклист для новой фичи

Когда добавляете новую функцию, убедитесь что:

- [ ] Добавлены типы в `shared/types/index.ts`
- [ ] Добавлены константы в `shared/constants/index.ts`
- [ ] Создана Firestore коллекция (если нужна)
- [ ] Написаны сервисы в модуле
- [ ] Написана валидация в `shared/validation/index.ts`
- [ ] Созданы компоненты UI
- [ ] Добавлены маршруты в `app/`
- [ ] Добавлены security rules для Firestore
- [ ] Написаны комментарии и документация
- [ ] Протестирована в браузере
- [ ] Проверена безопасность (multi-tenant изоляция)

## 🐛 Debug и логирование

### Используйте условное логирование

```typescript
// Включить через переменную окружения
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';

if (DEBUG) {
  console.log('Building fetched:', building);
}
```

### Firefox DevTools

1. Откройте DevTools (F12)
2. Перейдите на вкладку Network и проверьте Firestore запросы
3. Используйте Console для выполнения код в контексте приложения

### Firebase Emulator (для локальной разработки)

```bash
# Установить Firebase CLI
npm install -g firebase-tools

# Запустить эмулятор
firebase emulators:start

# Использовать эмулятор в конфигурации
if (process.env.NODE_ENV === 'development') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
}
```

## 📊 Структура данных примеры

### Company dengan Residents

```
companies/
  doc_id_123/
    ├── id: "doc_id_123"
    ├── name: "ООО Управляющая компания"
    └── createdAt: 2024-01-15

users/
  uid_resident_1/
    ├── uid: "uid_resident_1"
    ├── email: "resident@example.com"
    ├── role: "Resident"
    ├── companyId: "doc_id_123"
    ├── apartmentId: "apt_123"
    └── createdAt: 2024-01-15

buildings/
  building_456/
    ├── id: "building_456"
    ├── companyId: "doc_id_123"
    ├── name: "Дом 1"
    └── address: "ул. Пушкина, 10"

apartments/
  apt_123/
    ├── id: "apt_123"
    ├── buildingId: "building_456"
    ├── companyId: "doc_id_123"
    ├── number: "12"
    └── residentId: "uid_resident_1"

meters/
  meter_789/
    ├── id: "meter_789"
    ├── apartmentId: "apt_123"
    ├── type: "water"
    └── serialNumber: "WM-123456"

meter_readings/
  reading_001/
    ├── id: "reading_001"
    ├── companyId: "doc_id_123"
    ├── apartmentId: "apt_123"
    ├── meterId: "meter_789"
    ├── previousValue: 100
    ├── currentValue: 105
    ├── consumption: 5
    ├── month: 1
    ├── year: 2024
    └── submittedAt: 2024-01-25
```

## 🚨 Common Issues

### Ошибка: "User not found"

```typescript
// ✗ Неправильно
const user = auth.currentUser; // null если не аутентифицирован

// ✓ Правильно
const user = auth.currentUser;
if (!user) {
  throw new Error('User not authenticated');
}
```

### Ошибка: "Missing or insufficient permissions"

```typescript
// Проверьте:
// 1. Правильность Firestore Security Rules
// 2. Наличие companyId в документе
// 3. Соответствие companyId в Rules и в документе
```

### Ошибка: "Document not found"

```typescript
// ✓ Правильно проверить существование
const doc = await getDocument(collection, id);
if (!doc) {
  throw new Error('Document not found');
}
```

## 📚 Полезные ресурсы

- [Firebase Docs](https://firebase.google.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [TypeScript Docs](https://www.typescriptlang.org/docs)
- [React Docs](https://react.dev)

## 🤝 Code Review Checklist

Перед отправкой PR:

- [ ] Код следует соглашениям проекта
- [ ] Нет console.log в production коде
- [ ] Типы правильные и полные
- [ ] Ошибки обработаны корректно
- [ ] Multi-tenant изоляция соблюдена
- [ ] Security rules соответствуют коду
- [ ] Замечания типа FIXME удалены

