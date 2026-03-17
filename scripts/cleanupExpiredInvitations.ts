/**
 * Cleanup script for invitation lifecycle.
 *
 * Default mode: DRY-RUN (no writes).
 *
 * Actions:
 * 1) Revoke pending invitations where expiresAt < now.
 * 2) Optional purge for accepted/revoked invitations where gdpr.retentionUntil < now.
 *
 * Usage:
 *   npx tsx scripts/cleanupExpiredInvitations.ts
 *   npx tsx scripts/cleanupExpiredInvitations.ts --apply
 *   npx tsx scripts/cleanupExpiredInvitations.ts --apply --purge-retained
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue, WriteBatch } from 'firebase-admin/firestore';
import * as fs from 'node:fs';
import * as path from 'node:path';

const shouldApply = process.argv.includes('--apply');
const shouldPurgeRetained = process.argv.includes('--purge-retained');

const serviceAccountPath = path.join(__dirname, '../src/firebase/firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

type InvitationDoc = {
  status?: string;
  expiresAt?: Timestamp | Date | string;
  gdpr?: {
    retentionUntil?: Timestamp | Date | string;
  };
};

const toDateOrNull = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

async function flushBatch(batch: WriteBatch): Promise<void> {
  await batch.commit();
}

async function main() {
  const now = new Date();

  console.log('=== Cleanup: expired invitations ===');
  console.log(`Mode: ${shouldApply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Purge retained docs: ${shouldPurgeRetained ? 'YES' : 'NO'}\n`);

  const invitationsSnap = await db.collection('invitations').get();

  let total = 0;
  let revokeCandidates = 0;
  let purgeCandidates = 0;
  let revoked = 0;
  let purged = 0;

  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of invitationsSnap.docs) {
    total += 1;
    const data = doc.data() as InvitationDoc;

    const status = String(data.status ?? '').trim().toLowerCase();
    const expiresAt = toDateOrNull(data.expiresAt);
    const retentionUntil = toDateOrNull(data.gdpr?.retentionUntil);

    const isPendingExpired = status === 'pending' && !!expiresAt && expiresAt.getTime() < now.getTime();
    const isRetainedExpired =
      shouldPurgeRetained &&
      (status === 'accepted' || status === 'revoked') &&
      !!retentionUntil &&
      retentionUntil.getTime() < now.getTime();

    if (!isPendingExpired && !isRetainedExpired) {
      continue;
    }

    if (isPendingExpired) {
      revokeCandidates += 1;
      console.log(`[REVOKE] ${doc.id}`);

      if (shouldApply) {
        batch.update(doc.ref, {
          status: 'revoked',
          revokedAt: now,
          revokeReason: 'expired',
          updatedAt: now,
        });
        opsInBatch += 1;
        revoked += 1;
      }
    }

    if (isRetainedExpired) {
      purgeCandidates += 1;
      console.log(`[PURGE] ${doc.id}`);

      if (shouldApply) {
        batch.delete(doc.ref);
        opsInBatch += 1;
        purged += 1;
      }
    }

    if (opsInBatch >= 400) {
      await flushBatch(batch);
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (shouldApply && opsInBatch > 0) {
    await flushBatch(batch);
  }

  console.log('\n=== Summary ===');
  console.log(`Total invitations scanned: ${total}`);
  console.log(`Revoke candidates: ${revokeCandidates}`);
  console.log(`Purge candidates: ${purgeCandidates}`);

  if (shouldApply) {
    console.log(`Revoked: ${revoked}`);
    console.log(`Purged: ${purged}`);
  } else {
    console.log('Dry-run only. Re-run with --apply to persist changes.');
  }

  if (shouldApply && !shouldPurgeRetained) {
    console.log('\nTip: add --purge-retained to delete accepted/revoked invitations after retentionUntil.');
  }
}

main().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
