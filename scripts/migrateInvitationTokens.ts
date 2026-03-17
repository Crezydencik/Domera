/**
 * Migration script: remove legacy raw invitation tokens and keep only tokenHash.
 *
 * Default mode is DRY-RUN.
 * Use --apply to persist changes.
 *
 * Usage:
 *   npx tsx scripts/migrateInvitationTokens.ts
 *   npx tsx scripts/migrateInvitationTokens.ts --apply
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore, WriteBatch } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const shouldApply = process.argv.includes('--apply');

const serviceAccountPath = path.join(__dirname, '../src/firebase/firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

async function flushBatch(batch: WriteBatch): Promise<void> {
  await batch.commit();
}

async function main() {
  console.log('=== Migration: invitation token -> tokenHash only ===');
  console.log(`Mode: ${shouldApply ? 'APPLY' : 'DRY-RUN'}\n`);

  const invitationsSnap = await db.collection('invitations').get();

  let total = 0;
  let alreadySafe = 0;
  let candidates = 0;
  let toUpdateHash = 0;
  let toDeleteRawToken = 0;
  let updated = 0;
  let deleted = 0;

  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of invitationsSnap.docs) {
    total += 1;
    const data = doc.data() as { token?: unknown; tokenHash?: unknown };

    const token = typeof data.token === 'string' && data.token.trim() ? data.token.trim() : '';
    const tokenHash = typeof data.tokenHash === 'string' && data.tokenHash.trim() ? data.tokenHash.trim() : '';

    if (!token && tokenHash) {
      alreadySafe += 1;
      continue;
    }

    if (!token && !tokenHash) {
      // keep as is; no migration material available
      continue;
    }

    candidates += 1;

    const expectedHash = token ? hashToken(token) : '';
    const needsHashUpdate = !!token && tokenHash !== expectedHash;
    const needsRawTokenDelete = !!token;

    if (needsHashUpdate) toUpdateHash += 1;
    if (needsRawTokenDelete) toDeleteRawToken += 1;

    console.log(
      `[CANDIDATE] ${doc.id} hash:${needsHashUpdate ? 'update' : 'ok'} token:${needsRawTokenDelete ? 'delete' : 'none'}`
    );

    if (!shouldApply) {
      continue;
    }

    if (needsHashUpdate) {
      batch.update(doc.ref, { tokenHash: expectedHash });
      opsInBatch += 1;
      updated += 1;
    }

    if (needsRawTokenDelete) {
      batch.update(doc.ref, { token: FieldValue.delete() });
      opsInBatch += 1;
      deleted += 1;
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
  console.log(`Total invitations: ${total}`);
  console.log(`Already safe (tokenHash only): ${alreadySafe}`);
  console.log(`Candidates: ${candidates}`);
  console.log(`Need hash update: ${toUpdateHash}`);
  console.log(`Need raw token removal: ${toDeleteRawToken}`);

  if (shouldApply) {
    console.log(`Applied hash updates: ${updated}`);
    console.log(`Applied token removals: ${deleted}`);
  } else {
    console.log('Dry-run only. Re-run with --apply to persist changes.');
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
