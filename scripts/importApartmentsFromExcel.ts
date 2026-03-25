// Импортируем генератор именного ID
import { generateApartmentId } from '../src/modules/apartments/services/apartmentIdGenerator';
import * as XLSX from 'xlsx';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
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
  houseNumber?: string; // Majas numurs
  address?: string;
  apartmentNumber: string;
  floor?: string;
  ownerEmail?: string; 
  hotWaterMeterNumber?: string;
  coldWaterMeterNumber?: string;
  hotWaterCheckDueDate?: string;
  coldWaterCheckDueDate?: string;
  hotWaterCurrentValue?: number;
  hotWaterPreviousValue?: number;
  coldWaterCurrentValue?: number;
  coldWaterPreviousValue?: number;
  hotWaterReadings: ParsedReading[];
  coldWaterReadings: ParsedReading[];
}

type ParsedReading = {
  label: string;
  value: number;
  month: number;
  year: number;
};

const parseReadingPeriod = (label: string): { month: number; year: number } | null => {
  const normalized = label.trim();

  const monthYearMatch = normalized.match(/(\d{1,2})[.\-/](\d{4})/);
  if (monthYearMatch) {
    const month = Number(monthYearMatch[1]);
    const year = Number(monthYearMatch[2]);
    if (month >= 1 && month <= 12) {
      return { month, year };
    }
  }

  const yearMonthMatch = normalized.match(/(\d{4})[.\-/](\d{1,2})/);
  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1]);
    const month = Number(yearMonthMatch[2]);
    if (month >= 1 && month <= 12) {
      return { month, year };
    }
  }

  return null;
};

const parsePeriodFromDateCell = (raw: unknown): { month: number; year: number } | null => {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Guardrail: treat numeric value as Excel date only for realistic serial ranges.
    // Prevent false positives on meter readings like 207.898, 563.000, etc.
    if (raw < 20000 || raw > 70000) {
      return null;
    }
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + raw * 24 * 60 * 60 * 1000);
    if (!Number.isNaN(date.getTime())) {
      return { month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
    }
  }

  const text = String(raw).trim();

  // yyyy-mm-dd | yyyy/mm/dd | dd.mm.yyyy
  const fullDate = text.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$|^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (fullDate) {
    const y = fullDate[1] ? Number(fullDate[1]) : Number(fullDate[6]);
    const m = fullDate[2] ? Number(fullDate[2]) : Number(fullDate[5]);
    if (m >= 1 && m <= 12) return { month: m, year: y };
  }

  const byText = parseReadingPeriod(text);
  if (byText) return byText;

  // dd.mm (without year) -> current year
  const dayMonth = text.match(/^(\d{1,2})[.\-/](\d{1,2})$/);
  if (dayMonth) {
    const month = Number(dayMonth[2]);
    if (month >= 1 && month <= 12) {
      return { month, year: new Date().getFullYear() };
    }
  }

  return null;
};

const normalizeHeader = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const getCellStringByHeader = (row: Record<string, unknown>, headerCandidates: string[]): string => {
  for (const header of headerCandidates) {
    const raw = row[header];
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      return String(raw).trim();
    }
  }

  const normalizedCandidates = new Set(headerCandidates.map(normalizeHeader));
  for (const key of Object.keys(row)) {
    if (normalizedCandidates.has(normalizeHeader(key))) {
      const raw = row[key];
      if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
        return String(raw).trim();
      }
    }
  }

  return '';
};

const findDueDateFromRow = (row: Record<string, unknown>, type: 'hot' | 'cold'): string => {
  const keys = Object.keys(row);
  const meterToken = type === 'hot' ? 'kartsais' : 'aukstais';

  const dueDateKey = keys.find((key) => {
    const k = normalizeHeader(key);
    return (
      k.includes(meterToken) &&
      (
        (k.includes('derig') && k.includes('lidz')) ||
        k.includes('check due') ||
        k.includes('checkduedate') ||
        k.includes('expiry') ||
        k.includes('valid until')
      )
    );
  });

  if (!dueDateKey) return '';
  const raw = row[dueDateKey];
  return raw === undefined || raw === null ? '' : String(raw).trim();
};

const extractReadings = (row: Record<string, unknown>, prefix: 'Kartsais' | 'Aukstais'): ParsedReading[] => {
  const entries = Object.entries(row);
  const out: ParsedReading[] = [];
  const isDateHeader = (header: string): boolean => {
    const n = normalizeHeader(header);
    return n.startsWith('data') || n.includes('date');
  };
  const isLikelyDateColumn = (header: string): boolean => {
    const n = normalizeHeader(header);
    // XLSX utils often generate __EMPTY / __EMPTY_1 headers for unlabeled columns.
    return isDateHeader(header) || n === '' || n.startsWith('__empty');
  };

  const findNearestPeriod = (index: number): { period: { month: number; year: number }; label: string } | null => {
    let best: { distance: number; period: { month: number; year: number }; label: string } | null = null;

    for (let j = 0; j < entries.length; j++) {
      if (j === index) continue;
      const [dateColName, dateValue] = entries[j];
      if (!isLikelyDateColumn(dateColName)) continue;

      const parsed = parsePeriodFromDateCell(dateValue);
      if (!parsed) continue;

      const distance = Math.abs(j - index);
      const candidateLabel = String(dateValue ?? dateColName).trim() || dateColName;

      if (
        !best ||
        distance < best.distance ||
        (distance === best.distance && j > index)
      ) {
        best = { distance, period: parsed, label: candidateLabel };
      }
    }

    return best ? { period: best.period, label: best.label } : null;
  };

  for (let i = 0; i < entries.length; i++) {
    const [colName, value] = entries[i];
    if (
      typeof colName !== 'string' ||
      !colName.includes(prefix) ||
      colName.includes('NR') ||
      value === undefined ||
      value === null ||
      String(value).trim() === ''
    ) {
      continue;
    }

    const numValue = Number.parseFloat(String(value).replace(',', '.'));
    if (!Number.isFinite(numValue)) continue;

    let period = parseReadingPeriod(colName);
    let label = colName.trim();

    if (!period) {
      const nearest = findNearestPeriod(i);
      if (nearest) {
        period = nearest.period;
        label = nearest.label || colName.trim();
      }
    }

    if (!period) {
      console.warn(`[extractReadings] Пропущено показание "${colName}": не найдена дата (месяц/год)`);
      continue;
    }

    out.push({
      label,
      value: numValue,
      month: period.month,
      year: period.year,
    });
  }

  return out.sort((a, b) => a.year - b.year || a.month - b.month);
};

const buildSubmittedAtFromPeriod = (year: number, month: number): Date => {
  const now = new Date();
  const currentDay = now.getDate();
  const daysInTargetMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(currentDay, daysInTargetMonth);
  // Use midday to avoid timezone edge-case shifts around midnight.
  return new Date(year, month - 1, safeDay, 12, 0, 0, 0);
};

const buildWaterReadingGroup = ({
  apartmentId,
  buildingId,
  meterId,
  serialNumber,
  checkDueDate,
  readings,
}: {
  apartmentId: string;
  buildingId: string;
  meterId: string;
  serialNumber: string;
  checkDueDate?: string;
  readings: ParsedReading[];
}) => {
  const history = readings.map((reading, index) => {
    const previousValue = index > 0 ? readings[index - 1].value : 0;
    const consumption = index > 0 ? Math.max(0, reading.value - previousValue) : 0;
    const submittedAt = buildSubmittedAtFromPeriod(reading.year, reading.month);

    return {
      id: db.collection('apartments').doc().id,
      apartmentId,
      buildingId,
      meterId,
      previousValue,
      currentValue: reading.value,
      consumption,
      month: reading.month,
      year: reading.year,
      submittedAt,
    };
  });

  return {
    meterId,
    serialNumber,
    checkDueDate: checkDueDate || '',
    history,
  };
};

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
    if (rows.length > 0) {
      console.log('First row:', rows[0]);
      console.log('Row keys:', Object.keys(rows[0]));
    }
    
    // Parse data
    const apartments: ApartmentImportData[] = [];
    
    rows.forEach((row: Record<string, unknown>, index: number) => {
      try {
      const apartmentNumber = getCellStringByHeader(row, [
        'DZ',
        'Dz',
        'Dz number',
        'Dz Number',
        'dz number',
        'Apartment number',
        'Apartment Number',
      ]);

      if (!apartmentNumber) {
        console.log(`Skipping empty row ${index + 2}`);
        return; // Skip empty rows
      }
      
      const parseNum = (v: unknown): number | undefined => {
        const n = parseFloat(String(v ?? ''));
        return Number.isFinite(n) ? n : undefined;
      };

      const apartmentData: ApartmentImportData = {
        cadastralNumber: row['Kadastra numurs']?.toString() || '',
        houseNumber: row['Majas numurs']?.toString() || '',
        address: row['Adrese']?.toString() || '',
        apartmentNumber,
        floor: row['Stavs']?.toString() || '',
        ownerEmail: row['E pasts Reķiniem']?.toString() || '',
        hotWaterMeterNumber: row['Kartsais NR']?.toString() || '',
        coldWaterMeterNumber: row['Aukstais NR']?.toString() || '',
        hotWaterCheckDueDate: findDueDateFromRow(row as Record<string, unknown>, 'hot'),
        coldWaterCheckDueDate: findDueDateFromRow(row as Record<string, unknown>, 'cold'),
        // Direct (non-dated) column readings: prev value in base col, current in _1 col
        hotWaterPreviousValue: parseNum(row['Kartsais']),
        hotWaterCurrentValue: parseNum(row['Kartsais_1']),
        coldWaterPreviousValue: parseNum(row['Aukstais']),
        coldWaterCurrentValue: parseNum(row['Aukstais_1']),
        hotWaterReadings: extractReadings(row, 'Kartsais'),
        coldWaterReadings: extractReadings(row, 'Aukstais'),
      };
      
      apartments.push(apartmentData);
      } catch (rowError) {
        console.error(`✗ Ошибка в строке ${index + 2}:`, rowError);
      }
    });
    
    console.log(`\nParsed ${apartments.length} apartments`);
    
    // Import to Firestore
    for (const apt of apartments) {
      try {

        // Генерируем именной ID для квартиры
        const customId = generateApartmentId(apt.address, apt.apartmentNumber, apt.houseNumber);
        console.log('[IMPORT] Generated apartment ID:', customId, '| address:', apt.address, '| number:', apt.apartmentNumber, '| houseNumber:', apt.houseNumber);
        const apartmentRef = db.collection('apartments').doc(customId);
        
        const hotWaterReadings = apt.hotWaterReadings;

        const coldWaterReadings = apt.coldWaterReadings;

        const buildFallbackReading = (params: {
          apartmentId: string;
          buildingId: string;
          meterId: string;
          previousValue: number;
          currentValue: number;
        }) => {
          const now = new Date();
          const month = now.getMonth() + 1;
          const year = now.getFullYear();
          const consumption = Math.max(0, params.currentValue - params.previousValue);
          return {
            id: db.collection('apartments').doc().id,
            apartmentId: params.apartmentId,
            buildingId: params.buildingId,
            meterId: params.meterId,
            previousValue: params.previousValue,
            currentValue: params.currentValue,
            consumption,
            month,
            year,
            submittedAt: buildSubmittedAtFromPeriod(year, month),
          };
        };

        // Build waterReadings only inside apartment doc (no separate meters collection)
        const waterReadingsData: Record<string, unknown> = {};

        if (apt.hotWaterMeterNumber) {
          const hotWaterMeterId = db.collection('apartments').doc().id;
          const hotGroup = buildWaterReadingGroup({
            apartmentId: apartmentRef.id,
            buildingId,
            meterId: hotWaterMeterId,
            serialNumber: apt.hotWaterMeterNumber,
            checkDueDate: apt.hotWaterCheckDueDate,
            readings: hotWaterReadings,
          });
          console.log(`  ✓ Hot water data prepared: ${apt.hotWaterMeterNumber}`);
          // If no dated-column history, use direct column values as one history entry
          if (hotGroup.history.length === 0 && apt.hotWaterCurrentValue !== undefined) {
            hotGroup.history = [buildFallbackReading({
              apartmentId: apartmentRef.id,
              buildingId,
              meterId: hotWaterMeterId,
              previousValue: apt.hotWaterPreviousValue ?? 0,
              currentValue: apt.hotWaterCurrentValue,
            })];
          }
          waterReadingsData['hotmeterwater'] = hotGroup;
        }

        if (apt.coldWaterMeterNumber) {
          const coldWaterMeterId = db.collection('apartments').doc().id;
          const coldGroup = buildWaterReadingGroup({
            apartmentId: apartmentRef.id,
            buildingId,
            meterId: coldWaterMeterId,
            serialNumber: apt.coldWaterMeterNumber,
            checkDueDate: apt.coldWaterCheckDueDate,
            readings: coldWaterReadings,
          });
          console.log(`  ✓ Cold water data prepared: ${apt.coldWaterMeterNumber}`);
          // If no dated-column history, use direct column values as one history entry
          if (coldGroup.history.length === 0 && apt.coldWaterCurrentValue !== undefined) {
            coldGroup.history = [buildFallbackReading({
              apartmentId: apartmentRef.id,
              buildingId,
              meterId: coldWaterMeterId,
              previousValue: apt.coldWaterPreviousValue ?? 0,
              currentValue: apt.coldWaterCurrentValue,
            })];
          }
          waterReadingsData['coldmeterwater'] = coldGroup;
        }

        // Write apartment in one shot with fully built waterReadings
        await apartmentRef.set({
          buildingId,
          number: apt.apartmentNumber,
          cadastralNumber: apt.cadastralNumber,
          houseNumber: apt.houseNumber,
          address: apt.address,
          floor: apt.floor,
          ownerEmail: apt.ownerEmail,
          createdAt: new Date(),
          companyIds: [],
          waterReadings: waterReadingsData,
        });
        
        // Add apartment ID to the building's apartmentIds array
        await db.collection('buildings').doc(buildingId).update({
          apartmentIds: FieldValue.arrayUnion(apartmentRef.id),
        });

        console.log(`✓ Apartment ${apt.apartmentNumber} created with ID: ${apartmentRef.id}`);
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
