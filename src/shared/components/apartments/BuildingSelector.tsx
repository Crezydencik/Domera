"use client";

import React from 'react';
import type { Building } from '@/shared/types';

interface BuildingSelectorProps {
  buildings: Building[];
  selectedBuildingId: string | null;
  onBuildingSelect: (buildingId: string) => void;
  onAddResident: () => void;
  onAddApartment: () => void;
  onImport: () => void;
  showGlobalInvite: boolean;
  isAddingApartment: boolean;
}

export const BuildingSelector: React.FC<BuildingSelectorProps> = ({
  buildings,
  selectedBuildingId,
  onBuildingSelect,
  onAddResident,
  onAddApartment,
  onImport,
  showGlobalInvite,
  isAddingApartment,
}) => {
  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);

  // Debug
  console.log('selectedBuildingId:', selectedBuildingId);
  console.log('selectedBuilding:', selectedBuilding);
  console.log('address:', selectedBuilding?.address);

  return (
    <div className="mb-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition">
      <div className="flex flex-col gap-6">
        {/* Top: Building Selector */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left: Selector */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Выберите дом</label>
            <select
              value={selectedBuildingId || ''}
              onChange={(e) => onBuildingSelect(e.target.value || '')}
              className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-gray-50 to-white border-2 border-gray-200 text-gray-900 font-semibold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition cursor-pointer"
            >
              <option value="">Все дома</option>
              {buildings.length === 0 ? (
                <option disabled>Нет доступных домов</option>
              ) : (
                buildings.map((building) => (
                  <option key={building.id} value={building.id || ''}>
                    {building.name}
                  </option>
                ))
              )}
            </select>

            {/* Building Info */}
            {selectedBuilding && (
              <div className="mt-4 p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 space-y-2">
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm text-gray-800 font-medium">{selectedBuilding.address|| 'Адрес не указан'}</span>
                </div>
                {(selectedBuilding as any).managedBy && (
                  <div className="flex items-start gap-3">
                    <svg className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-gray-800 font-medium">
                      Управляет: {typeof (selectedBuilding as any).managedBy === 'object' 
                        ? (selectedBuilding as any).managedBy?.companyName || 'Неизвестно'
                        : (selectedBuilding as any).managedBy}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Action Buttons - only for larger screens */}
          <div className="hidden lg:flex flex-col gap-3 w-52">
            <button
              type="button"
              onClick={onAddResident}
              className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition duration-200 ${
                showGlobalInvite
                  ? 'bg-emerald-600 text-white hover:shadow-lg'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:shadow-lg hover:from-emerald-600 hover:to-emerald-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              {showGlobalInvite ? 'Отмена' : 'Добавить жилца'}
            </button>
            
            <button
              type="button"
              onClick={onAddApartment}
              className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition duration-200 ${
                isAddingApartment
                  ? 'bg-blue-600 text-white hover:shadow-lg'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg hover:from-blue-600 hover:to-blue-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {isAddingApartment ? 'Отмена' : 'Добавить квартиру'}
            </button>

            <button
              type="button"
              onClick={onImport}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg hover:from-purple-600 hover:to-purple-700 transition duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Импортировать
            </button>
          </div>
        </div>

        {/* Bottom: Action Buttons - only for mobile */}
        <div className="lg:hidden flex flex-col sm:flex-row gap-3 w-full">
          <button
            type="button"
            onClick={onAddResident}
            className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition duration-200 flex-1 ${
              showGlobalInvite
                ? 'bg-emerald-600 text-white hover:shadow-lg'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:shadow-lg hover:from-emerald-600 hover:to-emerald-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            {showGlobalInvite ? 'Отмена' : 'Добавить жилца'}
          </button>
          
          <button
            type="button"
            onClick={onAddApartment}
            className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition duration-200 flex-1 ${
              isAddingApartment
                ? 'bg-blue-600 text-white hover:shadow-lg'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg hover:from-blue-600 hover:to-blue-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {isAddingApartment ? 'Отмена' : 'Добавить квартиру'}
          </button>

          <button
            type="button"
            onClick={onImport}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg hover:from-purple-600 hover:to-purple-700 transition duration-200 flex-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Импортировать
          </button>
        </div>
      </div>
    </div>
  );
};
