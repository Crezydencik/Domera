import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/firebase/admin';
import { requireRequestAuth, toAuthErrorResponse } from '@/shared/lib/serverAuth';
import { writeAuditEvent } from '@/shared/lib/auditLog';
import { buildRateLimitKey, consumeRateLimit } from '@/shared/lib/rateLimit';

type CreateInvoicePayload = {
  apartmentId: string;
  month: number;
  year: number;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  pdfUrl?: string;
  companyId?: string;
  buildingId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request, {
      allowedRoles: ['ManagementCompany', 'Accountant'],
    });

    const payload = (await request.json()) as CreateInvoicePayload;
    if (!payload?.apartmentId || !Number.isFinite(payload.amount)) {
      await writeAuditEvent({
        request,
        action: 'invoice.create',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        reason: 'invalid_payload',
      });
      return NextResponse.json({ error: 'Invalid invoice payload' }, { status: 400 });
    }

    const rl = consumeRateLimit(
      buildRateLimitKey(request, 'invoice:create', auth.uid),
      20,
      60_000
    );
    if (!rl.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      await writeAuditEvent({
        request,
        action: 'invoice.create',
        status: 'rate_limited',
        actorUid: auth.uid,
        actorRole: auth.role,
        apartmentId: payload.apartmentId,
        reason: 'too_many_requests',
      });
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    if (auth.companyId && payload.companyId && payload.companyId !== auth.companyId) {
      await writeAuditEvent({
        request,
        action: 'invoice.create',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        companyId: payload.companyId,
        reason: 'tenant_mismatch',
      });
      return NextResponse.json({ error: 'Access denied for company' }, { status: 403 });
    }

    const db = getFirebaseAdminDb();
    const apartmentSnap = await db.collection('apartments').doc(payload.apartmentId).get();
    if (!apartmentSnap.exists) {
      await writeAuditEvent({
        request,
        action: 'invoice.create',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        apartmentId: payload.apartmentId,
        reason: 'apartment_not_found',
      });
      return NextResponse.json({ error: 'Apartment not found' }, { status: 404 });
    }

    const apartmentData = apartmentSnap.data() as Record<string, unknown>;
    const apartmentCompanyIds = Array.isArray(apartmentData.companyIds)
      ? apartmentData.companyIds.filter((x): x is string => typeof x === 'string')
      : [];

    const targetCompanyId = payload.companyId ?? auth.companyId ?? apartmentCompanyIds[0];
    if (!targetCompanyId || !apartmentCompanyIds.includes(targetCompanyId)) {
      await writeAuditEvent({
        request,
        action: 'invoice.create',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        apartmentId: payload.apartmentId,
        companyId: targetCompanyId,
        reason: 'apartment_company_mismatch',
      });
      return NextResponse.json({ error: 'Access denied for apartment/company ownership' }, { status: 403 });
    }

    const ref = db.collection('invoices').doc();
    const data = {
      apartmentId: payload.apartmentId,
      month: payload.month,
      year: payload.year,
      amount: payload.amount,
      status: payload.status,
      pdfUrl: payload.pdfUrl ?? '',
      companyId: targetCompanyId,
      buildingId: payload.buildingId ?? null,
      createdAt: new Date(),
      createdByUid: auth.uid,
    };

    await ref.set(data);

    await writeAuditEvent({
      request,
      action: 'invoice.create',
      status: 'success',
      actorUid: auth.uid,
      actorRole: auth.role,
      companyId: typeof data.companyId === 'string' ? data.companyId : undefined,
      apartmentId: payload.apartmentId,
      metadata: { invoiceId: ref.id },
    });

    return NextResponse.json({ success: true, invoice: { id: ref.id, ...data } });
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiAuthError') {
      return toAuthErrorResponse(error);
    }
    await writeAuditEvent({
      request,
      action: 'invoice.create',
      status: 'error',
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
