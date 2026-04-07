import type { MeterReading } from '@/shared/types';

type ReadingTimestampLike =
  | Date
  | string
  | { toDate?: () => Date; seconds?: number; _seconds?: number; nanoseconds?: number }
  | null
  | undefined;

type MeterReadingLike = Pick<MeterReading, 'currentValue' | 'month' | 'year' | 'submittedAt'> & {
  previousValue?: number | null;
  consumption?: number | null;
  id?: string;
};

const toTimestampMs = (value: ReadingTimestampLike): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }
  if (typeof value === 'object' && typeof value._seconds === 'number') {
    return value._seconds * 1000;
  }
  return 0;
};

const normalizeNumber = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const compareReadingPeriods = <T extends Pick<MeterReadingLike, 'month' | 'year' | 'submittedAt'>>(
  left: T,
  right: T
): number => {
  const yearDiff = normalizeNumber(left.year) - normalizeNumber(right.year);
  if (yearDiff !== 0) return yearDiff;

  const monthDiff = normalizeNumber(left.month) - normalizeNumber(right.month);
  if (monthDiff !== 0) return monthDiff;

  return toTimestampMs(left.submittedAt) - toTimestampMs(right.submittedAt);
};

export const sortMeterReadingsChronologically = <T extends MeterReadingLike>(history: T[]): T[] => {
  return [...history].sort(compareReadingPeriods);
};

export const recalculateMeterReadingHistory = <T extends MeterReadingLike>(history: T[]): T[] => {
  const sortedHistory = sortMeterReadingsChronologically(history);
  let previousCurrentValue = 0;

  return sortedHistory.map((reading, index) => {
    const currentValue = normalizeNumber(reading.currentValue);
    const previousValue = index === 0 ? 0 : previousCurrentValue;
    const consumption = index === 0 ? 0 : Math.max(0, currentValue - previousValue);

    previousCurrentValue = currentValue;

    return {
      ...reading,
      previousValue,
      consumption,
    };
  });
};

export const buildMeterHistorySnapshot = <T extends MeterReadingLike>(history: T[]) => {
  const recalculatedHistory = recalculateMeterReadingHistory(history);
  const latestReading = recalculatedHistory[recalculatedHistory.length - 1] ?? null;

  return {
    history: recalculatedHistory,
    latestReading,
  };
};

export const getPreviousReadingForPeriod = <T extends MeterReadingLike>(
  history: T[],
  year: number,
  month: number
): T | null => {
  const sortedHistory = sortMeterReadingsChronologically(history);
  let previousReading: T | null = null;

  for (const reading of sortedHistory) {
    const readingYear = normalizeNumber(reading.year);
    const readingMonth = normalizeNumber(reading.month);

    if (readingYear > year || (readingYear === year && readingMonth >= month)) {
      break;
    }

    previousReading = reading;
  }

  return previousReading;
};