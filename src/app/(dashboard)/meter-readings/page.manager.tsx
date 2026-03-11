"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { AccessError } from "@/shared/components/AccessError";
import { useTranslations } from "next-intl";
import * as XLSX from "xlsx";
import { getApartmentsByCompany } from "@/modules/apartments/services/apartmentsService";
import { getBuildingsByCompany } from "@/modules/invoices/services/buildings/services/buildingsService";
import { getMeterReadingsByCompany, getMetersByApartment, deleteMeterReading } from "@/modules/meters/services/metersService";
import { updateMeter } from "@/modules/meters/services/metersService";
import { ConfirmationDialog } from "@/shared/components/ui/ConfirmationDialog";
import { toast } from "react-toastify";
import type { Apartment, Building, Meter, MeterReading } from "@/shared/types";
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
const getMeterDisplayName = (meter?: Meter | null): string => {
  if (!meter) return '';
  const name = meter.name?.toString().trim() ?? '';
  if (!name) return meter.serialNumber?.trim() || meter.id || '';
  const code = name.toLowerCase();
  if (code === 'hwm') return 'ГВС';
  if (code === 'cwm') return 'ХВС';
  return name;
};
// ...existing code...
// Тип для waterReadings внутри apartments
type WaterReading = {
  meterId: string;
  serialNumber?: string;
  checkDueDate?: string;
  currentValue?: number;
  previousValue?: number;
  submittedAt?: string | Date;
  // Добавьте другие поля по необходимости
};


export default function MeterReadingsManagerPage() {
    // Состояния для модального окна редактирования счетчиков
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editApartmentId, setEditApartmentId] = useState<string|null>(null);
    const [editMeters, setEditMeters] = useState<Meter[]>([]);
    const [editSerials, setEditSerials] = useState<Record<string, string>>({});
    const [editChecks, setEditChecks] = useState<Record<string, string>>({});
      // Открыть модалку по id квартиры и подставить значения
      const openApartmentById = (apartmentId: string) => {
        const apartment = apartmentById[apartmentId];
        if (!apartment) return;
        setEditApartmentId(apartmentId);
        const meters = metersByApartmentId[apartmentId] || [];
        setEditMeters(meters);
        setEditSerials(Object.fromEntries(meters.map(m => {
          const wr = apartment?.waterReadings?.find(w => w.meterId === m.id);
          return [m.id, wr?.serialNumber || ''];
        })));
        setEditChecks(Object.fromEntries(meters.map(m => {
          const wr = apartment?.waterReadings?.find(w => w.meterId === m.id);
          return [m.id, wr?.checkDueDate ? (typeof wr.checkDueDate === 'string' ? wr.checkDueDate : wr.checkDueDate?.toISOString().slice(0,10)) : ''];
        })));
        setEditModalOpen(true);
      };
    // Открыть модалку для квартиры
    const openEditModal = (apartmentId: string) => {
      setEditApartmentId(apartmentId);
      const meters = metersByApartmentId[apartmentId] || [];
      setEditMeters(meters);
      const apartment = apartmentById[apartmentId];
      setEditSerials(Object.fromEntries(meters.map(m => {
        const wr = apartment?.waterReadings?.find(w => w.meterId === m.id);
        return [m.id, wr?.serialNumber || ''];
      })));
      setEditChecks(Object.fromEntries(meters.map(m => {
        const wr = apartment?.waterReadings?.find(w => w.meterId === m.id);
        return [m.id, wr?.checkDueDate ? (typeof wr.checkDueDate === 'string' ? wr.checkDueDate : wr.checkDueDate?.toISOString().slice(0,10)) : ''];
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
        // Копия waterReadings
        const waterReadings: WaterReading[] = Array.isArray(apartment.waterReadings) ? [...apartment.waterReadings] : [];
        for (const meter of editMeters) {
          const serial = editSerials[meter.id] || '';
          const checkDate = editChecks[meter.id] || '';
          let updated = false;
          waterReadings.forEach((wr, idx) => {
            if (wr.meterId === meter.id) {
              waterReadings[idx] = {
                ...wr,
                serialNumber: serial,
                checkDueDate: checkDate,
              };
              updated = true;
            }
          });
          if (!updated) {
            waterReadings.push({
              meterId: meter.id,
              serialNumber: serial,
              checkDueDate: checkDate,
            });
          }
        }
        // Сохранить waterReadings в apartments
        const mod = await import('@/modules/apartments/services/apartmentsService');
        await mod.updateApartment(editApartmentId, { waterReadings });
        toast.success('Сохранено!');
        // Обновить данные квартиры после сохранения
        const aData = await getApartmentsByCompany(user.companyId);
        setApartments(aData);
        // Найти обновлённую квартиру
        const updatedApartment = aData.find(a => a.id === editApartmentId);
        if (updatedApartment && Array.isArray(updatedApartment.waterReadings)) {
          setEditSerials(Object.fromEntries(editMeters.map(m => {
            const wr = updatedApartment.waterReadings.find(w => w.meterId === m.id);
            return [m.id, wr?.serialNumber || ''];
          })));
          setEditChecks(Object.fromEntries(editMeters.map(m => {
            const wr = updatedApartment.waterReadings.find(w => w.meterId === m.id);
            return [m.id, wr?.checkDueDate ? (typeof wr.checkDueDate === 'string' ? wr.checkDueDate : wr.checkDueDate.toISOString().slice(0,10)) : ''];
          })));
        }
        setEditModalOpen(false);
      } catch (e: any) {
        toast.error(e?.message || e?.toString() || 'Ошибка при сохранении!');
      }
    };
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

  // Если есть только один дом, выбираем его автоматически
  useEffect(() => {
    if (!selectedBuildingId && buildings.length === 1) {
      setSelectedBuildingId(buildings[0].id);
    }
  }, [selectedBuildingId, buildings]);

  // --- Состояния для ручного выбора дат периода сдачи показаний (перенесено из рендера) ---
  const [manualPeriod, setManualPeriod] = useState<{from: string, to: string} | null>(null);
  useEffect(() => {
    setManualPeriod(null);
  }, [selectedBuildingId, readings.length]);

  // Состояния для редактирования периода сдачи показаний ---
  const [editOpenDate, setEditOpenDate] = useState<string>('');
  const [editCloseDate, setEditCloseDate] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isMonthly, setIsMonthly] = useState<boolean>(true);
  // Синхронизировать с выбранным домом
  useEffect(() => {
    if (!selectedBuildingId) {
        setEditOpenDate(''); setEditCloseDate('');
      return;
    }
    const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
    setEditOpenDate(selectedBuilding?.waterSubmissionOpenDate || '');
    setEditCloseDate(selectedBuilding?.waterSubmissionCloseDate || '');
      setIsMonthly(selectedBuilding?.waterSubmissionIsMonthly !== false);
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
      t('apartment'),
      t('building'),
      t('meter'),
      t('period'),
      t('submittedAt'),
      t('previousValue'),
      t('currentValue'),
      t('consumption'),
      t('isMissing'),
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
      row.isMissing ? t('yes') : t('no'),
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
    if (typeof sheetName !== 'string' || !sheetName.trim()) sheetName = t('readings');
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-blue-500 border-t-blue-300 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">{t('loading')}</p>
        </div>
      </div>
    );
  }
  if (!user) {
    return <AccessError type="loginRequired" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white text-gray-900">
      <Header userName={user.name || user.email || t('user')} userEmail={user.email} onLogout={handleLogout} pageTitle={t('waterReadings')} />

      <main className="max-w-7xl mx-auto px-4 py-10">
        {/* Верхняя панель: фильтр и экспорт */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12">
          <div className="flex-1 max-w-sm">
            <label className="block text-sm font-semibold text-gray-700 mb-3" htmlFor="building-select">
              {t('selectBuilding') !== 'dashboard.meterReadings.selectBuilding' ? t('selectBuilding') : 'Выбрать дом'}
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
              onClick={handleExportCsv}
              disabled={exportRows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              CSV
            </button>
            <button
              type="button"
              onClick={handleExportXlsx}
              disabled={exportRows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-blue-600 hover:to-blue-700 hover:shadow-xl transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              XLSX
            </button>
          </div>
        </div>

        {/* Основная часть: период сдачи показаний */}
        {(() => {
          // Собираем все показания по квартирам выбранного дома (или по всем квартирам, если фильтр не выбран)
          const filteredApartments = apartments.filter(apartment => !selectedBuildingId || apartment.buildingId === selectedBuildingId);
          const allReadings = readings.filter(r => filteredApartments.some(a => a.id === r.apartmentId));
          let minDateAll = null, maxDateAll = null;
          if (allReadings.length > 0) {
            const allTimestamps = allReadings
              .map(r => toTimestampMs(r.submittedAt))
              .filter(ts => !!ts)
              .sort((a, b) => a - b);
            if (allTimestamps.length > 0) {
              minDateAll = new Date(allTimestamps[0]);
              maxDateAll = new Date(allTimestamps[allTimestamps.length - 1]);
            }
          }
          // Получаем выбранный дом
          const selectedBuilding = selectedBuildingId ? buildings.find(b => b.id === selectedBuildingId) : null;
          // Сохранение изменений
          const handleSaveDays = async () => {
            console.log('handleSaveDays called', { editOpenDate, editCloseDate, selectedBuilding });
            if (!selectedBuilding) {
              console.error('Нет выбранного дома!');
              return;
            }
            setIsSaving(true);
            try {
              // Вычисляем день месяца из даты закрытия
              let closeDay: number | undefined = undefined;
              if (editCloseDate) {
                const d = new Date(editCloseDate);
                if (!isNaN(d.getTime())) closeDay = d.getDate();
              }
              const update: any = {
                waterSubmissionOpenDate: editOpenDate || undefined,
                waterSubmissionCloseDate: editCloseDate || undefined,
              };
              // Удаляем все undefined поля
              Object.keys(update).forEach(key => update[key] === undefined && delete update[key]);
              const mod = await import('@/modules/invoices/services/buildings/services/buildingsService');
              await mod.updateBuilding(selectedBuilding.id, update);
              toast.success('Период сдачи показаний успешно сохранён!');
              // Обновить данные о домах после сохранения
              const bData = await getBuildingsByCompany(user.companyId);
              setBuildings(bData);
            } catch (e) {
              console.error('Ошибка при сохранении периода сдачи:', e);
              toast.error('Ошибка при сохранении периода сдачи!');
            } finally {
              setIsSaving(false);
            }
          };

          // Вычисляем отображаемые даты
          let displayFrom = minDateAll, displayTo = maxDateAll;
          if (manualPeriod && manualPeriod.from && manualPeriod.to) {
            displayFrom = new Date(manualPeriod.from);
            displayTo = new Date(manualPeriod.to);
          }

          return (
            <div className="mb-12">
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white shadow-md p-6 lg:p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{t('submissionPeriodForBuilding')}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {editOpenDate && editCloseDate
                        ? `${new Date(editOpenDate).toLocaleDateString('ru-RU')} — ${new Date(editCloseDate).toLocaleDateString('ru-RU')}`
                        : 'Даты не установлены'
                      }
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <label className="block">
                    <span className="text-sm font-semibold text-gray-700 mb-2 block">{t('openDate')}</span>
                    <input
                      type="date"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm"
                      value={editOpenDate}
                      onChange={e => setEditOpenDate(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-gray-700 mb-2 block">{t('closeDate')}</span>
                    <input
                      type="date"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm"
                      value={editCloseDate}
                      onChange={e => setEditCloseDate(e.target.value)}
                    />
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSaveDays}
                    type="button"
                    disabled={isSaving || !editOpenDate || !editCloseDate || !selectedBuildingId}
                  >
                    {isSaving ? 'Сохранение...' : t('save')}
                  </button>
                  {!selectedBuildingId && (
                    <p className="text-xs text-red-600 self-center">{t('selectBuildingToSave')}</p>
                  )}
                </div>
              </div>
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
            <p className="text-gray-600 text-lg font-medium">{t('loadingApartmentsAndReadings')}</p>
          </div>
        ) : apartments.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center shadow-sm">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <p className="text-gray-600 text-lg font-medium">{t('noApartmentsFound')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {apartments
              .filter(apartment => !selectedBuildingId || apartment.buildingId === selectedBuildingId)
              .map((apartment) => {
                const buildingName = buildingNameById[apartment.buildingId] ?? t('notSpecified');
                const meters = metersByApartmentId[apartment.id] || [];
                const apartmentReadings = readings.filter(r => r.apartmentId === apartment.id);
                return (
                  <div key={apartment.id} className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-md hover:shadow-lg hover:border-blue-300 transition-all duration-300 group">
                    {/*Заголовок с номером квартиры*/}
                    <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-gray-200">
                      <div className="flex-1 min-w-0">
                        <div className="text-3xl font-bold text-gray-900 mb-1">{apartment.number}</div>
                        <p className="text-sm text-gray-600">{t('building')}: <span className="text-gray-800 font-medium">{buildingName}</span></p>
                      </div>
                      <button
                        className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition shadow-sm group-hover:shadow-md"
                        title="Edit meters"
                        onClick={() => openEditModal(apartment.id)}
                      >
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15H9v-3L18.5 2.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>

                    {/* Модальное окно редактирования счетчиков */}
                    {editModalOpen && editApartmentId === apartment.id && (
                      <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/10"
                        onClick={e => {
                          if (e.target === e.currentTarget) setEditModalOpen(false);
                                    }}
                                  >
                                    <div className="relative bg-white rounded-2xl shadow-xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-200">
                                      <button
                                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                        type="button"
                                        onClick={() => setEditModalOpen(false)}
                                      >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                      </button>
                                      <h3 className="text-2xl font-bold text-gray-900 mb-6 pr-8">Данные счетчиков</h3>
                                      {editMeters.length === 0 ? (
                                        <p className="text-gray-600 text-center py-8">Счетчики не найдены</p>
                                      ) : (
                                        <form onSubmit={e => { e.preventDefault(); handleSaveMeters(); }} className="space-y-6">
                                          {editMeters.map(meter => (
                                            <div key={meter.id} className="pb-6 border-b border-gray-200 last:border-b-0">
                                              <h4 className="text-sm font-bold text-gray-700 mb-4 px-3 py-2 bg-gray-100 rounded-lg">
                                                {meter.name && meter.name.toLowerCase() === 'hwm' ? 'Горячая вода (ГВС)' : 'Холодная вода (ХВС)'}
                                              </h4>
                                              <div className="space-y-4">
                                                <label className="block">
                                                  <span className="text-sm font-semibold text-gray-700 mb-2 block">Номер счетчика</span>
                                                  <input
                                                    type="text"
                                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition placeholder-gray-400"
                                                    placeholder="Введите номер"
                                                    value={editSerials[meter.id] || ''}
                                                    onChange={e => setEditSerials(prev => ({ ...prev, [meter.id]: e.target.value }))}
                                                  />
                                                </label>
                                                <label className="block">
                                                  <span className="text-sm font-semibold text-gray-700 mb-2 block">Дата проверки</span>
                                                  <input
                                                    type="date"
                                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
                                                    value={editChecks[meter.id] || ''}
                                                    onChange={e => setEditChecks(prev => ({ ...prev, [meter.id]: e.target.value }))}
                                                  />
                                                </label>
                                              </div>
                                            </div>
                                          ))}
                                          <div className="flex gap-3 pt-4">
                                            <button
                                              type="button"
                                              className="flex-1 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-900 font-semibold hover:bg-gray-200 transition"
                                              onClick={() => setEditModalOpen(false)}
                                            >
                                              Отмена
                                            </button>
                                            <button
                                              type="submit"
                                              className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-md"
                                            >
                                              Сохранить
                                            </button>
                                          </div>
                                        </form>
                                      )}
                                    </div>
                                  </div>
                                )}

                    {/* Показание по месяцам */}
                    <div className="mt-6 space-y-3">
                      {(() => {
                        if (apartmentReadings.length === 0) {
                          return (
                            <div className="text-center py-8 text-gray-500">
                              <p className="text-sm">Нет показаний</p>
                            </div>
                          );
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
                              const readingsInMonth = grouped[key];
                              return (
                                <details key={key} className="group border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition">
                                  <summary className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition font-semibold text-gray-900">
                                    <span>{label}</span>
                                    <svg className="w-5 h-5 text-gray-600 group-open:rotate-180 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                  </summary>
                                  <div className="bg-white p-4 space-y-3 border-t border-gray-200">
                                    {readingsInMonth.map(reading => (
                                      <div key={reading.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm text-gray-600">
                                            <span className="font-semibold text-gray-900">{meterById[reading.meterId] ? getMeterDisplayName(meterById[reading.meterId]) : reading.meterId}</span>
                                          </p>
                                          <p className="text-xs text-gray-500 mt-1">{formatDateTime(reading.submittedAt)}</p>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                          <div className="text-center">
                                            <p className="text-xs text-gray-500">Предыдущее</p>
                                            <p className="font-semibold text-gray-900">{reading.previousValue}</p>
                                          </div>
                                          <div className="text-center">
                                            <p className="text-xs text-gray-500">Текущее</p>
                                            <p className="font-semibold text-gray-900">{reading.currentValue}</p>
                                          </div>
                                        </div>
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
