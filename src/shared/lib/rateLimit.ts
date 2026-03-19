import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { getFirebaseAdminDb } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// NOTE: TTL cleanup — configure a Firestore TTL policy on the `rate_limits` collection
// using the `expiresAt` field so expired buckets are automatically deleted.
// Console → Firestore → Indexes → TTL → Collection: rate_limits, Field: expiresAt

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

// Hash the human-readable key so document IDs are safe for Firestore (no `/` etc.)
const toDocId = (key: string): string =>
  createHash('sha256').update(key).digest('hex');

export const consumeRateLimit = async (
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> => {
  const db = getFirebaseAdminDb();
  const docRef = db.collection('rate_limits').doc(toDocId(key));
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);

    if (!snap.exists || (snap.data()?.resetAt?.toMillis?.() ?? 0) <= now) {
      const resetAt = now + windowMs;
      tx.set(docRef, {
        count: 1,
        resetAt: new Date(resetAt),
        // expiresAt is used by the Firestore TTL policy for automatic cleanup
        expiresAt: new Date(resetAt + windowMs),
      });
      return { allowed: true, remaining: Math.max(0, limit - 1), resetAt };
    }

    const data = snap.data()!;
    const count: number = typeof data.count === 'number' ? data.count : 0;
    const existingResetAt: number = (data.resetAt as FirebaseFirestore.Timestamp).toMillis();

    if (count >= limit) {
      return { allowed: false, remaining: 0, resetAt: existingResetAt };
    }

    tx.update(docRef, { count: FieldValue.increment(1) });
    return { allowed: true, remaining: Math.max(0, limit - count - 1), resetAt: existingResetAt };
  });
};

export const buildRateLimitKey = (
  request: NextRequest,
  routeScope: string,
  actorScope?: string
): string => {
  const ip = getClientIp(request);
  return `${routeScope}:${actorScope ?? 'anon'}:${ip}`;
};
