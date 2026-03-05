"use client";
import dynamic from "next/dynamic";
import { useAuth } from "@/shared/hooks/useAuth";

const ResidentPage = dynamic(() => import("./page.resident"));
const ManagerPage = dynamic(() => import("./page.manager"));

export default function MeterReadingsPage() {
  const { user, loading, isResident } = useAuth();
  if (loading) return <div>Загрузка...</div>;
  if (!user) return <div>Нет доступа</div>;
  if (isResident) return <ResidentPage />;
  return <ManagerPage />;
}
