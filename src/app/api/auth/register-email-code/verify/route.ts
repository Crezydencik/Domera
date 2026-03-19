import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/firebase/admin';
import { buildRateLimitKey, consumeRateLimit } from '@/shared/lib/rateLimit';
import { writeAuditEvent } from '@/shared/lib/auditLog';
import { toSafeErrorDetails } from '@/shared/lib/safeLog';

interface VerifyPayload {
  email: string;
  code: string;
}

const CODE_TTL_MS = 60 * 60 * 1000;
const TOKEN_TTL_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const COLLECTION = 'registration_email_codes';

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeCode = (code: string) => code.trim();

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidCode = (code: string) => /^\d{6}$/.test(code);

const makeDocId = (email: string): string => createHash('sha256').update(email).digest('hex');

const hashCode = (email: string, code: string): string => {
  const secret = process.env.REGISTRATION_CODE_SECRET ?? '';
  return createHash('sha256').update(`${email}:${code}:${secret}`).digest('hex');
};

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const safeEqual = (a: string, b: string): boolean => {
  const buffA = Buffer.from(a);
  const buffB = Buffer.from(b);

  if (buffA.length !== buffB.length) {
    return false;
  }

  return timingSafeEqual(buffA, buffB);
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as VerifyPayload;
    const email = normalizeEmail(payload?.email ?? '');
    const code = normalizeCode(payload?.code ?? '');

    const rlKey = buildRateLimitKey(request, 'auth:register-code:verify', email || 'anon');
    const rl = await consumeRateLimit(rlKey, 10, 60_000);
    if (!rl.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    if (!isValidEmail(email) || !isValidCode(code)) {
      return NextResponse.json({ error: 'Invalid email or code' }, { status: 400 });
    }

    const db = getFirebaseAdminDb();
    const docRef = db.collection(COLLECTION).doc(makeDocId(email));
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    const data = snap.data() as {
      codeHash: string;
      attempts?: number;
      expiresAt?: FirebaseFirestore.Timestamp;
    };

    const now = Date.now();
    const expiresAtMs = data?.expiresAt?.toMillis?.() ?? 0;
    const attempts = typeof data?.attempts === 'number' ? data.attempts : 0;

    if (!expiresAtMs || now > expiresAtMs) {
      await docRef.delete();
      return NextResponse.json({ error: 'Code expired' }, { status: 410 });
    }

    if (attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many invalid attempts' }, { status: 429 });
    }

    const expectedHash = hashCode(email, code);
    if (!safeEqual(expectedHash, data.codeHash)) {
      await docRef.update({ attempts: attempts + 1, updatedAt: new Date(now) });
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    const verificationToken = randomUUID();
    const tokenExpiresAt = now + TOKEN_TTL_MS;

    await docRef.update({
      verified: true,
      verifiedAt: new Date(now),
      verificationTokenHash: hashToken(verificationToken),
      tokenExpiresAt: new Date(tokenExpiresAt),
      updatedAt: new Date(now),
    });

    await writeAuditEvent({
      request,
      action: 'auth.register_code.verify',
      status: 'success',
      targetEmail: email,
    });

    return NextResponse.json({
      success: true,
      verificationToken,
      expiresInSeconds: TOKEN_TTL_MS / 1000,
    });
  } catch (error: unknown) {
    console.error('REGISTER_CODE_VERIFY error:', toSafeErrorDetails(error));
    const message = error instanceof Error ? error.message : 'Failed to verify code';

    await writeAuditEvent({
      request,
      action: 'auth.register_code.verify',
      status: 'error',
      reason: message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
