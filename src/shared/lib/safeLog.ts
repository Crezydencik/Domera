export interface SafeErrorDetails {
  name?: string;
  code?: string;
  message: string;
}

const truncate = (value: string, max = 240): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
};

export const toSafeErrorDetails = (error: unknown): SafeErrorDetails => {
  if (error instanceof Error) {
    const maybeCode = (error as Error & { code?: unknown }).code;
    return {
      name: error.name,
      code: typeof maybeCode === 'string' ? truncate(maybeCode, 80) : undefined,
      message: truncate(error.message || 'unknown_error'),
    };
  }

  if (typeof error === 'string') {
    return { message: truncate(error) };
  }

  return { message: 'unknown_error' };
};
