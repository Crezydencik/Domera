import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Script: populate building.apartmentIds from apartments collection
 * Usage: run with ts-node or compile and run in node environment where firebase is configured
 */
async function populate() {
  try {
    const buildingsCol = collection(db, 'buildings');
    const buildingsSnap = await getDocs(buildingsCol);

    for (const bDoc of buildingsSnap.docs) {
      const bId = bDoc.id;
      console.log(`Processing building ${bId}`);

      // find apartments with buildingId == bId
      const apartmentsCol = collection(db, 'apartments');
      const q = query(apartmentsCol, where('buildingId', '==', bId));
      const aptSnap = await getDocs(q);
      const aptIds = aptSnap.docs.map((d) => d.id);

      console.log(` - found ${aptIds.length} apartments`);

      if (aptIds.length > 0) {
        const bRef = doc(db, 'buildings', bId);
        await updateDoc(bRef, { apartmentIds: aptIds });
        console.log(` - updated building ${bId} apartmentIds`);
      } else {
        console.log(` - no apartments for building ${bId}`);
      }
    }

    console.log('Done.');
  } catch (err) {
    console.error('Error populating building apartmentIds:', err);
    process.exit(1);
  }
}

populate();
