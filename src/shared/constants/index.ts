/**
 * Application constants
 */

// User roles
export const USER_ROLES = {
  MANAGEMENT_COMPANY: 'ManagementCompany',
  RESIDENT: 'Resident',
  ACCOUNTANT: 'Accountant',
} as const;

// Firestore collection names
export const FIRESTORE_COLLECTIONS = {
  COMPANIES: 'companies',
  USERS: 'users',
  BUILDINGS: 'buildings',
  APARTMENTS: 'apartments',
  METERS: 'meters',
  METER_READINGS: 'meter_readings',
  INVOICES: 'invoices',
  INVITATIONS: 'invitations',
} as const;

// Meter types
export const METER_TYPES = {
  WATER: 'water',
  ELECTRICITY: 'electricity',
  HEAT: 'heat',
} as const;

// Default water meter templates for new/legacy buildings
export const DEFAULT_WATER_METER_TEMPLATES = ['ХВС', 'ГВС'] as const;

// Meter reading submission rules
export const METER_READING_RULES = {
  SUBMISSION_DAY: 25, // Submissions available from 25th of month
  SUBMISSION_OPEN_DAY: 25,
  SUBMISSION_CLOSED_MESSAGE: 'Передача показаний доступна с 25 числа',
} as const;

// Invoice statuses
export const INVOICE_STATUSES = {
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
} as const;

// Invitation statuses
export const INVITATION_STATUSES = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REVOKED: 'revoked',
} as const;

// Invitation rules
export const INVITATION_RULES = {
  EXPIRY_DAYS: 7,
  EXPIRY_HOURS: 72, // Alternative: hours-based expiry
} as const;

// Invitation token expiration (in hours)
export const INVITATION_TOKEN_EXPIRY_HOURS = 72;

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PROFILE: '/dashboard/profile',
  BUILDINGS: '/dashboard/buildings',
  APARTMENTS: '/dashboard/apartments',
  METER_READINGS: '/dashboard/meter-readings',
  // ...удалено: SETTINGS...
  INVOICES: '/dashboard/invoices',
  RESET_PASSWORD: '/reset-password',
  ACCEPT_INVITATION: '/accept-invitation',
} as const;

// Auth messages
export const AUTH_MESSAGES = {
  LOGIN_SUCCESS: 'Успешный вход',
  LOGOUT_SUCCESS: 'Вы вышли из системы',
  REGISTRATION_SUCCESS: 'Регистрация успешна',
  INVALID_CREDENTIALS: 'Неверный email или пароль',
  EMAIL_ALREADY_EXISTS: 'Email уже зарегистрирован',
  INVALID_TOKEN: 'Неверный или истёкший токен',
  PASSWORD_RESET_SENT: 'Ссылка на сброс пароля отправлена на вашу почту',
} as const;

// Field validation rules
export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 128,
  BUILDING_NAME_MIN_LENGTH: 2,
  BUILDING_NAME_MAX_LENGTH: 255,
  ADDRESS_MIN_LENGTH: 5,
  ADDRESS_MAX_LENGTH: 500,
  APARTMENT_NUMBER_PATTERN: /^[0-9а-яa-z\-\/]+$/i,
} as const;

// UI defaults
export const UI_DEFAULTS = {
  ITEMS_PER_PAGE: 20,
  DEBOUNCE_DELAY_MS: 300,
} as const;
