import { createHash, randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/firebase/admin';
import { buildRateLimitKey, consumeRateLimit } from '@/shared/lib/rateLimit';
import { writeAuditEvent } from '@/shared/lib/auditLog';
import { toSafeErrorDetails } from '@/shared/lib/safeLog';

interface RequestPayload {
  email: string;
  locale?: string;
}

const CODE_TTL_MS = 60 * 60 * 1000;
const COLLECTION = 'registration_email_codes';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const normalizeLocale = (locale?: string): 'en' | 'ru' | 'lv' => {
  if (!locale) return 'en';
  const code = locale.slice(0, 2).toLowerCase();
  if (code === 'ru' || code === 'lv') return code;
  return 'en';
};

const extractEmailFromFromField = (from: string): string => {
  const trimmed = from.trim();
  const angleBracketMatch = trimmed.match(/<([^>]+)>/);

  return (angleBracketMatch?.[1] ?? trimmed).trim().toLowerCase();
};

const isAllowedSenderDomain = (from: string, allowedDomain: string): boolean => {
  const email = extractEmailFromFromField(from);
  const atIndex = email.lastIndexOf('@');

  if (atIndex === -1) {
    return false;
  }

  const domain = email.slice(atIndex + 1);
  return domain === allowedDomain.toLowerCase();
};

const getResendConfig = () => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const allowedDomain = process.env.RESEND_ALLOWED_DOMAIN ?? 'lumtach.com';

  if (!apiKey || !from) {
    throw new Error('Resend is not configured. Please set RESEND_API_KEY and RESEND_FROM');
  }

  if (!isAllowedSenderDomain(from, allowedDomain)) {
    throw new Error(`Invalid RESEND_FROM: sender domain must be ${allowedDomain}`);
  }

  return { apiKey, from };
};

const makeDocId = (email: string): string => createHash('sha256').update(email).digest('hex');

const hashCode = (email: string, code: string): string => {
  const secret = process.env.REGISTRATION_CODE_SECRET ?? '';
  return createHash('sha256').update(`${email}:${code}:${secret}`).digest('hex');
};

const getTemplate = (locale: 'en' | 'ru' | 'lv', code: string) => {
  if (locale === 'ru') {
    return {
      subject: 'Код подтверждения регистрации Domera',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
          <h2 style="margin:0 0 12px;">Подтверждение регистрации</h2>
          <p style="margin:0 0 12px;">Введите этот код на странице регистрации:</p>
          <div style="font-size:34px;font-weight:700;letter-spacing:6px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:14px 18px;display:inline-block;">${code}</div>
          <p style="margin:14px 0 0;color:#334155;">Код действителен в течение 1 часа.</p>
          <p style="margin:18px 0 0;color:#64748b;font-size:13px;">Если вы не запрашивали регистрацию, просто проигнорируйте это письмо.</p>
        </div>
      `,
    };
  }

  if (locale === 'lv') {
    return {
      subject: 'Domera reģistrācijas apstiprināšanas kods',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
          <h2 style="margin:0 0 12px;">Reģistrācijas apstiprināšana</h2>
          <p style="margin:0 0 12px;">Ievadiet šo kodu reģistrācijas lapā:</p>
          <div style="font-size:34px;font-weight:700;letter-spacing:6px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:14px 18px;display:inline-block;">${code}</div>
          <p style="margin:14px 0 0;color:#334155;">Kods ir derīgs 1 stundu.</p>
          <p style="margin:18px 0 0;color:#64748b;font-size:13px;">Ja nereģistrējāties, vienkārši ignorējiet šo e-pastu.</p>
        </div>
      `,
    };
  }

  return {
    subject: 'Domera registration verification code',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
        <h2 style="margin:0 0 12px;">Confirm your registration</h2>
        <p style="margin:0 0 12px;">Enter this code on the registration page:</p>
        <div style="font-size:34px;font-weight:700;letter-spacing:6px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:14px 18px;display:inline-block;">${code}</div>
        <p style="margin:14px 0 0;color:#334155;">This code is valid for 1 hour.</p>
        <p style="margin:18px 0 0;color:#64748b;font-size:13px;">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  };
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as RequestPayload;
    const email = normalizeEmail(payload?.email ?? '');
    const locale = normalizeLocale(payload?.locale);

    const rlKey = buildRateLimitKey(request, 'auth:register-code:request', email || 'anon');
    const rl = await consumeRateLimit(rlKey, 5, 60_000);
    if (!rl.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    try {
      await getFirebaseAdminAuth().getUserByEmail(email);
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    } catch {
      // user not found => okay
    }

    const code = String(randomInt(100000, 1000000));
    const now = Date.now();
    const expiresAt = now + CODE_TTL_MS;

    const db = getFirebaseAdminDb();
    const docId = makeDocId(email);

    await db.collection(COLLECTION).doc(docId).set({
      email,
      codeHash: hashCode(email, code),
      verified: false,
      attempts: 0,
      locale,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      expiresAt: new Date(expiresAt),
    });

    const resendConfig = getResendConfig();
    const resend = new Resend(resendConfig.apiKey);
    const template = getTemplate(locale, code);

    const { error: resendError } = await resend.emails.send({
      from: resendConfig.from,
      to: email,
      subject: template.subject,
      html: template.html,
    });

    if (resendError) {
      throw new Error(`Resend error: ${resendError.message}`);
    }

    await writeAuditEvent({
      request,
      action: 'auth.register_code.request',
      status: 'success',
      targetEmail: email,
      metadata: { locale },
    });

    return NextResponse.json({ success: true, expiresInSeconds: CODE_TTL_MS / 1000 });
  } catch (error: unknown) {
    console.error('REGISTER_CODE_REQUEST error:', toSafeErrorDetails(error));
    const message = error instanceof Error ? error.message : 'Failed to send verification code';

    await writeAuditEvent({
      request,
      action: 'auth.register_code.request',
      status: 'error',
      reason: message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
