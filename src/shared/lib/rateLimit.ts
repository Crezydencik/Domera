import { NextRequest } from 'next/server';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const getClientIp = (request: NextRequest): string => {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return 'unknown-ip';
};

export const consumeRateLimit = (
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } => {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const next: Bucket = {
      count: 1,
      resetAt: now + windowMs,
    };
    buckets.set(key, next);
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: next.resetAt };
  }

  existing.count += 1;
  buckets.set(key, existing);

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
};

export const buildRateLimitKey = (
  request: NextRequest,
  routeScope: string,
  actorScope?: string
): string => {
  const ip = getClientIp(request);
  return `${routeScope}:${actorScope ?? 'anon'}:${ip}`;
};
