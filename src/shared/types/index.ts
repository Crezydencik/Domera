
export interface HeaderProps {
  userName?: string;
  userAvatarUrl?: string;
  userEmail?: string;
  pageTitle?: string;
  pageSubtitle?: string;
  onLogout?: () => void;
  right?: React.ReactNode;
}

/**
 * Apartment Invitation Meta and Account Status types
 */

export interface ApartmentInvitationMeta {
  email: string;
  sentAt?: string | Date;
}

export type ApartmentAccountStatus = 'activated' | 'pending' | 'notAssigned';
/**
 * Core domain types for Domera platform
 */

export type UserRole = 'ManagementCompany' | 'Resident' | 'Accountant';

export interface User {
  name: string;
  uid: string;
  email: string;
  role: UserRole;
  companyId?: string; // возвращено: companyId используется во многих местах
  apartmentId?: string; // Only for Resident role (primary or legacy)
  apartmentIds?: string[]; // Multiple apartments for Resident role
  createdAt: Date;
  displayName?: string; // Added displayName property
  phone?: string;
  address?: string;
  /**
   * Регистрационный номер компании (ManagementCompany)
   */
  registrationNumber?: string;
  /**
   * Язык рассылки: 'lv' (латышский, по умолчанию) или 'ru' (русский)
   */
  preferredLang?: 'lv' | 'ru';
  notifications?: {
    email?: boolean;
    meterReminder?: boolean;
    paymentReminder?: boolean;
    general?: boolean;
  };
  // Privacy consent
  privacyConsent?: boolean;
}

export interface Building {
  id: string;
  name: string;
  address?: string;
  companyId: string; // добавлено для корректной типизации
  managedBy?: {
    companyName?: string;
    managerUid?: string;
    managerEmail?: string;
    companyId?: string;
  };
  apartmentIds?: string[];
  // Optional nested settings for building (kept for compatibility)
  settings?: {
    water?: {
      meterTemplates?: string[];
      submissionOpenDay?: number;
    };
  };
  // Новые поля для периода сдачи показаний (строки-даты)
  waterSubmissionOpenDate?: string;
  waterSubmissionCloseDate?: string;
  waterSubmissionIsMonthly?: boolean;
  // legacy fields (kept for backward compatibility)
  waterMeterTemplates?: string[];
  waterSubmissionOpenDay?: number;
  waterSubmissionCloseDay?: number;
  // Показания счётчиков дома (аналогично квартире)
  waterReadings?: WaterReadings;
}
      
export interface TenantAccess {
  userId: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  rentDateFrom?: string;
  rentDateTo?: string;
  permissions: TenantPermission[];
  invitedAt: Date;
  acceptedAt?: Date;
}

export type TenantPermission = 'viewDocuments' | 'submitMeter' | 'remove';

export interface WaterMeterData {
  meterId: string;
  serialNumber?: string;
  checkDueDate?: string;
  currentValue?: number;
  previousValue?: number;
  submittedAt?: string | Date;
  history?: MeterReading[];
}

export interface WaterReadings {
  coldmeterwater?: WaterMeterData;
  hotmeterwater?: WaterMeterData;
}

export interface Apartment {
  id: string;
  buildingId: string;
  companyIds?: string[];
  number: string;
  residentId?: string; // legacy, для совместимости
  tenants?: TenantAccess[];
  waterReadings?: WaterReadings;
  // Базовые поля
  description?: string;              // Описание квартиры
  area?: number;                    // Площадь (кв.м)
  rooms?: number;                   // Количество комнат
  // Поля из кадастра (импорт из Excel)
  cadastralNumber?: string;          // Kadastra numurs
  cadastralPart?: string;            // Domājamā daļa
  address?: string;                  // Adrese
  floor?: string;                    // Stavs (этаж)
  apartmentType?: string;            // DZ t (тип квартиры)
  commonPropertyShare?: string;      // Daļa (kopīpašums)
  owner?: string;                    // Īpašnieks (собственник)
  ownerEmail?: string;               // E pasts Reķiniem (email)
  heatingArea?: number;              // Apkure (площадь отопления)
  managementArea?: number;           // Apsaimn (площадь управления)
  declaredResidents?: number;        // Dekl iedz (объявленные жители)
  hotWaterMeterNumber?: string;      // Kartsais NR
  coldWaterMeterNumber?: string;     // Aukstais NR
  // Agreement file links (legacy + normalized naming)
  ResidencyAgreementLinks?: string[];
  residencyAgreementLinks?: string[];
}

export type MeterType = 'water' | 'electricity' | 'heat';

export interface Meter {
  id: string;
  apartmentId: string;
  type: MeterType;
  serialNumber: string;
  name?: string;
  // Optional date (ISO string or Date) indicating next/assigned check due date for this meter
  checkDueDate?: string | Date;
  // History of meter readings stored directly in the meter document
  history?: MeterReading[];
}

export interface MeterReading {
  id: string;
  // companyId: string; // Удалено, используем только companyIds
  buildingId: string;
  apartmentId: string;
  meterId: string;
  previousValue: number;
  currentValue: number;
  consumption: number;
  month: number; // 1-12
  year: number;
  submittedAt: Date;
  userId: string; // <-- Added for user tracking
  isMissing?: boolean;
  note?: string;
  // optional helper fields stored with readings in apartment.waterReadings
  WMETNUM?: string;
  date?: string | Date;
  serialNumber?: string;
  checkDueDate?: string | Date;
}

export type InvoiceStatus = 'pending' | 'paid' | 'overdue';

export interface Invoice {
  id: string;
  // companyId: string; // Удалено, используем только companyIds
  apartmentId: string;
  month: number; // 1-12
  year: number;
  amount: number;
  status: InvoiceStatus;
  pdfUrl: string;
  createdAt: Date;
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export interface InvitationGdprMeta {
  lawfulBasis: 'contract' | 'legitimate_interest';
  processingPurpose: 'resident-invitation';
  legalBasisConfirmedAt: Date;
  privacyNoticeVersion: string;
  retentionUntil: Date;
  dataSubjectConsentAt?: Date;
}

export interface Invitation {
  id: string;
  companyId?: string;
  apartmentId: string;
  email: string;
  status: InvitationStatus;
  token?: string;
  tokenHash?: string;
  createdAt: Date;
  expiresAt?: Date;
  invitedByUid?: string;
  acceptedAt?: Date;
  revokedAt?: Date;
  gdpr?: InvitationGdprMeta;
  permissions?: TenantPermission[];
}

export type CompanyInvitationStatus = 'pending' | 'accepted' | 'revoked';

export interface CompanyInvitation {
  id: string;
  email: string;
  companyId: string;
  buildingId: string;
  buildingName?: string;
  role: 'Accountant' | 'ManagementCompany';
  status: CompanyInvitationStatus;
  invitedByUid?: string;
  createdAt: Date;
  acceptedAt?: Date;
}

/**
 * Notification types
 */
export type NotificationType = 'apartment-joined' | 'building-joined' | 'info' | 'warning' | 'success';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  apartmentId?: string;
  buildingId?: string;
  createdAt: Date;
  read: boolean;
  readAt?: Date;
}

/**
 * Auth-related types
 */

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegistrationData extends AuthCredentials {
  token: string; // Invitation token
}

export interface PasswordReset {
  email: string;
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
}

/**
 * API Response types
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Auth Context types
 */

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegistrationData) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

// apartments-specific types were consolidated into this file

/**
 * Project types
 */
export type ProjectStatus = 'planned' | 'in-progress' | 'completed';

export interface Project {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  buildingId?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Company types
 */
export interface Company {
  id: string;
  name: string;
  userId: string;
  address?: string;
  phone?: string;
  email?: string;
  registrationNumber?: string;
  buildings?: { id: string; name: string }[];
  createdAt: Date;
}

/**
 * News types
 */
export interface NewsItem {
  id: string;
  companyId: string;
  title: string;
  content: string;
  buildingId?: string;
  createdAt: Date;
  updatedAt?: Date;
  authorId?: string;
}
