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
  permissions?: string[];
  inviteType?: string;
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
      allowedRoles: ['ManagementCompany', 'Accountant', 'Resident'],
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
        permissions: (payload.permissions ?? []).filter(
          (p): p is import('@/shared/types').TenantPermission =>
            p === 'viewDocuments' || p === 'submitMeter' || p === 'remove'
        ),
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

    // Если у квартиры есть поле ownerName или ownerEmail, используем для письма
    const ownerName = apartment?.owner || '';
    const apartmentName = apartment?.number || '';

    let subject = 'Приглашение в Domera';
    let html = '';
    let text = '';
    let invitationLink = invitationResult.invitationLink;
    // Если это приглашение арендатора, добавляем inviteType=renter в ссылку
    if (payload.inviteType === 'renter') {
      if (!invitationLink.includes('inviteType=renter')) {
        invitationLink += (invitationLink.includes('?') ? '&' : '?') + 'inviteType=renter';
      }
      const renterEmailTemplate = (await import('@/emails/invitation.renter.lv')).default;
      subject = renterEmailTemplate.subject;
      html = renterEmailTemplate.html(invitationLink, apartmentName);
      text = `Jūs esat uzaicināts dzīvokļa īpašnieka pievienoties dzīvoklim Domera platformā.\n\nLūdzu, izmantojiet tikai funkciju "Iesniegt skaitītāju rādījumus". Citas iespējas jums nav pieejamas.\n\nPievienošanās saite: ${invitationLink}`;
    } else {
      // Обычное приглашение жильца (оставьте как было или используйте другой шаблон)
      const residentEmailTemplate = (await import('@/emails/invitation.lv')).default;
      subject = residentEmailTemplate.subject;
      html = residentEmailTemplate.html(invitationLink, apartmentName);
      text = `Jūs esat uzaicināts pievienoties dzīvoklim Domera platformā.\n\nPievienošanās saite: ${invitationLink}`;
    }

    let resendResult;
    try {
      resendResult = await resend.emails.send({
        from: resendConfig.from,
        to: payload.email,
        subject,
        text,
        html,
      });
      if (resendResult.error) {
        console.error('Resend error:', resendResult.error);
        throw new Error(`Resend error: ${resendResult.error.message || resendResult.error}`);
      }
    } catch (err) {
      console.error('Ошибка при отправке письма через Resend:', err);
      return NextResponse.json({
        error: 'Ошибка при отправке письма',
        details: err instanceof Error ? err.message : String(err),
      }, { status: 500 });
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
