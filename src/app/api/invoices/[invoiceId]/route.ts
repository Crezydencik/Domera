import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/firebase/admin';
import { requireRequestAuth, toAuthErrorResponse } from '@/shared/lib/serverAuth';
import { writeAuditEvent } from '@/shared/lib/auditLog';
import { buildRateLimitKey, consumeRateLimit } from '@/shared/lib/rateLimit';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ invoiceId: string }> }) {
  try {
    const auth = await requireRequestAuth(request, {
      allowedRoles: ['ManagementCompany', 'Accountant'],
    });
    const { invoiceId } = await params;
    const payload = (await request.json()) as Record<string, unknown>;

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
    }

    const rl = consumeRateLimit(buildRateLimitKey(request, 'invoice:update', invoiceId), 30, 60_000);
    if (!rl.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      await writeAuditEvent({
        request,
        action: 'invoice.update',
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

    const db = getFirebaseAdminDb();
    const ref = db.collection('invoices').doc(invoiceId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const current = snap.data() as Record<string, unknown>;
    const targetCompanyId = typeof current.companyId === 'string' ? current.companyId : undefined;
    if (auth.companyId && targetCompanyId && auth.companyId !== targetCompanyId) {
      await writeAuditEvent({
        request,
        action: 'invoice.update',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        companyId: targetCompanyId,
        reason: 'tenant_mismatch',
      });
      return NextResponse.json({ error: 'Access denied for company' }, { status: 403 });
    }

    await ref.set(payload, { merge: true });

    await writeAuditEvent({
      request,
      action: 'invoice.update',
      status: 'success',
      actorUid: auth.uid,
      actorRole: auth.role,
      companyId: targetCompanyId,
      apartmentId: typeof current.apartmentId === 'string' ? current.apartmentId : undefined,
      metadata: { invoiceId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiAuthError') {
      return toAuthErrorResponse(error);
    }
    await writeAuditEvent({
      request,
      action: 'invoice.update',
      status: 'error',
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ invoiceId: string }> }) {
  try {
    const auth = await requireRequestAuth(request, {
      allowedRoles: ['ManagementCompany', 'Accountant'],
    });
    const { invoiceId } = await params;

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
    }

    const rl = consumeRateLimit(buildRateLimitKey(request, 'invoice:delete', invoiceId), 20, 60_000);
    if (!rl.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      await writeAuditEvent({
        request,
        action: 'invoice.delete',
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

    const db = getFirebaseAdminDb();
    const ref = db.collection('invoices').doc(invoiceId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const current = snap.data() as Record<string, unknown>;
    const targetCompanyId = typeof current.companyId === 'string' ? current.companyId : undefined;
    if (auth.companyId && targetCompanyId && auth.companyId !== targetCompanyId) {
      await writeAuditEvent({
        request,
        action: 'invoice.delete',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        companyId: targetCompanyId,
        reason: 'tenant_mismatch',
      });
      return NextResponse.json({ error: 'Access denied for company' }, { status: 403 });
    }

    await ref.delete();

    await writeAuditEvent({
      request,
      action: 'invoice.delete',
      status: 'success',
      actorUid: auth.uid,
      actorRole: auth.role,
      companyId: targetCompanyId,
      apartmentId: typeof current.apartmentId === 'string' ? current.apartmentId : undefined,
      metadata: { invoiceId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiAuthError') {
      return toAuthErrorResponse(error);
    }
    await writeAuditEvent({
      request,
      action: 'invoice.delete',
      status: 'error',
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
