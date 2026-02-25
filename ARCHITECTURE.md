# Domera - Архитектура проекта

## 📐 Структура проекта

```
domera/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (public)/             # Public routes (login, register)
│   │   ├── (dashboard)/          # Protected routes (requires auth)
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── modules/                  # Feature modules (domain-driven)
│   │   ├── auth/                 # Authentication module
│   │   │   ├── services/
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── company/              # Management company module
│   │   ├── buildings/            # Building management
│   │   ├── apartments/           # Apartment management
│   │   ├── meters/               # Meter readings
│   │   ├── invoices/             # Invoice management
│   │   └── invitations/          # User invitations
│   │
│   ├── shared/                   # Shared utilities and components
│   │   ├── components/
│   │   │   ├── layout/           # Layout components
│   │   │   └── ui/               # UI components (buttons, forms, etc)
│   │   ├── hooks/                # Custom React hooks
│   │   ├── lib/                  # Utility functions
│   │   ├── types/                # TypeScript type definitions
│   │   ├── constants/            # Application constants
│   │   └── validation/           # Validation schemas
│   │
│   ├── firebase/                 # Firebase integration
│   │   ├── config.ts             # Firebase initialization
│   │   ├── services/             # Firebase service layer
│   │   │   ├── authService.ts
│   │   │   ├── firestoreService.ts
│   │   │   ├── storageService.ts
│   │   │   └── index.ts
│   │   ├── functions/            # Cloud Functions
│   │   └── rules/                # Firestore & Storage rules
│   │
│   └── middleware.ts             # Next.js middleware (auth checks)
│
├── public/                       # Static assets
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── .env.example
└── README.md
```

## 🏗️ Архитектурные принципы

### 1. Слоистая архитектура

```
UI Layer (Components)
      ↓
Service Layer (Business Logic)
      ↓
Data Access Layer (Firebase Services)
      ↓
Firebase (Auth, Firestore, Storage)
```

### 2. Модульность

Проект разделён на отдельные модули по функциональности:

- **auth** - Аутентификация и управление пользователями
- **company** - Управление компаниями
- **buildings** - Управление домами
- **apartments** - Управление квартирами
- **meters** - Управление счётчиками и показаниями
- **invoices** - Управление счетами
- **invitations** - Приглашение пользователей

Каждый модуль может содержать:
- `services/` - Бизнес-логика
- `components/` - React компоненты
- `hooks/` - Кастомные хуки
- `types/` - Типы (если специфичны для модуля)

### 3. Multi-tenant изоляция

Все данные в Firestore содержат `companyId`:

```typescript
// Ни один документ не может быть создан без companyId
interface Document {
  id: string;
  companyId: string;  // ✓ Обязателен
  // ...другие поля
}
```

### 4. Правила доступа (Security Rules)

**Resident** может видеть только:
- Свою квартиру
- Список своих счётчиков
- Свои показания
- Свои счета

**ManagementCompany** может видеть только:
- Дома своей компании
- Квартиры в домах компании
- Показания всех квартир
- Все счета компании

## 🔌 Сервисный слой

### Firebase Services (`src/firebase/services/`)

Низкоуровневые операции с Firebase:

```typescript
// authService.ts
export const loginUser = async (email, password) => { }
export const logoutUser = async () => { }
export const getCurrentUserToken = async () => { }

// firestoreService.ts
export const createDocument = async (collection, data) => { }
export const getDocument = async (collection, id) => { }
export const queryDocuments = async (collection, constraints) => { }
export const updateDocument = async (collection, id, data) => { }
export const deleteDocument = async (collection, id) => { }

// storageService.ts
export const uploadFile = async (path, file) => { }
export const downloadFile = async (path) => { }
export const uploadInvoicePDF = async (companyId, apartmentId, month, year, file) => { }
```

### Module Services (`src/modules/*/services/`)

Бизнес-логика для каждого модуля:

```typescript
// modules/buildings/services/buildingsService.ts
export const createBuilding = async (data) => { }
export const getBuildingsByCompany = async (companyId) => { }
export const updateBuilding = async (buildingId, data) => { }
export const deleteBuilding = async (buildingId) => { }

// modules/meters/services/metersService.ts
export const submitMeterReading = async (data) => { }
export const getMeterReadingsByApartment = async (apartmentId) => { }
export const getLastMeterReading = async (meterId) => { }
```

## 📊 Типизация и константы

### Types (`src/shared/types/index.ts`)

```typescript
// Core domain types
export interface User { }
export interface Company { }
export interface Building { }
export interface Apartment { }
export interface Meter { }
export interface MeterReading { }
export interface Invoice { }
export interface Invitation { }

// Auth types
export interface AuthCredentials { }
export interface RegistrationData { }
```

### Constants (`src/shared/constants/index.ts`)

```typescript
// Collection names
export const FIRESTORE_COLLECTIONS = {
  COMPANIES: 'companies',
  USERS: 'users',
  BUILDINGS: 'buildings',
  // ...
}

// Business rules
export const METER_READING_RULES = {
  SUBMISSION_OPEN_DAY: 25,
}

// Routes
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  // ...
}
```

## 🔐 Безопасность

### Authentication Flow

```
User → Login → Firebase Auth → Get ID Token
          ↓
      Get User from Firestore → Load User Document
          ↓
       Check Role & Permissions → Allow/Deny Access
```

### Firestore Security Rules

```firestore
// Общий паттерн - каждый может видеть только данные своей компании
match /buildings/{buildingId} {
  allow read: if request.auth.token.companyId == resource.data.companyId;
  allow write: if request.auth.token.companyId == resource.data.companyId 
               && hasRole('ManagementCompany');
}

// Resident видит только свою квартиру
match /apartments/{apartmentId} {
  allow read: if isResident() && 
              resource.data.apartmentId == request.auth.token.apartmentId;
}
```

## 📱 UI/UX слой

### Компоненты

```
shared/components/
├── layout/
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── Footer.tsx
└── ui/
    ├── Button.tsx
    ├── Modal.tsx
    ├── Form.tsx
    └── ...
```

Каждый модуль имеет соответствующие компоненты:

```
modules/buildings/components/
├── BuildingsList.tsx
├── BuildingForm.tsx
└── BuildingCard.tsx
```

### Custom Hooks

```typescript
// Аутентификация
export const useAuth = () => { }
export const useHasCompanyAccess = (companyId) => { }
export const useIsResidentOfApartment = (apartmentId) => { }

// Валидация и утилиты
export const useForm = (initialValues, onSubmit) => { }
export const useAsync = (asyncFunction) => { }
```

## 🔄 Data Flow

### Создание документа

```
Component
    ↓
Service (buildingsService.createBuilding)
    ↓
Firebase Service (firestoreService.createDocument)
    ↓
Firestore API
    ↓
Database ✓
```

### Чтение документа

```
Component (useEffect)
    ↓
Service (buildingsService.getBuildingsByCompany)
    ↓
Firebase Service (firestoreService.queryDocuments)
    ↓
Firestore API
    ↓
Database
    ↓
Component State ✓
```

## 🛑 Middleware и Route Protection

### Authentication Middleware

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  // Check if user is authenticated
  // Protect routes like /dashboard, /invoices, etc
  // Redirect to login if needed
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/buildings/:path*',
    // ...
  ]
}
```

### Route Groups

```
app/
├── (public)/
│   ├── login/
│   ├── register/
│   └── reset-password/
└── (dashboard)/
    ├── buildings/
    ├── apartments/
    ├── meter-readings/
    └── invoices/
```

## 🧪 Тестирование

Требуются следующие уровни тестирования:

1. **Unit Tests** - Services, utils
2. **Integration Tests** - Модули вместе с Firebase
3. **E2E Tests** - Полные сценарии пользователя

## 📚 Соглашения кодирования

### Именование файлов

```
- Components: PascalCase (BuildingsList.tsx)
- Services: camelCase (buildingsService.ts)
- Hooks: camelCase + use prefix (useAuth.ts)
- Types: файл types/index.ts или отдельные файлы
```

### Организация импортов

```typescript
// 1. React imports
import { useState, useEffect } from 'react';

// 2. Third-party libraries
import { collection, query, where } from 'firebase/firestore';

// 3. Firebase imports
import { db } from '@/firebase/config';

// 4. Types
import { Building } from '@/shared/types';

// 5. Constants
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';

// 6. Services
import { getBuildingsByCompany } from '@/modules/buildings/services';

// 7. Utilities
import { formatDate } from '@/shared/lib/utils';

// 8. Local imports
import { BuildingCard } from './BuildingCard';
```

### Error Handling

```typescript
try {
  const building = await createBuilding(data);
  // Success
} catch (error) {
  if (isFirebaseAuthError(error)) {
    // Handle auth error
  } else {
    // Handle other errors
  }
}
```

## 🚀 Инициализация проекта

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка Firebase
```bash
cp .env.example .env.local
# Заполните Firebase конфигурацию
```

### 3. Запуск dev сервера
```bash
npm run dev
```

### 4. Открыть в браузере
```
http://localhost:3000
```

## 📈 Масштабируемость

Архитектура позволяет легко:

1. **Добавлять новые модули** - Просто создайте папку в modules/ с сервисами и компонентами
2. **Расширять функционал** - Добавляйте методы в сервисы
3. **Изменять UI** - Компоненты изолированы от логики
4. **Оптимизировать БД** - Измените только services слой
5. **Добавлять новые роли** - Расширяйте типы и security rules

## 🔗 Связанная документация

- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
