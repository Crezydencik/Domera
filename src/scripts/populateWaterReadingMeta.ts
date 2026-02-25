import { queryDocuments, getDocument, updateDocument } from '@/firebase/services/firestoreService';
import { FIRESTORE_COLLECTIONS } from '@/shared/constants';
import type { Meter } from '@/shared/types';

async function main() {
  console.log('Starting migration: populate wrname/wrnum/wrexdate in apartment.waterReadings');
  const apartments = await queryDocuments(FIRESTORE_COLLECTIONS.APARTMENTS, [] as any[]);
  let updatedCount = 0;
  for (const apt of apartments) {
    const aptId = String(apt.id ?? apt['id']);
    const raw = Array.isArray(apt['waterReadings']) ? apt['waterReadings'] : [];
    let changed = false;
    const next = raw.map((item: any) => {
      if (item && typeof item === 'object' && Array.isArray(item.history) && typeof item.meterId === 'string') {
        // group
        const group = { ...item } as any;
        const mid = group.meterId as string;
        try {
          const meter = (getDocument(FIRESTORE_COLLECTIONS.METERS, mid) as unknown) as Promise<Meter | null>;
        } catch (e) {
          // ignore
        }
        return group;
      }
      return item;
    });

    // Second pass: fetch meters for groups that need meta
    const groups = next.filter((it: any) => it && typeof it === 'object' && Array.isArray(it.history) && typeof it.meterId === 'string');

    if (groups.length === 0) continue;

    // fetch all meter docs in parallel
    const meterIds = groups.map((g: any) => g.meterId);
    const meterDocs = await Promise.all(
      meterIds.map(async (mid) => {
        try {
          return (await getDocument(FIRESTORE_COLLECTIONS.METERS, mid)) as Meter | null;
        } catch (e) {
          return null;
        }
      })
    );

    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const md = meterDocs[i];
      const wantsWrName = !g.wrname || String(g.wrname).trim() === '';
      const wantsWrNum = !g.wrnum || String(g.wrnum).trim() === '';
      const wantsWrEx = !g.wrexdate;
      if (md && (wantsWrName || wantsWrNum || wantsWrEx)) {
        g.wrname = md.name ?? g.wrname ?? '';
        g.wrnum = md.serialNumber ?? g.wrnum ?? '';
        g.wrexdate = md.checkDueDate ?? g.wrexdate ?? null;
        changed = true;
      }
    }

    if (changed) {
      try {
        await updateDocument(FIRESTORE_COLLECTIONS.APARTMENTS, aptId, { waterReadings: next });
        updatedCount++;
        console.log(`Updated apartment ${aptId}`);
      } catch (e) {
        console.error(`Failed to update apartment ${aptId}:`, e);
      }
    }
  }

  console.log(`Done. Apartments updated: ${updatedCount}`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
