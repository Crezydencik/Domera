import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getFirebaseAdminAuth } from '@/firebase/admin';

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

    const subject = 'Paroles atiestatīšana Domera';
    const text = [
      'Domera — paroles atiestatīšana',
      '',
      'Sveicināti!',
      '',
      'Mēs saņēmām pieprasījumu mainīt jūsu konta paroli.',
      'Lai uzstādītu jaunu paroli, dodieties uz saiti:',
      resetLink,
      '',
      'Ja neesat sūtījis šo pieprasījumu, ignorējiet vēstuli — parole netiks mainīta.',
      '',
      'Ar cieņu,',
      'Domera komanda',
    ].join('\n');

    const html = `
      <div style="margin:0;padding:0;background:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:28px 12px;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#111827;border:1px solid #1f2937;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #1f2937;">
                    <p style="margin:0;color:#93c5fd;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Domera</p>
                    <h1 style="margin:8px 0 0;color:#f8fafc;font-size:22px;line-height:1.3;">Paroles atiestatīšana</h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 14px;color:#e5e7eb;font-size:15px;line-height:1.6;">
                      Sveicināti! Mēs saņēmām pieprasījumu mainīt jūsu konta paroli.
                    </p>
                    <p style="margin:0 0 20px;color:#cbd5e1;font-size:14px;line-height:1.6;">
                      Nospiediet pogu zemāk, lai uzstādītu jaunu paroli.
                    </p>

                    <p style="margin:0 0 22px;">
                      <a
                        href="${resetLink}"
                        style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:10px;"
                      >
                        Atiestatīt paroli
                      </a>
                    </p>

                    <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;">Ja poga nedarbojas, atveriet saiti manuāli:</p>
                    <p style="margin:0 0 20px;word-break:break-all;">
                      <a href="${resetLink}" style="color:#60a5fa;font-size:12px;line-height:1.5;text-decoration:underline;">${resetLink}</a>
                    </p>

                    <div style="margin:0 0 6px;padding:12px 14px;border-radius:10px;background:#0b1220;border:1px solid #1e293b;">
                      <p style="margin:0;color:#cbd5e1;font-size:12px;line-height:1.5;">
                        Ja tas nebijāt jūs — vienkārši ignorējiet vēstuli. Jūsu parole paliks nemainīga.
                      </p>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 24px;border-top:1px solid #1f2937;">
                    <p style="margin:0;color:#64748b;font-size:11px;line-height:1.5;">
                      Šī ir automātiska vēstule no Domera. Lūdzu, neatbildiet uz to.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    const { error: resendError } = await resend.emails.send({
      from: resendConfig.from,
      to: email,
      subject,
      text,
      html,
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
