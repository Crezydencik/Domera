"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { useTranslations } from "next-intl";
import * as XLSX from "xlsx";
import { getApartmentsByCompany } from "@/modules/apartments/services/apartmentsService";
import { getBuildingsByCompany } from "@/modules/invoices/services/buildings/services/buildingsService";
import { getMeterReadingsByCompany, getMetersByApartment, deleteMeterReading } from "@/modules/meters/services/metersService";
import { ConfirmationDialog } from "@/shared/components/ui/ConfirmationDialog";
import { toast } from "react-toastify";
import type { Apartment, Building, Meter, MeterReading } from "@/shared/types";
import Header from "../../../shared/components/layout/heder";
 import { useRouter } from 'next/navigation';
import { logout } from "../../../modules/auth/services/authService";


// Вспомогательные функции (скопированы из page.tsx)
type ReadingTimestampLike = Date | string | { toDate?: () => Date; seconds?: number; nanoseconds?: number } | null | undefined;
const toTimestampMs = (value: ReadingTimestampLike): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const ts = new Date(value).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  }
  if (typeof value === "object" && typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value === "object" && typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
};
const formatDateTime = (value: ReadingTimestampLike): string => {
  const timestamp = toTimestampMs(value);
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
};
const getMeterDisplayName = (meter: Meter): string => {
  const name = meter.name?.toString().trim() ?? "";
  if (!name) return meter.serialNumber?.trim() || meter.id;
  const code = name.toLowerCase();
  if (code === "hwm") return "ГВС";
  if (code === "cwm") return "ХВС";
  return name;
};
// ...existing code...

export default function MeterReadingsManagerPage() {
  const { user, loading } = useAuth();
  const t = useTranslations('dashboard.meterReadings');
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [metersByApartmentId, setMetersByApartmentId] = useState<Record<string, Meter[]>>({});
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [deletingReadingId, setDeletingReadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    apartmentId: string;
    apartmentNumber: string;
    readingId: string;
    meterName: string;
    period: string;
  } | null>(null);
  const [deleteMulti, setDeleteMulti] = useState<{
    apartmentId: string;
    apartmentNumber: string;
    left?: MeterReading | null;
    right?: MeterReading | null;
    period: string;
  } | null>(null);
  const [deleteMultiLeft, setDeleteMultiLeft] = useState(true);
  const [deleteMultiRight, setDeleteMultiRight] = useState(true);
  // Селектор дома
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      if (!user || !user.companyId) return;
      setIsLoadingData(true);
      setLoadError("");
      try {
        const [aData, bData] = await Promise.all([
          getApartmentsByCompany(user.companyId),
          getBuildingsByCompany(user.companyId),
        ]);
        setApartments(aData);
        setBuildings(bData);
        const readingsData = await getMeterReadingsByCompany(user.companyId);
        setReadings(readingsData);
        const meterEntries = await Promise.all(
          aData.map(async (apartment) => ({
            apartmentId: apartment.id,
            meters: await getMetersByApartment(apartment.id),
          }))
        );
        const currentMetersByApartmentId = meterEntries.reduce<Record<string, Meter[]>>((acc, entry) => {
          acc[entry.apartmentId] = entry.meters;
          return acc;
        }, {});
        setMetersByApartmentId(currentMetersByApartmentId);
      } catch (error: unknown) {
        setLoadError(error instanceof Error ? error.message : t('loadError'));
      } finally {
        setIsLoadingData(false);
      }
    };
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const apartmentById = useMemo(() => {
    return apartments.reduce<Record<string, Apartment>>((acc, apartment) => {
      acc[apartment.id] = apartment;
      return acc;
    }, {});
  }, [apartments]);

  const buildingNameById = useMemo(() => {
    return buildings.reduce<Record<string, string>>((acc, building) => {
      acc[building.id] = building.name;
      return acc;
    }, {});
  }, [buildings]);

  const meterById = useMemo(() => {
    const allMeters = Object.values(metersByApartmentId).flat();
    return allMeters.reduce<Record<string, Meter>>((acc, meter) => {
      acc[meter.id] = meter;
      return acc;
    }, {});
  }, [metersByApartmentId]);

  const sortedReadings = useMemo(() => {
    return [...readings].sort((a, b) => {
      const periodDiff = a.year - b.year || a.month - b.month;
      if (periodDiff !== 0) return periodDiff;
      return (
        toTimestampMs(a.submittedAt as ReadingTimestampLike) -
        toTimestampMs(b.submittedAt as ReadingTimestampLike)
      );
    });
  }, [readings]);

  const readingsByApartmentId = useMemo(() => {
    return sortedReadings.reduce<Record<string, MeterReading[]>>((acc, reading) => {
      if (!acc[reading.apartmentId]) {
        acc[reading.apartmentId] = [];
      }
      acc[reading.apartmentId].push(reading);
      return acc;
    }, {});
  }, [sortedReadings]);

  // Экспорт в CSV/XLSX
  const exportRows = useMemo(() => {
    return sortedReadings.map((reading) => {
      const apartment = apartmentById[reading.apartmentId];
      const apartmentNumber = apartment?.number ?? reading.apartmentId;
      const buildingName = apartment ? buildingNameById[apartment.buildingId] ?? t('notSpecified') : t('notSpecified');
      const meter = meterById[reading.meterId];
      const meterName = meter ? getMeterDisplayName(meter) : reading.meterId;
      const period = `${reading.year}. gads ${String(reading.month).padStart(2, '0')}`;
      return {
        apartmentNumber,
        buildingName,
        meterName,
        period,
        submittedAt: formatDateTime(reading.submittedAt as ReadingTimestampLike),
        previousValue: reading.previousValue,
        currentValue: reading.currentValue,
        consumption: reading.consumption,
        isMissing: Boolean(reading.isMissing),
      };
    });
  }, [sortedReadings, apartmentById, buildingNameById, meterById, t]);

  const handleExportCsv = () => {
    if (exportRows.length === 0) return;
    const headers = [
      'Квартира',
      'Дом',
      'Счетчик',
      'Период',
      'Дата отправки',
      'Предыдущее',
      'Текущее',
      'Расход (м³)',
      'Нет счетчика',
    ];
    const rows = exportRows.map((row) => [
      row.apartmentNumber,
      row.buildingName,
      row.meterName,
      row.period,
      row.submittedAt,
      row.previousValue,
      row.currentValue,
      row.consumption,
      row.isMissing ? 'Да' : 'Нет',
    ]);
    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meter-readings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportXlsx = () => {
    if (exportRows.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(
      exportRows.map((row) => ({
        Apartment: row.apartmentNumber,
        Building: row.buildingName,
        Meter: row.meterName,
        Period: row.period,
        SubmittedAt: row.submittedAt,
        PreviousValue: row.previousValue,
        CurrentValue: row.currentValue,
        Consumption: row.consumption,
        IsMissing: row.isMissing ? 'Yes' : 'No',
      }))
    );
    const workbook = XLSX.utils.book_new();
    // Имя листа: максимум 31 символ, без спецсимволов
    let sheetName = t('meterReadings');
    if (typeof sheetName !== 'string' || !sheetName.trim()) sheetName = 'Readings';
    sheetName = sheetName.replace(/[\/?*\[\]:]/g, '').replace(/&/g, 'and').slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `meter-readings-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Удаление показаний
  const handleDeleteReading = async () => {
    if (!deleteTarget) return;
    setDeletingReadingId(deleteTarget.readingId);
    try {
      await deleteMeterReading(deleteTarget.apartmentId, deleteTarget.readingId);
      setReadings((prev) => prev.filter((reading) => reading.id !== deleteTarget.readingId));
      toast.success(
        t('meterReadingDeleted', { meterName: deleteTarget.meterName, period: deleteTarget.period })
      );
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('meterReadingDeleteError'));
    } finally {
      setDeletingReadingId(null);
    }
  };

  const handleDeleteMultiConfirm = async () => {
    if (!deleteMulti) return;
    setDeletingReadingId('multi');
    try {
      const toDelete: string[] = [];
      if (deleteMultiLeft && deleteMulti.left && deleteMulti.left.id) toDelete.push(deleteMulti.left.id);
      if (deleteMultiRight && deleteMulti.right && deleteMulti.right.id) toDelete.push(deleteMulti.right.id);
      if (toDelete.length === 0) {
        throw new Error('Не выбрано ни одного показания для удаления');
      }
      for (const id of toDelete) {
        await deleteMeterReading(deleteMulti.apartmentId, id);
      }
      setReadings((prev) => prev.filter((reading) => !toDelete.includes(reading.id)));
      toast.success(t('meterReadingsDeleted'));
      setDeleteMulti(null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('meterReadingsDeleteError'));
    } finally {
      setDeletingReadingId(null);
    }
  };
     const router = useRouter();
  	const handleLogout = async () => {
		await logout();
		await fetch('/api/auth/clear-cookies', { method: 'POST' });
		router.push('/login');
		router.refresh();
	  };
  

  if (loading) {
    return <div className="text-black bg-white min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }
  if (!user) {
    return <div className="text-black bg-white min-h-screen flex items-center justify-center">{t('loginRequired')}</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      <Header userName={user.name || user.email || t('user')} userEmail={user.email} onLogout={handleLogout} pageTitle={t('waterReadings')} />

      <main className="max-w-7xl mx-auto px-4 py-10">
        {/* Верхняя панель: фильтр и экспорт */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div className="flex flex-col w-full max-w-xs">
            <label className="block text-base font-semibold text-gray-700 mb-2" htmlFor="building-select">
              {t('selectBuilding') !== 'dashboard.meterReadings.selectBuilding' ? t('selectBuilding') : 'Выбрать дом'}
            </label>
            <select
              id="building-select"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-base text-gray-700 shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
              value={selectedBuildingId}
              onChange={e => setSelectedBuildingId(e.target.value)}
            >
              <option value="">Все дома</option>
              {buildings.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-row flex-wrap items-end gap-3">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exportRows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white shadow-sm transition hover:bg-gray-100 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 17l4 4 4-4m-4-5v9" /></svg>
              CSV
            </button>
            <button
              type="button"
              onClick={handleExportXlsx}
              disabled={exportRows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-blue-500 to-blue-400 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-blue-600 hover:to-blue-500 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 17l4 4 4-4m-4-5v9" /></svg>
              XLSX
            </button>
          </div>
        </div>

        {/* Основная часть: карточки квартир */}
        {loadError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-base text-red-700 shadow-sm animate-fade-in">
            {loadError}
          </div>
        )}

        {isLoadingData ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-lg text-gray-600 shadow animate-pulse">
                {t('loadingApartmentsAndReadings')}
              </div>
            ) : apartments.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-12 text-center shadow">
                <p className="text-gray-500 text-lg font-medium">{t('noApartmentsFound')}</p>
              </div>
            ) : (
              <div className="space-y-8">
                {apartments
                  .filter(apartment => !selectedBuildingId || apartment.buildingId === selectedBuildingId)
                  .map((apartment) => {
                    const buildingName = buildingNameById[apartment.buildingId] ?? t('notSpecified');
                    const meters = metersByApartmentId[apartment.id] || [];
                    return (
                      <div key={apartment.id} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-lg transition-all duration-200 hover:shadow-2xl hover:bg-blue-50 group">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full bg-blue-400 group-hover:bg-blue-600 transition"></span>
                              {t('apartment')} {apartment.number}
                            </h2>
                            <p className="text-xs text-gray-400 mt-1">{t('building')}: <span className="font-medium text-gray-600">{buildingName}</span></p>
                          </div>
                        </div>
                        {/* Показания сгруппированы по месяцам (аккордеоны) */}
                        <div className="mt-4 space-y-4">
                          {(() => {
                            const apartmentReadings = readings.filter(r => r.apartmentId === apartment.id);
                            if (apartmentReadings.length === 0) {
                              return <div className="text-gray-400 text-sm italic">Нет показаний</div>;
                            }
                            // Группировка по месяцам/годам
                            const grouped = apartmentReadings.reduce((acc, reading) => {
                              const key = `${reading.year}-${String(reading.month).padStart(2, '0')}`;
                              if (!acc[key]) acc[key] = [];
                              acc[key].push(reading);
                              return acc;
                            }, {} as Record<string, MeterReading[]>);
                            // Сортировка месяцев по убыванию (сначала свежие)
                            const sortedKeys = Object.keys(grouped).sort((a, b) => {
                              const [ya, ma] = a.split('-').map(Number);
                              const [yb, mb] = b.split('-').map(Number);
                              return yb - ya || mb - ma;
                            });
                            return sortedKeys.map(key => {
                              const [year, month] = key.split('-').map(Number);
                              const label = `${year}. gads ${String(month).padStart(2, '0')}`;
                              return (
                                <details key={key} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                  <summary className="cursor-pointer font-semibold text-blue-700">{label}</summary>
                                  <div className="mt-2 space-y-2">
                                    {grouped[key].map(reading => (
                                      <div key={reading.id} className="flex flex-col md:flex-row md:items-center md:gap-6 gap-1 text-sm border-b border-gray-100 pb-2 last:border-b-0 text-gray-900">
                                        <span><span className="font-semibold">Счётчик:</span> <span className="font-normal">{meterById[reading.meterId] ? getMeterDisplayName(meterById[reading.meterId]) : reading.meterId}</span></span>
                                        <span><span className="font-semibold">Текущее:</span> <span className="font-normal">{reading.currentValue}</span></span>
                                        <span><span className="font-semibold">Предыдущее:</span> <span className="font-normal">{reading.previousValue}</span></span>
                                        <span><span className="font-semibold">Дата:</span> <span className="font-normal">{formatDateTime(reading.submittedAt)}</span></span>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          
        <ConfirmationDialog
          isOpen={Boolean(deleteTarget)}
          title={t('deleteReading')}
          description={t('confirmDeleteReading')}
          details={
            deleteTarget
              ? [
                  `${t('apartment')}: ${deleteTarget.apartmentNumber}`,
                  `${t('meter')}: ${deleteTarget.meterName}`,
                  `${t('period')}: ${deleteTarget.period}`,
                ]
              : []
          }
          confirmLabel={t('delete')}
          confirmVariant="danger"
          loading={Boolean(deletingReadingId)}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteReading}
        />

        <ConfirmationDialog
          isOpen={Boolean(deleteMulti)}
          title={t('deleteReadings')}
          description={t('selectReadingsToDelete')}
          details={deleteMulti ? [`${t('apartment')}: ${deleteMulti.apartmentNumber}`, `${t('period')}: ${deleteMulti.period}`] : []}
          confirmLabel={t('deleteSelected')}
          confirmVariant="danger"
          loading={Boolean(deletingReadingId)}
          onCancel={() => setDeleteMulti(null)}
          onConfirm={handleDeleteMultiConfirm}
        >
          {deleteMulti && (
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={deleteMultiLeft}
                  onChange={(e) => setDeleteMultiLeft(e.target.checked)}
                />
                <span>
                  {deleteMulti.left ? (meterById[deleteMulti.left.meterId] ? getMeterDisplayName(meterById[deleteMulti.left.meterId]) : deleteMulti.left.meterId) : '-'}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={deleteMultiRight}
                  onChange={(e) => setDeleteMultiRight(e.target.checked)}
                />
                <span>
                  {deleteMulti.right ? (meterById[deleteMulti.right.meterId] ? getMeterDisplayName(meterById[deleteMulti.right.meterId]) : deleteMulti.right.meterId) : '-'}
                </span>
              </label>
            </div>
          )}
        </ConfirmationDialog>
      </main>
    </div>
  );
}
