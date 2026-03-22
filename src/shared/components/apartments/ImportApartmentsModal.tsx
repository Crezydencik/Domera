'use client';

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslations } from 'next-intl';
import { auth } from '@/firebase/config';
import type { Building } from '@/shared/types';

interface ImportResults {
  imported: number;
  errors: string[];
  skippedDuplicates: string[];
  createdApartments: string[];
}

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
  const t = useTranslations();
  const tm = useTranslations('ui.importApartmentsModal');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [importResults, setImportResults] = useState<ImportResults | null>(null);

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
  const companyId =
    selectedBuilding?.companyId ||
    selectedBuilding?.managedBy?.companyId;

  const resetState = () => {
    setFile(null);
    setSelectedBuildingId('');
    setProgress('');
    setImportResults(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleImport = async () => {
    if (!file || !selectedBuildingId || !companyId) {
      toast.error(t('auth.alert.selectBuildingAndFile'));
      return;
    }

    setIsLoading(true);
    setProgress(tm('progress.uploadingFile'));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('buildingId', selectedBuildingId);
      formData.append('companyId', companyId);

      const currentUser = auth.currentUser;
      if (!currentUser) {
        setProgress(`${tm('progress.errorPrefix')}: ${t('auth.alert.authenticationRequired')}`);
        toast.error(t('auth.alert.authenticationRequired'));
        return;
      }

      const idToken = await currentUser.getIdToken();

      const response = await fetch('/api/apartments/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setProgress(`${tm('progress.errorPrefix')}: ${data.error || t('auth.alert.importError')}`);
        toast.error(data.error || t('auth.alert.importError'));
        return;
      }

      setProgress(tm('progress.completed'));
      setImportResults(data.results);
      
      const details =
        data.results.errors.length > 0 || data.results.skippedDuplicates.length > 0
          ? ` (errors: ${data.results.errors.length}, duplicates: ${data.results.skippedDuplicates.length})`
          : '';

      toast.success(
        t('auth.alert.importSuccessSummary', {
          imported: data.results.imported,
          details,
        })
      );

      if (data.results.errors.length > 0) {
        console.log('Import errors:', data.results.errors);
        data.results.errors.forEach((err: string) => {
          console.warn(err);
        });
      }

      if (data.results.skippedDuplicates.length > 0) {
        console.warn('Duplicate apartments skipped:', data.results.skippedDuplicates);
      }

      onImportSuccess?.();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : t('auth.alert.importError');
      setProgress(`${tm('progress.errorPrefix')}: ${errorMsg}`);
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
              {importResults ? tm('resultTitle') : tm('title')}
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              {importResults
                ? tm('resultDescription')
                : tm('description')}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {importResults ? (
            <>
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-sm font-semibold text-green-900">
                  {tm('summary.imported', { count: importResults.imported })}
                </p>
                <p className="text-sm text-green-800 mt-1">
                  {tm('summary.skippedDuplicates', { count: importResults.skippedDuplicates.length })}
                </p>
                <p className="text-sm text-green-800 mt-1">
                  {tm('summary.errors', { count: importResults.errors.length })}
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-800">{tm('sections.createdApartments')}</p>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
                  {importResults.createdApartments.length > 0 ? (
                    <ul className="space-y-2 text-sm text-gray-700">
                      {importResults.createdApartments.map((item) => (
                        <li key={item} className="rounded-md bg-white px-3 py-2 shadow-sm">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">{tm('sections.noNewApartments')}</p>
                  )}
                </div>
              </div>

              {importResults.skippedDuplicates.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-amber-800">{tm('sections.skippedDuplicates')}</p>
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <ul className="space-y-2 text-sm text-amber-900">
                      {importResults.skippedDuplicates.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {importResults.errors.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-red-800">{tm('sections.errors')}</p>
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3">
                    <ul className="space-y-2 text-sm text-red-900">
                      {importResults.errors.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
          {/* Building selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {tm('fields.selectBuilding')}
            </label>
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg bg-gray-50 border-2 border-gray-200 text-gray-900 px-4 py-2 focus:border-blue-500 focus:outline-none transition disabled:opacity-50"
            >
              <option value="">{tm('fields.selectBuildingPlaceholder')}</option>
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
              {tm('fields.excelFile')}
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
            </>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          {importResults ? (
            <button
              onClick={handleClose}
              className="w-full px-4 py-2 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition"
            >
              {tm('buttons.ok')}
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold bg-white hover:bg-gray-50 transition disabled:opacity-50"
              >
                {t('system.button.cancel')}
              </button>
              <button
                onClick={handleImport}
                disabled={!file || !selectedBuildingId || isLoading}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition disabled:opacity-50"
              >
                {isLoading ? tm('buttons.importing') : tm('buttons.import')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
