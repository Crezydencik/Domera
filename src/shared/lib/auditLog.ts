import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { getFirebaseAdminDb } from '@/firebase/admin';
import { toSafeErrorDetails } from '@/shared/lib/safeLog';

type AuditStatus = 'success' | 'denied' | 'error' | 'rate_limited';

interface AuditEventInput {
  request?: NextRequest;
  action: string;
  status: AuditStatus;
  actorUid?: string;
  actorRole?: string;
  companyId?: string;
  apartmentId?: string;
  invitationId?: string;
  targetEmail?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

const ALERTABLE_STATUSES: Set<AuditStatus> = new Set(['denied', 'rate_limited']);
const BURST_WINDOW_MS = 5 * 60_000;
const BURST_THRESHOLD = 20;

const burstState = new Map<string, { count: number; resetAt: number }>();

const getClientIp = (request?: NextRequest): string | null => {
  if (!request) return null;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp || null;
};

const getEmailDomain = (email: string): string | null => {
  const at = email.lastIndexOf('@');
  if (at === -1) return null;
  return email.slice(at + 1).toLowerCase();
};

const trackBurstAndAlert = async (
  db: FirebaseFirestore.Firestore,
  status: AuditStatus,
  ipHash: string | null,
  action: string,
  reason?: string
): Promise<void> => {
  if (!ipHash || !ALERTABLE_STATUSES.has(status)) {
    return;
  }

  const now = Date.now();
  const key = ipHash;
  const current = burstState.get(key);

  if (!current || now >= current.resetAt) {
    burstState.set(key, { count: 1, resetAt: now + BURST_WINDOW_MS });
    return;
  }

  current.count += 1;
  burstState.set(key, current);

  if (current.count !== BURST_THRESHOLD) {
    return;
  }

  const alertPayload = {
    type: 'authz_burst',
    ipHash,
    windowMs: BURST_WINDOW_MS,
    threshold: BURST_THRESHOLD,
    action,
    status,
    reason: reason ?? null,
    detectedAt: new Date(),
  };

  console.warn('security.alert.repeated_401_403_429_burst', alertPayload);

  try {
    await db.collection('security_alerts').add(alertPayload);
  } catch (error) {
    console.warn('security.alert.write.failed', toSafeErrorDetails(error));
  }
};

export const writeAuditEvent = async (input: AuditEventInput): Promise<void> => {
  try {
    const db = getFirebaseAdminDb();

    const targetEmailNormalized = input.targetEmail?.trim().toLowerCase();
    const clientIp = getClientIp(input.request);
    const ipHash = clientIp ? hash(clientIp) : null;

    await db.collection('audit_events').add({
      action: input.action,
      status: input.status,
      actorUid: input.actorUid ?? null,
      actorRole: input.actorRole ?? null,
      companyId: input.companyId ?? null,
      apartmentId: input.apartmentId ?? null,
      invitationId: input.invitationId ?? null,
      targetEmailHash: targetEmailNormalized ? hash(targetEmailNormalized) : null,
      targetEmailDomain: targetEmailNormalized ? getEmailDomain(targetEmailNormalized) : null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? null,
      ipHash,
      userAgent: input.request?.headers.get('user-agent') ?? null,
      createdAt: new Date(),
    });

    await trackBurstAndAlert(db, input.status, ipHash, input.action, input.reason);
  } catch (error) {
    console.warn('audit.log.write.failed', toSafeErrorDetails(error));
  }
};
