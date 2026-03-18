const DEFAULT_SESSION_TTL_MINUTES = 30;
const MIN_SESSION_TTL_MINUTES = 5;
const MAX_SESSION_TTL_MINUTES = 24 * 60;

export const SESSION_COOKIE_NAME = '__session';

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
};

export const getSessionTtlMinutes = (): number => {
  const raw = process.env.FIREBASE_SESSION_TTL_MINUTES;
  const parsed = Number.parseInt(raw ?? String(DEFAULT_SESSION_TTL_MINUTES), 10);
  return clamp(parsed, MIN_SESSION_TTL_MINUTES, MAX_SESSION_TTL_MINUTES);
};

export const getSessionTtlMs = (): number => getSessionTtlMinutes() * 60 * 1000;

export const getSessionCookieMaxAgeSeconds = (): number => Math.floor(getSessionTtlMs() / 1000);
