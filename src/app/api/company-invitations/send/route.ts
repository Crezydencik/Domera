import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createDocument } from '@/firebase/services/firestoreService';
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';

interface SendCompanyInvitationPayload {
  email: string;
  companyId: string;
  role: 'Accountant' | 'ManagementCompany';
  buildingId: string;
  buildingName?: string;
  invitedByUid?: string;
}

const getResendConfig = () => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    throw new Error('Resend nav konfigurēts. Norādiet RESEND_API_KEY un RESEND_FROM');
  }

  return { apiKey, from };
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as SendCompanyInvitationPayload;

    if (!payload.email || !payload.companyId || !payload.role || !payload.buildingId) {
      return NextResponse.json(
        { error: 'Nepieciešams email, companyId, buildingId un role' },
        { status: 400 }
      );
    }

    const normalizedEmail = payload.email.trim().toLowerCase();
    const roleLabel = payload.role === 'Accountant' ? 'бухгалтер' : 'администратор дома';

    const invitationId = await createDocument(FIRESTORE_COLLECTIONS.COMPANY_INVITATIONS, {
      email: normalizedEmail,
      companyId: payload.companyId,
      buildingId: payload.buildingId,
      buildingName: payload.buildingName ?? '',
      role: payload.role,
      status: 'pending',
      invitedByUid: payload.invitedByUid ?? '',
      createdAt: new Date(),
    });

    const origin = request.nextUrl.origin;
    const registerLink = `${origin}/register?inviteRole=${encodeURIComponent(payload.role)}&companyId=${encodeURIComponent(
      payload.companyId
    )}&email=${encodeURIComponent(normalizedEmail)}&invitationId=${encodeURIComponent(invitationId)}`;

    const resendConfig = getResendConfig();
    const resend = new Resend(resendConfig.apiKey);

    const subject = `Domera: приглашение в компанию (${roleLabel})`;

    const text = [
      'Domera — приглашение в компанию',
      '',
      `Вас пригласили в компанию с ролью: ${roleLabel}.`,
      payload.buildingName ? `Дом: ${payload.buildingName}` : '',
      '',
      'Для регистрации и получения доступа перейдите по ссылке:',
      registerLink,
      '',
      'Если вы не ожидали это письмо, просто проигнорируйте его.',
      '',
      'Команда Domera',
    ]
      .filter(Boolean)
      .join('\n');

    const html = `
      <div style="margin:0;padding:24px;background:#f3f4f6;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 24px 12px;">
                    <h1 style="margin:0;color:#0f172a;font-size:28px;line-height:1.2;font-weight:800;">Приглашение в Domera</h1>
                    <p style="margin:12px 0 0;color:#334155;font-size:16px;line-height:1.6;">
                      Вас пригласили в компанию с ролью <strong>${roleLabel}</strong>${
                        payload.buildingName ? ` для дома <strong>${payload.buildingName}</strong>` : ''
                      }.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 24px;">
                    <a href="${registerLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:12px 18px;border-radius:10px;">
                      Зарегистрироваться и принять приглашение
                    </a>
                    <p style="margin:14px 0 0;color:#64748b;font-size:13px;line-height:1.5;word-break:break-all;">${registerLink}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    await resend.emails.send({
      from: resendConfig.from,
      to: normalizedEmail,
      subject,
      text,
      html,
    });

    return NextResponse.json({ success: true, registerLink, invitationId });
  } catch (error) {
    console.error('Error sending company invitation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка отправки приглашения' },
      { status: 500 }
    );
  }
}
