/**
 * Validation schemas and utilities
 */

import { VALIDATION } from '../constants';

/**
 * Email validation
 */
export const validateEmail = (email: string): boolean => {
  return VALIDATION.EMAIL_REGEX.test(email);
};

/**
 * Password validation
 */
export const validatePassword = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
    errors.push(`Пароль должен содержать минимум ${VALIDATION.PASSWORD_MIN_LENGTH} символов`);
  }

  if (password.length > VALIDATION.PASSWORD_MAX_LENGTH) {
    errors.push(`Пароль не должен превышать ${VALIDATION.PASSWORD_MAX_LENGTH} символов`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export type PasswordStrengthLevel = 'weak' | 'medium' | 'strong';

/**
 * Password strength evaluation.
 *
 * Scoring criteria (0..4):
 * - length >= 8
 * - has lowercase letters
 * - has uppercase letters
 * - has digits
 * - has special chars
 *
 * Weak  : score <= 2 or length < minimum
 * Medium: score = 3
 * Strong: score >= 4
 */
export const getPasswordStrength = (password: string): {
  score: number;
  level: PasswordStrengthLevel;
  isStrongEnoughToSave: boolean;
} => {
  if (!password) {
    return { score: 0, level: 'weak', isStrongEnoughToSave: false };
  }

  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const normalizedScore = Math.min(score, 4);

  const level: PasswordStrengthLevel =
    password.length < VALIDATION.PASSWORD_MIN_LENGTH || normalizedScore <= 2
      ? 'weak'
      : normalizedScore === 3
        ? 'medium'
        : 'strong';

  return {
    score: normalizedScore,
    level,
    isStrongEnoughToSave: level !== 'weak',
  };
};

/**
 * Building name validation
 */
export const validateBuildingName = (name: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (name.length < VALIDATION.BUILDING_NAME_MIN_LENGTH) {
    errors.push(
      `Название дома должно содержать минимум ${VALIDATION.BUILDING_NAME_MIN_LENGTH} символов`
    );
  }

  if (name.length > VALIDATION.BUILDING_NAME_MAX_LENGTH) {
    errors.push(
      `Название дома не должно превышать ${VALIDATION.BUILDING_NAME_MAX_LENGTH} символов`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Address validation
 */
export const validateAddress = (address: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (address.length < VALIDATION.ADDRESS_MIN_LENGTH) {
    errors.push(
      `Адрес должен содержать минимум ${VALIDATION.ADDRESS_MIN_LENGTH} символов`
    );
  }

  if (address.length > VALIDATION.ADDRESS_MAX_LENGTH) {
    errors.push(
      `Адрес не должен превышать ${VALIDATION.ADDRESS_MAX_LENGTH} символов`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Apartment number validation
 */
export const validateApartmentNumber = (number: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (!number.trim()) {
    errors.push('Номер квартиры не должен быть пустым');
  }

  if (!VALIDATION.APARTMENT_NUMBER_PATTERN.test(number)) {
    errors.push('Номер квартиры содержит недопустимые символы');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Meter reading value validation
 */
export const validateMeterReading = (value: number): {
  isValid: boolean;
  error?: string;
} => {
  if (value < 0) {
    return {
      isValid: false,
      error: 'Показания счётчика не могут быть отрицательными',
    };
  }

  if (!Number.isFinite(value)) {
    return {
      isValid: false,
      error: 'Показания счётчика должны быть числом',
    };
  }

  return { isValid: true };
};

/**
 * Consumption calculation validation
 */
export const validateConsumption = (
  currentValue: number,
  previousValue: number
): {
  isValid: boolean;
  error?: string;
  consumption?: number;
} => {
  const consumption = currentValue - previousValue;
  if (!Number.isFinite(consumption)) {
    return { isValid: false, error: 'Расход должен быть числом', consumption };
  }
  if (consumption < 0) {
    return {
      isValid: false,
      error: 'Показание не может быть меньше предыдущего месяца',
      consumption,
    };
  }
  return {
    isValid: true,
    consumption,
  };
};

/**
 * Composite validation for login form
 */
export const validateLoginForm = (
  email: string,
  password: string
): {
  isValid: boolean;
  errors: { email?: string; password?: string };
} => {
  const errors: { email?: string; password?: string } = {};

  if (!validateEmail(email)) {
    errors.email = 'Пожалуйста, введите корректный email';
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.errors[0];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Composite validation for registration form
 */
export const validateRegistrationForm = (
  email: string,
  password: string
): {
  isValid: boolean;
  errors: { email?: string; password?: string };
} => {
  return validateLoginForm(email, password);
};

/**
 * Composite validation for building form
 */
export const validateBuildingForm = (
  name: string,
  address: string
): {
  isValid: boolean;
  errors: { name?: string; address?: string };
} => {
  const errors: { name?: string; address?: string } = {};

  const nameValidation = validateBuildingName(name);
  if (!nameValidation.isValid) {
    errors.name = nameValidation.errors[0];
  }

  const addressValidation = validateAddress(address);
  if (!addressValidation.isValid) {
    errors.address = addressValidation.errors[0];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
