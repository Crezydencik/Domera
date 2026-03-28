"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { AccessError } from "@/shared/components/AccessError";
import { useTranslations } from "next-intl";
import * as XLSX from "xlsx";
import { getApartmentsByCompany } from "@/modules/apartments/services/apartmentsService";
import { getBuildingsByCompany } from "@/modules/invoices/services/buildings/services/buildingsService";
import { getMeterReadingsByCompany, getMetersByApartment, deleteMeterReading } from "@/modules/meters/services/metersService";
import { ConfirmationDialog } from "@/shared/components/ui/ConfirmationDialog";
import { MeterDetailsModal } from "./components/MeterDetailsModal";
import { Modal } from "@/shared/components/ui/Modal";
import { toast } from "react-toastify";
import type { Apartment, Building, Meter, MeterReading, WaterMeterData, WaterReadings } from "@/shared/types";
import Header from "../../../shared/components/layout/heder";

import { useRouter } from 'next/navigation';
import { logout } from "../../../modules/auth/services/authService";

// Styles imports
import "@/app/globals.css";


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
const formatThreeDecimals = (value: unknown): string => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toFixed(3);
};
const getLatestReadingForMeter = (readings: MeterReading[], meterId: string): MeterReading | null => {
  const filtered = readings.filter((reading) => reading.meterId === meterId);
  if (filtered.length === 0) return null;

  return [...filtered].sort((a, b) => {
    const periodDiff = Number(b.year) - Number(a.year) || Number(b.month) - Number(a.month);
    if (periodDiff !== 0) return periodDiff;
    return toTimestampMs(b.submittedAt as ReadingTimestampLike) - toTimestampMs(a.submittedAt as ReadingTimestampLike);
  })[0] ?? null;
};
const isPreviousCalendarMonth = (year: number, month: number): boolean => {
  const now = new Date();
  let prevMonth = now.getMonth(); // 0..11, previous calendar month index
  let prevYear = now.getFullYear();

  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }

  return year === prevYear && month === prevMonth;
};
const getMeterDisplayName = (meter?: Meter | null): string => {
  if (!meter) return '';
  const name = meter.name?.toString().trim() ?? '';
  if (!name) return meter.serialNumber?.trim() || meter.id || '';
  const code = name.toLowerCase();
  if (code === 'hwm') return 'hmw';
  if (code === 'cwm') return 'cwm';
  return name;
};
const getApartmentMeterSerial = (apartment: Apartment, meter?: Meter | null): string => {
  if (!meter) return '';

  if (meter.name?.toLowerCase() === 'cwm') {
    return apartment.waterReadings?.coldmeterwater?.serialNumber
      || apartment.coldWaterMeterNumber
      || meter.serialNumber
      || '';
  }

  return apartment.waterReadings?.hotmeterwater?.serialNumber
    || apartment.hotWaterMeterNumber
    || meter.serialNumber
    || '';
};


export default function MeterReadingsManagerPage() {
  // Состояния для модалки экспорта
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');
  const [exportMonth, setExportMonth] = useState<string>(''); // формат YYYY-MM
    // Состояния для модального окна редактирования счетчиков
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [openHistoryIds, setOpenHistoryIds] = useState<Set<string>>(new Set());
    const toggleHistory = (id: string) => setOpenHistoryIds(prev => { const next = new Set(prev); if (next.has(id)) { next.delete(id); } else { next.add(id); } return next; });
    const [editApartmentId, setEditApartmentId] = useState<string|null>(null);
    const [editMeters, setEditMeters] = useState<Meter[]>([]);
    const [editSerials, setEditSerials] = useState<Record<string, string>>({});
    const [editChecks, setEditChecks] = useState<Record<string, string>>({});
    // Открыть модалку для квартиры
    const openEditModal = (apartmentId: string) => {
      setEditApartmentId(apartmentId);
      const apartment = apartmentById[apartmentId];
      const allMeters = metersByApartmentId[apartmentId] || [];
      // Deduplicate: keep one meter p  er type (cwm/hwm), prefer the one in waterReadings
      const dedupedMeters: Meter[] = [];
      const seen = new Set<string>();
      for (const m of allMeters) {
        const isCold = m.name?.toLowerCase() === 'cwm';
        const typeKey = isCold ? 'cwm' : 'hwm';
        const wr = isCold ? apartment?.waterReadings?.coldmeterwater : apartment?.waterReadings?.hotmeterwater;
        if (seen.has(typeKey)) {
          // Already have a meter of this type; only replace if this one matches waterReadings
          if (wr?.meterId === m.id) {
            dedupedMeters.splice(dedupedMeters.findIndex(x => (x.name?.toLowerCase() === 'cwm') === isCold), 1, m);
          }
        } else {
          seen.add(typeKey);
          dedupedMeters.push(m);
        }
      }
      setEditMeters(dedupedMeters);
      setEditSerials(Object.fromEntries(dedupedMeters.map(m => {
        const isCold = m.name?.toLowerCase() === 'cwm';
        const wr = isCold ? apartment?.waterReadings?.coldmeterwater : apartment?.waterReadings?.hotmeterwater;
        const match = wr?.meterId === m.id ? wr : undefined;
        const fallback = isCold ? apartment?.coldWaterMeterNumber : apartment?.hotWaterMeterNumber;
        return [m.id, match?.serialNumber || fallback || ''];
      })));
      setEditChecks(Object.fromEntries(dedupedMeters.map(m => {
        const isCold = m.name?.toLowerCase() === 'cwm';
        const wr = isCold ? apartment?.waterReadings?.coldmeterwater : apartment?.waterReadings?.hotmeterwater;
        const match = wr?.meterId === m.id ? wr : undefined;
        return [m.id, match?.checkDueDate ? (typeof match.checkDueDate === 'string' ? match.checkDueDate : '') : ''];
      })));
      setEditModalOpen(true);
    };
    // Сохранить изменения
    const handleSaveMeters = async () => {
      try {
        if (!editApartmentId) throw new Error('Нет выбранной квартиры');
        // Получить текущий apartment
        const apartment = apartmentById[editApartmentId];
        if (!apartment) throw new Error('Квартира не найдена');
        // Сохранить coldmeterwater / hotmeterwater в apartments
        const waterReadingsUpdate: WaterReadings = { ...apartment.waterReadings };
        for (const meter of editMeters) {
          const serial = editSerials[meter.id] || '';
          const checkDate = editChecks[meter.id] || '';
          const isCold = meter.name?.toLowerCase() === 'cwm';
          const existing = isCold ? apartment.waterReadings?.coldmeterwater : apartment.waterReadings?.hotmeterwater;
          const meterData: WaterMeterData = {
            ...(existing && existing.meterId === meter.id ? existing : {}),
            meterId: meter.id,
            serialNumber: serial,
            checkDueDate: checkDate,
          };
          if (isCold) {
            waterReadingsUpdate.coldmeterwater = meterData;
          } else {
            waterReadingsUpdate.hotmeterwater = meterData;
          }
        }
        const updateData: Partial<Omit<Apartment, 'id'>> = { waterReadings: waterReadingsUpdate };
        const mod = await import('@/modules/apartments/services/apartmentsService');
        await mod.updateApartment(editApartmentId, updateData);
        toast.success(t('auth.alert.saved'));
        // Обновить данные квартиры после сохранения
        const aData = await getApartmentsByCompany(user.companyId);
        setApartments(aData);
        // Найти обновлённую квартиру
        const updatedApartment = aData.find(a => a.id === editApartmentId);
        if (updatedApartment) {
          setEditSerials(Object.fromEntries(editMeters.map(m => {
            const isCold = m.name?.toLowerCase() === 'cwm';
            const wr = isCold ? updatedApartment.waterReadings?.coldmeterwater : updatedApartment.waterReadings?.hotmeterwater;
            const match = wr?.meterId === m.id ? wr : undefined;
            return [m.id, match?.serialNumber || ''];
          })));
          setEditChecks(Object.fromEntries(editMeters.map(m => {
            const isCold = m.name?.toLowerCase() === 'cwm';
            const wr = isCold ? updatedApartment.waterReadings?.coldmeterwater : updatedApartment.waterReadings?.hotmeterwater;
            const match = wr?.meterId === m.id ? wr : undefined;
            return [m.id, match?.checkDueDate ? (typeof match.checkDueDate === 'string' ? match.checkDueDate : '') : ''];
          })));
        }
        setEditModalOpen(false);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : t('auth.alert.saveError');
        toast.error(message);
      }
    };
  const { user, loading } = useAuth();
  const t = useTranslations();
  const tMeter = useTranslations('dashboard.meterReadings');
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

  // Если есть только один дом, выбираем его автоматически
  useEffect(() => {
    if (!selectedBuildingId && buildings.length === 1) {
      setSelectedBuildingId(buildings[0].id);
    }
  }, [selectedBuildingId, buildings]);

  // Состояния для редактирования периода сдачи показаний ---
  const [editOpenDate, setEditOpenDate] = useState<string>('');
  const [editCloseDate, setEditCloseDate] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editSubmitEveryMonth, setEditSubmitEveryMonth] = useState<boolean>(false);
  // Синхронизировать с выбранным домом
  useEffect(() => {
    if (!selectedBuildingId) {
        setEditOpenDate(''); setEditCloseDate(''); setEditSubmitEveryMonth(false);
      return;
    }
    const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
    setEditOpenDate(selectedBuilding?.waterSubmissionOpenDate || '');
    setEditCloseDate(selectedBuilding?.waterSubmissionCloseDate || '');
    setEditSubmitEveryMonth(Boolean(selectedBuilding?.waterSubmissionIsMonthly));
  }, [selectedBuildingId, buildings]);

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
        setLoadError(error instanceof Error ? error.message : tMeter('loadError'));
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
      const buildingName = apartment ? buildingNameById[apartment.buildingId] ?? tMeter('notSpecified') : tMeter('notSpecified');
      const meter = meterById[reading.meterId];
      const meterName = meter ? getMeterDisplayName(meter) : reading.meterId;
      const period = `${reading.year}. gads ${String(reading.month).padStart(2, '0')}`;
      return {
        apartmentId: reading.apartmentId,
        meterId: reading.meterId,
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
  }, [sortedReadings, apartmentById, buildingNameById, meterById, tMeter]);

  const handleExportCsv = () => {
    if (exportRows.length === 0) return;
    const headers = [
      tMeter('apartment'),
      tMeter('building'),
      tMeter('meter'),
      tMeter('period'),
      tMeter('submittedAt'),
      tMeter('previousValue'),
      tMeter('currentValue'),
      tMeter('consumption'),
      tMeter('isMissing'),
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
      row.isMissing ? tMeter('yes') : tMeter('no'),
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
    let sheetName = tMeter('meterReadings');
    if (typeof sheetName !== 'string' || !sheetName.trim()) sheetName = tMeter('readings');
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
        tMeter('meterReadingDeleted', { meterName: deleteTarget.meterName, period: deleteTarget.period })
      );
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : tMeter('meterReadingDeleteError'));
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
        throw new Error(t('auth.alert.noneSelectedForDelete'));
      }
      for (const id of toDelete) {
        await deleteMeterReading(deleteMulti.apartmentId, id);
      }
      setReadings((prev) => prev.filter((reading) => !toDelete.includes(reading.id)));
      toast.success(tMeter('meterReadingsDeleted'));
      setDeleteMulti(null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : tMeter('meterReadingsDeleteError'));
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

  // Сортировка квартир
  const [sortColumn, setSortColumn] = useState<'number' | 'building'>('number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const visibleApartments = useMemo(() => {
    const filtered = apartments.filter(
      (apartment) => !selectedBuildingId || apartment.buildingId === selectedBuildingId
    );
    const sorted = [...filtered].sort((a, b) => {
      if (sortColumn === 'number') {
        const nA = a.number || '';
        const nB = b.number || '';
        if (nA < nB) return sortDirection === 'asc' ? -1 : 1;
        if (nA > nB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }
      if (sortColumn === 'building') {
        const bA = buildingNameById[a.buildingId] || '';
        const bB = buildingNameById[b.buildingId] || '';
        if (bA < bB) return sortDirection === 'asc' ? -1 : 1;
        if (bA > bB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }
      return 0;
    });
    return sorted;
  }, [apartments, selectedBuildingId, sortColumn, sortDirection, buildingNameById]);
  

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-white via-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-blue-500 border-t-blue-300 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">{tMeter('loading')}</p>
        </div>
      </div>
    );
  }
  if (!user) {
    return <AccessError type="loginRequired" />;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-white via-gray-50 to-white text-gray-900">


      <main className="max-w-7xl mx-auto px-4 py-10">
        {/* Верхняя панель: фильтр и экспорт */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12">
          <div className="flex-1 max-w-sm">
            <label className="block text-sm font-semibold text-gray-700 mb-3" htmlFor="building-select">
              {tMeter('selectBuilding') !== 'dashboard.meterReadings.selectBuilding' ? tMeter('selectBuilding') : 'Выбрать дом'}
            </label>
            <select
              id="building-select"
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-md hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
              value={selectedBuildingId}
              onChange={e => setSelectedBuildingId(e.target.value)}
            >
              <option value="">Все дома</option>
              {buildings.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-row gap-3 items-center">
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-green-400 px-4 py-2.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 transition shadow-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Экспорт
            </button>
                  {/* Модалка экспорта */}
                  <Modal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)}>
                    <div className="flex flex-col gap-4 min-w-[280px]">
                      <h2 className="text-lg font-bold mb-2">Экспорт данных</h2>
                      <label className="block">
                        <span className="text-sm font-semibold text-gray-700 mb-2 block">Формат</span>
                        <select
                          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-md"
                          value={exportFormat}
                          onChange={e => setExportFormat(e.target.value as 'csv' | 'xlsx')}
                        >
                          <option value="csv">CSV</option>
                          <option value="xlsx">Excel (XLSX)</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-gray-700 mb-2 block">Месяц</span>
                        <input
                          type="month"
                          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-md"
                          value={exportMonth}
                          onChange={e => setExportMonth(e.target.value)}
                        />
                      </label>
                      <div className="flex gap-2 mt-2">
                        <button
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                          onClick={() => {
                            if (!exportMonth) return;
                            const [year, month] = exportMonth.split('-').map(Number);
                            // Фильтруем показания по выбранному месяцу
                            const filteredRows = exportRows.filter(row => {
                              // row.period: "2026. gads 03"
                              const periodMatch = row.period.match(/(\d{4})\. gads (\d{2})/);
                              if (!periodMatch) return false;
                              const y = Number(periodMatch[1]);
                              const m = Number(periodMatch[2]);
                              return y === year && m === month;
                            });
                            if (filteredRows.length === 0) {
                              toast.info('Нет данных за выбранный месяц');
                              setExportModalOpen(false);
                              return;
                            }
                            if (exportFormat === 'csv') {
                              // CSV экспорт
                              const headers = [
                                'Номер квартиры',
                                'Email жильца',
                                'Номера счётчика',
                                'Тип счётчика',
                                'Показание за прошлый месяц',
                                'Показание за текущий месяц',
                                'Разница',
                              ];
                              const rows = filteredRows.map(row => {
                                const apartment = apartmentById && apartmentById[row.apartmentId];
                                const meter = meterById && meterById[row.meterId];
                                return [
                                  row.apartmentNumber,
                                  apartment?.ownerEmail || '',
                                  meter?.serialNumber || '',
                                  meter?.name || meter?.type || '',
                                  row.previousValue,
                                  row.currentValue,
                                  row.consumption,
                                ];
                              });
                              const csv = [headers, ...rows]
                                .map(line => line.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                                .join('\n');
                              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `meter-readings-${exportMonth}.csv`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } else {
                              // XLSX экспорт (корректно для браузера)
                              const worksheet = XLSX.utils.aoa_to_sheet([
                                [
                                  'Номер квартиры',
                                  'Email жильца',
                                  'Номера счётчика',
                                  'Показание за прошлый месяц',
                                  'Показание за текущий месяц',
                                  'Разница',
                                ],
                                ...filteredRows.map(row => {
                                  const apartment = apartmentById && apartmentById[row.apartmentId];
                                  const meter = meterById && meterById[row.meterId];
                                  return [
                                    row.apartmentNumber,
                                    apartment?.ownerEmail || '',
                                    meter?.serialNumber || '',
                                    meter?.name || meter?.type || '',
                                    row.previousValue,
                                    row.currentValue,
                                    row.consumption,
                                  ];
                                }),
                              ]);
                              const workbook = XLSX.utils.book_new();
                              XLSX.utils.book_append_sheet(workbook, worksheet, 'Экспорт');
                              // Генерируем бинарный массив для Blob
                              const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                              const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `meter-readings-${exportMonth}.xlsx`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }
                            setExportModalOpen(false);
                          }}
                          disabled={!exportMonth}
                        >
                          Экспортировать
                        </button>
                        <button
                          className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition"
                          onClick={() => setExportModalOpen(false)}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  </Modal>
          </div>
        </div>

        {/* Основная часть: период сдачи показаний */}
        {(() => {
          // Получаем выбранный дом
          const selectedBuilding = selectedBuildingId ? buildings.find(b => b.id === selectedBuildingId) : null;
          // Сохранение изменений
          const handleSaveDays = async () => {
            if (!selectedBuilding) {
              return;
            }
            setIsSaving(true);
            try {
              // Вычисляем день месяца из даты закрытия
              const update: Record<string, string | undefined> = {
                waterSubmissionOpenDate: editOpenDate || undefined,
                waterSubmissionCloseDate: editCloseDate || undefined,
              };
              const updateWithMonthly = {
                ...update,
                waterSubmissionIsMonthly: editSubmitEveryMonth,
              } as Record<string, string | boolean | undefined>;
              // Удаляем все undefined поля
              Object.keys(updateWithMonthly).forEach(key => updateWithMonthly[key] === undefined && delete updateWithMonthly[key]);
              const mod = await import('@/modules/invoices/services/buildings/services/buildingsService');
              await mod.updateBuilding(selectedBuilding.id, updateWithMonthly);
              toast.success(t('auth.alert.submissionPeriodSaved'));
              // Обновить данные о домах после сохранения
              const bData = await getBuildingsByCompany(user.companyId);
              setBuildings(bData);
            } catch (e) {
              console.error('Ошибка при сохранении периода сдачи:', e);
              toast.error(t('auth.alert.submissionPeriodSaveError'));
            } finally {
              setIsSaving(false);
            }
          };

          return (
            <div className="mb-12">
              <details className="group rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50 to-white shadow-md">
                <summary className="list-none cursor-pointer px-6 py-5 lg:px-8 lg:py-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{tMeter('submissionPeriodForBuilding')}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {editOpenDate && editCloseDate
                            ? `${new Date(editOpenDate).toLocaleDateString('ru-RU')} — ${new Date(editCloseDate).toLocaleDateString('ru-RU')}`
                            : 'Даты не установлены'
                          }
                        </p>
                      </div>
                    </div>
                    <svg className="h-5 w-5 text-gray-600 transition-transform group-open:rotate-180 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </summary>

                <div className="border-t border-blue-100 px-6 pb-6 lg:px-8 lg:pb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 mt-6">
                    <label className="block">
                      <span className="text-sm font-semibold text-gray-700 mb-2 block">{tMeter('openDate')}</span>
                      <input
                        type="date"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm"
                        value={editOpenDate}
                        onChange={e => setEditOpenDate(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-gray-700 mb-2 block">{tMeter('closeDate')}</span>
                      <input
                        type="date"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm"
                        value={editCloseDate}
                        onChange={e => setEditCloseDate(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 mr-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                        checked={editSubmitEveryMonth}
                        onChange={(e) => setEditSubmitEveryMonth(e.target.checked)}
                      />
                      Подавать каждый месяц
                    </label>
                    <button
                      className="px-6 py-2.5 rounded-lg bg-linear-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleSaveDays}
                      type="button"
                      disabled={isSaving || !editOpenDate || !editCloseDate || !selectedBuildingId}
                    >
                      {isSaving ? 'Сохранение...' : tMeter('save')}
                    </button>
                    <button
                      className="px-6 py-2.5 rounded-lg bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      onClick={async () => {
                        if (!selectedBuilding) return;
                        setIsSaving(true);
                        try {
                          const mod = await import('@/modules/invoices/services/buildings/services/buildingsService');
                          await mod.updateBuilding(selectedBuilding.id, {
                            waterSubmissionOpenDate: '',
                            waterSubmissionCloseDate: '',
                          });
                          toast.success('Месяц сдачи удалён');
                          setEditOpenDate('');
                          setEditCloseDate('');
                          // Обновить данные о домах после удаления
                          const bData = await getBuildingsByCompany(user.companyId);
                          setBuildings(bData);
                        } catch (e) {
                          toast.error('Ошибка при удалении месяца сдачи');
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      type="button"
                      disabled={isSaving || !selectedBuildingId}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Удалить месяц сдачи
                    </button>
                    {!selectedBuildingId && (
                      <p className="text-xs text-red-600 self-center">{tMeter('selectBuildingToSave')}</p>
                    )}
                  </div>
                </div>
              </details>
            </div>
          );
        })()}

        {loadError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-base text-red-700 shadow-sm animate-fade-in">
            {loadError}
          </div>
        )}

        {isLoadingData ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center shadow-sm animate-pulse">
            <p className="text-gray-600 text-lg font-medium">{tMeter('loadingApartmentsAndReadings')}</p>
          </div>
        ) : apartments.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center shadow-sm">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <p className="text-gray-600 text-lg font-medium">{tMeter('noApartmentsFound')}</p>
          </div>
        ) : visibleApartments.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center shadow-sm">
            <p className="text-gray-600 text-lg font-medium">Нет квартир для выбранного дома</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-240 text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <tr>
                    <th
                      className="px-4 py-3 text-left font-semibold cursor-pointer select-none"
                      onClick={() => {
                        if (sortColumn === 'number') setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                        else { setSortColumn('number'); setSortDirection('asc'); }
                      }}
                    >
                      Квартира
                      {sortColumn === 'number' && (
                        <span className="ml-1 inline-block align-middle">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th
                      className="px-4 py-3 text-left font-semibold cursor-pointer select-none"
                      onClick={() => {
                        if (sortColumn === 'building') setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                        else { setSortColumn('building'); setSortDirection('asc'); }
                      }}
                    >
                      Дом
                      {sortColumn === 'building' && (
                        <span className="ml-1 inline-block align-middle">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">Счётчики</th>
                    <th className="px-4 py-3 text-center font-semibold">Показания</th>
                    <th className="px-4 py-3 text-right font-semibold">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
            {visibleApartments.map((apartment) => {
                const buildingName = buildingNameById[apartment.buildingId] ?? tMeter('notSpecified');
                const meters = metersByApartmentId[apartment.id] || [];
                const apartmentReadings = readingsByApartmentId[apartment.id] || [];
                const dedupedMeters = meters.reduce<Meter[]>((acc, meter) => {
                  const normalizedName = meter.name?.toLowerCase() === 'hwm' ? 'hwm' : meter.name?.toLowerCase() === 'cwm' ? 'cwm' : meter.id;
                  if (!acc.some((item) => (item.name?.toLowerCase() || item.id) === normalizedName)) {
                    acc.push(meter);
                  }
                  return acc;
                }, []);
                const grouped = apartmentReadings.reduce((acc, reading) => {
                  const key = `${reading.year}-${String(reading.month).padStart(2, '0')}`;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(reading);
                  return acc;
                }, {} as Record<string, MeterReading[]>);
                const sortedKeys = Object.keys(grouped).sort((a, b) => {
                  const [ya, ma] = a.split('-').map(Number);
                  const [yb, mb] = b.split('-').map(Number);
                  return yb - ya || mb - ma;
                });
                return (
                  <>
                    <tr key={`${apartment.id}-main`} className="align-top bg-white transition hover:bg-blue-50/20">
                      <td className="px-4 py-4">
                        <div className="text-lg font-bold text-gray-900">#{apartment.number}</div>
                      </td>
                      <td className="px-4 py-4 text-gray-900">{buildingName}</td>
                      <td className="px-4 py-4 w-full">
                        {dedupedMeters.length > 0 ? (
                          <div>
                            <div className="flex flex-col items-start gap-2">
                              {dedupedMeters.map((meter) => {
                                const isCold = meter.name?.toLowerCase() === 'cwm';
                                return (
                                  <div key={meter.id} className="flex flex-col items-start gap-1">
                                    <div
                                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                                        isCold
                                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                                          : 'border-rose-200 bg-rose-50 text-rose-700'
                                      }`}
                                    >
                                      <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isCold ? 'bg-blue-500' : 'bg-rose-500'}`} />
                                      <span>{getMeterDisplayName(meter)}</span>
                                      <span className="text-gray-400">•</span>
                                      <span className="font-medium text-gray-900">{getApartmentMeterSerial(apartment, meter) || 'без номера'}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                            Счётчики не найдены
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {(() => {
                          // Определяем текущий месяц и год
                          const now = new Date();
                          const curMonth = now.getMonth() + 1;
                          const curYear = now.getFullYear();
                          // Период сдачи для дома
                          const building = buildings.find(b => b.id === apartment.buildingId);
                          const openDate = building?.waterSubmissionOpenDate ? new Date(building.waterSubmissionOpenDate) : null;
                          const closeDate = building?.waterSubmissionCloseDate ? new Date(building.waterSubmissionCloseDate) : null;
                          // Есть ли показания за этот месяц
                          const readingsThisMonth = apartmentReadings.filter(r => r.year === curYear && r.month === curMonth);
                          const allSubmitted = dedupedMeters.length > 0 && readingsThisMonth.length === dedupedMeters.length;
                          let status: 'green' | 'yellow' | 'red' = 'yellow';
                          let tooltip = '';
                          if (allSubmitted) {
                            status = 'green';
                            tooltip = 'Показания сданы';
                          } else if (closeDate && now > closeDate) {
                            status = 'red';
                            tooltip = 'Период сдачи закрыт, показания не сданы';
                          } else {
                            status = 'yellow';
                            tooltip = 'Показания ещё не сданы';
                          }
                          // Формат месяца сдачи как YYYY/MM
                          let displayMonth = curMonth;
                          let displayYear = curYear;
                          if (openDate) {
                            displayMonth = openDate.getMonth() + 1;
                            displayYear = openDate.getFullYear();
                          }
                          const monthStr = `${displayYear}/${String(displayMonth).padStart(2, '0')}`;
                          return (
                            <div className="flex flex-col items-center gap-1">
                              <span title={tooltip} className={`inline-block w-4 h-4 rounded-full border-2 ${
                                status === 'green' ? 'bg-green-400 border-green-500' : status === 'yellow' ? 'bg-yellow-300 border-yellow-500' : 'bg-red-400 border-red-500'
                              }`} />
                              <div className="flex flex-col gap-1 mt-1">
                                {dedupedMeters.map((meter) => {
                                  const latestReading = getLatestReadingForMeter(apartmentReadings, meter.id);
                                  return (
                                    <div key={meter.id} className="text-xs text-gray-700">
                                      {latestReading
                                        ? `Пред: ${formatThreeDecimals(latestReading.previousValue)} • Тек: ${formatThreeDecimals(latestReading.currentValue)} • Расход: ${formatThreeDecimals(latestReading.consumption)}`
                                        : 'Пред: — • Тек: — • Расход: —'}
                                    </div>
                                  );
                                })}
                              </div>
                              <span className="text-xs text-gray-500 mt-1">{monthStr}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                              openHistoryIds.has(apartment.id)
                                ? 'border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200'
                                : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                            title="История показаний"
                            onClick={() => toggleHistory(apartment.id)}
                          >
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                              <path d="M9 17v-6m3 6V7m3 10v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M3 8.828A2 2 0 0 1 4.414 8.414L11.586 1.242A2 2 0 0 1 13 1.828V3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9H4a2 2 0 0 1-1.172-.414" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 transition hover:bg-blue-100"
                            title="Edit meters"
                            onClick={() => openEditModal(apartment.id)}
                          >
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15H9v-3L18.5 2.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                      

                    {openHistoryIds.has(apartment.id) && (
                    <tr key={`${apartment.id}-history`} className="bg-slate-50/60">
                      <td colSpan={5} className="px-6 pb-6 pt-4">
                        {apartmentReadings.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
                            Нет показаний
                          </div>
                        ) : (
                          <div className="space-y-3">
                                {sortedKeys.map((key) => {
                                  const [year, month] = key.split('-').map(Number);
                                  const label = `${year}. gads ${String(month).padStart(2, '0')}`;
                                  const readingsInMonth = grouped[key];
                                  const showConsumption = isPreviousCalendarMonth(year, month);

                                  return (
                                    <details key={key} className="group/month overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-bold text-slate-900 transition hover:bg-slate-50">
                                        <div className="flex items-center gap-3">
                                          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-xl bg-slate-100 px-2 text-xs font-bold text-slate-600">
                                            {String(month).padStart(2, '0')}
                                          </span>
                                          <span>{label}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            title="Удалить все показания за месяц"
                                            className="p-1 rounded hover:bg-red-100 text-red-600 transition"
                                            onClick={e => {
                                              e.stopPropagation();
                                              setDeleteMulti({
                                                apartmentId: apartment.id,
                                                apartmentNumber: apartment.number,
                                                period: label,
                                                left: readingsInMonth[0] || null,
                                                right: readingsInMonth[1] || null,
                                              });
                                            }}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                          </button>
                                          <svg className="h-4 w-4 text-slate-500 transition-transform group-open/month:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </div>
                                      </summary>
                                      <div className="border-t border-slate-100 bg-white p-4">
                                        <table className="w-full text-xs text-slate-700">
                                          <thead>
                                            <tr className="border-b border-slate-100 text-slate-500">
                                              <th className="px-2 py-2 text-left font-semibold">Счётчик</th>
                                              <th className="px-2 py-2 text-left font-semibold">Дата</th>
                                              <th className="px-2 py-2 text-right font-semibold">Предыдущее</th>
                                              <th className="px-2 py-2 text-right font-semibold">Текущее</th>
                                              <th className="px-2 py-2 text-right font-semibold">Расход</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {readingsInMonth.map((reading) => (
                                              <tr key={reading.id} className="border-b border-slate-50 last:border-b-0">
                                                <td className="px-2 py-2 font-semibold text-slate-900">
                                                  {meterById[reading.meterId] ? getMeterDisplayName(meterById[reading.meterId]) : reading.meterId}
                                                </td>
                                                <td className="px-2 py-2">{formatDateTime(reading.submittedAt)}</td>
                                                <td className="px-2 py-2 text-right">{formatThreeDecimals(reading.previousValue)}</td>
                                                <td className="px-2 py-2 text-right font-bold text-slate-900">{formatThreeDecimals(reading.currentValue)}</td>
                                                <td className="px-2 py-2 text-right">
                                                  {showConsumption ? formatThreeDecimals(reading.consumption) : '—'}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </details>
                                  );
                                })}
                          </div>
                        )}
                      </td>
                    </tr>
                    )}
                  </>
                );
              })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <MeterDetailsModal
          isOpen={editModalOpen}
          meters={editMeters}
          serials={editSerials}
          checks={editChecks}
          onChangeSerial={(meterId, value) => setEditSerials((prev) => ({ ...prev, [meterId]: value }))}
          onChangeCheck={(meterId, value) => setEditChecks((prev) => ({ ...prev, [meterId]: value }))}
          onClose={() => setEditModalOpen(false)}
          onSave={handleSaveMeters}
        />
        <ConfirmationDialog
          isOpen={Boolean(deleteTarget)}
          title={tMeter('deleteReading')}
          description={tMeter('confirmDeleteReading')}
          details={
            deleteTarget
              ? [
                  `${tMeter('apartment')}: ${deleteTarget.apartmentNumber}`,
                  `${tMeter('meter')}: ${deleteTarget.meterName}`,
                  `${tMeter('period')}: ${deleteTarget.period}`,
                ]
              : []
          }
          confirmLabel={tMeter('delete')}
          confirmVariant="danger"
          loading={Boolean(deletingReadingId)}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteReading}
        />

        <ConfirmationDialog
          isOpen={Boolean(deleteMulti)}
          title={tMeter('deleteReadings')}
          description={tMeter('selectReadingsToDelete')}
          details={deleteMulti ? [`${tMeter('apartment')}: ${deleteMulti.apartmentNumber}`, `${tMeter('period')}: ${deleteMulti.period}`] : []}
          confirmLabel={tMeter('deleteSelected')}
          confirmVariant="danger"
          loading={Boolean(deletingReadingId)}
          onCancel={() => setDeleteMulti(null)}
          onConfirm={handleDeleteMultiConfirm}
        >
          {deleteMulti && (
            <div className="mt-4 space-y-3 bg-gray-100 p-4 rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteMultiLeft}
                  onChange={(e) => setDeleteMultiLeft(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-300 cursor-pointer"
                />
                <span className="text-sm text-gray-900">
                  {deleteMulti.left ? (meterById[deleteMulti.left.meterId] ? getMeterDisplayName(meterById[deleteMulti.left.meterId]) : deleteMulti.left.meterId) : '-'}
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteMultiRight}
                  onChange={(e) => setDeleteMultiRight(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-300 cursor-pointer"
                />
                <span className="text-sm text-gray-900">
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
