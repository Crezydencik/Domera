"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { AccessError } from "@/shared/components/AccessError";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import Header from "../../../../shared/components/layout/heder";
import { useRouter, useSearchParams } from "next/navigation";
import { logout } from "../../../../modules/auth/services/authService";
import { getBuildingsByCompany, updateBuilding } from "@/modules/invoices/services/buildings/services/buildingsService";
import { MeterInputBlock } from "@/shared/components/ui/MeterInputBlock";
import { MeterDetailsModal } from "../components/MeterDetailsModal";
import type { Building, Meter, MeterReading, WaterMeterData, WaterReadings } from "@/shared/types";

export default function BuildingWaterReadingsPage() {
  const { user, loading } = useAuth();
  const t = useTranslations();
  const tMeter = useTranslations("dashboard.meterReadings");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [buildingCwmInt, setBuildingCwmInt] = useState("");
  const [buildingCwmFrac, setBuildingCwmFrac] = useState("");
  const [buildingHwmInt, setBuildingHwmInt] = useState("");
  const [buildingHwmFrac, setBuildingHwmFrac] = useState("");
  const [isBuildingReadingSubmitting, setIsBuildingReadingSubmitting] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailMeters, setDetailMeters] = useState<Meter[]>([]);
  const [detailSerials, setDetailSerials] = useState<Record<string, string>>({});
  const [detailChecks, setDetailChecks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedBuildingId && buildings.length === 1) {
      setSelectedBuildingId(buildings[0].id);
    }
  }, [selectedBuildingId, buildings]);

  useEffect(() => {
    const requestedBuildingId = searchParams.get("buildingId");
    if (!requestedBuildingId || buildings.length === 0) return;
    if (buildings.some((b) => b.id === requestedBuildingId)) {
      setSelectedBuildingId(requestedBuildingId);
    }
  }, [searchParams, buildings]);

  useEffect(() => {
    setBuildingCwmInt("");
    setBuildingCwmFrac("");
    setBuildingHwmInt("");
    setBuildingHwmFrac("");
  }, [selectedBuildingId]);

  useEffect(() => {
    const loadData = async () => {
      if (!user?.companyId) return;
      setIsLoadingData(true);
      setLoadError("");
      try {
        const bData = await getBuildingsByCompany(user.companyId);
        setBuildings(bData);
      } catch (error: unknown) {
        setLoadError(error instanceof Error ? error.message : tMeter("loadError"));
      } finally {
        setIsLoadingData(false);
      }
    };
    loadData();
  }, [user, tMeter]);

  const selectedBuilding = selectedBuildingId
    ? buildings.find((b) => b.id === selectedBuildingId)
    : null;

  const openMeterDetails = () => {
    if (!selectedBuilding) return;

    const coldMeterId = selectedBuilding.waterReadings?.coldmeterwater?.meterId || `building-${selectedBuilding.id}-cwm`;
    const hotMeterId = selectedBuilding.waterReadings?.hotmeterwater?.meterId || `building-${selectedBuilding.id}-hwm`;

    const meters: Meter[] = [
      {
        id: hotMeterId,
        apartmentId: "",
        type: "water",
        serialNumber: selectedBuilding.waterReadings?.hotmeterwater?.serialNumber || "",
        name: "hwm",
        checkDueDate: selectedBuilding.waterReadings?.hotmeterwater?.checkDueDate,
      },
      {
        id: coldMeterId,
        apartmentId: "",
        type: "water",
        serialNumber: selectedBuilding.waterReadings?.coldmeterwater?.serialNumber || "",
        name: "cwm",
        checkDueDate: selectedBuilding.waterReadings?.coldmeterwater?.checkDueDate,
      },
    ];

    setDetailMeters(meters);
    setDetailSerials({
      [hotMeterId]: selectedBuilding.waterReadings?.hotmeterwater?.serialNumber || "",
      [coldMeterId]: selectedBuilding.waterReadings?.coldmeterwater?.serialNumber || "",
    });
    setDetailChecks({
      [hotMeterId]: typeof selectedBuilding.waterReadings?.hotmeterwater?.checkDueDate === "string"
        ? selectedBuilding.waterReadings.hotmeterwater.checkDueDate
        : "",
      [coldMeterId]: typeof selectedBuilding.waterReadings?.coldmeterwater?.checkDueDate === "string"
        ? selectedBuilding.waterReadings.coldmeterwater.checkDueDate
        : "",
    });
    setDetailsModalOpen(true);
  };

  const handleSaveMeterDetails = async () => {
    if (!selectedBuilding || !user) return;

    const nextWaterReadings: WaterReadings = {
      ...(selectedBuilding.waterReadings ?? {}),
    };

    for (const meter of detailMeters) {
      const isCold = meter.name?.toLowerCase() === "cwm";
      const key = isCold ? "coldmeterwater" : "hotmeterwater";
      const existing = nextWaterReadings[key] ?? selectedBuilding.waterReadings?.[key];
      const nextMeterData: WaterMeterData = {
        ...(existing ?? {}),
        meterId: existing?.meterId || meter.id,
      };

      const serial = (detailSerials[meter.id] || "").trim();
      const check = (detailChecks[meter.id] || "").trim();

      if (serial) {
        nextMeterData.serialNumber = serial;
      } else {
        delete nextMeterData.serialNumber;
      }

      if (check) {
        nextMeterData.checkDueDate = check;
      } else {
        delete nextMeterData.checkDueDate;
      }

      nextWaterReadings[key] = nextMeterData;
    }

    try {
      await updateBuilding(selectedBuilding.id, { waterReadings: nextWaterReadings });
      toast.success(t('auth.alert.meterDetailsSaved'));
      setDetailsModalOpen(false);
      const bData = await getBuildingsByCompany(user.companyId);
      setBuildings(bData);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('auth.alert.meterDetailsSaveError'));
    }
  };

  const handleSubmitBuildingReading = async () => {
    if (!selectedBuilding || !user) return;

    const cwmCombined = buildingCwmInt ? `${buildingCwmInt}.${buildingCwmFrac || "0"}` : "";
    const hwmCombined = buildingHwmInt ? `${buildingHwmInt}.${buildingHwmFrac || "0"}` : "";

    if (!cwmCombined && !hwmCombined) {
      toast.error(t('auth.alert.enterAtLeastOneReading'));
      return;
    }

    const genId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const newWaterReadings: WaterReadings = {};
    if (selectedBuilding.waterReadings?.coldmeterwater) {
      newWaterReadings.coldmeterwater = selectedBuilding.waterReadings.coldmeterwater;
    }
    if (selectedBuilding.waterReadings?.hotmeterwater) {
      newWaterReadings.hotmeterwater = selectedBuilding.waterReadings.hotmeterwater;
    }

    if (cwmCombined) {
      const newVal = parseFloat(cwmCombined);
      if (Number.isNaN(newVal)) {
        toast.error(t('auth.alert.invalidColdValue'));
        return;
      }
      const existing = selectedBuilding.waterReadings?.coldmeterwater;
      if (existing?.history?.some((h) => Number(h.month) === month && Number(h.year) === year)) {
        toast.error(t('auth.alert.coldAlreadySubmitted'));
        return;
      }
      const meterId = `building-${selectedBuilding.id}-cwm`;
      const prevVal = existing?.currentValue ?? 0;
      const reading: MeterReading = {
        id: genId(),
        apartmentId: "",
        buildingId: selectedBuilding.id,
        meterId,
        previousValue: prevVal,
        currentValue: newVal,
        consumption: newVal - prevVal,
        month,
        year,
        submittedAt: now,
        userId: user.uid,
      };
      const coldData: WaterMeterData = {
        meterId,
        currentValue: newVal,
        previousValue: prevVal,
        submittedAt: now,
        history: [...(existing?.history ?? []), reading],
      };
      if (existing?.serialNumber) coldData.serialNumber = existing.serialNumber;
      if (existing?.checkDueDate) coldData.checkDueDate = existing.checkDueDate;
      newWaterReadings.coldmeterwater = coldData;
    }

    if (hwmCombined) {
      const newVal = parseFloat(hwmCombined);
      if (Number.isNaN(newVal)) {
        toast.error(t('auth.alert.invalidHotValue'));
        return;
      }
      const existing = selectedBuilding.waterReadings?.hotmeterwater;
      if (existing?.history?.some((h) => Number(h.month) === month && Number(h.year) === year)) {
        toast.error(t('auth.alert.hotAlreadySubmitted'));
        return;
      }
      const meterId = `building-${selectedBuilding.id}-hwm`;
      const prevVal = existing?.currentValue ?? 0;
      const reading: MeterReading = {
        id: genId(),
        apartmentId: "",
        buildingId: selectedBuilding.id,
        meterId,
        previousValue: prevVal,
        currentValue: newVal,
        consumption: newVal - prevVal,
        month,
        year,
        submittedAt: now,
        userId: user.uid
      };
      const hotData: WaterMeterData = {
        meterId,
        currentValue: newVal,
        previousValue: prevVal,
        submittedAt: now,
        history: [...(existing?.history ?? []), reading],
      };
      if (existing?.serialNumber) hotData.serialNumber = existing.serialNumber;
      if (existing?.checkDueDate) hotData.checkDueDate = existing.checkDueDate;
      newWaterReadings.hotmeterwater = hotData;
    }

    setIsBuildingReadingSubmitting(true);
    try {
      await updateBuilding(selectedBuilding.id, { waterReadings: newWaterReadings });
      toast.success(t('auth.alert.buildingReadingsSaved'));
      setBuildingCwmInt("");
      setBuildingCwmFrac("");
      setBuildingHwmInt("");
      setBuildingHwmFrac("");
      const bData = await getBuildingsByCompany(user.companyId);
      setBuildings(bData);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('auth.alert.buildingReadingsSaveError'));
    } finally {
      setIsBuildingReadingSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    await fetch("/api/auth/clear-cookies", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-white via-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-blue-500 border-t-blue-300 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">{tMeter("loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) return <AccessError type="loginRequired" />;

  const cwmHistory = (selectedBuilding?.waterReadings?.coldmeterwater?.history ?? []) as MeterReading[];
  const hwmHistory = (selectedBuilding?.waterReadings?.hotmeterwater?.history ?? []) as MeterReading[];
  const periodsSet = new Set<string>();
  [...cwmHistory, ...hwmHistory].forEach((r) => periodsSet.add(`${r.year}-${String(r.month).padStart(2, "0")}`));
  const sortedPeriods = Array.from(periodsSet).sort((a, b) => b.localeCompare(a));
  const cwmPrev = selectedBuilding?.waterReadings?.coldmeterwater?.currentValue;
  const hwmPrev = selectedBuilding?.waterReadings?.hotmeterwater?.currentValue;

  return (
    <div className="min-h-screen bg-linear-to-br from-white via-gray-50 to-white text-gray-900">


      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div className="flex-1 max-w-sm">
            <label className="block text-sm font-semibold text-gray-700 mb-3" htmlFor="building-select">
              {tMeter("selectBuilding") !== "dashboard.meterReadings.selectBuilding" ? tMeter("selectBuilding") : "Выбрать дом"}
            </label>
            <select
              id="building-select"
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-md hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
            >
              <option value="">Выберите дом</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openMeterDetails}
              disabled={!selectedBuilding}
              aria-label="Детали счётчиков"
              title="Детали счётчиков"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15H9v-3L18.5 2.5z" /></svg>
            </button>
            <button
              type="button"
              onClick={() => router.push("/meter-readings")}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition shadow-md"
            >
              ← Назад к таблице
            </button>
          </div>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-base text-red-700 shadow-sm animate-fade-in">
            {loadError}
          </div>
        )}

        {isLoadingData ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center shadow-sm animate-pulse">
            <p className="text-gray-600 text-lg font-medium">{tMeter("loading")}</p>
          </div>
        ) : !selectedBuilding ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center shadow-sm">
            <p className="text-gray-600 text-lg font-medium">Выберите дом для подачи показаний</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-md p-6 lg:p-8">

            <div className="flex flex-col md:flex-row gap-6 mb-6">
              <div className="flex-1 min-w-0 flex flex-col items-stretch">
                <MeterInputBlock
                  type="cold"
                  value={`${buildingCwmInt}.${buildingCwmFrac.padEnd(3, "0")}`}
                  onChange={(val) => {
                    const [int, frac = ""] = val.split(".");
                    setBuildingCwmInt(int.replace(/\D/g, "").slice(0, 5));
                    setBuildingCwmFrac(frac.replace(/\D/g, "").slice(0, 3));
                  }}
                  loading={isBuildingReadingSubmitting}
                  serial={selectedBuilding.waterReadings?.coldmeterwater?.serialNumber || ""}
                  label="cwm"
                  integerDigits={5}
                  validUntil={selectedBuilding.waterReadings?.coldmeterwater?.checkDueDate ? String(selectedBuilding.waterReadings.coldmeterwater.checkDueDate) : ""}
                  onSubmit={handleSubmitBuildingReading}
                />
                {cwmPrev !== undefined && (
                  <p className="text-xs text-gray-500 mt-1 text-center">Предыдущее: {cwmPrev}</p>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col items-stretch">
                <MeterInputBlock
                  type="hot"
                  value={`${buildingHwmInt}.${buildingHwmFrac.padEnd(3, "0")}`}
                  onChange={(val) => {
                    const [int, frac = ""] = val.split(".");
                    setBuildingHwmInt(int.replace(/\D/g, "").slice(0, 5));
                    setBuildingHwmFrac(frac.replace(/\D/g, "").slice(0, 3));
                  }}
                  loading={isBuildingReadingSubmitting}
                  serial={selectedBuilding.waterReadings?.hotmeterwater?.serialNumber || ""}
                  label="hwm"
                  integerDigits={5}
                  validUntil={selectedBuilding.waterReadings?.hotmeterwater?.checkDueDate ? String(selectedBuilding.waterReadings.hotmeterwater.checkDueDate) : ""}
                  onSubmit={handleSubmitBuildingReading}
                />
                {hwmPrev !== undefined && (
                  <p className="text-xs text-gray-500 mt-1 text-center">Предыдущее: {hwmPrev}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmitBuildingReading}
                disabled={isBuildingReadingSubmitting || (!buildingCwmInt && !buildingHwmInt)}
                className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBuildingReadingSubmitting ? "Сохранение..." : "Nodot ūdens rādījumus"}
              </button>
            </div>

            {sortedPeriods.length > 0 && (
              <div className="mt-8">
                <h4 className="text-sm font-bold text-gray-700 mb-3">История показаний</h4>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Период</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">ХВС пред.</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">ХВС тек.</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">ГВС пред.</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">ГВС тек.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedPeriods.map((key) => {
                        const [y, m] = key.split("-").map(Number);
                        const cwmR = cwmHistory.find((r) => r.year === y && r.month === m);
                        const hwmR = hwmHistory.find((r) => r.year === y && r.month === m);
                        return (
                          <tr key={key} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-semibold text-gray-900">{y}. gads {String(m).padStart(2, "0")}</td>
                            <td className="px-4 py-2.5 text-right text-gray-500">{cwmR ? cwmR.previousValue : "—"}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-gray-900">{cwmR ? cwmR.currentValue : "—"}</td>
                            <td className="px-4 py-2.5 text-right text-gray-500">{hwmR ? hwmR.previousValue : "—"}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-gray-900">{hwmR ? hwmR.currentValue : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <MeterDetailsModal
          isOpen={detailsModalOpen}
          meters={detailMeters}
          serials={detailSerials}
          checks={detailChecks}
          onChangeSerial={(meterId, value) => setDetailSerials((prev) => ({ ...prev, [meterId]: value }))}
          onChangeCheck={(meterId, value) => setDetailChecks((prev) => ({ ...prev, [meterId]: value }))}
          onClose={() => setDetailsModalOpen(false)}
          onSave={handleSaveMeterDetails}
        />
      </main>
    </div>
  );
}
