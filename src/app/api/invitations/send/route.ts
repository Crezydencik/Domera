import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createInvitation } from '@/modules/invitations/services/invitationsService';
import { getFirebaseAdminAuth } from '@/firebase/admin';

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
    throw new Error('Resend не настроен. Укажите RESEND_API_KEY и RESEND_FROM');
  }

  if (!isAllowedSenderDomain(from, allowedDomain)) {
    throw new Error(
      `Некорректный RESEND_FROM: адрес отправителя должен быть из домена ${allowedDomain}`
    );
  }

  return { apiKey, from };
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as SendInvitationPayload;
    console.log('SEND_INVITATION payload:', payload);


    if (!payload.apartmentId || !payload.email) {
      return NextResponse.json(
        { error: 'apartmentId и email обязательны' },
        { status: 400 }
      );
    }

    // Получаем квартиру и companyId из неё
    const { getApartment } = await import('@/modules/apartments/services/apartmentsService');
    const apartment = await getApartment(payload.apartmentId);
    if (!apartment) {
      return NextResponse.json({ error: 'Квартира не найдена' }, { status: 404 });
    }
    const companyId = Array.isArray(apartment.companyIds) && apartment.companyIds.length > 0 ? apartment.companyIds[0] : undefined;
    if (!companyId) {
      return NextResponse.json({ error: 'У квартиры не найден companyId' }, { status: 400 });
    }

    const origin = request.nextUrl.origin;

    const invitationResult = await createInvitation(
      companyId,
      payload.apartmentId,
      payload.email,
      {
        invitedByUid: payload.invitedByUid,
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

    const loginLink = `${origin}/login?redirect=${encodeURIComponent(invitationResult.invitationLink)}`;

    const resendConfig = getResendConfig();
    const resend = new Resend(resendConfig.apiKey);

    const subject = existingAccountDetected
      ? 'Domera: вам открыт доступ к квартире'
      : 'Приглашение в Domera';

    const text = existingAccountDetected
      ? [
          'Domera — доступ к квартире',
          '',
          'Здравствуйте!',
          '',
          'Для вашего существующего аккаунта открыт доступ к квартире в Domera.',
          '1) Войдите в аккаунт:',
          loginLink,
          '2) После входа подтвердите доступ по ссылке приглашения:',
          invitationResult.invitationLink,
          '',
          'Если вы не ожидали это письмо, просто проигнорируйте его.',
          '',
          'С уважением,',
          'Команда Domera',
        ].join('\n')
      : [
          'Domera — приглашение',
          '',
          'Здравствуйте!',
          '',
          'Вас пригласили в сервис Domera как жильца.',
          'Чтобы завершить регистрацию и создать доступ, перейдите по ссылке:',
          invitationResult.invitationLink,
          '',
          'Если вы не ожидали это письмо, просто проигнорируйте его.',
          '',
          'С уважением,',
          'Команда Domera',
        ].join('\n');

    const html = existingAccountDetected
      ? `
      <div style="margin:0;padding:0;background:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:28px 12px;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#111827;border:1px solid #1f2937;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #1f2937;">
                    <p style="margin:0;color:#93c5fd;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Domera</p>
                    <h1 style="margin:8px 0 0;color:#f8fafc;font-size:22px;line-height:1.3;">Доступ к квартире открыт</h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 14px;color:#e5e7eb;font-size:15px;line-height:1.6;">
                      Для вашего существующего аккаунта открыт доступ в Domera.
                    </p>
                    <p style="margin:0 0 8px;color:#cbd5e1;font-size:14px;line-height:1.6;">Шаг 1: войдите в аккаунт</p>
                    <p style="margin:0 0 18px;">
                      <a href="${loginLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:10px;">
                        Войти в Domera
                      </a>
                    </p>

                    <p style="margin:0 0 8px;color:#cbd5e1;font-size:14px;line-height:1.6;">Шаг 2: подтвердите доступ к квартире</p>
                    <p style="margin:0 0 22px;">
                      <a href="${invitationResult.invitationLink}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:10px;">
                        Принять доступ
                      </a>
                    </p>

                    <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;">Если кнопки не работают, откройте ссылки вручную:</p>
                    <p style="margin:0 0 8px;word-break:break-all;"><a href="${loginLink}" style="color:#60a5fa;font-size:12px;line-height:1.5;text-decoration:underline;">${loginLink}</a></p>
                    <p style="margin:0 0 20px;word-break:break-all;"><a href="${invitationResult.invitationLink}" style="color:#60a5fa;font-size:12px;line-height:1.5;text-decoration:underline;">${invitationResult.invitationLink}</a></p>

                    <div style="margin:0 0 6px;padding:12px 14px;border-radius:10px;background:#0b1220;border:1px solid #1e293b;">
                      <p style="margin:0;color:#cbd5e1;font-size:12px;line-height:1.5;">
                        Если вы не ожидали это письмо, просто проигнорируйте его.
                      </p>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 24px;border-top:1px solid #1f2937;">
                    <p style="margin:0;color:#64748b;font-size:11px;line-height:1.5;">
                      Это автоматическое письмо от сайта Domera. Пожалуйста, не отвечайте на него.
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
      <div style="margin:0;padding:0;background:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:28px 12px;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#111827;border:1px solid #1f2937;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #1f2937;">
                    <p style="margin:0;color:#93c5fd;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Domera</p>
                    <h1 style="margin:8px 0 0;color:#f8fafc;font-size:22px;line-height:1.3;">Приглашение в сервис</h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 14px;color:#e5e7eb;font-size:15px;line-height:1.6;">
                      Здравствуйте! Вас пригласили в Domera как жильца.
                    </p>
                    <p style="margin:0 0 20px;color:#cbd5e1;font-size:14px;line-height:1.6;">
                      Нажмите кнопку ниже, чтобы принять приглашение и завершить регистрацию.
                    </p>

                    <p style="margin:0 0 22px;">
                      <a
                        href="${invitationResult.invitationLink}"
                        style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:10px;"
                      >
                        Принять приглашение
                      </a>
                    </p>

                    <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;">Если кнопка не работает, откройте ссылку вручную:</p>
                    <p style="margin:0 0 20px;word-break:break-all;">
                      <a href="${invitationResult.invitationLink}" style="color:#60a5fa;font-size:12px;line-height:1.5;text-decoration:underline;">${invitationResult.invitationLink}</a>
                    </p>

                    <div style="margin:0 0 6px;padding:12px 14px;border-radius:10px;background:#0b1220;border:1px solid #1e293b;">
                      <p style="margin:0;color:#cbd5e1;font-size:12px;line-height:1.5;">
                        Если вы не ожидали это письмо, просто проигнорируйте его.
                      </p>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 24px;border-top:1px solid #1f2937;">
                    <p style="margin:0;color:#64748b;font-size:11px;line-height:1.5;">
                      Это автоматическое письмо от сайта Domera. Пожалуйста, не отвечайте на него.
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

    return NextResponse.json({
      success: true,
      message: 'Приглашение отправлено на email',
      invitationId: invitationResult.invitation.id,
      token: invitationResult.invitation.token,
      invitationLink: invitationResult.invitationLink,
      existingAccountDetected,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ошибка отправки приглашения';
    console.error('SEND_INVITATION API error:', message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
