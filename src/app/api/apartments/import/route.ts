import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { db } from '@/firebase/config';
import { collection, doc, setDoc, updateDoc, arrayUnion, getDocs, query, where } from 'firebase/firestore';
import { requireRequestAuth, toAuthErrorResponse } from '@/shared/lib/serverAuth';
import { writeAuditEvent } from '@/shared/lib/auditLog';

type ParsedReading = {
  label: string;
  value: number;
  month: number;
  year: number;
};

const normalizeHeader = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const normalizeApartmentNumber = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

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
    // Excel serial date -> JS Date (Excel epoch)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + raw * 24 * 60 * 60 * 1000);
    if (!Number.isNaN(date.getTime())) {
      return { month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
    }
  }

  const text = String(raw).trim();

  // ISO/full date (e.g. 2026-02-25, 2026/02/25, 25.02.2026)
  const fullDate = text.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$|^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (fullDate) {
    const y = fullDate[1] ? Number(fullDate[1]) : Number(fullDate[6]);
    const m = fullDate[2] ? Number(fullDate[2]) : Number(fullDate[5]);
    if (m >= 1 && m <= 12) return { month: m, year: y };
  }

  const byText = parseReadingPeriod(text);
  if (byText) return byText;

  // dd.mm (without year) -> use current year
  const dayMonth = text.match(/^(\d{1,2})[.\-/](\d{1,2})$/);
  if (dayMonth) {
    const month = Number(dayMonth[2]);
    if (month >= 1 && month <= 12) {
      return { month, year: new Date().getFullYear() };
    }
  }

  return null;
};

const extractReadings = (row: Record<string, unknown>, prefix: 'Kartsais' | 'Aukstais'): ParsedReading[] => {
  const entries = Object.entries(row);
  const out: ParsedReading[] = [];
  const isDateHeader = (header: string): boolean => {
    const n = normalizeHeader(header);
    return n.startsWith('data') || n.includes('date');
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

    // 1) Try to parse month/year from the header itself
    let period = parseReadingPeriod(colName);
    let label = colName.trim();

    // 2) If header doesn't contain period, prefer nearest valid date LEFT, then RIGHT
    if (!period) {
      for (let j = i - 1; j >= 0; j--) {
        const [dateColName, dateValue] = entries[j];
        if (!isDateHeader(dateColName)) continue;
        const parsed = parsePeriodFromDateCell(dateValue);
        if (parsed) {
          period = parsed;
          label = String(dateValue ?? dateColName).trim() || colName.trim();
          break;
        }
      }

      if (!period) {
        for (let j = i + 1; j < entries.length; j++) {
          const [dateColName, dateValue] = entries[j];
          if (!isDateHeader(dateColName)) continue;
          const parsed = parsePeriodFromDateCell(dateValue);
          if (parsed) {
            period = parsed;
            label = String(dateValue ?? dateColName).trim() || colName.trim();
            break;
          }
        }
      }
    }

    if (!period) continue;

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
      id: doc(collection(db, 'apartments')).id,
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

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request, {
      allowedRoles: ['ManagementCompany', 'Accountant'],
    });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const buildingId = formData.get('buildingId') as string;
    const companyId = formData.get('companyId') as string;

    if (!file) {
      await writeAuditEvent({
        request,
        action: 'apartments.import',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        reason: 'file_missing',
      });

      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    if (!buildingId || !companyId) {
      await writeAuditEvent({
        request,
        action: 'apartments.import',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        reason: 'missing_building_or_company_id',
      });

      return NextResponse.json(
        { error: 'Building ID and Company ID are required' },
        { status: 400 }
      );
    }

    if (auth.companyId && auth.companyId !== companyId) {
      await writeAuditEvent({
        request,
        action: 'apartments.import',
        status: 'denied',
        actorUid: auth.uid,
        actorRole: auth.role,
        companyId,
        reason: 'tenant_mismatch',
      });

      return NextResponse.json({ error: 'Access denied for company' }, { status: 403 });
    }

    // Read Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];

    console.log(`Processing ${rows.length} apartments from Excel`);

    const existingApartmentsSnapshot = await getDocs(
      query(collection(db, 'apartments'), where('buildingId', '==', buildingId))
    );

    const existingApartmentNumbers = new Set(
      existingApartmentsSnapshot.docs
        .map((apartmentDoc) => apartmentDoc.data().number)
        .filter((number): number is string => typeof number === 'string' && number.trim() !== '')
        .map(normalizeApartmentNumber)
    );

    const importedApartmentNumbers = new Set<string>();

    const results = {
      imported: 0,
      errors: [] as string[],
      skippedDuplicates: [] as string[],
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
        const parseNum = (v: unknown): number | undefined => {
          const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
          return Number.isFinite(n) ? n : undefined;
        };
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
            id: doc(collection(db, 'apartments')).id,
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

        const apartmentNumber = getCellStringByHeader(row, [
          'DZ',
          'Dz',
          'Dz number',
          'Dz Number',
          'dz number',
          'Apartment number',
          'Apartment Number',
        ]);

        // Skip empty rows
        if (!apartmentNumber) {
          continue;
        }

        const normalizedApartmentNumber = normalizeApartmentNumber(apartmentNumber);

        if (existingApartmentNumbers.has(normalizedApartmentNumber) || importedApartmentNumbers.has(normalizedApartmentNumber)) {
          results.skippedDuplicates.push(`Квартира ${apartmentNumber} уже существует в выбранном доме`);
          console.warn(`Duplicate apartment skipped: ${apartmentNumber} for building ${buildingId}`);
          continue;
        }

        const hotWaterMeterNumber = row['Kartsais NR'] !== undefined && row['Kartsais NR'] !== null
          ? String(row['Kartsais NR']).trim()
          : '';
        const coldWaterMeterNumber = row['Aukstais NR'] !== undefined && row['Aukstais NR'] !== null
          ? String(row['Aukstais NR']).trim()
          : '';

        // Collect all basic data
        const apartmentData: Record<string, unknown> = {
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
              apartmentData.heatingArea = parseFloat(String(row[field]));
            } else if (field === 'Apsaimn') {
              apartmentData.managementArea = parseFloat(String(row[field]));
            } else if (field === 'Dekl iedz') {
              apartmentData.declaredResidents = parseInt(String(row[field]));
            }
          }
        });

        const apartmentRef = doc(collection(db, 'apartments'));
        console.log(`✓ Created apartment: ${apartmentNumber} (${apartmentRef.id})`);

        const waterReadings: Record<string, unknown> = {};
        const hotWaterCheckDueDate = findDueDateFromRow(row, 'hot');
        const coldWaterCheckDueDate = findDueDateFromRow(row, 'cold');

        // Create hot water meter if serial number exists
        if (hotWaterMeterNumber) {
          const hotWaterMeterRef = doc(collection(db, 'meters'));
          const hotWaterReadings = extractReadings(row, 'Kartsais');
          const hotGroup = buildWaterReadingGroup({
            apartmentId: apartmentRef.id,
            buildingId,
            meterId: hotWaterMeterRef.id,
            serialNumber: hotWaterMeterNumber,
            checkDueDate: hotWaterCheckDueDate,
            readings: hotWaterReadings,
          });

          // If no date-based history exists, fallback to direct columns
          if (hotGroup.history.length === 0) {
            const hotCurrent = parseNum(row['Kartsais_1']);
            const hotPrevious = parseNum(row['Kartsais']);
            if (hotCurrent !== undefined) {
              const fallbackReading = buildFallbackReading({
                apartmentId: apartmentRef.id,
                buildingId,
                meterId: hotWaterMeterRef.id,
                previousValue: hotPrevious ?? 0,
                currentValue: hotCurrent,
              });
              hotGroup.history = [fallbackReading];
            }
          }

          await setDoc(hotWaterMeterRef, {
            id: hotWaterMeterRef.id,
            apartmentId: apartmentRef.id,
            type: 'water',
            name: 'hwm',
            serialNumber: hotWaterMeterNumber,
            checkDueDate: hotWaterCheckDueDate || '',
            history: hotGroup.history,
            createdAt: new Date(),
          });

          console.log(`  ✓ Hot water meter: ${hotWaterMeterNumber}`);
          waterReadings.hotmeterwater = hotGroup;
        }

        // Create cold water meter if serial number exists
        if (coldWaterMeterNumber) {
          const coldWaterMeterRef = doc(collection(db, 'meters'));
          const coldWaterReadings = extractReadings(row, 'Aukstais');
          const coldGroup = buildWaterReadingGroup({
            apartmentId: apartmentRef.id,
            buildingId,
            meterId: coldWaterMeterRef.id,
            serialNumber: coldWaterMeterNumber,
            checkDueDate: coldWaterCheckDueDate,
            readings: coldWaterReadings,
          });

          // If no date-based history exists, fallback to direct columns
          if (coldGroup.history.length === 0) {
            const coldCurrent = parseNum(row['Aukstais_1']);
            const coldPrevious = parseNum(row['Aukstais']);
            if (coldCurrent !== undefined) {
              const fallbackReading = buildFallbackReading({
                apartmentId: apartmentRef.id,
                buildingId,
                meterId: coldWaterMeterRef.id,
                previousValue: coldPrevious ?? 0,
                currentValue: coldCurrent,
              });
              coldGroup.history = [fallbackReading];
            }
          }

          await setDoc(coldWaterMeterRef, {
            id: coldWaterMeterRef.id,
            apartmentId: apartmentRef.id,
            type: 'water',
            name: 'cwm',
            serialNumber: coldWaterMeterNumber,
            checkDueDate: coldWaterCheckDueDate || '',
            history: coldGroup.history,
            createdAt: new Date(),
          });

          console.log(`  ✓ Cold water meter: ${coldWaterMeterNumber}`);
          waterReadings.coldmeterwater = coldGroup;
        }

        await setDoc(apartmentRef, {
          ...apartmentData,
          waterReadings,
        });

        // Add apartment ID to the building's apartmentIds array
        await updateDoc(doc(db, 'buildings', buildingId), {
          apartmentIds: arrayUnion(apartmentRef.id),
        });

        importedApartmentNumbers.add(normalizedApartmentNumber);
        existingApartmentNumbers.add(normalizedApartmentNumber);

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

    await writeAuditEvent({
      request,
      action: 'apartments.import',
      status: 'success',
      actorUid: auth.uid,
      actorRole: auth.role,
      companyId,
      metadata: {
        buildingId,
        imported: results.imported,
        skippedDuplicates: results.skippedDuplicates.length,
        rowErrors: results.errors.length,
      },
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiAuthError') {
      await writeAuditEvent({
        request,
        action: 'apartments.import',
        status: 'denied',
        reason: error.message,
      });

      return toAuthErrorResponse(error);
    }

    console.error('Import error:', error);
    await writeAuditEvent({
      request,
      action: 'apartments.import',
      status: 'error',
      reason: error instanceof Error ? error.message : 'unknown_error',
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
