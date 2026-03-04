import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getFirebaseAdminAuth } from '@/firebase/admin';
import { getUserByEmail } from '@/modules/auth/services/authService';
import resetPasswordLV from '@/emails/resetPassword.lv';
import resetPasswordRU from '@/emails/resetPassword.ru';

interface SendPasswordResetPayload {
  email: string;
}

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
    throw new Error('Resend nav konfigurēts. Norādiet RESEND_API_KEY un RESEND_FROM');
  }

  if (!isAllowedSenderDomain(from, allowedDomain)) {
    throw new Error(
      `Nederīgs RESEND_FROM: sūtītāja adresei jābūt no domēna ${allowedDomain}`
    );
  }

  return { apiKey, from };
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const buildCustomResetLink = (origin: string, firebaseResetLink: string): string => {
  const parsed = new URL(firebaseResetLink);
  const oobCode = parsed.searchParams.get('oobCode');

  if (!oobCode) {
    throw new Error('Neizdevās izveidot paroles atiestatīšanas saiti');
  }

  const customUrl = new URL('/reset-password/confirm', origin);
  customUrl.searchParams.set('oobCode', oobCode);

  return customUrl.toString();
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as SendPasswordResetPayload;
    const email = payload?.email?.trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Ievadiet korektu e-pastu' }, { status: 400 });
    }

    const origin = request.nextUrl.origin;
    const adminAuth = getFirebaseAdminAuth();

    const firebaseResetLink = await adminAuth.generatePasswordResetLink(email, {
      url: `${origin}/login`,
      handleCodeInApp: false,
    });
    const resetLink = buildCustomResetLink(origin, firebaseResetLink);

    const resendConfig = getResendConfig();
    const resend = new Resend(resendConfig.apiKey);

    // Получаем пользователя и определяем язык рассылки
    const user = await getUserByEmail(email);
    const lang = user?.preferredLang === 'ru' ? 'ru' : 'lv';
    const template = lang === 'ru' ? resetPasswordRU : resetPasswordLV;

    const { error: resendError } = await resend.emails.send({
      from: resendConfig.from,
      to: email,
      subject: template.subject,
      html: template.html(resetLink),
    });

    if (resendError) {
      throw new Error(`Resend error: ${resendError.message}`);
    }

    return NextResponse.json({ success: true, message: 'Vēstule nosūtīta' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Kļūda, nosūtot paroles atiestatīšanas vēstuli';
    console.error('SEND_PASSWORD_RESET API error:', message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
