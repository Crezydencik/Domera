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
  uid: string;
  email: string;
  role: UserRole;
  companyId?: string; // возвращено: companyId используется во многих местах
  apartmentId?: string; // Only for Resident role
  createdAt: Date;
  displayName?: string; // Added displayName property
  // ...удалено: Notification settings...
  notifications?: {
    email?: boolean;
    meterReminder?: boolean;
    paymentReminder?: boolean;
    general?: boolean;
  };
  // Privacy consent
  privacyConsent?: boolean;
}

export interface Company {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Building {
  id: string;
  name: string;
  address?: string;
  managedBy?: {
    companyName?: string;
    managerUid?: string;
    managerEmail?: string;
  };
  apartmentIds?: string[];
  // Optional nested settings for building (kept for compatibility)
  settings?: {
    water?: {
      meterTemplates?: string[];
      submissionOpenDay?: number;
    };
  };
  // legacy fields (kept for backward compatibility)
  waterMeterTemplates?: string[];
  waterSubmissionOpenDay?: number;
}

export interface TenantAccess {
  userId: string;
  email: string;
  permissions: TenantPermission[];
  invitedAt: Date;
  acceptedAt?: Date;
}

export type TenantPermission = 'viewDocuments' | 'submitMeter' | 'remove';

export interface Apartment {
  id: string;
  buildingId: string;
  companyIds?: string[];
  number: string;
  residentId?: string; // legacy, для совместимости
  tenants?: TenantAccess[];
  waterReadings?: MeterReading[];
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
  isMissing?: boolean;
  note?: string;
  // optional helper fields stored with readings in apartment.waterReadings
  WMETNUM?: string;
  date?: string | Date;
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
  // companyId: string; // Удалено, используем только companyIds
  apartmentId: string;
  email: string;
  status: InvitationStatus;
  token: string;
  createdAt: Date;
  expiresAt?: Date;
  invitedByUid?: string;
  acceptedAt?: Date;
  revokedAt?: Date;
  gdpr?: InvitationGdprMeta;
  permissions?: TenantPermission[];
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
