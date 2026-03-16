/**
 * Migration script: populate waterReadings.coldmeterwater / hotmeterwater
 * for all existing apartments.
 *
 * Usage:
 *   npx tsx scripts/migrateWaterReadings.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccountPath = path.join(__dirname, '../src/firebase/firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  console.log('=== Migration: waterReadings.coldmeterwater / hotmeterwater ===\n');

  const apartmentsSnap = await db.collection('apartments').get();
  let updated = 0;
  let skipped = 0;

  for (const aptDoc of apartmentsSnap.docs) {
    const apt = aptDoc.data();
    const aptId = aptDoc.id;

    // Already migrated — skip
    const existing = apt['waterReadings'];
    if (
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      (existing['coldmeterwater'] || existing['hotmeterwater'])
    ) {
      console.log(`[SKIP] ${aptId} — already migrated`);
      skipped++;
      continue;
    }

    const waterReadingsUpdate: Record<string, unknown> = {};

    // --- Try to use existing meters from the meters collection ---
    const metersSnap = await db.collection('meters').where('apartmentId', '==', aptId).get();

    if (!metersSnap.empty) {
      for (const meterDoc of metersSnap.docs) {
        const meter = meterDoc.data();
        const meterId = meterDoc.id;
        const rawName = (meter['name'] ?? '').toString().toLowerCase();

        const isCold = rawName === 'cwm' || /хвс|cold|хол|aukst/i.test(rawName);
        const isHot = rawName === 'hwm' || /гвс|hot|гор|kart/i.test(rawName);

        if (!isCold && !isHot) {
          console.log(`  [WARN] meter ${meterId} unknown type "${rawName}", skipping`);
          continue;
        }

        const fieldName = isCold ? 'coldmeterwater' : 'hotmeterwater';

        // Collect history from old waterReadings array (if any)
        let history: unknown[] = [];
        if (Array.isArray(existing)) {
          for (const item of existing) {
            if (item && typeof item === 'object' && item['meterId'] === meterId) {
              if (Array.isArray(item['history'])) history = item['history'];
              break;
            }
          }
        }
        if (history.length === 0 && Array.isArray(meter['history'])) {
          history = meter['history'];
        }

        const lastEntry = history.length > 0
          ? (history[history.length - 1] as Record<string, unknown>)
          : null;

        waterReadingsUpdate[fieldName] = {
          meterId,
          serialNumber: meter['serialNumber'] ?? '',
          checkDueDate: meter['checkDueDate'] ?? '',
          currentValue: lastEntry?.['currentValue'] ?? null,
          previousValue: lastEntry?.['previousValue'] ?? null,
          submittedAt: lastEntry?.['submittedAt'] ?? null,
          history,
        };

        console.log(`  [${fieldName}] meter=${meterId} serial=${meter['serialNumber']} history=${history.length}`);
      }
    } else {
      // No meters in collection — create from coldWaterMeterNumber / hotWaterMeterNumber
      const coldSerial = apt['coldWaterMeterNumber']?.toString() ?? '';
      const hotSerial = apt['hotWaterMeterNumber']?.toString() ?? '';

      if (!coldSerial && !hotSerial) {
        console.log(`[SKIP] ${aptId} — no meters and no serial number fields`);
        skipped++;
        continue;
      }

      if (hotSerial) {
        const hotRef = db.collection('meters').doc();
        await hotRef.set({
          apartmentId: aptId,
          buildingId: apt['buildingId'] ?? '',
          type: 'water',
          name: 'hwm',
          serialNumber: hotSerial,
          createdAt: new Date(),
        });
        waterReadingsUpdate['hotmeterwater'] = {
          meterId: hotRef.id,
          serialNumber: hotSerial,
          checkDueDate: '',
          currentValue: null,
          previousValue: null,
          submittedAt: null,
          history: [],
        };
        console.log(`  [hotmeterwater] created meter ${hotRef.id} serial=${hotSerial}`);
      }

      if (coldSerial) {
        const coldRef = db.collection('meters').doc();
        await coldRef.set({
          apartmentId: aptId,
          buildingId: apt['buildingId'] ?? '',
          type: 'water',
          name: 'cwm',
          serialNumber: coldSerial,
          createdAt: new Date(),
        });
        waterReadingsUpdate['coldmeterwater'] = {
          meterId: coldRef.id,
          serialNumber: coldSerial,
          checkDueDate: '',
          currentValue: null,
          previousValue: null,
          submittedAt: null,
          history: [],
        };
        console.log(`  [coldmeterwater] created meter ${coldRef.id} serial=${coldSerial}`);
      }
    }

    if (Object.keys(waterReadingsUpdate).length === 0) {
      console.log(`[SKIP] ${aptId} — nothing to write`);
      skipped++;
      continue;
    }

    await db.collection('apartments').doc(aptId).update({ waterReadings: waterReadingsUpdate });
    console.log(`[OK] apartment ${aptId} updated\n`);
    updated++;
  }

  console.log(`\n=== Done. Updated: ${updated}, Skipped: ${skipped} ===`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
