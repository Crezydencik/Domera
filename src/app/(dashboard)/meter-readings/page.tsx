"use client";
import dynamic from "next/dynamic";
import { useAuth } from "@/shared/hooks/useAuth";
import { useTranslations } from "next-intl";

const ResidentPage = dynamic(() => import("./page.resident"));
const ManagerPage = dynamic(() => import("./page.manager"));

export default function MeterReadingsPage() {
  const { user, loading, isResident } = useAuth();
  const t = useTranslations('syystem');
  if (loading) return <div>{t('loading')}</div>;
  if (!user) return <div>{t('noAccess')}</div>;
  if (isResident) return <ResidentPage />;
  return <ManagerPage />;
}
