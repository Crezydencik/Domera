import React from "react";
import Image from "next/image";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "@/shared/providers/LanguageProvider";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const { locale, setLocale } = useLanguage();
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Левая колонка: форма (50%) */}
      <div className="relative w-full sm:w-1/2 max-w-full bg-white shadow-xl z-10 min-h-screen flex flex-col">
        {/* Хедер закреплён сверху */}
        <div className="w-full flex items-center justify-between bg-white z-20 px-8 pt-4 pb-2" style={{minHeight: 40, position: 'sticky', top: 0}}>
          <Image src="/next.svg" alt="Logo" width={80} height={28} priority />
          <LanguageSwitcher value={locale} onChange={setLocale} />
        </div>
        {/* Центрированная форма */}
        <div className="flex-1 flex flex-col justify-center items-center">
          <div className="w-full" style={{maxWidth: 440}}>
            {children}
          </div>
        </div>
      </div>
      {/* Правая колонка: промо-блок (50%) */}
      <div className="hidden sm:flex w-1/2 min-h-screen items-center justify-center bg-indigo-600">
        <div className="max-w-md text-white p-10">
          <h2 className="text-3xl font-bold mb-4">Effortlessly manage your team and operations.</h2>
          <p className="mb-8 text-lg opacity-90">Log in to access your CRM dashboard and manage your team.</p>
          {/* Иллюстрация/графика-заглушка */}
          <div className="bg-white bg-opacity-10 rounded-lg p-6 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold">$189,374</span>
              </div>
              <div>
                <div className="text-sm opacity-80">Total Sales</div>
                <div className="text-lg font-semibold">$189,374</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold">6,248</span>
              </div>
              <div>
                <div className="text-sm opacity-80">Units Sold</div>
                <div className="text-lg font-semibold">6,248 Units</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;