const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../data-import.xlsx');

console.log(`\n📊 Анализ структуры файла: ${filePath}\n`);

try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  console.log(`📄 Лист: "${sheetName}"`);
  console.log(`📋 Всего листов: ${workbook.SheetNames.length}\n`);
  
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  
  console.log(`📝 Количество строк: ${rows.length}`);
  console.log(`📌 Количество колонок: ${Object.keys(rows[0] || {}).length}`);
  
  // Show headers
  if (rows.length > 0) {
    console.log(`\n🏷️  Названия колонок:`);
    Object.keys(rows[0]).forEach((key, index) => {
      console.log(`   ${index + 1}. "${key}"`);
    });
  }
  
  // Show first 3 rows of data
  console.log(`\n📊 Первые 3 строки данных:\n`);
  rows.slice(0, 3).forEach((row, idx) => {
    console.log(`Строка ${idx + 1}:`);
    Object.entries(row).forEach(([key, value]) => {
      if (value) console.log(`   ${key}: ${value}`);
    });
    console.log('');
  });
  
  // Identify meter and reading columns
  const meterColumns = Object.keys(rows[0] || {}).filter(
    key => key.includes('Karstais') || key.includes('Aukstais') || key.toLowerCase().includes('nr')
  );
  
  console.log(`🌡️  Колонки со счётчиками/показаниями:`);
  meterColumns.forEach(col => {
    console.log(`   - "${col}"`);
  });
  
} catch (error) {
  console.error('❌ Ошибка чтения файла:', error.message);
}
