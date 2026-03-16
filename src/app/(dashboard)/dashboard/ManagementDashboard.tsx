"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/shared/hooks/useAuth";
import { logout } from "@/modules/auth/services/authService";
import Header from "@/shared/components/layout/heder";
import { getApartmentsByCompany } from "@/modules/apartments/services/apartmentsService";
import { getBuildingsByCompany } from "@/modules/invoices/services/buildings/services/buildingsService";

type ManagementStats = {
  buildings: number;
  apartments: number;
};

export default function ManagementDashboard() {
  const t = useTranslations("dashboard.management");
  const { user } = useAuth();
  const router = useRouter();
  const name = user?.displayName || user?.email || t("user");
  const [stats, setStats] = useState<ManagementStats>({ buildings: 0, apartments: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoadingStats(true);

      if (!user?.companyId) {
        setStats({ buildings: 0, apartments: 0 });
        setLoadingStats(false);
        return;
      }

      try {
        const [buildings, apartments] = await Promise.all([
          getBuildingsByCompany(user.companyId),
          getApartmentsByCompany(user.companyId),
        ]);

        setStats({
          buildings: buildings.length,
          apartments: apartments.length,
        });
      } catch {
        setStats({ buildings: 0, apartments: 0 });
      } finally {
        setLoadingStats(false);
      }
    }

    fetchStats();
  }, [user?.companyId]);

  const handleLogout = async () => {
    await logout();
    await fetch("/api/auth/clear-cookies", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-white via-green-50 to-blue-50">
      <Header
        userName={name}
        userEmail={user?.email}
        userAvatarUrl={(user as { avatarUrl?: string } | null)?.avatarUrl}
        onLogout={handleLogout}
        pageTitle={t("welcome", { name })}
      />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <p className="mb-6 text-sm text-gray-600">{t("intro")}</p>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{t("totalBuildings")}</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {loadingStats ? t("loadingStats") : stats.buildings}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{t("totalApartments")}</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {loadingStats ? t("loadingStats") : stats.apartments}
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
