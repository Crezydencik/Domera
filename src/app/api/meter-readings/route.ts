import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/firebase/admin';
import { requireRequestAuth, toAuthErrorResponse } from '@/shared/lib/serverAuth';
import { writeAuditEvent } from '@/shared/lib/auditLog';
import { buildRateLimitKey, consumeRateLimit } from '@/shared/lib/rateLimit';

interface SubmitMeterReadingPayload {
  apartmentId: string;
  meterId: string;
  meterKey?: 'coldmeterwater' | 'hotmeterwater';
  previousValue: number;
  currentValue: number;
  consumption: number;
  buildingId: string;
  month?: number;
  year?: number;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request, {
      allowedRoles: ['Resident', 'ManagementCompany', 'Accountant'],
    });

    const payload = (await request.json()) as SubmitMeterReadingPayload;
    if (!payload?.apartmentId || !payload?.meterId) {
      await writeAuditEvent({
        request,
        action: 'meter_reading.submit',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        reason: 'missing_required_fields',
      });
      return NextResponse.json({ error: 'apartmentId and meterId are required' }, { status: 400 });
    }

    const rl = await consumeRateLimit(
      buildRateLimitKey(request, 'meter-readings:submit', payload.apartmentId),
      20,
      60_000
    );

    if (!rl.allowed) {
      await writeAuditEvent({
        request,
        action: 'meter_reading.submit',
        status: 'rate_limited',
        actorUid: auth.uid,
        actorRole: auth.role,
        apartmentId: payload.apartmentId,
        reason: 'too_many_requests',
      });
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const db = getFirebaseAdminDb();
    const apartmentRef = db.collection('apartments').doc(payload.apartmentId);
    const apartmentSnap = await apartmentRef.get();

    if (!apartmentSnap.exists) {
      await writeAuditEvent({
        request,
        action: 'meter_reading.submit',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        apartmentId: payload.apartmentId,
        reason: 'apartment_not_found',
      });
      return NextResponse.json({ error: 'Apartment not found' }, { status: 404 });
    }

    const apartment = apartmentSnap.data() as Record<string, unknown>;
    const companyIds = Array.isArray(apartment.companyIds)
      ? apartment.companyIds.filter((x): x is string => typeof x === 'string')
      : [];

    if (auth.role === 'Resident') {
      const isClaimApartment = Boolean(auth.apartmentId && auth.apartmentId === payload.apartmentId);
      const isPrimaryResident = typeof apartment.residentId === 'string' && apartment.residentId === auth.uid;
      const isTenantWithSubmit = Array.isArray(apartment.tenants)
        && apartment.tenants.some((tenant) => {
          if (!tenant || typeof tenant !== 'object') return false;
          const t = tenant as Record<string, unknown>;
          const userId = typeof t.userId === 'string' ? t.userId : '';
          const permissions = Array.isArray(t.permissions)
            ? t.permissions.filter((p): p is string => typeof p === 'string')
            : [];
          return userId === auth.uid && permissions.includes('submitMeter');
        });

      if (!isClaimApartment && !isPrimaryResident && !isTenantWithSubmit) {
        await writeAuditEvent({
          request,
          action: 'meter_reading.submit',
          status: 'denied',
          actorUid: auth.uid,
          actorRole: auth.role,
          apartmentId: payload.apartmentId,
          reason: 'resident_apartment_mismatch',
        });
        return NextResponse.json({ error: 'Access denied for apartment' }, { status: 403 });
      }
    } else if (auth.companyId && !companyIds.includes(auth.companyId)) {
      await writeAuditEvent({
        request,
        action: 'meter_reading.submit',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        apartmentId: payload.apartmentId,
        companyId: auth.companyId,
        reason: 'tenant_mismatch',
      });
      return NextResponse.json({ error: 'Access denied for company' }, { status: 403 });
    }

    const now = new Date();
    // Используем месяц и год из payload, если они есть, иначе по серверу
    const month = typeof payload.month === 'number' ? payload.month : now.getMonth() + 1;
    const year = typeof payload.year === 'number' ? payload.year : now.getFullYear();
    const reading = {
      id: randomUUID(),
      apartmentId: payload.apartmentId,
      meterId: payload.meterId,
      submittedAt: now,
      previousValue: payload.previousValue,
      currentValue: payload.currentValue,
      consumption: payload.consumption,
      buildingId: payload.buildingId,
      month,
      year,
    };

    const wr = (apartment.waterReadings ?? {}) as Record<string, unknown>;
    const namedKey = (['coldmeterwater', 'hotmeterwater'] as const).find(
      (k) => (wr[k] as Record<string, unknown> | undefined)?.meterId === payload.meterId
    );
    const preferredKey = payload.meterKey;
    const key = namedKey
      ?? (preferredKey === 'coldmeterwater' || preferredKey === 'hotmeterwater' ? preferredKey : undefined)
      ?? (/hwm|hot|gvs|гор/i.test(String(payload.meterId)) ? 'hotmeterwater' : undefined)
      ?? (/cwm|cold|hvs|хол/i.test(String(payload.meterId)) ? 'coldmeterwater' : undefined)
      ?? 'coldmeterwater';
    const meterGroup = (wr[key] as Record<string, unknown> | undefined) ?? { meterId: payload.meterId, history: [] };
    const history = Array.isArray(meterGroup.history) ? [...(meterGroup.history as Record<string, unknown>[])] : [];

    const duplicate = history.some((h) => Number(h.month) === month && Number(h.year) === year);
    if (duplicate) {
      // Логируем подробности для диагностики
      const debugHistory = history.map((h) => ({ month: h.month, year: h.year, value: h.currentValue }));
      console.error('[METER DUPLICATE]', {
        payloadMonth: month,
        payloadYear: year,
        debugHistory,
      });
      await writeAuditEvent({
        request,
        action: 'meter_reading.submit',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        apartmentId: payload.apartmentId,
        reason: 'duplicate_period_reading',
        debug: { payloadMonth: month, payloadYear: year, debugHistory },
      });
      return NextResponse.json({ error: 'Reading already exists for current month', debug: { payloadMonth: month, payloadYear: year, debugHistory } }, { status: 409 });
    }

    history.push(reading);

    await apartmentRef.set(
      {
        waterReadings: {
          ...wr,
          [key]: {
            ...meterGroup,
            meterId: payload.meterId,
            history,
            currentValue: payload.currentValue,
            previousValue: payload.previousValue,
            submittedAt: now,
          },
        },
      },
      { merge: true }
    );

    await writeAuditEvent({
      request,
      action: 'meter_reading.submit',
      status: 'success',
      actorUid: auth.uid,
      actorRole: auth.role,
      companyId: auth.companyId,
      apartmentId: payload.apartmentId,
      metadata: { meterId: payload.meterId, month, year },
    });

    return NextResponse.json({ success: true, reading });
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiAuthError') {
      await writeAuditEvent({ request, action: 'meter_reading.submit', status: 'denied', reason: error.message });
      return toAuthErrorResponse(error);
    }

    await writeAuditEvent({
      request,
      action: 'meter_reading.submit',
      status: 'error',
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Failed to submit meter reading' }, { status: 500 });
  }
}
