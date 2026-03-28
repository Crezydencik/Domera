'use client';

import { useAuth } from '@/shared/hooks/useAuth';
import { AccessError } from '@/shared/components/AccessError';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { getApartmentsByCompany, getApartment, getApartmentsByResidentId } from '@/modules/apartments/services/apartmentsService';
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
import { toast } from 'react-toastify';
import type { Apartment, Building, Meter, MeterReading, WaterMeterData } from '@/shared/types';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { logout } from '../../../modules/auth/services/authService';
import { WaterMeterInput } from '@/shared/components/ui/WaterMeterInput';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';

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
    return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
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
  if (code === 'hwm') return 'hwm';
  if (code === 'cwm') return 'cwm';
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

const getApartmentWaterMeterData = (
  apartment: Apartment | null | undefined,
  meterId: string
): WaterMeterData | undefined => {
  const waterReadings = apartment?.waterReadings as unknown;

  if (!waterReadings || !meterId) {
    return undefined;
  }

  if (Array.isArray(waterReadings)) {
    return waterReadings.find(
      (item): item is WaterMeterData =>
        Boolean(item) &&
        typeof item === 'object' &&
        'meterId' in item &&
        (item as WaterMeterData).meterId === meterId
    );
  }

  if (typeof waterReadings === 'object') {
    return (['coldmeterwater', 'hotmeterwater'] as const)
      .map((key) => (waterReadings as Record<string, unknown>)[key])
      .find(
        (item): item is WaterMeterData =>
          Boolean(item) &&
          typeof item === 'object' &&
          'meterId' in item &&
          (item as WaterMeterData).meterId === meterId
      );
  }

  return undefined;
};

const getLatestReadingByWaterType = (
  apartment: Apartment | null | undefined,
  meterType: 'cold' | 'hot'
): MeterReading | undefined => {
  const wr = apartment?.waterReadings;
  if (!wr || typeof wr !== 'object' || Array.isArray(wr)) return undefined;

  const group = meterType === 'hot'
    ? (wr.hotmeterwater as WaterMeterData | undefined)
    : (wr.coldmeterwater as WaterMeterData | undefined);

  const history = Array.isArray(group?.history) ? group.history : [];
  if (history.length === 0) return undefined;

  return [...history].sort((a, b) => toTimestampMs(b.submittedAt) - toTimestampMs(a.submittedAt))[0];
};

const normalizeMeterSerial = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, '');
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
  const locale = useLocale();
  
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [metersByApartmentId, setMetersByApartmentId] = useState<Record<string, Meter[]>>({});
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [selectedMeterApartmentId, setSelectedMeterApartmentId] = useState<string | null>(null);
  
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState('');
  
  const [waterReadingIntegerByMeterId, setWaterReadingIntegerByMeterId] = useState<Record<string, string>>({});
  const [waterReadingFractionByMeterId, setWaterReadingFractionByMeterId] = useState<Record<string, string>>({});
  const [meterSerialInputByMeterId, setMeterSerialInputByMeterId] = useState<Record<string, string>>({});
  const [editingSerialByMeterId, setEditingSerialByMeterId] = useState<Record<string, boolean>>({});
  const [submittingReadingApartmentId, setSubmittingReadingApartmentId] = useState<string | null>(null);
  const [submitRetryLockedUntilByApartmentId, setSubmitRetryLockedUntilByApartmentId] = useState<Record<string, number>>({});
  const t = useTranslations();
  const tMeter = useTranslations('dashboard.meterReadings');
  const [meterCheckDateInputByMeterId, setMeterCheckDateInputByMeterId] = useState<Record<string, string>>({});
  const [editingCheckByMeterId, setEditingCheckByMeterId] = useState<Record<string, boolean>>({});
  const [forceSaveByMeterId, setForceSaveByMeterId] = useState<Record<string, boolean>>({});

  const formatDateByLocale = useCallback((value: string | Date | undefined | null): string => {
    if (!value) return '—';
    try {
      const date = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(date.getTime())) return '—';
      return new Intl.DateTimeFormat(locale || undefined).format(date);
    } catch {
      return '—';
    }
  }, [locale]);

  const formatMonthPeriodLabel = useCallback((year: number, month: number): string => {
    const date = new Date(year, month - 1, 1);
    const monthNameRaw = new Intl.DateTimeFormat(locale || undefined, {
      month: 'long',
    }).format(date);
    const monthName = monthNameRaw
      ? monthNameRaw.charAt(0).toLocaleUpperCase(locale || undefined) + monthNameRaw.slice(1)
      : monthNameRaw;

    const baseLocale = (locale || 'en').split('-')[0].toLowerCase();
    const yearWordByLocale: Record<string, string> = {
      lv: 'gads',
      ru: 'год',
      en: 'year',
    };
    const yearWord = yearWordByLocale[baseLocale] || 'year';

    return `${year}. ${yearWord}. ${monthName}`;
  }, [locale]);

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
      toast.error(t('auth.alert.enterMeterNumber'));
      return;
    }

    // prevent saving if edits are not allowed here (residents)
    const meter0 = meterById[meterId];
    if (meter0 && !canEditMetaForMeter(meter0)) {
      const allowedForManagement = isManagementCompany && Boolean(forceSaveByMeterId[meterId]);
      if (!allowedForManagement) {
        showMeterError(meterId, tMeter('editingMetaForbidden'));
        return;
      }
    }

    try {
      // ensure stored meter name uses English codes: 'hwm' (hot water meter) or 'cwm' (cold water meter)
      const meter = meterById[meterId];
      const nameCode = meter && isHotMeter(meter) ? 'hwm' : 'cwm';
      const options = { force: Boolean(forceSaveByMeterId[meterId]), apartmentId };
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
      toast.success(tMeter('submitSuccess'));
    } catch (err) {
      console.error('Failed to save meter serial:', err);
      const msg = err instanceof Error ? err.message : String(err);
      showMeterError(meterId, msg || tMeter('submitError'));
    }
  };

    const handleSaveMeterCheckDate = async (apartmentId: string, meterId: string) => {
      const pending = (meterCheckDateInputByMeterId[meterId] || '').trim();
      if (!pending) {
        toast.error(tMeter('enterCheckDate'));
        return;
      }

        // prevent saving if edits are not allowed here (residents)
        const meter0 = meterById[meterId];
        if (meter0 && !canEditMetaForMeter(meter0)) {
          const allowedForManagement = isManagementCompany && Boolean(forceSaveByMeterId[meterId]);
          if (!allowedForManagement) {
            showMeterError(meterId, tMeter('editingMetaForbidden'));
            return;
          }
        }

      try {
        // save as ISO date string and ensure meter name code is stored in English
        const meter = meterById[meterId];
        const nameCode = meter && isHotMeter(meter) ? 'hwm' : 'cwm';
        const options = { force: Boolean(forceSaveByMeterId[meterId]), apartmentId };
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
        toast.success(tMeter('meterReadings.submitSuccess'));
      } catch (err) {
        console.error('Failed to save meter check date:', err);
        const msg = err instanceof Error ? err.message : String(err);
        showMeterError(meterId, msg || tMeter('submitError'));
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
          <div className="text-sm text-gray-400">{tMeter('noValueDash', { defaultValue: '—' })}</div>
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
                    placeholder={tMeter('enterMeterSerial')}
                  />
                  <button
                    onClick={() => handleSaveMeterSerial(reading.apartmentId, meter.id)}
                    className="text-xs text-slate-300 hover:text-white"
                    title={tMeter('save')}

                  >
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setEditingSerialByMeterId((prev) => ({ ...prev, [meter.id]: false }));
                      setForceSaveByMeterId((prev) => ({ ...prev, [meter.id]: false }));
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200"
                    title={tMeter('cancel')}
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <span className="text-xs text-slate-400 flex items-center gap-2">
                  <span>{tMeter('meterNumber', { defaultValue: 'Nr.' })} {(() => {
                    // Найти waterReading для текущей квартиры и meterId
                    const apartment = apartments.find(a => a.id === reading.apartmentId);
                    const wr = getApartmentWaterMeterData(apartment, meter.id);
                    return wr?.serialNumber || serial;
                  })()}</span>
                  {canEditMeta ? (
                    <button
                      onClick={() => {
                        setMeterSerialInputByMeterId((prev) => ({ ...prev, [meter.id]: meter?.serialNumber ?? '' }));
                        setEditingSerialByMeterId((prev) => ({ ...prev, [meter.id]: true }));
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200"
                      title={tMeter('edit')}
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
                    title={tMeter('save')}
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
                      {tMeter('force')}
                    </label>
                  )}
                  <button
                    onClick={() => {
                      setEditingCheckByMeterId((prev) => ({ ...prev, [meter.id]: false }));
                      setForceSaveByMeterId((prev) => ({ ...prev, [meter.id]: false }));
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200"
                    title={tMeter('cancel')}
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>{tMeter('checkDueDate')}: {formatDateOnly(meter?.checkDueDate)}</span>
                  {canEditMeta ? (
                    <button
                      onClick={() => {
                        setMeterCheckDateInputByMeterId((prev) => ({ ...prev, [meter.id]: toInputDate(meter?.checkDueDate) }));
                        setEditingCheckByMeterId((prev) => ({ ...prev, [meter.id]: true }));
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200"
                      title={tMeter('edit')}
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
          <div className="text-xs text-slate-400">{tMeter('periodStart')}: {prevValue}</div>
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

        // --- Исправленная логика: всегда показывать владельцу его квартиры ---
        if (user.role === 'Resident') {
          const residentApartmentIds: string[] = (user.apartmentIds && user.apartmentIds.length > 0)
            ? user.apartmentIds
            : user.apartmentId ? [user.apartmentId] : [];

          // Получаем все квартиры, где residentId = user.uid
          const [byIds, byResidentId] = await Promise.all([
            residentApartmentIds.length > 0
              ? Promise.all(residentApartmentIds.map((id) => getApartment(id)))
              : Promise.resolve([] as (Apartment | null)[]),
            getApartmentsByResidentId(user.uid),
          ]);

          // Получаем все квартиры, где ownerEmail совпадает с email пользователя
          const apartmentsCollection = collection(db, 'apartments');
          const q = query(apartmentsCollection, where('ownerEmail', '==', user.email));
          const snapshot = await getDocs(q);
          const byOwnerEmail = snapshot.docs.map((doc) => {
            const data = doc.data() as Record<string, unknown>;
            return {
              id: doc.id,
              buildingId: data.buildingId as string ?? '',
              number: data.number as string ?? '',
              ...data,
            } as Apartment;
          });

          // Объединяем все найденные квартиры без дубликатов
          const merged: Record<string, Apartment> = {};
          for (const a of byResidentId) if (a) merged[a.id] = a;
          for (const a of byOwnerEmail) if (a) merged[a.id] = a;
          for (const a of byIds) if (a && a.residentId === user.uid) merged[a.id] = a;
          let apts = Object.values(merged);
          // Если после объединения квартир ничего не найдено, явно ищем по ownerEmail
          if (apts.length === 0 && user.email) {
            const apartmentsCollection = collection(db, 'apartments');
            const q = query(apartmentsCollection, where('ownerEmail', '==', user.email));
            const snapshot = await getDocs(q);
            apts = snapshot.docs.map((doc) => {
              const data = doc.data() as Record<string, unknown>;
              return {
                id: doc.id,
                buildingId: data.buildingId as string ?? '',
                number: data.number as string ?? '',
                ...data,
              } as Apartment;
            });
          }
          apartmentsData = apts;
          const buildingIdSet = new Set(apts.map((a) => a.buildingId).filter(Boolean));
          const bArr = (await Promise.all(Array.from(buildingIdSet).map((id) => getBuilding(id)))).filter((b): b is Building => b !== null);
          buildingsData = bArr;
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

        // Явно фильтруем квартиры для владельца по ownerEmail
        let visibleApartments = apartmentsData;
        if (user.email) {
          visibleApartments = apartmentsData.filter(
            (a) => a.ownerEmail === user.email || (a.tenants && a.tenants.some(t => t.email === user.email))
          );
        }

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

        // Set initial selectedMeterApartmentId when first loading
        if (visibleApartments.length > 0) {
          setSelectedMeterApartmentId((prev) => {
            if (prev && visibleApartments.some((a) => a.id === prev)) return prev;
            return visibleApartments[0]?.id ?? null;
          });
        }

        // fetch readings and meters in background (do not block initial render)
        (async () => {
          try {
            if (user.role === 'Resident') {
              // Use the already-loaded visibleApartments IDs (which includes residentId query results)
              const residentIds = visibleApartments.map((a) => a.id);
              const allReadings = await Promise.all(residentIds.map((id) => getMeterReadingsByApartment(id)));
              readingsData = allReadings.flat();
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
            setLoadError((err as Error).message ?? tMeter('loadError'));
          } finally {
            setIsLoadingData(false);
          }
        })();
      } catch (error: unknown) {
        setLoadError(error instanceof Error ? error.message : tMeter('loadError'));
        setIsLoadingData(false);
      }
    };

    loadData();
  }, [user]);



  // Filter readings for renters (arendators) to only their own submissions
  const sortedReadings = useMemo(() => {
    let filtered = readings;
    // Если пользователь — арендатор (tenant), показывать только его показания
    if (user && user.role !== 'Resident' && user.role !== 'ManagementCompany') {
      // Найти квартиры, где этот пользователь — арендатор с submitMeter
      const allowedApartmentIds = apartments
        .filter(apartment => Array.isArray(apartment.tenants) && apartment.tenants.some(
          t => t.userId === user.uid && t.permissions.includes('submitMeter')
        ))
        .map(a => a.id);
      // Фильтровать показания: только по этим квартирам и только те, что отправил этот арендатор
      filtered = readings.filter(r => allowedApartmentIds.includes(r.apartmentId) && r.buildingId && r.apartmentId && r && r.userId === user.uid);
    }
    // sort chronologically: oldest -> newest
    return [...filtered].sort((a, b) => {
      const periodDiff = a.year - b.year || a.month - b.month;
      if (periodDiff !== 0) return periodDiff;
      return (
        toTimestampMs(a.submittedAt as ReadingTimestampLike) -
        toTimestampMs(b.submittedAt as ReadingTimestampLike)
      );
    });
  }, [readings, user, apartments]);

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
    if (!isResident || !selectedMeterApartmentId) return;

    const apartmentId = selectedMeterApartmentId;
    const meters = getWaterMetersByApartment(apartmentId);
    const aptReadings = readingsByApartmentId[apartmentId] ?? [];
    const selectedApartment = apartments.find((a) => a.id === apartmentId);

    const resolveLastReadingForMeter = (meter: Meter): MeterReading | undefined => {
      // 1) Prefer grouped history by water type (cold/hot), independent from meterId schema changes
      const fromTypeGroup = getLatestReadingByWaterType(selectedApartment, isHotMeter(meter) ? 'hot' : 'cold');
      if (fromTypeGroup) return fromTypeGroup;

      // 2) Prefer grouped history in apartment.waterReadings for this meterId
      const group = getApartmentWaterMeterData(selectedApartment, meter.id);
      const groupHistory = Array.isArray(group?.history) ? group.history : [];
      const fromGroup = [...groupHistory].sort((a, b) => toTimestampMs(b.submittedAt) - toTimestampMs(a.submittedAt))[0];
      if (fromGroup) return fromGroup;

      // 3) Fallback by exact meterId in flattened readings
      const fromMeterId = aptReadings
        .filter((r) => r.meterId === meter.id)
        .sort((a, b) => toTimestampMs(b.submittedAt) - toTimestampMs(a.submittedAt))[0];
      if (fromMeterId) return fromMeterId;

      // 4) Fallback by serial in reading payload (serialNumber / WMETNUM)
      const meterSerial = normalizeMeterSerial(meter.serialNumber);
      if (!meterSerial) return undefined;

      return aptReadings
        .filter((r) => {
          const readingSerial = normalizeMeterSerial(r.serialNumber ?? r.WMETNUM);
          return readingSerial.length > 0 && readingSerial === meterSerial;
        })
        .sort((a, b) => toTimestampMs(b.submittedAt) - toTimestampMs(a.submittedAt))[0];
    };

    // Новый алгоритм: ищем последнее показание сначала по meterId, если не найдено — по serialNumber
    setWaterReadingIntegerByMeterId((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const meter of meters) {
        const last = resolveLastReadingForMeter(meter);
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
        const last = resolveLastReadingForMeter(meter);
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
  }, [user, isResident, selectedMeterApartmentId, readingsByApartmentId, metersByApartmentId, apartments, getWaterMetersByApartment]);

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
      const buildingName = buildingNameById[apartment.buildingId] ?? tMeter('notSpecified');
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
      setTimedSubmitError(apartment.id, tMeter('retryAvailableIn', { seconds: secondsLeft }), 15000);
      return;
    }

    // Проверка прав на отправку:
    // - Жилец (Resident) может отправлять показания для своей квартиры
    // - Управляющая компания (ManagementCompany) может отправлять при совпадении companyId
    // - Также допускаем явное право в tenants (permissions.includes('submitMeter'))
    const isTenantWithSubmit = Array.isArray(apartment.tenants)
      ? apartment.tenants.some((tenant) => tenant.userId === user?.uid && tenant.permissions?.includes('submitMeter'))
      : false;

    const residentApartmentIds = user
      ? (user.apartmentIds && user.apartmentIds.length > 0
          ? user.apartmentIds
          : user.apartmentId
            ? [user.apartmentId]
            : [])
      : [];

    const canUserSubmit =
      (isResident && residentApartmentIds.includes(apartment.id)) ||
      (isManagementCompany && user?.companyId && Array.isArray(apartment.companyIds) && apartment.companyIds.includes(user.companyId)) ||
      isTenantWithSubmit;

    if (!canUserSubmit) {
      setTimedSubmitError(apartment.id, tMeter('insufficientPermissions'), 15000);
      return;
    }

    const apartmentBuilding = buildings.find((building) => building.id === apartment.buildingId);
    const openDate = apartmentBuilding?.waterSubmissionOpenDate;
    const closeDate = apartmentBuilding?.waterSubmissionCloseDate;
    const fallbackOpenDay = apartmentBuilding?.waterSubmissionOpenDay;
    // Проверяем разрешён ли период сдачи показаний
    const canSubmit = isMeterSubmissionAllowed(openDate, closeDate, fallbackOpenDay);
    if (!canSubmit) {
      const periodMsg = openDate && closeDate
        ? `${tMeter('submissionPeriod', {
            open: formatDateByLocale(openDate),
            close: formatDateByLocale(closeDate),
          })}`
        : tMeter('submissionAvailableFrom', { day: fallbackOpenDay || 25 });
      setTimedSubmitError(apartment.id, periodMsg, 15000);
      return;
    }

    const waterMeters = getWaterMetersByApartment(apartment.id).slice().sort((a, b) => Number(isHotMeter(a)) - Number(isHotMeter(b)));
    if (waterMeters.length === 0) {
      setTimedSubmitError(apartment.id, tMeter('noWaterMetersConfigured'), 15000);
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
      setTimedSubmitError(apartment.id, tMeter('alreadySubmittedFor', { names }), 15000);
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

          // Metadata updates (serial/check date) are managed by ManagementCompany only.

          const intPart = (waterReadingIntegerByMeterId[meter.id] ?? '').replace(/\D/g, '') || '0';
          let fracPart = (waterReadingFractionByMeterId[meter.id] ?? '').replace(/\D/g, '');
          // pad fraction to 3 digits
          fracPart = fracPart.padEnd(3, '0');
          const rawValue = `${intPart}.${fracPart}`;
          const currentValue = Number(rawValue);

          // Для первого показания разрешаем любое положительное значение, расход = 0
          let nextConsumption = 0;
          if (isFirstReading) {
            if (currentValue < 0 || isNaN(currentValue)) {
              throw new Error(tMeter('meterReadingError', { meterLabel, error: tMeter('invalidValue') }));
            }
          } else {
            const meterReadingValidation = validateMeterReading(currentValue);
            if (!meterReadingValidation.isValid) {
              throw new Error(tMeter('meterReadingError', { meterLabel, error: meterReadingValidation.error ?? tMeter('invalidValue') }));
            }
            const consumptionValidation = validateConsumption(currentValue, previousValue);
            if (!consumptionValidation.isValid || typeof consumptionValidation.consumption !== 'number') {
              throw new Error(tMeter('meterConsumptionError', { meterLabel, error: consumptionValidation.error ?? tMeter('invalidConsumption') }));
            }
            nextConsumption = consumptionValidation.consumption;
          }

          const meterKey: 'coldmeterwater' | 'hotmeterwater' = isHotMeter(meter)
            ? 'hotmeterwater'
            : 'coldmeterwater';

          return {
            companyId: user?.companyId ?? (Array.isArray(apartment.companyIds) ? apartment.companyIds[0] : undefined),
            buildingId: apartment.buildingId,
            apartmentId: apartment.id,
            meterId: meter.id,
            meterKey,
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
        const created = await submitMeterReading({ ...reading, userId: user.uid });
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
      toast.success(tMeter('meterReadingsSaved'));
    } catch (error: unknown) {
      setTimedSubmitError(
        apartment.id,
        error instanceof Error ? error.message : tMeter('meterReadingsSubmitError'),
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
    return <div className="text-white">{tMeter('loading')}</div>;
  }

  if (!user) {
    return <AccessError type="loginRequired" />;
  }

  // Новый компонент для истории показаний в стиле аккордеона
  function MeterReadingsHistoryAccordion({ readings, meterById, apartment }: { readings: MeterReading[]; meterById: Record<string, Meter>; apartment?: Apartment }) {
        // Группируем по годам и месяцам
        const [openAccordionKey, setOpenAccordionKey] = useState<string>('');
        const grouped = readings.reduce((acc, r) => {
          const submittedMs = toTimestampMs(r.submittedAt as ReadingTimestampLike);
          const submittedDate = submittedMs > 0 ? new Date(submittedMs) : null;
          const year = Number.isFinite(Number(r.year)) ? Number(r.year) : submittedDate?.getFullYear();
          const month = Number.isFinite(Number(r.month)) ? Number(r.month) : (submittedDate ? submittedDate.getMonth() + 1 : undefined);
          const key = `${year ?? 'unknown'}-${String(month ?? 'unknown').padStart(2, '0')}`;
          acc[key] = acc[key] || [];
          acc[key].push(r);
          return acc;
        }, {});

        // Сортировка: сначала год по убыванию, потом месяц по убыванию
        const sortedKeys = Object.keys(grouped).sort((a, b) => {
          if (a.includes('unknown')) return 1;
          if (b.includes('unknown')) return -1;
          const [aYear, aMonth] = a.split('-').map(Number);
          const [bYear, bMonth] = b.split('-').map(Number);
          if (bYear !== aYear) return bYear - aYear;
          return bMonth - aMonth;
        });
    const inferIsHotFromApartment = (reading: MeterReading): boolean | undefined => {
      const wr = apartment?.waterReadings;
      if (!wr || typeof wr !== 'object' || Array.isArray(wr)) return undefined;

      const hot = wr.hotmeterwater as WaterMeterData | undefined;
      const cold = wr.coldmeterwater as WaterMeterData | undefined;

      if (reading.meterId) {
        if (hot?.meterId && hot.meterId === reading.meterId) return true;
        if (cold?.meterId && cold.meterId === reading.meterId) return false;
      }

      const readingSerial = normalizeMeterSerial(reading.serialNumber ?? reading.WMETNUM);
      if (readingSerial) {
        const hotSerial = normalizeMeterSerial(hot?.serialNumber);
        const coldSerial = normalizeMeterSerial(cold?.serialNumber);
        if (hotSerial && readingSerial === hotSerial) return true;
        if (coldSerial && readingSerial === coldSerial) return false;
      }
      return undefined;
    };

    // Для быстрого поиска предыдущего показания по meterId
    const readingsByMeterId = useMemo(() => {
      const map: Record<string, MeterReading[]> = {};
      readings.forEach(r => {
        if (!map[r.meterId]) map[r.meterId] = [];
        map[r.meterId].push(r);
      });
      // Сортируем по времени (старое -> новое)
      Object.keys(map).forEach(id => map[id].sort((a, b) => toTimestampMs(a.submittedAt as ReadingTimestampLike) - toTimestampMs(b.submittedAt as ReadingTimestampLike)));
      return map;
    }, [readings]);

    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        {sortedKeys.map((key) => {
          const [year, month] = key.split('-');
          const monthLabel = key.includes('unknown')
            ? tMeter('history')
            : formatMonthPeriodLabel(Number(year), Number(month));
          const monthReadings = grouped[key];
          const monthReadingsSorted = [...monthReadings].sort(
            (a, b) => toTimestampMs(b.submittedAt as ReadingTimestampLike) - toTimestampMs(a.submittedAt as ReadingTimestampLike)
          );
          return (
            <div key={key} className="border-b last:border-b-0">
              <button
                className="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
                onClick={() => setOpenAccordionKey(openAccordionKey === key ? '' : key)}
              >
                <span className="font-semibold text-gray-900">{monthLabel}</span>
                <span className="text-blue-600 text-sm">
                  {openAccordionKey === key ? (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 12l5-5 5 5" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 8l5 5 5-5" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
              </button>
              {openAccordionKey === key && (
                <div className="px-4 py-3 space-y-3 bg-white">
                  {monthReadingsSorted.map((reading, idx) => {
                    const meter = meterById[reading.meterId];
                    const inferred = inferIsHotFromApartment(reading);
                    const isHot = meter
                      ? isHotMeter(meter)
                      : (inferred ?? /hwm|hot|gvs|гор/i.test(String(reading.meterId ?? '')));
                    const readingKey = reading.id
                      ? String(reading.id)
                      : `${key}-${reading.meterId || 'unknown-meter'}-${toTimestampMs(reading.submittedAt as ReadingTimestampLike)}-${idx}`;
                    const allForMeter = readingsByMeterId[reading.meterId] || [];
                    const idxInAll = allForMeter.findIndex(r => r.id === reading.id);
                    const prevReading = idxInAll > 0 ? allForMeter[idxInAll - 1] : undefined;
                    const prevValue = prevReading?.currentValue ?? 0;
                    let diff = (reading.currentValue ?? 0) - prevValue;
                    if (diff < 0) diff = 0;
                    return (
                      <div key={readingKey} className="flex items-center gap-4 p-3 rounded border bg-gray-50">
                        <div className={`rounded-full p-2 ${ isHot ? 'bg-red-100' : 'bg-blue-100'}`}> 
                          <svg width={24} height={24} fill="none" viewBox="0 0 24 24">
                            <circle cx={12} cy={12} r={10} fill={isHot ? '#f87171' : '#60a5fa'} />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-gray-500">{isHot ? tMeter('hotWater') : tMeter('coldWater')} {tMeter('meterNumber', { defaultValue: 'Nr.' })} <b>{meter?.serialNumber || reading.serialNumber || reading.WMETNUM || reading.meterId || tMeter('noValueDash', { defaultValue: '—' })}</b></div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">{formatNumberDot(reading.currentValue ?? 0, 3)}</div>
                          <div className="text-xs text-gray-500">{tMeter('periodStart')}: {formatNumberDot(prevValue, 3)}</div>
                          <div className="text-xs text-gray-500">{tMeter('difference')}: <b>{formatNumberDot(diff, 3)} m³</b></div>
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
      <main className="mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-full">
        {loadError && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {tMeter('loadError', { defaultValue: loadError })}
          </div>
        )}
        {isLoadingData ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-6 text-gray-600 text-base sm:text-lg">
            {tMeter('loadingApartmentsAndReadings')}
          </div>
        ) : (
          (() => {
            const residentApartment = apartments.find(a => selectedMeterApartmentId ? a.id === selectedMeterApartmentId : true) ?? apartments[0];
            if (!residentApartment) {
              return <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center"><p className="text-gray-600">{tMeter('noApartmentsFound')}</p></div>;
            }
            const meters = getWaterMetersByApartment(residentApartment.id);
            let readings = readingsByApartmentId[residentApartment.id] ?? [];
            // For renters (arendators), filter readings to only those apartments where user is a tenant with submitMeter
            if (user && user.role !== 'Resident' && user.role !== 'ManagementCompany') {
              const isTenantWithSubmit = Array.isArray(residentApartment.tenants)
                && residentApartment.tenants.some(t => t.userId === user.uid && t.permissions.includes('submitMeter'));
              if (isTenantWithSubmit) {
                // Only show readings if the user is a tenant with submitMeter
                // (in future, if readings had author, could filter more precisely)
                // For now, show all readings for this apartment (since we can't distinguish by author)
                // If you want to show only readings submitted by this user, filter here if possible
              } else {
                readings = [];
              }
            }
            // --- Новая логика: вычисляем доступность сдачи ---
            const apartmentBuilding = buildings.find((building) => building.id === residentApartment.buildingId);
            const openDate = apartmentBuilding?.waterSubmissionOpenDate;
            const closeDate = apartmentBuilding?.waterSubmissionCloseDate;
            const fallbackOpenDay = apartmentBuilding?.waterSubmissionOpenDay;
            const canSubmit = isMeterSubmissionAllowed(openDate, closeDate, fallbackOpenDay);
            // ---
            return (
              <div>
                {apartments.length > 1 && (
                  <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    <label className="text-sm font-medium text-neutral-600" htmlFor="meter-apartment-select">
                      {tMeter('selectApartment')}:
                    </label>
                    <select
                      id="meter-apartment-select"
                      className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base sm:text-sm text-neutral-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 w-full sm:w-auto"
                      value={selectedMeterApartmentId ?? ''}
                      onChange={(e) => setSelectedMeterApartmentId(e.target.value)}
                    >
                      {apartments.map((apt) => (
                        <option key={apt.id} value={apt.id}>
                          {tMeter('apartment')} {apt.number}
                          {apt.address ? ` — ${apt.address}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              <div className="rounded-lg border border-gray-200 bg-white p-2 sm:p-3">
                <div className="mb-2 flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{tMeter('apartment')} {residentApartment.number}</h2>
                  </div>
                </div>
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">{tMeter('submitWaterReadings')}</h3>
                  {(() => {
                    const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
                    const allMetersSubmitted = meters.length > 0 && meters.every(meter => {
                      const readings = readingsByApartmentId[residentApartment.id] || [];
                      return readings.some(r => r.meterId === meter.id && r.month === currentMonth && r.year === currentYear);
                    });
                    if (!canSubmit) {
                      return (
                        <div className="mt-3 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                          {tMeter('submissionUnavailable')}<br />
                          {(() => {
                            const buildingId = String(residentApartment?.buildingId || '');
                            const apartmentBuilding = Array.isArray(buildings) ? buildings.find(b => String(b.id) === buildingId) : undefined;
                            const openDate = apartmentBuilding?.waterSubmissionOpenDate;
                            const closeDate = apartmentBuilding?.waterSubmissionCloseDate;
                            return (
                              <>
                                {openDate && closeDate ? (
                                  <>
                                    {tMeter('submissionPeriod', { open: formatDateByLocale(openDate), close: formatDateByLocale(closeDate) })}
                                  </>
                                ) : (
                                  <span>{tMeter('submissionPeriodNotSet')}</span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      );
                    } else if (meters.length === 0) {
                      return <p className="mt-3 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">{tMeter('noWaterMetersConfigured')}</p>;
                    } else if (allMetersSubmitted) {
                      return <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-base text-green-800 font-semibold text-center">{tMeter('submittedForThisMonth')}</div>;
                    } else {
                      return (
                        <>
                          <div className="flex flex-col gap-4 md:flex-row md:gap-6">
                            {/* Render cold meter left, hot meter right */}
                            {['cold', 'hot'].map((type) => {
                              const meter = meters.find(m => (type === 'hot' ? isHotMeter(m) : !isHotMeter(m)));
                              if (!meter) return null;
                              const intPart = waterReadingIntegerByMeterId[meter.id] ?? '';
                              const fracPart = (waterReadingFractionByMeterId[meter.id] ?? '').padEnd(3, '0');
                              const value = `${intPart}.${fracPart}`;
                              const wr = getApartmentWaterMeterData(residentApartment, meter.id);
                              return (
                                <div key={meter.id} className="flex-1 min-w-0 flex flex-col items-stretch">
                                  <WaterMeterInput
                                    value={value}
                                    onChange={val => {
                                      const clean = val.replace(',', '.');
                                      const parts = clean.split('.');
                                      let int = parts[0] || '';
                                      let frac = parts[1] || '';
                                      int = int.replace(/\D/g, '').slice(0, 5);
                                      frac = frac.replace(/\D/g, '').slice(0, 3);
                                      setWaterReadingIntegerByMeterId(prev => ({ ...prev, [meter.id]: int }));
                                      setWaterReadingFractionByMeterId(prev => ({ ...prev, [meter.id]: frac }));
                                    }}
                                    disabled={false}
                                    color={isHotMeter(meter) ? 'red' : 'blue'}
                                    meterNumber={wr?.serialNumber || meter.serialNumber || ''}
                                    previousValue={(() => {
                                      if (wr && Array.isArray(wr.history) && wr.history.length > 0) {
                                        const now = new Date();
                                        const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
                                        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
                                        const prev = wr.history.find(r => r.month === prevMonth && r.year === prevYear);
                                        if (prev && prev.currentValue !== undefined && prev.currentValue !== null) {
                                          return String(prev.currentValue);
                                        }
                                      }
                                      if (wr?.previousValue !== undefined && wr?.previousValue !== null) {
                                        return String(wr.previousValue);
                                      }
                                      return '';
                                    })()}
                                    waterType={type as 'hot' | 'cold'}
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-end mt-4">
                            <button
                              className="w-full sm:w-auto px-6 py-3 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60 text-base sm:text-base"
                              onClick={() => handleSubmitWaterReading(residentApartment)}
                              disabled={submittingReadingApartmentId === residentApartment.id}
                            >
                              {submittingReadingApartmentId === residentApartment.id ? tMeter('saving') : tMeter('submitWaterReadings')}
                            </button>
                          </div>
                        </>
                      );
                    }
                  })()}
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">{tMeter('history')}</h3>
                  {readings.length === 0 ? (
                    <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">{tMeter('noReadingsForApartment')}</p>
                  ) : (
                    <MeterReadingsHistoryAccordion readings={readings} meterById={meterById} apartment={residentApartment} />
                  )}
                </div>
              </div>
              </div>
            );
          })()
        )}
      </main>
    </div>
  );
}
