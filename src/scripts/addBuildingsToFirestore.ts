import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const buildings = [
  {
    name: 'Первый дом',
    address: 'Matisa 82',
    managedBy: {
      companyId: 'ij979VbAprV4TPgSsWoG',
      companyName: 'dom1',
      managerEmail: 'denik1902@inbox.lv',
      managerUid: 'bmtIV52ccvWiNLJqAtZrqYhc5AT2',
    },
  },
  {
    name: 'Второй дом',
    address: 'Brivibas 45',
    managedBy: {
      companyId: 'ij979VbAprV4TPgSsWoH',
      companyName: 'dom2',
      managerEmail: 'manager2@example.com',
      managerUid: 'bmtIV52ccvWiNLJqAtZrqYhc5AT3',
    },
  },
];

const addBuildingsToFirestore = async () => {
  try {
    const buildingsCollection = collection(db, 'buildings');
    for (const building of buildings) {
      const docRef = await addDoc(buildingsCollection, building);
      console.log(`Added building with ID: ${docRef.id}`);
    }
    console.log('All buildings have been added successfully.');
  } catch (error) {
    console.error('Error adding buildings to Firestore:', error);
  }
};

addBuildingsToFirestore();