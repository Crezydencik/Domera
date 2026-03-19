import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createInvitation } from '@/modules/invitations/services/invitationsService';
import { getFirebaseAdminAuth } from '@/firebase/admin';
import { requireRequestAuth, toAuthErrorResponse } from '@/shared/lib/serverAuth';
import { writeAuditEvent } from '@/shared/lib/auditLog';
import { buildRateLimitKey, consumeRateLimit } from '@/shared/lib/rateLimit';

interface SendInvitationPayload {
  apartmentId: string;
  email: string;
  invitedByUid?: string;
  legalBasisConfirmed: boolean;
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

const EMAIL_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/domera-eb224.firebasestorage.app/o/System%2FDomera_loga.png?alt=media&token=53ccefaa-c38f-490b-9138-010da531327e';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request, {
      allowedRoles: ['ManagementCompany', 'Accountant'],
    });

    const payload = (await request.json()) as SendInvitationPayload;

    const rl = await consumeRateLimit(buildRateLimitKey(request, 'invitation:send', auth.uid), 10, 60_000);
    if (!rl.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      await writeAuditEvent({
        request,
        action: 'invitation.send',
        status: 'rate_limited',
        actorUid: auth.uid,
        actorRole: auth.role,
        reason: 'too_many_requests',
      });

      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    if (!payload.apartmentId || !payload.email) {
      await writeAuditEvent({
        request,
        action: 'invitation.send',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        reason: 'missing_required_fields',
      });

      return NextResponse.json(
        { error: 'Nepieciešams apartmentId un email' },
        { status: 400 }
      );
    }

    // Получаем квартиру и companyId из неё
    const { getApartment } = await import('@/modules/apartments/services/apartmentsService');
    const apartment = await getApartment(payload.apartmentId);
    if (!apartment) {
      await writeAuditEvent({
        request,
        action: 'invitation.send',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        apartmentId: payload.apartmentId,
        reason: 'apartment_not_found',
      });

      return NextResponse.json({ error: 'Dzīvoklis nav atrasts' }, { status: 404 });
    }
    const companyId = Array.isArray(apartment.companyIds) && apartment.companyIds.length > 0 ? apartment.companyIds[0] : undefined;
    if (!companyId) {
      await writeAuditEvent({
        request,
        action: 'invitation.send',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        apartmentId: payload.apartmentId,
        reason: 'company_id_missing',
      });

      return NextResponse.json({ error: 'Dzīvoklim nav companyId' }, { status: 400 });
    }

    if (auth.companyId && auth.companyId !== companyId) {
      await writeAuditEvent({
        request,
        action: 'invitation.send',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        companyId,
        apartmentId: payload.apartmentId,
        targetEmail: payload.email,
        reason: 'tenant_mismatch',
      });

      return NextResponse.json({ error: 'Piekļuve šim uzņēmumam liegta' }, { status: 403 });
    }

    const origin = request.nextUrl.origin;

    const invitationResult = await createInvitation(
      companyId,
      payload.apartmentId,
      payload.email,
      {
        invitedByUid: auth.uid,
        legalBasisConfirmed: payload.legalBasisConfirmed,
        privacyNoticeVersion: 'v1',
        baseUrl: origin,
      }
    );

    const normalizedEmail = payload.email.trim().toLowerCase();
    let existingAccountDetected = false;

    try {
      const adminAuth = getFirebaseAdminAuth();
      await adminAuth.getUserByEmail(normalizedEmail);
      existingAccountDetected = true;
    } catch {
      existingAccountDetected = false;
    }

    const resendConfig = getResendConfig();
    const resend = new Resend(resendConfig.apiKey);

    const subject = existingAccountDetected
      ? 'Domera: jums ir piešķirta piekļuve dzīvoklim'
      : 'Ielūgums uz Domera';

    const text = existingAccountDetected
      ? [
          'Domera — piekļuve dzīvoklim',
          '',
          'Sveicināti!',
          '',
          'Jūsu esošajam kontam ir piešķirta piekļuve dzīvoklim Domera.',
          'Apstipriniet piekļuvi, izmantojot ielūguma saiti:',
          invitationResult.invitationLink,
          '',
          'Ja negaidījāt šo vēstuli, vienkārši ignorējiet to.',
          '',
          'Ar cieņu,',
          'Domera komanda',
        ].join('\n')
      : [
          'Domera — ielūgums',
          '',
          'Sveicināti!',
          '',
          'Jūs esat uzaicināts uz Domera kā dzīvokļa iedzīvotājs.',
          'Lai pabeigtu reģistrāciju un iegūtu piekļuvi, dodieties uz saiti:',
          invitationResult.invitationLink,
          '',
          'Ja negaidījāt šo vēstuli, vienkārši ignorējiet to.',
          '',
          'Ar cieņu,',
          'Domera komanda',
        ].join('\n');

    const html = existingAccountDetected
      ? `
      <div style="margin:0;padding:0;background:#f3f4f6;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:28px 12px;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 28px 18px;text-align:center;">
                    <img src="${EMAIL_LOGO_URL}" alt="Domera Logo" width="270" height="80" style="display:block;margin:0 auto 14px;" />
                    <h1 style="margin:12px 0 0;color:#111827;font-size:30px;line-height:1.25;font-weight:800;">Piekļuve dzīvoklim piešķirta</h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:8px 28px 24px;text-align:center;">
                    <p style="margin:0 0 18px;color:#374151;font-size:17px;line-height:1.6;">
                      Jūsu esošajam kontam ir piešķirta piekļuve Domera.
                    </p>

                    <p style="margin:0 0 10px;color:#4b5563;font-size:16px;line-height:1.6;">Apstipriniet piekļuvi dzīvoklim</p>
                    <p style="margin:0 0 22px;">
                      <a href="${invitationResult.invitationLink}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;font-size:20px;padding:14px 26px;border-radius:12px;">
                        Apstiprināt piekļuvi
                      </a>
                    </p>

                    <p style="margin:0 0 10px;color:#6b7280;font-size:14px;line-height:1.6;">Ja pogas nedarbojas, atveriet saites manuāli:</p>
                    <p style="margin:0 0 20px;word-break:break-all;text-align:center;"><a href="${invitationResult.invitationLink}" style="color:#2563eb;font-size:14px;line-height:1.5;text-decoration:underline;">${invitationResult.invitationLink}</a></p>

                    <p style="margin:0;padding:12px 14px;border-radius:10px;background:#f9fafb;border:1px solid #e5e7eb;color:#4b5563;font-size:14px;line-height:1.5;">
                      Ja negaidījāt šo vēstuli, vienkārši ignorējiet to.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px 28px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                      Šī ir automātiska vēstule no Domera. Lūdzu, neatbildiet uz to.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `
      : `
      <div style="margin:0;padding:0;background:#f3f4f6;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:28px 12px;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 28px 18px;text-align:center;">
                    <img src="${EMAIL_LOGO_URL}" alt="Domera Logo" width="270" height="80" style="display:block;margin:0 auto 14px;" />
                    <h1 style="margin:12px 0 0;color:#111827;font-size:30px;line-height:1.25;font-weight:800;">Ielūgums uz Domera</h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:8px 28px 24px;text-align:center;">
                    <p style="margin:0 0 18px;color:#374151;font-size:17px;line-height:1.6;">
                      Sveicināti! Jūs esat uzaicināts uz Domera kā dzīvokļa iedzīvotājs.
                    </p>
                    <p style="margin:0 0 20px;color:#4b5563;font-size:16px;line-height:1.6;">
                      Nospiediet pogu zemāk, lai pieņemtu ielūgumu un pabeigtu reģistrāciju.
                    </p>

                    <p style="margin:0 0 22px;">
                      <a
                        href="${invitationResult.invitationLink}"
                        style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:20px;padding:14px 26px;border-radius:12px;"
                      >
                        Pieņemt ielūgumu
                      </a>
                    </p>

                    <p style="margin:0 0 10px;color:#6b7280;font-size:14px;line-height:1.6;">Ja poga nedarbojas, atveriet saiti manuāli:</p>
                    <p style="margin:0 0 20px;word-break:break-all;text-align:center;">
                      <a href="${invitationResult.invitationLink}" style="color:#2563eb;font-size:14px;line-height:1.5;text-decoration:underline;">${invitationResult.invitationLink}</a>
                    </p>

                    <p style="margin:0;padding:12px 14px;border-radius:10px;background:#f9fafb;border:1px solid #e5e7eb;color:#4b5563;font-size:14px;line-height:1.5;">
                      Ja negaidījāt šo vēstuli, vienkārši ignorējiet to.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px 28px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
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
      to: payload.email,
      subject,
      text,
      html,
    });

    if (resendError) {
      throw new Error(`Resend error: ${resendError.message}`);
    }

    await writeAuditEvent({
      request,
      action: 'invitation.send',
      status: 'success',
      actorUid: auth.uid,
      actorRole: auth.role,
      companyId,
      apartmentId: payload.apartmentId,
      invitationId: invitationResult.invitation.id,
      targetEmail: payload.email,
      metadata: {
        existingAccountDetected,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Ielūgums nosūtīts uz e-pastu',
      invitationId: invitationResult.invitation.id,
      invitationLink: invitationResult.invitationLink,
      existingAccountDetected,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ApiAuthError') {
      await writeAuditEvent({
        request,
        action: 'invitation.send',
        status: 'denied',
        reason: error.message,
      });

      return toAuthErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : 'Kļūda, nosūtot ielūgumu';
    console.error('SEND_INVITATION API error:', message);

    await writeAuditEvent({
      request,
      action: 'invitation.send',
      status: 'error',
      reason: message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
