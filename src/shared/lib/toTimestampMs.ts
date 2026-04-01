// Универсальная функция преобразования даты/таймстемпа в миллисекунды
// Используется для сортировки и сравнения дат

export type ReadingTimestampLike = string | Date | { toDate?: () => Date; seconds?: number } | null | undefined;

export const toTimestampMs = (value: ReadingTimestampLike): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const ts = new Date(value).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }
  return 0;
};
