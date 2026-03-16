'use client';

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import type { Building } from '@/shared/types';

interface ImportApartmentsModalProps {
  buildings: Building[];
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

export const ImportApartmentsModal: React.FC<ImportApartmentsModalProps> = ({
  buildings,
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
  const companyId = selectedBuilding?.companyId;

  const handleImport = async () => {
    if (!file || !selectedBuildingId || !companyId) {
      toast.error('Выберите дом и файл');
      return;
    }

    setIsLoading(true);
    setProgress('Загрузка файла...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('buildingId', selectedBuildingId);
      formData.append('companyId', companyId);

      const response = await fetch('/api/apartments/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setProgress(`Ошибка: ${data.error}`);
        toast.error(data.error || 'Ошибка импорта');
        return;
      }

      setProgress('✓ Импорт завершен!');
      
      toast.success(
        `Успешно импортировано ${data.results.imported} квартир${
          data.results.errors.length > 0 
            ? ` (Ошибок: ${data.results.errors.length})`
            : ''
        }`
      );

      if (data.results.errors.length > 0) {
        console.log('Import errors:', data.results.errors);
        data.results.errors.forEach((err: string) => {
          console.warn(err);
        });
      }

      setTimeout(() => {
        onClose();
        setFile(null);
        setSelectedBuildingId('');
        setProgress('');
        onImportSuccess?.();
      }, 1500);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Ошибка импорта';
      setProgress(`Ошибка: ${errorMsg}`);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border-2 border-blue-100 bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              Импорт квартир
            </h3>
            <p className="text-gray-600 text-sm mt-1">Загрузите Excel файл с данными квартир и счётчиков</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Building selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Выберите дом *
            </label>
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg bg-gray-50 border-2 border-gray-200 text-gray-900 px-4 py-2 focus:border-blue-500 focus:outline-none transition disabled:opacity-50"
            >
              <option value="">Выберите дом...</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </div>

          {/* File input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Файл Excel (.xlsx) *
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={isLoading}
              className="w-full rounded-lg bg-gray-50 border-2 border-gray-200 text-gray-900 px-4 py-2 focus:border-blue-500 focus:outline-none transition disabled:opacity-50"
            />
            {file && (
              <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {file.name}
              </p>
            )}
          </div>

          {/* Progress message */}
          {progress && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-sm text-blue-900 font-medium">{progress}</p>
            </div>
          )}

          {/* Info box
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs text-amber-900 font-medium">
              💡 Файл должен содержать следующие колонки:
            </p>
            <ul className="text-xs text-amber-800 mt-2 space-y-1 ml-4">
              <li>• DZ (номер квартиры)</li>
              <li>• Adrese (адрес)</li>
              <li>• Kartsais NR (номер счётчика горячей воды)</li>
              <li>• Aukstais NR (номер счётчика холодной воды)</li>
              <li>• Показания счётчиков (в виде колонок Kartsais и Aukstais)</li>
            </ul>
          </div> */}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold bg-white hover:bg-gray-50 transition disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handleImport}
            disabled={!file || !selectedBuildingId || isLoading}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition disabled:opacity-50"
          >
            {isLoading ? 'Импорт...' : 'Импортировать'}
          </button>
        </div>
      </div>
    </div>
  );
};
