'use client';

import { Apartment } from '@/shared/types';

interface ApartmentCardProps {
  apartment: Apartment;
  onDetails: (apartment: Apartment) => void;
  onUnassign: (apartmentId: string) => void;
  onDelete: (apartmentId: string) => void;
}

export function ApartmentCard({
  apartment,
  onDetails,
  onUnassign,
  onDelete,
}: ApartmentCardProps) {
  const toNumber = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };

  const tenant0 = apartment.tenants?.[0] as unknown;
  const residentEmailFromTenant = (typeof tenant0 === 'object' && tenant0 !== null && 'email' in tenant0)
    ? (tenant0 as { email?: string }).email
    : undefined;
  const residentNameFromTenant = (typeof tenant0 === 'object' && tenant0 !== null && 'name' in tenant0)
    ? (tenant0 as { name?: string }).name
    : undefined;

  const residentEmail = residentEmailFromTenant || apartment.ownerEmail;
  const residentName = residentNameFromTenant || apartment.owner;
  const residentPhone = (typeof tenant0 === 'object' && tenant0 !== null && 'phone' in tenant0) 
    ? (tenant0 as { phone?: string }).phone 
    : undefined;
  const isOccupied = Boolean(apartment.tenants && apartment.tenants.length > 0);
  const apartmentArea =
    toNumber(apartment.area) ??
    toNumber(apartment.managementArea) ??
    toNumber(apartment.heatingArea);
  const declaredResidents = toNumber(apartment.declaredResidents);

  return (
    <div className="rounded-xl border-2 border-gray-100 bg-white overflow-hidden hover:border-blue-300 hover:shadow-lg transition">
      {/* Header с номером и статусом */}
      <div className="h-1 bg-linear-to-r from-blue-500 to-cyan-500"></div>
      
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-3xl font-bold text-gray-900">#{apartment.number}</div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mt-2 ${
              isOccupied 
                ? 'bg-green-100 text-green-700' 
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${isOccupied ? 'bg-green-600' : 'bg-yellow-600'}`}></span>
              {isOccupied ? 'Занята' : 'Свободна'}
            </div>
          </div>
          
          {/* Кнопки в верхнем правом углу */}
          <div className="flex gap-1.5">
            <button 
              onClick={() => onDetails(apartment)} 
              className="p-2 rounded-lg bg-white border-2 border-blue-200 text-blue-600 hover:bg-blue-50 transition flex items-center justify-center"
              title="Полная информация"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {isOccupied && (
              <button 
                onClick={() => onUnassign(apartment.id)} 
                className="p-2 rounded-lg bg-white border-2 border-amber-200 text-amber-600 hover:bg-amber-50 transition flex items-center justify-center"
                title="Удалить жильца"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12a1 1 0 100-2 1 1 0 000 2z" />
                </svg>
              </button>
            )}
            <button 
              onClick={() => onDelete(apartment.id)} 
              className="p-2 rounded-lg bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 transition flex items-center justify-center"
              title="Удалить квартиру"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Excel-like row */}
        <div className="mb-4 rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Строка</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Статус</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Имя жильца</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Email</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Площадь</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Декларированные</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Этаж</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Адрес</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white hover:bg-blue-50/30">
                <td className="border border-gray-200 px-3 py-2 font-medium text-gray-900">{apartment.number || '—'}</td>
                <td className="border border-gray-200 px-3 py-2 text-gray-700">{isOccupied ? 'Занята' : 'Свободна'}</td>
                <td className="border border-gray-200 px-3 py-2 text-gray-900">{residentName || '—'}</td>
                <td className="border border-gray-200 px-3 py-2 text-gray-900">{residentEmail || '—'}</td>
                <td className="border border-gray-200 px-3 py-2 text-gray-900">{typeof apartmentArea === 'number' ? `${apartmentArea} м²` : '—'}</td>
                <td className="border border-gray-200 px-3 py-2 text-gray-900">{typeof declaredResidents === 'number' ? declaredResidents : '—'}</td>
                <td className="border border-gray-200 px-3 py-2 text-gray-900">{apartment.floor || '—'}</td>
                <td className="border border-gray-200 px-3 py-2 text-gray-900">{apartment.address || '—'}</td>
              </tr>
            </tbody>
          </table>
          {!isOccupied && (
            <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-200 bg-gray-50">
              Квартира свободна — ожидает нового жильца
            </div>
          )}
          {residentPhone && (
            <div className="px-3 py-2 text-xs text-gray-600 border-t border-gray-200 bg-gray-50">
              Телефон жильца: {residentPhone}
            </div>
          )}
        </div>

        {/* Дополнительная информация */}
        {apartment.ResidencyAgreementLinks && (
          <div className="mb-3 text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-100">
            📄 Договор загружен
          </div>
        )}
      </div>
    </div>
  );
}
