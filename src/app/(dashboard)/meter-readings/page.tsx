"use client";
import dynamic from "next/dynamic";
import { useAuth } from "@/shared/hooks/useAuth";
import { useTranslations } from "next-intl";
import Loader from "../../../shared/components/ui/loading";
import { AccessError } from "@/shared/components/AccessError";

const ResidentPage = dynamic(() => import("./page.resident"));
const ManagerPage = dynamic(() => import("./page.manager"));

export default function MeterReadingsPage() {
  const { user, loading, isResident } = useAuth();
  const t = useTranslations('syystem');
  if (loading) return <Loader text={t('loading')} />;
  if (!user) return <AccessError type="loginRequired" />;
  if (isResident) return <ResidentPage />;
  return <ManagerPage />;
}
