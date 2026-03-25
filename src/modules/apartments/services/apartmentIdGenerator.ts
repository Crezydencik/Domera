// apartmentIdGenerator.ts
// Генерация безопасного именного ID для квартиры

export function generateApartmentId(companyAddress: string, apartmentNumber: string, houseNumber?: string): string {
  // Берём первые 5 букв адреса компании, приводим к нижнему регистру и убираем пробелы
  const companyPart = companyAddress.replace(/\s/g, '').substring(0, 5).toLowerCase();
  // Генерируем случайные строки
  const random1 = Math.random().toString(36).substring(2, 6);
  const random2 = Math.random().toString(36).substring(2, 6);
  // Собираем ID
  let id = `${companyPart}_${random1}_${apartmentNumber}_${random2}`;
  if (houseNumber) {
    id += `_${houseNumber}`;
  }
  return id;
}
