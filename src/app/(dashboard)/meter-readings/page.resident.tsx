"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as XLSX from "xlsx";
import { getApartment } from "@/modules/apartments/services/apartmentsService";
import { getBuilding } from "@/modules/invoices/services/buildings/services/buildingsService";
import { getLastMeterReading, getMeterReadingsByApartment, getMetersByApartment, submitMeterReading, updateMeter, deleteMeterReading } from "@/modules/meters/services/metersService";
import { METER_READING_RULES } from "@/shared/constants";
import { getCurrentMonthYear, isMeterSubmissionAllowed } from "@/shared/lib/utils";
import { validateConsumption, validateMeterReading } from "@/shared/validation";
import { ConfirmationDialog } from "@/shared/components/ui/ConfirmationDialog";
import { toast } from "react-toastify";
import type { Apartment, Building, Meter, MeterReading } from "@/shared/types";

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
const formatDateOnly = (value: string | Date | undefined | null): string => {
  if (!value) return "—";
  try {
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  } catch (e) {
    return "—";
  }
};
const toInputDate = (value: string | Date | undefined | null): string => {
  if (!value) return "";
  try {
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch (e) {
    return "";
  }
};
const getReadingPeriodLabel = (reading: MeterReading): string => `${String(reading.month).padStart(2, "0")}.${reading.year}`;
const getMeterDisplayName = (meter: Meter): string => {
  const name = meter.name?.toString().trim() ?? "";
  if (!name) return meter.serialNumber?.trim() || meter.id;
  const code = name.toLowerCase();
  if (code === "hwm") return "ГВС";
  if (code === "cwm") return "ХВС";
  return name;
};
const isHotMeter = (meter?: Meter | null): boolean => {
  if (!meter) return false;
  const name = meter.name?.toString().trim() ?? "";
  if (name.toLowerCase() === "hwm") return true;
  if (name.toLowerCase() === "cwm") return false;
  const display = getMeterDisplayName(meter);
  return /гвс|gvs|hot|hotwater|гор/i.test(display);
};
const formatNumberDot = (value: number | string | undefined | null, decimals = 2): string => {
  if (value === undefined || value === null || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  const parts = abs.toFixed(decimals).split(".");
  const intPart = parts[0];
  const decPart = parts[1];
  const intWithSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${intWithSpaces}.${decPart}`;
};
 
export default function MeterReadingsResidentPage() {
  const { user, loading, isResident } = useAuth();
  const t = useTranslations('dashboard.meterReadings');
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [metersByApartmentId, setMetersByApartmentId] = useState<Record<string, Meter[]>>({});
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState("");
  // ...дополнительные состояния для UI отправки показаний, ошибок и т.д.

  useEffect(() => {
    const loadData = async () => {
      if (!user || !user.apartmentId) return;
      setIsLoadingData(true);
      setLoadError("");
      try {
        const apt = await getApartment(user.apartmentId);
        let apartmentsData: Apartment[] = [];
        let buildingsData: Building[] = [];
        if (apt) {
          apartmentsData = [apt];
          if (apt.buildingId) {
            const b = await getBuilding(apt.buildingId);
            if (b) buildingsData = [b];
          }
        }
        setApartments(apartmentsData);
        setBuildings(buildingsData);
        // показания и счетчики
        const readingsData = await getMeterReadingsByApartment(user.apartmentId);
        setReadings(readingsData);
        const meterEntries = await Promise.all(
          apartmentsData.map(async (apartment) => ({
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
        {loadError && (
          <div className="mb-6 rounded-md border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
            {loadError}
          </div>
        )}

        {isLoadingData ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-gray-300">
            {t('loadingApartmentsAndReadings')}
          </div>
        ) : apartments.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 text-center">
            <p className="text-gray-300">{t('noApartmentsFound')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {apartments.map((apartment) => {
              const apartmentReadings = readingsByApartmentId[apartment.id] ?? [];
              const buildingName = buildingNameById[apartment.buildingId] ?? t('notSpecified');
              return (
                <div key={apartment.id} className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold text-white">{t('apartment')} {apartment.number}</h2>
                      <p className="text-xs text-gray-400">{t('building')}: {buildingName}</p>
                    </div>
                  </div>
                  {/* Здесь можно добавить UI для отправки показаний, историю, и т.д. */}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
