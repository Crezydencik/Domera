import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/firebase/admin';
import { requireRequestAuth, toAuthErrorResponse } from '@/shared/lib/serverAuth';
import { writeAuditEvent } from '@/shared/lib/auditLog';
import { buildRateLimitKey, consumeRateLimit } from '@/shared/lib/rateLimit';

const findReadingInApartment = (
  apartment: Record<string, unknown>,
  readingId: string
): { key: 'coldmeterwater' | 'hotmeterwater'; group: Record<string, unknown>; index: number } | null => {
  const wr = (apartment.waterReadings ?? {}) as Record<string, unknown>;
  for (const key of ['coldmeterwater', 'hotmeterwater'] as const) {
    const group = wr[key] as Record<string, unknown> | undefined;
    if (!group || !Array.isArray(group.history)) continue;

    const idx = (group.history as Record<string, unknown>[]).findIndex((h) => String(h.id ?? '') === readingId);
    if (idx >= 0) {
      return { key, group, index: idx };
    }
  }
  return null;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ readingId: string }> }) {
  try {
    const auth = await requireRequestAuth(request, {
      allowedRoles: ['Resident', 'ManagementCompany', 'Accountant'],
    });
    const { readingId } = await params;
    const payload = (await request.json()) as { apartmentId?: string; data?: Record<string, unknown> };

    if (!readingId || !payload.apartmentId || !payload.data) {
      return NextResponse.json({ error: 'readingId, apartmentId and data are required' }, { status: 400 });
    }

    const rl = await consumeRateLimit(buildRateLimitKey(request, 'meter-reading:update', readingId), 30, 60_000);
    if (!rl.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      await writeAuditEvent({
        request,
        action: 'meter_reading.update',
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

    const db = getFirebaseAdminDb();
    const apartmentRef = db.collection('apartments').doc(payload.apartmentId);
    const apartmentSnap = await apartmentRef.get();
    if (!apartmentSnap.exists) {
      return NextResponse.json({ error: 'Apartment not found' }, { status: 404 });
    }

    const apartment = apartmentSnap.data() as Record<string, unknown>;
    const companyIds = Array.isArray(apartment.companyIds)
      ? apartment.companyIds.filter((x): x is string => typeof x === 'string')
      : [];

    if (auth.role === 'Resident') {
      if (!auth.apartmentId || auth.apartmentId !== payload.apartmentId) {
        return NextResponse.json({ error: 'Access denied for apartment' }, { status: 403 });
      }
    } else if (auth.companyId && !companyIds.includes(auth.companyId)) {
      return NextResponse.json({ error: 'Access denied for company' }, { status: 403 });
    }

    const found = findReadingInApartment(apartment, readingId);
    if (!found) {
      return NextResponse.json({ error: 'Reading not found' }, { status: 404 });
    }

    const history = [...(found.group.history as Record<string, unknown>[])];
    history[found.index] = { ...history[found.index], ...payload.data, id: history[found.index].id };

    const wr = (apartment.waterReadings ?? {}) as Record<string, unknown>;
    await apartmentRef.set(
      {
        waterReadings: {
          ...wr,
          [found.key]: {
            ...found.group,
            history,
          },
        },
      },
      { merge: true }
    );

    await writeAuditEvent({
      request,
      action: 'meter_reading.update',
      status: 'success',
      actorUid: auth.uid,
      actorRole: auth.role,
      companyId: auth.companyId,
      apartmentId: payload.apartmentId,
      metadata: { readingId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiAuthError') {
      return toAuthErrorResponse(error);
    }
    await writeAuditEvent({
      request,
      action: 'meter_reading.update',
      status: 'error',
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Failed to update meter reading' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ readingId: string }> }) {
    const { readingId } = await params;
    const apartmentId = request.nextUrl.searchParams.get('apartmentId')?.trim();
    console.log('[API] DELETE meter-reading', { readingId, apartmentId });
  try {
    const auth = await requireRequestAuth(request, {
      allowedRoles: ['Resident', 'ManagementCompany', 'Accountant'],
    });
    const { readingId } = await params;
    const apartmentId = request.nextUrl.searchParams.get('apartmentId')?.trim();

    if (!readingId || !apartmentId) {
      return NextResponse.json({ error: 'readingId and apartmentId are required' }, { status: 400 });
    }

    const rl = await consumeRateLimit(buildRateLimitKey(request, 'meter-reading:delete', readingId), 20, 60_000);
    if (!rl.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      await writeAuditEvent({
        request,
        action: 'meter_reading.delete',
        status: 'rate_limited',
        actorUid: auth.uid,
        actorRole: auth.role,
        apartmentId,
        reason: 'too_many_requests',
      });
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const db = getFirebaseAdminDb();
    const apartmentRef = db.collection('apartments').doc(apartmentId);
    const apartmentSnap = await apartmentRef.get();
    if (!apartmentSnap.exists) {
      return NextResponse.json({ error: 'Apartment not found' }, { status: 404 });
    }

    const apartment = apartmentSnap.data() as Record<string, unknown>;
    const companyIds = Array.isArray(apartment.companyIds)
      ? apartment.companyIds.filter((x): x is string => typeof x === 'string')
      : [];

    if (auth.role === 'Resident') {
      if (!auth.apartmentId || auth.apartmentId !== apartmentId) {
        return NextResponse.json({ error: 'Access denied for apartment' }, { status: 403 });
      }
    } else if (auth.companyId && !companyIds.includes(auth.companyId)) {
      return NextResponse.json({ error: 'Access denied for company' }, { status: 403 });
    }

    const found = findReadingInApartment(apartment, readingId);
    console.log('[API] Найденное показание:', found);
    if (!found) {
      return NextResponse.json({ error: 'Reading not found' }, { status: 404 });
    }

    const reading = (found.group.history as Record<string, unknown>[])[found.index];
    console.log('[API] Детали показания:', reading);
    function toDateSafe(ts) {
      if (ts instanceof Date) return ts;
      if (ts && typeof ts._seconds === 'number') return new Date(ts._seconds * 1000);
      return null;
    }
    const submittedAt = toDateSafe(reading.submittedAt);
    const now = new Date();
    let submittedAtLog, submittedYear, submittedMonth;
    if (submittedAt instanceof Date && !isNaN(submittedAt.getTime())) {
      submittedAtLog = submittedAt.toISOString();
      submittedYear = submittedAt.getFullYear();
      submittedMonth = submittedAt.getMonth();
    } else {
      submittedAtLog = submittedAt;
      submittedYear = null;
      submittedMonth = null;
    }
    console.log('[API] Проверка удаления:', {
      submittedAt: submittedAtLog,
      now: now.toISOString(),
      submittedYear,
      submittedMonth,
      nowYear: now.getFullYear(),
      nowMonth: now.getMonth(),
      reading
    });
    if (
      Number.isNaN(submittedAt.getTime()) ||
      submittedAt.getFullYear() !== now.getFullYear() ||
      submittedAt.getMonth() !== now.getMonth()
    ) {
      let submittedAtBlockLog, submittedYearBlock, submittedMonthBlock;
      if (submittedAt instanceof Date && !isNaN(submittedAt.getTime())) {
        submittedAtBlockLog = submittedAt.toISOString();
        submittedYearBlock = submittedAt.getFullYear();
        submittedMonthBlock = submittedAt.getMonth();
      } else {
        submittedAtBlockLog = submittedAt;
        submittedYearBlock = null;
        submittedMonthBlock = null;
      }
      console.log('[API] Блокировка удаления:', {
        submittedAt: submittedAtBlockLog,
        now: now.toISOString(),
        submittedYear: submittedYearBlock,
        submittedMonth: submittedMonthBlock,
        nowYear: now.getFullYear(),
        nowMonth: now.getMonth(),
        reading
      });
      return NextResponse.json({ error: 'Cannot delete readings from previous months' }, { status: 409 });
    }

    const history = (found.group.history as Record<string, unknown>[]).filter((h) => String(h.id ?? '') !== readingId);
    const wr = (apartment.waterReadings ?? {}) as Record<string, unknown>;
    await apartmentRef.set(
      {
        waterReadings: {
          ...wr,
          [found.key]: {
            ...found.group,
            history,
          },
        },
      },
      { merge: true }
    );

    await writeAuditEvent({
      request,
      action: 'meter_reading.delete',
      status: 'success',
      actorUid: auth.uid,
      actorRole: auth.role,
      companyId: auth.companyId,
      apartmentId,
      metadata: { readingId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Ошибка удаления meter reading:', error);
    if (error instanceof Error && error.name === 'ApiAuthError') {
      return toAuthErrorResponse(error);
    }
    await writeAuditEvent({
      request,
      action: 'meter_reading.delete',
      status: 'error',
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Failed to delete meter reading' }, { status: 500 });
  }
}
