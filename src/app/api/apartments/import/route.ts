import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { db } from '@/firebase/config';
import { collection, addDoc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const buildingId = formData.get('buildingId') as string;
    const companyId = formData.get('companyId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    if (!buildingId || !companyId) {
      return NextResponse.json(
        { error: 'Building ID and Company ID are required' },
        { status: 400 }
      );
    }

    // Read Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, any>[];

    console.log(`Processing ${rows.length} apartments from Excel`);

    const results = {
      imported: 0,
      errors: [] as string[],
      createdApartments: [] as string[],
    };

    // Basic fields that should be saved
    const basicFields = [
      'Kadastra numurs',
      'Adrese',
      'Domājamā daļa',
      'Daļa (kopīpašums)',
      'Īpašnieks',
      'E pasts Reķiniem',
      'DZ',
      'Stavs',
      'DZ t',
      'Apkure',
      'Apsaimn',
      'Dekl iedz',
      'Kartsais NR',
      'Aukstais NR',
    ];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];

        // Skip empty rows
        if (!row['DZ'] && !row['Domājamā daļa']) {
          continue;
        }

        const apartmentNumber = (row['DZ'] || row['Domājamā daļa']).toString();

        // Collect all basic data
        const apartmentData: Record<string, any> = {
          buildingId,
          number: apartmentNumber,
          companyIds: [companyId],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Add all basic fields
        basicFields.forEach(field => {
          if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
            // Map user-friendly field names to internal names
            if (field === 'Kadastra numurs') {
              apartmentData.cadastralNumber = row[field].toString();
            } else if (field === 'Adrese') {
              apartmentData.address = row[field].toString();
            } else if (field === 'Stavs') {
              apartmentData.floor = row[field].toString();
            } else if (field === 'E pasts Reķiniem') {
              apartmentData.ownerEmail = row[field].toString();
            } else if (field === 'Īpašnieks') {
              apartmentData.owner = row[field].toString();
            } else if (field === 'Domājamā daļa') {
              apartmentData.cadastralPart = row[field].toString();
            } else if (field === 'Daļa (kopīpašums)') {
              apartmentData.commonPropertyShare = row[field].toString();
            } else if (field === 'DZ t') {
              apartmentData.apartmentType = row[field].toString();
            } else if (field === 'Apkure') {
              apartmentData.heatingArea = parseFloat(row[field]);
            } else if (field === 'Apsaimn') {
              apartmentData.managementArea = parseFloat(row[field]);
            } else if (field === 'Dekl iedz') {
              apartmentData.declaredResidents = parseInt(row[field]);
            } else if (field === 'Kartsais NR') {
              apartmentData.hotWaterMeterNumber = row[field].toString();
            } else if (field === 'Aukstais NR') {
              apartmentData.coldWaterMeterNumber = row[field].toString();
            }
          }
        });

        // Create apartment document
        const apartmentRef = await addDoc(collection(db, 'apartments'), apartmentData);
        console.log(`✓ Created apartment: ${apartmentNumber} (${apartmentRef.id})`);

        // Create hot water meter if serial number exists
        if (apartmentData.hotWaterMeterNumber) {
          const hotWaterMeterRef = await addDoc(collection(db, 'meters'), {
            apartmentId: apartmentRef.id,
            type: 'water',
            name: 'Горячая вода',
            serialNumber: apartmentData.hotWaterMeterNumber,
            createdAt: new Date(),
          });

          console.log(`  ✓ Hot water meter: ${apartmentData.hotWaterMeterNumber}`);

          // Add hot water readings from all columns that contain "Kartsais" but not "NR"
          for (const [colName, value] of Object.entries(row)) {
            if (typeof colName === 'string' && (colName.includes('Kartsais') && !colName.includes('NR')) && value) {
              const numValue = parseFloat(String(value));
              if (!isNaN(numValue)) {
                await addDoc(collection(db, 'meterReadings'), {
                  apartmentId: apartmentRef.id,
                  meterId: hotWaterMeterRef.id,
                  type: 'water',
                  meterType: 'Горячая вода',
                  value: numValue,
                  dateLabel: colName.trim(), // Save original column name as date label
                  submittedAt: new Date(),
                  buildingId,
                  companyId,
                });
              }
            }
          }
        }

        // Create cold water meter if serial number exists
        if (apartmentData.coldWaterMeterNumber) {
          const coldWaterMeterRef = await addDoc(collection(db, 'meters'), {
            apartmentId: apartmentRef.id,
            type: 'water',
            name: 'Холодная вода',
            serialNumber: apartmentData.coldWaterMeterNumber,
            createdAt: new Date(),
          });

          console.log(`  ✓ Cold water meter: ${apartmentData.coldWaterMeterNumber}`);

          // Add cold water readings from all columns that contain "Aukstais" but not "NR"
          for (const [colName, value] of Object.entries(row)) {
            if (typeof colName === 'string' && (colName.includes('Aukstais') && !colName.includes('NR')) && value) {
              const numValue = parseFloat(String(value));
              if (!isNaN(numValue)) {
                await addDoc(collection(db, 'meterReadings'), {
                  apartmentId: apartmentRef.id,
                  meterId: coldWaterMeterRef.id,
                  type: 'water',
                  meterType: 'Холодная вода',
                  value: numValue,
                  dateLabel: colName.trim(), // Save original column name as date label
                  submittedAt: new Date(),
                  buildingId,
                  companyId,
                });
              }
            }
          }
        }

        results.imported++;
        results.createdApartments.push(
          `${apartmentNumber} (${apartmentData.address || 'N/A'}) - Собственник: ${apartmentData.owner || 'N/A'}`
        );
        console.log(`✓ Fully processed apartment ${apartmentNumber}\n`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.errors.push(`Row ${i + 1}: ${errorMsg}`);
        console.error(`✗ Error importing row ${i + 1}:`, errorMsg);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
