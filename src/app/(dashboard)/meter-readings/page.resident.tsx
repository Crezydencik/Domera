'use client';

import { useAuth } from '@/shared/hooks/useAuth';
import { useEffect, useMemo, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { getApartmentsByCompany, getApartment } from '@/modules/apartments/services/apartmentsService';
import { getBuildingsByCompany, getBuilding } from '@/modules/invoices/services/buildings/services/buildingsService';
import {
  deleteMeterReading,
  getLastMeterReading,
  getMeterReadingsByCompany,
  getMeterReadingsByApartment,
  getMetersByApartment,
  submitMeterReading,
  updateMeter,
} from '@/modules/meters/services/metersService';
import { METER_READING_RULES } from '@/shared/constants';
import { getCurrentMonthYear, isMeterSubmissionAllowed } from '@/shared/lib/utils';
import { validateConsumption, validateMeterReading } from '@/shared/validation';
import { ConfirmationDialog } from '@/shared/components/ui/ConfirmationDialog';
import { toast } from 'react-toastify';
import type { Apartment, Building, Meter, MeterReading } from '@/shared/types';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { logout } from '../../../modules/auth/services/authService';
import Header from '../../../shared/components/layout/heder';
import { MeterInputBlock } from '@/shared/components/ui/MeterInputBlock';




type ReadingTimestampLike =
  | Date
  | string
  | { toDate?: () => Date; seconds?: number; nanoseconds?: number }
  | null
  | undefined;


interface DeleteReadingTarget {
  apartmentId: string;
  apartmentNumber: string;
  readingId: string;
  meterName: string;
  period: string;
}


const toTimestampMs = (value: ReadingTimestampLike): number => {
  if (!value) return 0;
  
  if (value instanceof Date) {
    return value.getTime();
  }
  
  if (typeof value === 'string') {
    const ts = new Date(value).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  }

  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }

  return 0;
};

const formatDateOnly = (value: string | Date | undefined | null): string => {
  if (!value) return '—';
  try {
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  } catch (e) {
    return '—';
  }
};

const toInputDate = (value: string | Date | undefined | null): string => {
  if (!value) return '';
  try {
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return '';
    // format as yyyy-mm-dd for <input type="date" />
    return d.toISOString().slice(0, 10);
  } catch (e) {
    return '';
  }
};


const getReadingMeterName = (reading: MeterReading, meterMap: Record<string, Meter>): string => {
  const meter = meterMap[reading.meterId];
  return meter?.name || meter?.serialNumber || reading.meterId;
};

const getMeterDisplayName = (meter?: Meter | null): string => {
  if (!meter) return '';
  const name = meter.name?.toString().trim() ?? '';
  if (!name) return meter.serialNumber?.trim() || meter.id || '';
  const code = name.toLowerCase();
  if (code === 'hwm') return 'HWM';
  if (code === 'cwm') return 'CWM';
  return name;
};

const isHotMeter = (meter?: Meter | null): boolean => {
  if (!meter) return false;
  const name = meter.name?.toString().trim() ?? '';
  // explicit code check
  if (name.toLowerCase() === 'hwm') return true;
  if (name.toLowerCase() === 'cwm') return false;
  
  // fallback to heuristic on display name/serial
  const display = getMeterDisplayName(meter);
  return /гвс|gvs|hot|hotwater|гор/i.test(display);
};



const formatNumberDot = (value: number | string | undefined | null, decimals = 2): string => {
  if (value === undefined || value === null || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  const parts = abs.toFixed(decimals).split('.');
  const intPart = parts[0];
  const decPart = parts[1];
  const intWithSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${intWithSpaces}.${decPart}`;
};

const downloadTextFile = (content: string, fileName: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function MeterReadingsPage() {
  const { user, loading, isResident, isManagementCompany } = useAuth();
  
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [metersByApartmentId, setMetersByApartmentId] = useState<Record<string, Meter[]>>({});
  const [readings, setReadings] = useState<MeterReading[]>([]);
  
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState('');
  
  const [waterReadingIntegerByMeterId, setWaterReadingIntegerByMeterId] = useState<Record<string, string>>({});
  const [waterReadingFractionByMeterId, setWaterReadingFractionByMeterId] = useState<Record<string, string>>({});
  const [meterSerialInputByMeterId, setMeterSerialInputByMeterId] = useState<Record<string, string>>({});
  const [editingSerialByMeterId, setEditingSerialByMeterId] = useState<Record<string, boolean>>({});
  const [submittingReadingApartmentId, setSubmittingReadingApartmentId] = useState<string | null>(null);
  const [submitRetryLockedUntilByApartmentId, setSubmitRetryLockedUntilByApartmentId] = useState<Record<string, number>>({});
  const t = useTranslations('dashboard.meterReadings');
  const [meterCheckDateInputByMeterId, setMeterCheckDateInputByMeterId] = useState<Record<string, string>>({});
  const [editingCheckByMeterId, setEditingCheckByMeterId] = useState<Record<string, boolean>>({});
  const [forceSaveByMeterId, setForceSaveByMeterId] = useState<Record<string, boolean>>({});

  const setTimedSubmitError = (apartmentId: string, message: string, lockForMs: number = 15000) => {
    toast.error(message, {
      autoClose: lockForMs,
      toastId: `submit-error-${apartmentId}`,
    });

    if (lockForMs > 0) {
      setSubmitRetryLockedUntilByApartmentId((prev) => ({
        ...prev,
        [apartmentId]: Date.now() + lockForMs,
      }));
    }

    window.setTimeout(() => {
      setSubmitRetryLockedUntilByApartmentId((prev) => {
        if (!prev[apartmentId] || prev[apartmentId] > Date.now()) return prev;
        const next = { ...prev };
        delete next[apartmentId];
        return next;
      });
    }, lockForMs);
  };

  const showMeterError = (meterId: string, message: string) => {
    const safe = String(message).slice(0, 60).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
    const id = `meter-error-${meterId}-${safe}`;
    toast.error(message, { toastId: id, autoClose: 15000 });
  };

  const handleSaveMeterSerial = async (apartmentId: string, meterId: string) => {
    const pending = (meterSerialInputByMeterId[meterId] || '').trim();
    if (!pending) {
      toast.error('Введите номер счётчика');
      return;
    }

    // prevent saving if edits are not allowed here (residents)
    const meter0 = meterById[meterId];
    if (meter0 && !canEditMetaForMeter(meter0)) {
      const allowedForManagement = isManagementCompany && Boolean(forceSaveByMeterId[meterId]);
      if (!allowedForManagement) {
        showMeterError(meterId, t('editingMetaForbidden'));
        return;
      }
    }

    try {
      // ensure stored meter name uses English codes: 'hwm' (hot water meter) or 'cwm' (cold water meter)
      const meter = meterById[meterId];
      const nameCode = meter && isHotMeter(meter) ? 'hwm' : 'cwm';
      const options = { force: Boolean(forceSaveByMeterId[meterId]) };
      await updateMeter(meterId, { serialNumber: pending, name: nameCode }, options);
      // update local state so UI reflects saved serial immediately
      setMetersByApartmentId((prev) => {
        const next = { ...prev };
        const arr = (next[apartmentId] || []).map((m) => (m.id === meterId ? { ...m, serialNumber: pending, name: nameCode } : m));
        next[apartmentId] = arr;
        return next;
      });
      // turn off editing for this meter
      setEditingSerialByMeterId((prev) => ({ ...prev, [meterId]: false }));
      setForceSaveByMeterId((prev) => ({ ...prev, [meterId]: false }));
      // clear input
      setMeterSerialInputByMeterId((prev) => ({ ...prev, [meterId]: '' }));
      toast.success(t('submitSuccess'));
    } catch (err) {
      console.error('Failed to save meter serial:', err);
      const msg = err instanceof Error ? err.message : String(err);
      showMeterError(meterId, msg || t('submitError'));
    }
  };

    const handleSaveMeterCheckDate = async (apartmentId: string, meterId: string) => {
      const pending = (meterCheckDateInputByMeterId[meterId] || '').trim();
      if (!pending) {
        toast.error(t('enterCheckDate'));
        return;
      }

        // prevent saving if edits are not allowed here (residents)
        const meter0 = meterById[meterId];
        if (meter0 && !canEditMetaForMeter(meter0)) {
          const allowedForManagement = isManagementCompany && Boolean(forceSaveByMeterId[meterId]);
          if (!allowedForManagement) {
            showMeterError(meterId, t('editingMetaForbidden'));
            return;
          }
        }

      try {
        // save as ISO date string and ensure meter name code is stored in English
        const meter = meterById[meterId];
        const nameCode = meter && isHotMeter(meter) ? 'hwm' : 'cwm';
        const options = { force: Boolean(forceSaveByMeterId[meterId]) };
        await updateMeter(meterId, { checkDueDate: pending, name: nameCode }, options);
        setMetersByApartmentId((prev) => {
          const next = { ...prev };
          const arr = (next[apartmentId] || []).map((m) => (m.id === meterId ? { ...m, checkDueDate: pending, name: nameCode } : m));
          next[apartmentId] = arr;
          return next;
        });
        setEditingCheckByMeterId((prev) => ({ ...prev, [meterId]: false }));
        setMeterCheckDateInputByMeterId((prev) => ({ ...prev, [meterId]: '' }));
        setForceSaveByMeterId((prev) => ({ ...prev, [meterId]: false }));
        toast.success(t('meterReadings.submitSuccess'));
      } catch (err) {
        console.error('Failed to save meter check date:', err);
        const msg = err instanceof Error ? err.message : String(err);
        showMeterError(meterId, msg || t('submitError'));
      }
    };

  const isSubmitRetryLocked = (apartmentId: string): boolean => {
    const lockedUntil = submitRetryLockedUntilByApartmentId[apartmentId] ?? 0;
    return lockedUntil > Date.now();
  };

 

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

  const canEditMetaForMeter = (meter?: Meter | null): boolean => {
    if (!meter) return false;
    const hasSerial = Boolean(meter.serialNumber);
    const hasCheck = Boolean(meter.checkDueDate);
    // allow one-time addition when either is missing
    if (!hasSerial || !hasCheck) return true;
    const due = Number(new Date(String(meter.checkDueDate)).getTime());
    if (Number.isNaN(due) || due <= 0) return false;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
    return Date.now() >= due - oneMonthMs;
  };

  // render a single reading card (or empty placeholder when reading is not present)
  const renderReadingCard = (reading?: MeterReading | null) => {
    if (!reading) {
      return (
        <div className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-900/50 p-3 min-h-16">
          <div className="text-sm text-gray-400">—</div>
        </div>
      );
    }

    const meter = meterById[reading.meterId];
    const meterName = getReadingMeterName(reading, meterById);
    const serial = meter?.serialNumber ?? '-';
    const value = formatNumberDot(reading.currentValue ?? 0, 3);
    const prevValue = formatNumberDot(reading.previousValue ?? 0, 3);
    const isHot = isHotMeter(meter);
    const colorClass = isHot ? 'text-red-400' : 'text-blue-300';

    const canEditMeta = canEditMetaForMeter(meter);

    return (
      <div className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-900/60 p-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/60 ${isHot ? 'ring-1 ring-red-700/40' : 'ring-1 ring-blue-700/30'}`}>
            <svg className={`h-5 w-5 ${isHot ? 'text-red-400' : 'text-blue-300'}`} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C12 2 7 9 7 13a5 5 0 0010 0c0-4-5-11-5-11z" />
            </svg>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              {editingSerialByMeterId[meter.id] ? (
                <span className="flex items-center gap-2">
                  <input
                    className="text-xs rounded bg-slate-800/60 px-1 py-0.5 text-slate-200"
                    value={meterSerialInputByMeterId[meter.id] ?? meter?.serialNumber ?? ''}
                    onChange={(e) => setMeterSerialInputByMeterId((prev) => ({ ...prev, [meter.id]: e.target.value }))}
                    placeholder={t('enterMeterSerial')}
                  />
                  <button
                    onClick={() => handleSaveMeterSerial(reading.apartmentId, meter.id)}
                    className="text-xs text-slate-300 hover:text-white"
                    title={t('save')}

                  >
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setEditingSerialByMeterId((prev) => ({ ...prev, [meter.id]: false }));
                      setForceSaveByMeterId((prev) => ({ ...prev, [meter.id]: false }));
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200"
                    title={t('cancel')}
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <span className="text-xs text-slate-400 flex items-center gap-2">
                  <span>Nr. {(() => {
                    // Найти waterReading для текущей квартиры и meterId
                    const apartment = apartments.find(a => a.id === reading.apartmentId);
                    const wr = apartment?.waterReadings?.find(w => w.meterId === meter.id);
                    return wr?.serialNumber || serial;
                  })()}</span>
                  {canEditMeta ? (
                    <button
                      onClick={() => {
                        setMeterSerialInputByMeterId((prev) => ({ ...prev, [meter.id]: meter?.serialNumber ?? '' }));
                        setEditingSerialByMeterId((prev) => ({ ...prev, [meter.id]: true }));
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200"
                      title={t('edit')}
                    >
                      ✎
                    </button>
                  ) : null}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400">
              {editingCheckByMeterId[meter.id] ? (
                <span className="flex items-center gap-2">
                  <input
                    type="date"
                    className="text-xs rounded bg-slate-800/60 px-1 py-0.5 text-slate-200"
                    value={meterCheckDateInputByMeterId[meter.id] ?? toInputDate(meter?.checkDueDate)}
                    onChange={(e) => setMeterCheckDateInputByMeterId((prev) => ({ ...prev, [meter.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => handleSaveMeterCheckDate(reading.apartmentId, meter.id)}
                    className="text-xs text-slate-300 hover:text-white"
                    title={t('save')}
                  >
                    ✓
                  </button>
                  {isManagementCompany && (
                    <label className="flex items-center gap-1 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={Boolean(forceSaveByMeterId[meter.id])}
                        onChange={(e) => setForceSaveByMeterId((prev) => ({ ...prev, [meter.id]: e.target.checked }))}
                      />
                      {t('force')}
                    </label>
                  )}
                  <button
                    onClick={() => {
                      setEditingCheckByMeterId((prev) => ({ ...prev, [meter.id]: false }));
                      setForceSaveByMeterId((prev) => ({ ...prev, [meter.id]: false }));
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200"
                    title={t('cancel')}
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>{t('checkDueDate')}: {formatDateOnly(meter?.checkDueDate)}</span>
                  {canEditMeta ? (
                    <button
                      onClick={() => {
                        setMeterCheckDateInputByMeterId((prev) => ({ ...prev, [meter.id]: toInputDate(meter?.checkDueDate) }));
                        setEditingCheckByMeterId((prev) => ({ ...prev, [meter.id]: true }));
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200"
                      title={t('edit')}
                    >
                      ✎
                    </button>
                  ) : null}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg font-semibold text-white">{value}</div>
          <div className="text-xs text-slate-400">{t('periodStart')}: {prevValue}</div>
        </div>
      </div>
    );
  };

  const getWaterMetersByApartment = useCallback((apartmentId: string): Meter[] => {
    return (metersByApartmentId[apartmentId] ?? []).filter((meter) => meter.type === 'water');
  }, [metersByApartmentId]);

  const getBuildingSubmissionOpenDay = (building?: Building): number => {
    if (!building) return METER_READING_RULES.SUBMISSION_OPEN_DAY;

    const value = building.waterSubmissionOpenDay;
    return typeof value === 'number' && value >= 1 && value <= 31
      ? value
      : METER_READING_RULES.SUBMISSION_OPEN_DAY;
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      setIsLoadingData(true);
      setLoadError('');

      try {
        let apartmentsData: typeof apartments = [];
        let buildingsData: Building[] = [];
        let readingsData: MeterReading[] = [];

        if (user.role === 'Resident' && user.apartmentId) {
          const apt = await getApartment(user.apartmentId);
          if (apt) {
            apartmentsData = [apt];
            if (apt.buildingId) {
              const b = await getBuilding(apt.buildingId);
              // DEBUG: вывод результата getBuilding
              console.log('DEBUG getBuilding result:', b, 'for id:', apt.buildingId);
              if (b) buildingsData = [b];
            }
            // defer reading fetch for faster initial render
            // readingsData = await getMeterReadingsByApartment(apt.id);
          }
        } else if (user.companyId) {
          // fetch apartments and buildings in parallel; readings and meters will be fetched afterwards
          const [aData, bData] = await Promise.all([
            getApartmentsByCompany(user.companyId),
            getBuildingsByCompany(user.companyId),
          ]);
          apartmentsData = aData;
          buildingsData = bData;
          // readingsData = await getMeterReadingsByCompany(user.companyId);
        }

        // Ensure apartments come from DB and include buildingId
        const visibleApartments = user.role === 'Resident' ? apartmentsData.filter((apartment) => apartment.id === user.apartmentId) : apartmentsData;

        // If some apartments reference buildings that weren't returned by getBuildingsByCompany
        // (e.g., legacy docs or missing companyId on building), fetch those buildings individually
        const existingBuildingIds = new Set(buildingsData.map((b) => b.id));
        const missingBuildingIds = Array.from(new Set(visibleApartments.map((a) => a.buildingId).filter(Boolean))).filter((id) => !existingBuildingIds.has(id));
        if (missingBuildingIds.length > 0) {
          const extraBuildings = await Promise.all(missingBuildingIds.map((id) => getBuilding(id)));
          buildingsData = [...buildingsData, ...extraBuildings.filter(Boolean) as Building[]];
        }


        // set apartments/buildings early so UI can render while we fetch heavier data
        setApartments(visibleApartments);
        setBuildings(buildingsData); // DEBUG: убрана фильтрация для проверки

        // fetch readings and meters in background (do not block initial render)
        (async () => {
          try {
            if (user.role === 'Resident' && user.apartmentId) {
              readingsData = await getMeterReadingsByApartment(user.apartmentId);
            } else if (user.companyId) {
              readingsData = await getMeterReadingsByCompany(user.companyId);
            }

            const visibleApartmentIds = new Set(visibleApartments.map((apartment) => apartment.id));
            const visibleReadings = readingsData.filter((reading) => visibleApartmentIds.has(reading.apartmentId));

            const meterEntries = await Promise.all(
              visibleApartments.map(async (apartment) => ({
                apartmentId: apartment.id,
                meters: await getMetersByApartment(apartment.id),
              }))
            );

            const currentMetersByApartmentId = meterEntries.reduce<Record<string, Meter[]>>((acc, entry) => {
              acc[entry.apartmentId] = entry.meters;
              return acc;
            }, {});

            setMetersByApartmentId(currentMetersByApartmentId);
            setReadings(visibleReadings);
          } catch (err) {
            console.error('Background load failed:', err);
            // surface non-blocking error
            setLoadError((err as Error).message ?? t('loadError'));
          } finally {
            setIsLoadingData(false);
          }
        })();
      } catch (error: unknown) {
        setLoadError(error instanceof Error ? error.message : t('loadError'));
        setIsLoadingData(false);
      }
    };

    loadData();
  }, [user]);



  const sortedReadings = useMemo(() => {
    // sort chronologically: oldest -> newest
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

  // Prefill submission inputs with the last submitted reading for the same meter (if present)
  useEffect(() => {
    if (!user) return;
    // only prefill for resident viewing their apartment (submission UI shown for residents)
    if (!isResident || !user.apartmentId) return;

    const apartmentId = user.apartmentId;
    const meters = getWaterMetersByApartment(apartmentId);
    const aptReadings = readingsByApartmentId[apartmentId] ?? [];

    // Новый алгоритм: ищем последнее показание сначала по meterId, если не найдено — по serialNumber
    setWaterReadingIntegerByMeterId((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const meter of meters) {
        // Найти последнее показание по meterId
        let last = aptReadings
          .filter(r => r.meterId === meter.id)
          .sort((a, b) => toTimestampMs(b.submittedAt) - toTimestampMs(a.submittedAt))[0];
        // Если не найдено — ищем по serialNumber
        if (!last && meter.serialNumber) {
          last = aptReadings
            .filter(r => {
              const m = meters.find(mtr => mtr.id === r.meterId);
              return m && m.serialNumber && m.serialNumber === meter.serialNumber;
            })
            .sort((a, b) => toTimestampMs(b.submittedAt) - toTimestampMs(a.submittedAt))[0];
        }
        let intPart = '0';
        if (last) {
          const currentVal = last.currentValue ?? 0;
          const parts = Number(currentVal).toFixed(3).split('.');
          intPart = parts[0] ?? '0';
        }
        next[meter.id] = intPart.replace(/\D/g, '').slice(0,6).padStart(6, '0');
        changed = true;
      }
      return changed ? next : prev;
    });

    setWaterReadingFractionByMeterId((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const meter of meters) {
        // Найти последнее показание по meterId
        let last = aptReadings
          .filter(r => r.meterId === meter.id)
          .sort((a, b) => toTimestampMs(b.submittedAt) - toTimestampMs(a.submittedAt))[0];
        // Если не найдено — ищем по serialNumber
        if (!last && meter.serialNumber) {
          last = aptReadings
            .filter(r => {
              const m = meters.find(mtr => mtr.id === r.meterId);
              return m && m.serialNumber && m.serialNumber === meter.serialNumber;
            })
            .sort((a, b) => toTimestampMs(b.submittedAt) - toTimestampMs(a.submittedAt))[0];
        }
        let fracPart = '000';
        if (last) {
          const currentVal = last.currentValue ?? 0;
          const parts = Number(currentVal).toFixed(3).split('.');
          fracPart = (parts[1] ?? '000').slice(0,3).padEnd(3, '0');
        }
        next[meter.id] = fracPart.replace(/\D/g, '').slice(0,3).padEnd(3, '0');
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [user, isResident, readingsByApartmentId, metersByApartmentId, getWaterMetersByApartment]);

  const firstReadingIdByMeterId = useMemo(() => {
    const byMeter = readings.reduce<Record<string, MeterReading[]>>((acc, reading) => {
      if (!acc[reading.meterId]) {
        acc[reading.meterId] = [];
      }
      acc[reading.meterId].push(reading);
      return acc;
    }, {});

    return Object.entries(byMeter).reduce<Record<string, string>>((acc, [meterId, meterReadings]) => {
      const first = [...meterReadings].sort(
        (a, b) =>
          toTimestampMs(a.submittedAt as ReadingTimestampLike) -
          toTimestampMs(b.submittedAt as ReadingTimestampLike)
      )[0];

      if (first) {
        acc[meterId] = first.id;
      }

      return acc;
    }, {});
  }, [readings]);

  const getEffectiveConsumption = useCallback((reading: MeterReading): number => {
    return firstReadingIdByMeterId[reading.meterId] === reading.id ? 0 : reading.consumption;
  }, [firstReadingIdByMeterId]);

  const apartmentCards = useMemo(() => {
    return apartments.map((apartment) => {
      const apartmentReadings = readingsByApartmentId[apartment.id] ?? [];
      // find most recent reading by timestamp
      const latestReading = apartmentReadings.reduce<MeterReading | undefined>((best, r) => {
        if (!best) return r;
        return toTimestampMs(r.submittedAt as ReadingTimestampLike) > toTimestampMs(best.submittedAt as ReadingTimestampLike) ? r : best;
      }, undefined as unknown as MeterReading | undefined) as MeterReading | undefined;
      const buildingName = buildingNameById[apartment.buildingId] ?? t('notSpecified');
      const monthsCount = new Set(
        apartmentReadings.map((reading) => `${reading.year}-${String(reading.month).padStart(2, '0')}`)
      ).size;

      return {
        apartment,
        buildingName,
        readings: apartmentReadings,
        latestReading,
        monthsCount,
      };
    });
  }, [apartments, readingsByApartmentId, buildingNameById]);

  const handleSubmitWaterReading = async (apartment: Apartment) => {
    if (isSubmitRetryLocked(apartment.id)) {
      const lockedUntil = submitRetryLockedUntilByApartmentId[apartment.id] ?? 0;
      const secondsLeft = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000));
      setTimedSubmitError(apartment.id, t('retryAvailableIn', { seconds: secondsLeft }), 15000);
      return;
    }

    // Проверка прав на отправку:
    // - Жилец (Resident) может отправлять показания для своей квартиры
    // - Управляющая компания (ManagementCompany) может отправлять при совпадении companyId
    // - Также допускаем явное право в tenants (permissions.includes('submitMeter'))
    const isTenantWithSubmit = Array.isArray(apartment.tenants)
      ? apartment.tenants.some((tenant) => tenant.userId === user?.uid && tenant.permissions?.includes('submitMeter'))
      : false;

    const canUserSubmit =
      (isResident && user?.apartmentId === apartment.id) ||
      (isManagementCompany && user?.companyId && Array.isArray(apartment.companyIds) && apartment.companyIds.includes(user.companyId)) ||
      isTenantWithSubmit;

    if (!canUserSubmit) {
      setTimedSubmitError(apartment.id, t('insufficientPermissions'), 15000);
      return;
    }

    const apartmentBuilding = buildings.find((building) => building.id === apartment.buildingId);
    const openDate = apartmentBuilding?.waterSubmissionOpenDate;
    const closeDate = apartmentBuilding?.waterSubmissionCloseDate;
    const fallbackOpenDay = apartmentBuilding?.waterSubmissionOpenDay;
    // Проверяем разрешён ли период сдачи показаний
    const canSubmit = isMeterSubmissionAllowed(openDate, closeDate, fallbackOpenDay);
    if (!canSubmit) {
      let periodMsg = openDate && closeDate
        ? `Подача показаний доступна с ${new Date(openDate).toLocaleDateString('ru-RU')} по ${new Date(closeDate).toLocaleDateString('ru-RU')}`
        : t('submissionAvailableFrom', { day: fallbackOpenDay || 25 });
      setTimedSubmitError(apartment.id, periodMsg, 15000);
      return;
    }

    const waterMeters = getWaterMetersByApartment(apartment.id).slice().sort((a, b) => Number(isHotMeter(a)) - Number(isHotMeter(b)));
    if (waterMeters.length === 0) {
      setTimedSubmitError(apartment.id, t('noWaterMetersConfigured'), 15000);
      return;
    }

    // Prevent duplicate submissions: for the same apartment and meter, only one submission per month is allowed
    const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
    const existingForApartment = readingsByApartmentId[apartment.id] ?? [];
    const alreadySubmittedMeters = waterMeters.filter((meter) =>
      existingForApartment.some((r) => r.meterId === meter.id && r.month === currentMonth && r.year === currentYear)
    );

    if (alreadySubmittedMeters.length > 0) {
      const names = alreadySubmittedMeters.map((m) => getMeterDisplayName(m)).join(', ');
      setTimedSubmitError(apartment.id, t('alreadySubmittedFor', { names }), 15000);
      return;
    }

    setSubmittingReadingApartmentId(apartment.id);

    try {

      // КЛИЕНТСКОЕ вычисление текущего месяца/года
      const { month, year } = getCurrentMonthYear();

            const preparedReadings = await Promise.all(
        waterMeters.map(async (meter) => {
          const meterLabel = getMeterDisplayName(meter);
          const lastReading = await getLastMeterReading(apartment.id, meter.id);
          const isFirstReading = !lastReading;
          const previousValue = lastReading?.currentValue ?? 0;

          // If user entered a serial number for this meter (one-time), persist it
          const pendingSerial = meterSerialInputByMeterId[meter.id];
          if (pendingSerial && !meter.serialNumber) {
            try {
              const options = { force: Boolean(forceSaveByMeterId[meter.id]) };
              await updateMeter(meter.id, { serialNumber: pendingSerial }, options);
            } catch (err) {
              console.warn('Failed to persist meter serial:', err);
            }
          }

          const intPart = (waterReadingIntegerByMeterId[meter.id] ?? '').replace(/\D/g, '').slice(0,5) || '0';
          let fracPart = (waterReadingFractionByMeterId[meter.id] ?? '').replace(/\D/g, '').slice(0,3);
          // pad fraction to 3 digits
          fracPart = fracPart.padEnd(3, '0');
          const rawValue = `${intPart}.${fracPart}`;
          const currentValue = Number(rawValue);

          // Для первого показания разрешаем любое положительное значение, расход = 0
          let nextConsumption = 0;
          if (isFirstReading) {
            if (currentValue < 0 || isNaN(currentValue)) {
              throw new Error(t('meterReadingError', { meterLabel, error: t('invalidValue') }));
            }
          } else {
            const meterReadingValidation = validateMeterReading(currentValue);
            if (!meterReadingValidation.isValid) {
              throw new Error(t('meterReadingError', { meterLabel, error: meterReadingValidation.error ?? t('invalidValue') }));
            }
            const consumptionValidation = validateConsumption(currentValue, previousValue);
            if (!consumptionValidation.isValid || typeof consumptionValidation.consumption !== 'number') {
              throw new Error(t('meterConsumptionError', { meterLabel, error: consumptionValidation.error ?? t('invalidConsumption') }));
            }
            nextConsumption = consumptionValidation.consumption;
          }

          return {
            companyId: user?.companyId ?? (Array.isArray(apartment.companyIds) ? apartment.companyIds[0] : undefined),
            buildingId: apartment.buildingId,
            apartmentId: apartment.id,
            meterId: meter.id,
            previousValue,
            currentValue,
            consumption: nextConsumption,
            month,
            year,
            submittedAt: new Date(),
          };
        })
      );

      const createdReadings: MeterReading[] = [];
      for (const reading of preparedReadings) {
        const created = await submitMeterReading(reading);
        createdReadings.push(created);
      }

      setReadings((prev) => [...createdReadings, ...prev]);
      setSubmitRetryLockedUntilByApartmentId((prev) => {
        if (!prev[apartment.id]) return prev;
        const next = { ...prev };
        delete next[apartment.id];
        return next;
      });
      setWaterReadingIntegerByMeterId((prev) => {
        const next = { ...prev };
        waterMeters.forEach((meter) => {
          delete next[meter.id];
        });
        return next;
      });
      setWaterReadingFractionByMeterId((prev) => {
        const next = { ...prev };
        waterMeters.forEach((meter) => {
          delete next[meter.id];
        });
        return next;
      });
      toast.success(t('meterReadingsSaved'));
    } catch (error: unknown) {
      setTimedSubmitError(
        apartment.id,
        error instanceof Error ? error.message : t('meterReadingsSubmitError'),
        15000
      );
    } finally {
      setSubmittingReadingApartmentId(null);
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
    return <div className="text-white">{t('loading')}</div>;
  }

  if (!user) {
    return <div className="text-white">{t('loginRequired')}</div>;
  }

  // Новый компонент для истории показаний в стиле аккордеона
  function MeterReadingsHistoryAccordion({ readings, meterById }) {
    // Группируем по годам и месяцам
    const grouped = readings.reduce((acc, r) => {
      const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
      acc[key] = acc[key] || [];
      acc[key].push(r);
      return acc;
    }, {});

    // Сортировка: сначала год по убыванию, потом месяц по убыванию
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      const [aYear, aMonth] = a.split('-').map(Number);
      const [bYear, bMonth] = b.split('-').map(Number);
      if (bYear !== aYear) return bYear - aYear;
      return bMonth - aMonth;
    });
    const [open, setOpen] = useState(sortedKeys[0] || '');

    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        {sortedKeys.map((key) => {
          const [year, month] = key.split('-');
          const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('ru', { month: 'long' });
          const monthLabel = `${year}. gads, ${monthName.charAt(0).toLowerCase() + monthName.slice(1)}`;
          const monthReadings = grouped[key];
          // Для каждого месяца ищем холодный и горячий счетчик
          const cold = monthReadings.find(r => !isHotMeter(meterById[r.meterId]));
          const hot = monthReadings.find(r => isHotMeter(meterById[r.meterId]));
          return (
            <div key={key} className="border-b last:border-b-0">
              <button
                className="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
                onClick={() => setOpen(open === key ? '' : key)}
              >
                <span className="font-semibold text-gray-900">{monthLabel}</span>
                <span className="text-blue-600 text-sm">{open === key ? '▲' : '▼'}</span>
              </button>
              {open === key && (
                <div className="px-4 py-3 space-y-3 bg-white">
                  {[cold, hot].map((reading, idx) => {
                    if (!reading) return null;
                    const meter = meterById[reading.meterId];
                    const isHot = isHotMeter(meter);
                    return (
                      <div key={reading.id} className="flex items-center gap-4 p-3 rounded border bg-gray-50">
                        <div className={`rounded-full p-2 ${ isHot ? 'bg-red-100' : 'bg-blue-100'}`}>
                          <svg width={24} height={24} fill="none" viewBox="0 0 24 24">
                            <circle cx={12} cy={12} r={10} fill={isHot ? '#f87171' : '#60a5fa'} />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-gray-500">{isHot ? t('hotWater') : t('coldWater')} Nr. <b>{meter?.serialNumber || '—'}</b></div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">{formatNumberDot(reading.currentValue ?? 0, 3)}</div>
                          <div className="text-xs text-gray-500">{t('periodStart')}: {formatNumberDot(reading.previousValue ?? 0, 3)}</div>
                          <div className="text-xs text-gray-500">{t('difference')}: <b>{formatNumberDot((reading.currentValue ?? 0) - (reading.previousValue ?? 0), 3)} m³</b></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header userName={user.name || user.email || t('user')} userEmail={user.email} onLogout={handleLogout} pageTitle={t('waterReadings')} />
      <main className=" mx-auto px-4 py-8">
        {loadError && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}
        {isLoadingData ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-gray-600">
            {t('loadingApartmentsAndReadings')}
          </div>
        ) : (
          (() => {
            const residentApartment = apartments.find(a => user.role === 'Resident' && user.apartmentId === a.id);
            if (!residentApartment) {
              return <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center"><p className="text-gray-600">{t('noApartmentsFound')}</p></div>;
            }
            const meters = getWaterMetersByApartment(residentApartment.id);
            const readings = readingsByApartmentId[residentApartment.id] ?? [];
            // --- Новая логика: вычисляем доступность сдачи ---
            const apartmentBuilding = buildings.find((building) => building.id === residentApartment.buildingId);
            const openDate = apartmentBuilding?.waterSubmissionOpenDate;
            const closeDate = apartmentBuilding?.waterSubmissionCloseDate;
            const fallbackOpenDay = apartmentBuilding?.waterSubmissionOpenDay;
            const canSubmit = isMeterSubmissionAllowed(openDate, closeDate, fallbackOpenDay);
            // ---
            return (
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{t('apartment')} {residentApartment.number}</h2>
                  </div>
                </div>
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">{t('submitWaterReadings')}</h3>
                  {!canSubmit ? (
                    <div className="mt-3 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                      {t('submissionUnavailable')}<br />
                      {(() => {
                        // Найти здание по id (строгое сравнение строк)
                        const buildingId = String(residentApartment?.buildingId || '');
                        const apartmentBuilding = Array.isArray(buildings) ? buildings.find(b => String(b.id) === buildingId) : undefined;
                        const openDate = apartmentBuilding?.waterSubmissionOpenDate;
                        const closeDate = apartmentBuilding?.waterSubmissionCloseDate;
                        const debugIds = Array.isArray(buildings)
                          ? buildings.map(b => `id: ${b.id} (${typeof b.id}), == buildingId: ${b.id == buildingId}, ===: ${b.id === buildingId}`)
                          : [];
                        return (
                          <>
                            {openDate && closeDate ? (
                              <>
                                {t('submissionPeriod', { open: new Date(openDate).toLocaleDateString(), close: new Date(closeDate).toLocaleDateString() })}
                              </>
                            ) : (
                              <span>{t('submissionPeriodNotSet')}</span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : meters.length === 0 ? (
                    <p className="mt-3 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">{t('noWaterMetersConfigured')}</p>
                  ) : (
                    <>
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Render cold meter left, hot meter right */}
                        {['cold', 'hot'].map((type) => {
                          const meter = meters.find(m => (type === 'hot' ? isHotMeter(m) : !isHotMeter(m)));
                          if (!meter) return null;
                          const value = `${waterReadingIntegerByMeterId[meter.id] ?? ''}.${(waterReadingFractionByMeterId[meter.id] ?? '').padEnd(3, '0')}`;
                          // Найти serialNumber из waterReadings для текущей квартиры и meterId
                          const wr = residentApartment?.waterReadings?.find(w => w.meterId === meter.id);
                          return (
                            <div key={meter.id} className="flex-1 min-w-0 flex flex-col items-stretch">
                              <MeterInputBlock
                                type={type as 'hot' | 'cold'}
                                value={value}
                                onChange={val => {
                                  const [int, frac = ''] = val.split('.')
                                  setWaterReadingIntegerByMeterId(prev => ({ ...prev, [meter.id]: int.replace(/\D/g, '').slice(0, 6) }));
                                  setWaterReadingFractionByMeterId(prev => ({ ...prev, [meter.id]: frac.replace(/\D/g, '').slice(0, 3) }));
                                }}
                                loading={false}
                                serial={wr?.serialNumber || meter.serialNumber || meter.id}
                                label={getMeterDisplayName(meter)}
                                validUntil={formatDateOnly(meter?.checkDueDate)}
                                onSubmit={undefined}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-end mt-4">
                        <button
                          className="px-6 py-3 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60"
                          onClick={() => handleSubmitWaterReading(residentApartment)}
                          disabled={submittingReadingApartmentId === residentApartment.id}
                        >
                          {submittingReadingApartmentId === residentApartment.id ? t('saving') : t('submitWaterReadings')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">{t('history')}</h3>
                  {readings.length === 0 ? (
                    <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">{t('noReadingsForApartment')}</p>
                  ) : (
                    <MeterReadingsHistoryAccordion readings={readings} meterById={meterById} />
                  )}
                </div>
              </div>
            );
          })()
        )}
      </main>
    </div>
  );
}
