import fs from 'fs';
import path from 'path';

interface CompanyInfo {
  year: number;
  month: number;
  regNr: string;
  name: string;
}

interface WaterReading {
  DzNumurs: string;
  DzForeignKey: string;
  SkdNrM: string;
  BeigMNor: number;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;');
}

function exportWaterReadingsXml(
  company: CompanyInfo,
  readings: WaterReading[],
  outputPath: string
) {
  const xmlHeader = '<?xml version="1.0" encoding="utf-8"?>\n';
  const rootOpen = '<UdSkRd xmlns:xsd="http://www.w3.org/2001/XMLSchema"\n        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n';
  const rootClose = '</UdSkRd>\n';

  // Общая часть
  let xml = xmlHeader + rootOpen;
  xml += `  <Gads>${company.year}</Gads>\n`;
  xml += `  <Menesis>${company.month}</Menesis>\n`;
  xml += `  <RegNr>${escapeXml(company.regNr)}</RegNr>\n`;
  xml += `  <Nosaukums>${escapeXml(company.name)}</Nosaukums>\n`;

  // Таблица
  xml += '  <Tab>\n';
  for (const r of readings) {
    // Пропускать пустые поля
    if (!r.DzNumurs || !r.DzForeignKey || !r.SkdNrM || r.BeigMNor === undefined || r.BeigMNor === null) continue;
    xml += '    <R>\n';
    xml += `      <DzNumurs>${escapeXml(r.DzNumurs)}</DzNumurs>\n`;
    xml += `      <DzForeignKey>${escapeXml(r.DzForeignKey)}</DzForeignKey>\n`;
    xml += `      <SkdNrM>${escapeXml(r.SkdNrM)}</SkdNrM>\n`;
    // Число с точкой, 3 знака после запятой
    xml += `      <BeigMNor>${r.BeigMNor.toFixed(3)}</BeigMNor>\n`;
    xml += '    </R>\n';
  }
  xml += '  </Tab>\n';
  xml += rootClose;

  fs.writeFileSync(outputPath, xml, { encoding: 'utf-8' });
  console.log(`XML экспортирован в ${outputPath}`);
}

// Пример использования
if (require.main === module) {
  const company: CompanyInfo = {
    year: 2026,
    month: 4,
    regNr: '43901000731',
    name: '"Auzas" SIA',
  };
  const readings: WaterReading[] = [
    { DzNumurs: '1', DzForeignKey: '4301', SkdNrM: '4746009', BeigMNor: 971.016 },
    { DzNumurs: '2', DzForeignKey: '4302', SkdNrM: '4746010', BeigMNor: 524.357 },
  ];
  const outPath = path.join(__dirname, '../water_readings_export.xml');
  exportWaterReadingsXml(company, readings, outPath);
}

export { exportWaterReadingsXml };
export type { CompanyInfo, WaterReading };