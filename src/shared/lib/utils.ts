/**
 * Shared utility functions
 */

/**
 * Format date to readable string
 * ВНИМАНИЕ: Используйте только для форматирования уже полученных дат,
 * не вызывайте new Date() внутри SSR/JSX напрямую!
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Format currency
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  }).format(amount);
};

/**
 * Check if date is in range
 */
export const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
  return date >= startDate && date <= endDate;
};

/**
 * Get current month and year
 * ВНИМАНИЕ: Используйте только внутри useEffect/useState!
 */
export const getCurrentMonthYear = (): { month: number; year: number } => {
  if (typeof window === 'undefined') {
    // SSR: возвращаем null-значения, чтобы избежать гидрации
    return { month: 0, year: 0 };
  }
  const now = new Date();
  return {
    month: now.getMonth() + 1, // JS months are 0-indexed
    year: now.getFullYear(),
  };
};

/**
 * Check if meter submission is allowed based on current date
 * ВНИМАНИЕ: Используйте только внутри useEffect/useState!
 */
export const isMeterSubmissionAllowed = (submissionOpenDay: number = 25): boolean => {
  if (typeof window === 'undefined') return false;
  const now = new Date();
  return now.getDate() >= submissionOpenDay;
};

/**
 * Get days until next submission opens
 * ВНИМАНИЕ: Используйте только внутри useEffect/useState!
 */
export const getDaysUntilSubmissionOpen = (submissionOpenDay: number = 25): number => {
  if (typeof window === 'undefined') return 0;
  const now = new Date();
  const currentDay = now.getDate();

  if (currentDay >= submissionOpenDay) {
    // Submission already open, will open next month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, submissionOpenDay);
    const diffTime = nextMonth.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } else {
    // Submission opens later this month
    return submissionOpenDay - currentDay;
  }
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Format month/year for display
 * ВНИМАНИЕ: Используйте только для форматирования уже полученных дат!
 */
export const formatMonthYear = (month: number, year: number): string => {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
};

/**
 * Get month name
 * ВНИМАНИЕ: Используйте только для форматирования уже полученных дат!
 */
export const getMonthName = (month: number): string => {
  const date = new Date(2024, month - 1);
  return date.toLocaleDateString('ru-RU', { month: 'long' });
};

/**
 * Generate unique token for invitations
 * ВНИМАНИЕ: Используйте только внутри useEffect/useState!
 */
export const generateToken = (): string => {
  if (typeof window === 'undefined') {
    // Node.js/SSR: используем crypto
    try {
      // crypto доступен в Node.js
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const crypto = require('crypto');
      return crypto.randomBytes(16).toString('hex');
    } catch (e) {
      // fallback если crypto не доступен
      return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
  }
  // Браузер
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Проверка ошибки Firebase Auth
 */
export const isFirebaseAuthError = (error: any): error is { code: string; message: string } => {
  return typeof error === 'object' && 'code' in error && 'message' in error;
};
