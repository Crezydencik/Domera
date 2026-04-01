// Универсальный форматтер даты и времени для отображения в UI
// Использует ru-RU локаль по умолчанию

export type FirestoreDateLike = Date | string | number | { toDate?: () => Date } | null | undefined;

export const formatDateTime = (value: FirestoreDateLike): string => {
  if (!value) return '—';
  try {
    if (value instanceof Date) return value.toLocaleString('ru-RU');
    if (typeof value === 'string' || typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ru-RU');
    }
    if (typeof value === 'object' && typeof value.toDate === 'function') {
      return value.toDate().toLocaleString('ru-RU');
    }
  } catch {
    return '—';
  }
  return '—';
};
