'use client';

import { useAuth } from '@/shared/hooks/useAuth';
import Link from 'next/link';
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



type ReadingTimestampLike =
  | Date
  | string
  | { toDate?: () => Date; seconds?: number; nanoseconds?: number }
  | null
  | undefined;

interface ExportRow {
  apartmentNumber: string;
  buildingName: string;
  meterName: string;
  period: string;
  submittedAt: string;
  previousValue: number;
  currentValue: number;
  consumption: number;
  isMissing: boolean;
}

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

const formatDateTime = (value: ReadingTimestampLike): string => {
  const timestamp = toTimestampMs(value);
  if (!timestamp) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
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

const getReadingPeriodLabel = (reading: MeterReading): string => {
  return `${String(reading.month).padStart(2, '0')}.${reading.year}`;
};

const getReadingMeterName = (reading: MeterReading, meterMap: Record<string, Meter>): string => {
  const meter = meterMap[reading.meterId];
  return meter?.name || meter?.serialNumber || reading.meterId;
};

const getMeterDisplayName = (meter: Meter): string => {
  const name = meter.name?.toString().trim() ?? '';
  if (!name) return meter.serialNumber?.trim() || meter.id;
  const code = name.toLowerCase();
  if (code === 'hwm') return 'ГВС';
  if (code === 'cwm') return 'ХВС';
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
  const [deleteTarget, setDeleteTarget] = useState<DeleteReadingTarget | null>(null);
  const [deletingReadingId, setDeletingReadingId] = useState<string | null>(null);
  const t = useTranslations('dashboard.meterReadings');
  // delete menu state removed; multi-delete uses modal
  const [deleteMulti, setDeleteMulti] = useState<{
    apartmentId: string;
    apartmentNumber: string;
    left?: MeterReading | null;
    right?: MeterReading | null;
    period: string;
  } | null>(null);
  const [deleteMultiLeft, setDeleteMultiLeft] = useState(true);
  const [deleteMultiRight, setDeleteMultiRight] = useState(true);
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

  const handleSaveMeterMeta = async (apartmentId: string, meterId: string) => {
    const serial = (meterSerialInputByMeterId[meterId] || '').trim();
    const checkDate = (meterCheckDateInputByMeterId[meterId] || '').trim();

    if (!serial && !checkDate) {
      toast.error(t('enterMeterSerialOrCheckDate'));
      return;
    }

    // prevent saving meta if edits are not allowed (residents) unless management forces
    const existingMeter = meterById[meterId];
    if (existingMeter && !canEditMetaForMeter(existingMeter)) {
      const allowedForManagement = isManagementCompany && Boolean(forceSaveByMeterId[meterId]);
      if (!allowedForManagement) {
        showMeterError(meterId, t('editingMetaForbidden'));
        return;
      }
    }

    try {
      const payload: Record<string, any> = {};
      if (serial) payload.serialNumber = serial;
      if (checkDate) payload.checkDueDate = checkDate;
      // write English name code based on whether the meter is hot or cold
      const meter = meterById[meterId];
      payload.name = meter && isHotMeter(meter) ? 'hwm' : 'cwm';

      const options = { force: Boolean(forceSaveByMeterId[meterId]) };
      await updateMeter(meterId, payload, options);

      setMetersByApartmentId((prev) => {
        const next = { ...prev };
        const arr = (next[apartmentId] || []).map((m) => (m.id === meterId ? { ...m, ...(payload as any) } : m));
        next[apartmentId] = arr;
        return next;
      });

      // clear inputs and editing flags
      setMeterSerialInputByMeterId((prev) => ({ ...prev, [meterId]: '' }));
      setMeterCheckDateInputByMeterId((prev) => ({ ...prev, [meterId]: '' }));
      setEditingSerialByMeterId((prev) => ({ ...prev, [meterId]: false }));
      setEditingCheckByMeterId((prev) => ({ ...prev, [meterId]: false }));
      setForceSaveByMeterId((prev) => ({ ...prev, [meterId]: false }));

      toast.success(t('submitSuccess'));
    } catch (err) {
      console.error('Failed to save meter meta:', err);
      const msg = err instanceof Error ? err.message : String(err);
      showMeterError(meterId, msg || t('submitError'));
    }
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
                  <span>Nr. {serial}</span>
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

        const visibleBuildingIds = new Set(visibleApartments.map((apartment) => apartment.buildingId));
        const visibleBuildings = buildingsData.filter((building) => visibleBuildingIds.has(building.id));

        // set apartments/buildings early so UI can render while we fetch heavier data
        setApartments(visibleApartments);
        setBuildings(visibleBuildings);

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

    const lastByMeter: Record<string, MeterReading> = {};
    for (const r of aptReadings) {
      const existing = lastByMeter[r.meterId];
      if (!existing || toTimestampMs(r.submittedAt as ReadingTimestampLike) > toTimestampMs(existing.submittedAt as ReadingTimestampLike)) {
        lastByMeter[r.meterId] = r;
      }
    }

    // set inputs only when they are empty / not set by user
    setWaterReadingIntegerByMeterId((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const meter of meters) {
        const last = lastByMeter[meter.id];
        if (!last) continue;
        const currentVal = last.currentValue ?? 0;
        const parts = Number(currentVal).toFixed(3).split('.');
        const intPart = parts[0] ?? '0';
        if (!next[meter.id] || next[meter.id] === '') {
          next[meter.id] = intPart.replace(/\D/g, '').slice(0,5);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setWaterReadingFractionByMeterId((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const meter of meters) {
        const last = lastByMeter[meter.id];
        if (!last) continue;
        const currentVal = last.currentValue ?? 0;
        const parts = Number(currentVal).toFixed(3).split('.');
        const fracPart = (parts[1] ?? '000').slice(0,3).padEnd(3, '0');
        if (!next[meter.id] || next[meter.id] === '') {
          next[meter.id] = fracPart.replace(/\D/g, '').slice(0,3);
          changed = true;
        }
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

  const exportRows = useMemo<ExportRow[]>(() => {
    return sortedReadings.map((reading) => {
      const apartment = apartmentById[reading.apartmentId];
      const apartmentNumber = apartment?.number ?? reading.apartmentId;
      const buildingName = apartment ? buildingNameById[apartment.buildingId] ?? t('notSpecified') : t('notSpecified');
      const meterName = getMeterDisplayName(meterById[reading.meterId]) || reading.meterId;

      return {
        apartmentNumber,
        buildingName,
        meterName,
        period: `${String(reading.month).padStart(2, '0')}.${reading.year}`,
        submittedAt: formatDateTime(reading.submittedAt as ReadingTimestampLike),
        previousValue: reading.previousValue,
        currentValue: reading.currentValue,
        consumption: getEffectiveConsumption(reading),
        isMissing: Boolean(reading.isMissing),
      };
    });
  }, [sortedReadings, apartmentById, buildingNameById, meterById, getEffectiveConsumption]);

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

    downloadTextFile(
      csv,
      `meter-readings-${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8;'
    );
  };

  const handleExportXlsx = () => {
    if (exportRows.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(
      exportRows.map((row) => ({
        [t('apartment')]: row.apartmentNumber,
        [t('building')]: row.buildingName,
        [t('meter')]: row.meterName,
        [t('period')]: row.period,
        [t('submittedAt')]: row.submittedAt,
        [t('previousValue')]: row.previousValue,
        [t('currentValue')]: row.currentValue,
        [t('consumption')]: row.consumption,
        [t('isMissing')]: row.isMissing ? t('yes') : t('no'),
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t('meterReadings'));
    XLSX.writeFile(workbook, `meter-readings-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };


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
    const submissionOpenDay = getBuildingSubmissionOpenDay(apartmentBuilding);


    // КЛИЕНТСКОЕ вычисление: разрешена ли отправка показаний
    const canSubmit = isMeterSubmissionAllowed(submissionOpenDay);
    if (!canSubmit) {
      setTimedSubmitError(apartment.id, t('submissionAvailableFrom', { day: submissionOpenDay }), 15000);
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
          const meterReadingValidation = validateMeterReading(currentValue);

          if (!meterReadingValidation.isValid) {
            throw new Error(t('meterReadingError', { meterLabel, error: meterReadingValidation.error ?? t('invalidValue') }));
          }

          const consumptionValidation = validateConsumption(currentValue, previousValue);
          if (!consumptionValidation.isValid || typeof consumptionValidation.consumption !== 'number') {
            throw new Error(t('meterConsumptionError', { meterLabel, error: consumptionValidation.error ?? t('invalidConsumption') }));
          }

          const nextConsumption = isFirstReading ? 0 : consumptionValidation.consumption;

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

  if (loading) {
    return <div className="text-white">{t('loading')}</div>;
  }

  if (!user) {
    return <div className="text-white">{t('loginRequired')}</div>;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-400 hover:text-white">
            ← {t('back')}
          </Link>
          <h1 className="text-2xl font-bold text-white">{t('waterReadings')}</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!isResident && (
          <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800 p-2">
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exportRows.length === 0}
                className="rounded-md border border-slate-500 px-3 py-1 text-xs text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportXlsx}
                disabled={exportRows.length === 0}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                XLSX
              </button>
            </div>
          </div>
        )}

        {loadError && (
          <div className="mb-6 rounded-md border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
            {loadError}
          </div>
        )}

        {isLoadingData ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-gray-300">
            {t('loadingApartmentsAndReadings')}
          </div>
        ) : apartmentCards.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 text-center">
            <p className="text-gray-300">{t('noApartmentsFound')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {apartmentCards.map(({ apartment, buildingName, readings: apartmentReadings, latestReading, monthsCount }) => (
              <div key={apartment.id} className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-white">{t('apartment')} {apartment.number}</h2>
                    <p className="text-xs text-gray-400">{t('building')}: {buildingName}</p>
                  </div>

                  <div className="text-right text-xs text-gray-300">
                    <p>{t('totalMonths')}: {monthsCount}</p>
                    <p>
                      {t('lastSubmission')}: {latestReading ? formatDateTime(latestReading.submittedAt as ReadingTimestampLike) : '—'}
                    </p>
                  </div>
                </div>

                {isResident && user.apartmentId === apartment.id && (
                  <div className="mb-3 rounded-lg border border-blue-700/50 bg-blue-900/20 p-2">
                    <h3 className="text-sm font-medium text-blue-200">{t('submitWaterReadings')}</h3>

                          {getWaterMetersByApartment(apartment.id).length === 0 ? (
                            <p className="mt-3 rounded-md border border-amber-700 bg-amber-900/30 px-3 py-2 text-sm text-amber-300">
                              {t('noWaterMetersConfigured')}
                            </p>
                          ) : (
                            <div className="mt-2 grid gap-3 md:grid-cols-2">
                              {getWaterMetersByApartment(apartment.id).slice().sort((a, b) => Number(isHotMeter(a)) - Number(isHotMeter(b))).map((meter) => {
                                const intPart = waterReadingIntegerByMeterId[meter.id] ?? '';
                                const fracPart = waterReadingFractionByMeterId[meter.id] ?? '';
                                const composed = (intPart === '' && fracPart === '') ? undefined : Number(`${intPart || '0'}.${(fracPart || '').padEnd(3, '0')}`);
                                const displayValue = composed === undefined ? '—' : formatNumberDot(composed, 3);

                                return (
                                  <div key={meter.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                                    {/* Inputs first, live value below them, and meter title uses serial number */}
                                    <div className="flex items-center justify-between w-full gap-4">
                                      <div className="flex items-center gap-3">
                                        <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/50 ${/гвс|гВС|GVS|hot|hotwater|гор/i.test(getMeterDisplayName(meter)) ? 'ring-1 ring-red-700/40' : 'ring-1 ring-blue-700/30'}`}>
                                          <svg className={`h-6 w-6 ${/гвс|гВС|GVS|hot|hotwater|гор/i.test(getMeterDisplayName(meter)) ? 'text-red-400' : 'text-blue-300'}`} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 2C12 2 7 9 7 13a5 5 0 0010 0c0-4-5-11-5-11z" />
                                          </svg>
                                        </div>

                                        <div className="text-left">
                                          <div className="flex items-center gap-2">
                                            {meter.serialNumber && meter.checkDueDate ? (
                                              <span className="font-medium text-base text-white">Nr. {meter.serialNumber}</span>
                                            ) : (
                                              <div className="flex items-center gap-2">
                                                {/* Serial input (separate inline flow) */}
                                                {editingSerialByMeterId[meter.id] ? (
                                                  <span className="flex items-center gap-2">
                                                    <input
                                                      type="text"
                                                      value={meterSerialInputByMeterId[meter.id] ?? meter?.serialNumber ?? ''}
                                                      onChange={(e) => setMeterSerialInputByMeterId((prev) => ({ ...prev, [meter.id]: e.target.value }))}
                                                      placeholder={t('enterSerial')}
                                                      className="w-28 rounded-md border border-slate-600 bg-slate-700 px-1 py-0.5 text-xs text-white"
                                                    />
                                                    <button
                                                      type="button"
                                                      onClick={() => handleSaveMeterSerial(apartment.id, meter.id)}
                                                      className="h-8 w-8 flex items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                                                      title={t('save')}
                                                    >✓</button>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setEditingSerialByMeterId((prev) => ({ ...prev, [meter.id]: false }));
                                                        setMeterSerialInputByMeterId((prev) => ({ ...prev, [meter.id]: '' }));
                                                      }}
                                                      className="h-8 w-8 flex items-center justify-center rounded-md bg-slate-700 text-white hover:bg-slate-600"
                                                      title={t('cancel')}
                                                    >✕</button>
                                                  </span>
                                                ) : (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setMeterSerialInputByMeterId((prev) => ({ ...prev, [meter.id]: meter?.serialNumber ?? '' }));
                                                      setEditingSerialByMeterId((prev) => ({ ...prev, [meter.id]: true }));
                                                    }}
                                                    className="text-xs text-slate-400 hover:text-slate-200"
                                                    title={t('enterSerial')}
                                                  >
                                                    Nr. — ✎
                                                  </button>
                                                )}
.
                                                {/* Check date input (separate inline flow) */}
                                             
                                              </div>
                                            )}
                                          </div>
                                          <div className="text-xs text-slate-400 mt-1">{getMeterDisplayName(meter)}</div>
                                          <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                                            {editingCheckByMeterId[meter.id] ? (
                                              <>
                                                <input
                                                  type="date"
                                                  value={meterCheckDateInputByMeterId[meter.id] ?? toInputDate(meter?.checkDueDate)}
                                                  onChange={(e) => setMeterCheckDateInputByMeterId((prev) => ({ ...prev, [meter.id]: e.target.value }))}
                                                  className="rounded bg-slate-800/60 px-1 py-0.5 text-slate-200 text-xs"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => handleSaveMeterCheckDate(apartment.id, meter.id)}
                                                  className="h-8 w-8 flex items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
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
                                                        type="button"
                                                        onClick={() => {
                                                          setEditingCheckByMeterId((prev) => ({ ...prev, [meter.id]: false }));
                                                          setForceSaveByMeterId((prev) => ({ ...prev, [meter.id]: false }));
                                                        }}
                                                        className="text-xs text-slate-400 hover:text-slate-200"
                                                      >
                                                        ✕
                                                      </button>
                                              </>
                                            ) : (
                                              <>
                                                <span>{t('checkDueDate')}: {formatDateOnly(meter?.checkDueDate)}</span>
                                                {canEditMetaForMeter(meter) ? (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setMeterCheckDateInputByMeterId((prev) => ({ ...prev, [meter.id]: toInputDate(meter?.checkDueDate) }));
                                                      setEditingCheckByMeterId((prev) => ({ ...prev, [meter.id]: true }));
                                                    }}
                                                    className="text-xs text-slate-400 hover:text-slate-200"
                                                  >
                                                    ✎
                                                  </button>
                                                ) : null}
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex flex-col items-start gap-2">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={5}
                                            value={waterReadingIntegerByMeterId[meter.id] ?? ''}
                                            onChange={(e) =>
                                              setWaterReadingIntegerByMeterId((prev) => ({
                                                ...prev,
                                                [meter.id]: e.target.value.replace(/\D/g, '').slice(0,5),
                                              }))
                                            }
                                            className="w-14 rounded-md border border-slate-600 bg-slate-700 px-1 py-0.5 text-xs text-white text-right"
                                            placeholder={t('intPart')}
                                          />
                                          <div className="text-slate-300">.</div>
                                          <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={3}
                                            value={waterReadingFractionByMeterId[meter.id] ?? ''}
                                            onChange={(e) =>
                                              setWaterReadingFractionByMeterId((prev) => ({
                                                ...prev,
                                                [meter.id]: e.target.value.replace(/\D/g, '').slice(0,3),
                                              }))
                                            }
                                            className="w-12 rounded-md border border-slate-600 bg-slate-700 px-1 py-0.5 text-xs text-white"
                                            placeholder={t('fractionPart')}
                                          />
                                        </div>

                                        <div className="mt-1 text-sm font-mono text-white">{displayValue}</div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSubmitWaterReading(apartment)}
                        disabled={
                          submittingReadingApartmentId === apartment.id ||
                          getWaterMetersByApartment(apartment.id).length === 0 ||
                          isSubmitRetryLocked(apartment.id)
                        }
                        className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {submittingReadingApartmentId === apartment.id ? t('saving') : t('submit')}
                      </button>
                    </div>

                  </div>
                )}

                {apartmentReadings.length === 0 ? (
                  <p className="rounded-md border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-gray-400">
                    {t('noReadingsForApartment')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(
                      apartmentReadings.reduce<Record<string, MeterReading[]>>((acc, reading) => {
                        const period = getReadingPeriodLabel(reading);
                        if (!acc[period]) {
                          acc[period] = [];
                        }
                        acc[period].push(reading);
                        return acc;
                      }, {})
                    ).map(([period, periodReadings], index) => (
                      <details
                        key={`${apartment.id}-${period}`}
                        open={index === 0}
                        className="rounded-lg border border-slate-700 bg-slate-900/35"
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-slate-200 marker:hidden">
                          <span className="font-medium">{period}</span>
                          <span className="text-xs text-slate-400">{t('entries')}: {periodReadings.length}</span>
                        </summary>

                        <div className="space-y-3 p-4">
                          {(() => {
                            const sorted = periodReadings.slice().sort((a, b) => {
                              const ma = meterById[a.meterId];
                              const mb = meterById[b.meterId];
                              return Number(isHotMeter(ma)) - Number(isHotMeter(mb));
                            });

                            const cold = sorted.filter((r) => !isHotMeter(meterById[r.meterId]));
                            const hot = sorted.filter((r) => isHotMeter(meterById[r.meterId]));
                            const rows = Math.max(cold.length, hot.length);

                            return Array.from({ length: rows }).map((_, i) => {
                              const left = cold[i] ?? null;
                              const right = hot[i] ?? null;
                              const { month: nowMonth, year: nowYear } = getCurrentMonthYear();

                              const canDeleteLeft =
                                !!left && isResident && user?.apartmentId === apartment.id && Number(left.month) === Number(nowMonth) && Number(left.year) === Number(nowYear);

                              const canDeleteRight =
                                !!right && isResident && user?.apartmentId === apartment.id && Number(right.month) === Number(nowMonth) && Number(right.year) === Number(nowYear);

                              const bothOptions = canDeleteLeft && canDeleteRight;

                              const handleCenterDelete = () => {
                                // if both deletable, open modal to choose; otherwise trigger delete for existing one
                                if (bothOptions) {
                                  setDeleteMulti({
                                    apartmentId: apartment.id,
                                    apartmentNumber: apartment.number,
                                    left,
                                    right,
                                    period,
                                  });
                                  setDeleteMultiLeft(true);
                                  setDeleteMultiRight(true);
                                  return;
                                }

                                if (canDeleteLeft && left) {
                                  setDeleteTarget({
                                    apartmentId: apartment.id,
                                    apartmentNumber: apartment.number,
                                    readingId: left.id,
                                    meterName: getReadingMeterName(left, meterById),
                                    period,
                                  });
                                  return;
                                }

                                if (canDeleteRight && right) {
                                  setDeleteTarget({
                                    apartmentId: apartment.id,
                                    apartmentNumber: apartment.number,
                                    readingId: right.id,
                                    meterName: getReadingMeterName(right, meterById),
                                    period,
                                  });
                                  return;
                                }
                              };

                              return (
                                <div key={`${period}-${i}`} className="flex items-start gap-3">
                                  <div className="flex-1">{renderReadingCard(left)}</div>
                                  <div className="flex-1">{renderReadingCard(right)}</div>
                                  <div className="shrink-0 relative">
                                    <button
                                      type="button"
                                      onClick={handleCenterDelete}
                                      disabled={Boolean(deletingReadingId) || !(canDeleteLeft || canDeleteRight)}
                                      title={deletingReadingId ? t('deleting') : t('deleteReading')}
                                      className="flex h-8 w-8 items-center justify-center rounded-md bg-red-600/90 text-white hover:bg-red-700 disabled:opacity-50"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                                        <path d="M3 6h18v2H3V6zm2 3h14l-1 11H6L5 9zm5-6h4v2h-4V3z" />
                                      </svg>
                                    </button>

                                    {/* dropdown removed; multi-delete handled via modal (deleteMulti state) */}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            ))}
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
          {/* Custom content: checkboxes for left/right */}
          {deleteMulti && (
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={deleteMultiLeft}
                  onChange={(e) => setDeleteMultiLeft(e.target.checked)}
                />
                <span className="text-sm">{t('deleteCold')} — {deleteMulti.left ? getReadingMeterName(deleteMulti.left, meterById) : '—'}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={deleteMultiRight}
                  onChange={(e) => setDeleteMultiRight(e.target.checked)}
                />
                <span className="text-sm">{t('deleteHot')} — {deleteMulti.right ? getReadingMeterName(deleteMulti.right, meterById) : '—'}</span>
              </label>
            </div>
          )}
        </ConfirmationDialog>
      </main>
    </div>
  );
}
