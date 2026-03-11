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
  const tenant0 = apartment.tenants?.[0] as unknown;
  const residentEmail = (typeof tenant0 === 'object' && tenant0 !== null && 'email' in tenant0) 
    ? (tenant0 as { email?: string }).email 
    : undefined;
  const residentName = (typeof tenant0 === 'object' && tenant0 !== null && 'name' in tenant0) 
    ? (tenant0 as { name?: string }).name 
    : undefined;
  const residentPhone = (typeof tenant0 === 'object' && tenant0 !== null && 'phone' in tenant0) 
    ? (tenant0 as { phone?: string }).phone 
    : undefined;
  const isOccupied = Boolean(apartment.tenants && apartment.tenants.length > 0);

  return (
    <div className="rounded-xl border-2 border-gray-100 bg-white overflow-hidden hover:border-blue-300 hover:shadow-lg transition">
      {/* Header с номером и статусом */}
      <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
      
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

        {/* Информация о жильце */}
        {isOccupied ? (
          <div className="mb-4 p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
            <p className="text-xs text-gray-600 font-semibold mb-2">Жилец</p>
            {residentName && (
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                </svg>
                <span className="font-semibold text-gray-900">{residentName}</span>
              </div>
            )}
            {residentEmail && (
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-700 break-all font-medium">{residentEmail}</span>
              </div>
            )}
            {residentPhone && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 00.948.684l1.498 7.487a1 1 0 00.502.756l1.813 1.206V9a2 2 0 012-2h3.26a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
                </svg>
                <span className="text-sm text-gray-700 font-medium">{residentPhone}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-4 p-4 rounded-lg bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-dashed border-gray-300">
            <p className="text-sm text-gray-500 text-center font-medium">Квартира свободна</p>
            <p className="text-xs text-gray-400 text-center mt-1">Ожидает нового жильца</p>
          </div>
        )}

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
