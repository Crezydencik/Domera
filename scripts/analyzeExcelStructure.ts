import * as XLSX from 'xlsx';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '../data-import.xlsx');

interface ExcelRow {
  [key: string]: unknown;
}

interface FieldInfo {
  name: string;
  type: 'basic' | 'date' | 'hotWater' | 'coldWater';
  dateKey?: string;
}

console.log(`\n📊 Анализ структуры файла: ${filePath}\n`);

try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  
  if (!sheetName) {
    console.error('❌ Листы не найдены в файле');
    process.exit(1);
  }

  console.log(`📄 Лист: "${sheetName}"`);
  console.log(`📋 Всего листов: ${workbook.SheetNames.length}\n`);
  
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' });
  
  console.log(`📝 Количество строк: ${rows.length}`);
  const headers = Object.keys(rows[0] || {});
  console.log(`📌 Количество колонок: ${headers.length}`);
  
  // Categorize columns
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
  
  const readingFields = headers.filter(h => !basicFields.includes(h) && h && !h.startsWith('__EMPTY'));
  
  // Identify date patterns
  const hotWaterReadings = readingFields.filter(h => h.includes('Kartsais'));
  const coldWaterReadings = readingFields.filter(h => h.includes('Aukstais'));
  
  console.log(`\n🏷️  БАЗОВЫЕ ПОЛЯ (${basicFields.length}):`);
  basicFields.forEach((field, index) => {
    const hasValue = headers.includes(field);
    const status = hasValue ? '✓' : '✗';
    console.log(`   ${status} ${index + 1}. "${field}"`);
  });
  
  console.log(`\n🌡️  ПОКАЗАНИЯ ГОРЯЧЕЙ ВОДЫ (${hotWaterReadings.length}):`);
  hotWaterReadings.forEach((field) => {
    console.log(`   - "${field}"`);
  });
  
  console.log(`\n❄️  ПОКАЗАНИЯ ХОЛОДНОЙ ВОДЫ (${coldWaterReadings.length}):`);
  coldWaterReadings.forEach((field) => {
    console.log(`   - "${field}"`);
  });
  
  // Show first 2 rows with all data
  console.log(`\n📊 Пример данных первой квартиры:\n`);
  if (rows.length > 0) {
    const firstRow = rows[0];
    console.log(`Адрес: ${firstRow['Adrese']}`);
    console.log(`Номер: ${firstRow['DZ']}`);
    console.log(`Этаж: ${firstRow['Stavs']}`);
    console.log(`Email: ${firstRow['E pasts Reķiniem']}`);
    console.log(`Собственник: ${firstRow['Īpašnieks']}`);
    console.log(`\nСчётчики:`);
    console.log(`  Горячая вода: ${firstRow['Kartsais NR']}`);
    console.log(`  Холодная вода: ${firstRow['Aukstais NR']}`);
    console.log(`\nПоказания горячей воды:`);
    hotWaterReadings.forEach(field => {
      const value = firstRow[field];
      if (value) console.log(`  ${field}: ${value}`);
    });
    console.log(`\nПоказания холодной воды:`);
    coldWaterReadings.forEach(field => {
      const value = firstRow[field];
      if (value) console.log(`  ${field}: ${value}`);
    });
  }
  
  console.log(`\n✅ Анализ завершен`);
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('❌ Ошибка чтения файла:', errorMessage);
  process.exit(1);
}
