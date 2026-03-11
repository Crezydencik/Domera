import * as XLSX from 'xlsx';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../src/firebase/firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

interface ApartmentImportData {
  cadastralNumber?: string;
  address?: string;
  apartmentNumber: string;
  floor?: string;
  ownerEmail?: string;
  hotWaterMeterNumber?: string;
  coldWaterMeterNumber?: string;
  readings: {
    date: string;
    hotWater?: number;
    coldWater?: number;
  }[];
}

async function importApartmentsFromExcel(filePath: string, buildingId: string) {
  try {
    console.log(`Reading Excel file: ${filePath}`);
    
    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    
    console.log(`Found ${rows.length} rows in Excel`);
    console.log('First row:', rows[0]);
    
    // Parse data
    const apartments: ApartmentImportData[] = [];
    
    rows.forEach((row: any, index: number) => {
      if (!row['DZ'] && !row['Domājamā daļa']) {
        console.log(`Skipping empty row ${index + 2}`);
        return; // Skip empty rows
      }
      
      const apartmentData: ApartmentImportData = {
        cadastralNumber: row['Kadastra numurs']?.toString() || '',
        address: row['Adrese']?.toString() || '',
        apartmentNumber: (row['DZ'] || row['Domājamā daļa'])?.toString() || '',
        floor: row['Stavs']?.toString() || '',
        ownerEmail: row['E pasts Reķiniem']?.toString() || '',
        hotWaterMeterNumber: row['Karstais NR']?.toString() || '',
        coldWaterMeterNumber: row['Aukstais NR']?.toString() || '',
        readings: [],
      };
      
      // Extract readings from columns (different date formats)
      const readingColumns = Object.keys(row).filter(
        key => key.includes('Karstais') || key.includes('Aukstais')
      );
      
      readingColumns.forEach(col => {
        const value = row[col];
        if (value !== undefined && value !== null && value !== '') {
          apartmentData.readings.push({
            date: col,
            hotWater: col.includes('Karstais') ? parseFloat(value) : undefined,
            coldWater: col.includes('Aukstais') ? parseFloat(value) : undefined,
          });
        }
      });
      
      apartments.push(apartmentData);
    });
    
    console.log(`\nParsed ${apartments.length} apartments`);
    
    // Import to Firestore
    for (const apt of apartments) {
      try {
        // Create apartment document
        const apartmentRef = db.collection('apartments').doc();
        
        await apartmentRef.set({
          buildingId,
          number: apt.apartmentNumber,
          cadastralNumber: apt.cadastralNumber,
          address: apt.address,
          floor: apt.floor,
          ownerEmail: apt.ownerEmail,
          createdAt: new Date(),
          companyIds: [], // Will be set from building
        });
        
        console.log(`✓ Apartment ${apt.apartmentNumber} created with ID: ${apartmentRef.id}`);
        
        // Create meters
        if (apt.hotWaterMeterNumber) {
          const hotWaterRef = db.collection('meters').doc();
          await hotWaterRef.set({
            apartmentId: apartmentRef.id,
            type: 'water',
            name: 'Горячая вода',
            serialNumber: apt.hotWaterMeterNumber,
            createdAt: new Date(),
          });
          console.log(`  ✓ Hot water meter created: ${apt.hotWaterMeterNumber}`);
        }
        
        if (apt.coldWaterMeterNumber) {
          const coldWaterRef = db.collection('meters').doc();
          await coldWaterRef.set({
            apartmentId: apartmentRef.id,
            type: 'water',
            name: 'Холодная вода',
            serialNumber: apt.coldWaterMeterNumber,
            createdAt: new Date(),
          });
          console.log(`  ✓ Cold water meter created: ${apt.coldWaterMeterNumber}`);
        }
        
        // Add readings
        for (const reading of apt.readings) {
          if (reading.hotWater) {
            const readingRef = db.collection('meterReadings').doc();
            await readingRef.set({
              apartmentId: apartmentRef.id,
              meterId: apt.hotWaterMeterNumber,
              type: 'water',
              value: reading.hotWater,
              date: reading.date,
              submittedAt: new Date(),
            });
          }
          
          if (reading.coldWater) {
            const readingRef = db.collection('meterReadings').doc();
            await readingRef.set({
              apartmentId: apartmentRef.id,
              meterId: apt.coldWaterMeterNumber,
              type: 'water',
              value: reading.coldWater,
              date: reading.date,
              submittedAt: new Date(),
            });
          }
        }
        
        console.log(`  ✓ Reading data imported\n`);
      } catch (error) {
        console.error(`✗ Error importing apartment ${apt.apartmentNumber}:`, error);
      }
    }
    
    console.log('✓ Import completed successfully!');
  } catch (error) {
    console.error('Error during import:', error);
    process.exit(1);
  }
}

// Get building ID from command line
const buildingId = process.argv[2];
if (!buildingId) {
  console.error('Usage: npx ts-node scripts/importApartmentsFromExcel.ts <buildingId>');
  process.exit(1);
}

importApartmentsFromExcel(path.join(__dirname, '../data-import.xlsx'), buildingId);
