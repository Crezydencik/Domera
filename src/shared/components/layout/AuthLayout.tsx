import React from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "@/shared/providers/LanguageProvider";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const { locale, setLocale } = useLanguage();
  const t = useTranslations("auth");
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Левая колонка: форма (50%) */}
      <div className="relative w-full sm:w-1/2 max-w-full bg-white shadow-xl z-10 min-h-screen flex flex-col">
        {/* Хедер закреплён сверху */}
        <div className="w-full flex items-center justify-between bg-white z-20 px-8 pt-4 pb-2" style={{minHeight: 40, position: 'sticky', top: 0}}>
          <Image src="/Logo1.png" alt="Domera Logo" width={140} height={40} priority className="h-10 w-auto" />
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
      <div className="relative hidden sm:flex w-1/2 min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-indigo-700 via-blue-700 to-violet-700">
        <div className="pointer-events-none absolute -top-16 -left-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative z-10 max-w-lg p-10 text-white">
          <span className="mb-5 inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            {t("layout.badge")}
          </span>

          <h2 className="mb-4 text-4xl font-bold leading-tight">
            {t("layout.title")}
          </h2>
          <p className="mb-8 text-lg text-white/90">
            {t("layout.subtitle")}
          </p>

          <div className="mb-8 grid gap-3">
            <div className="flex items-start gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3">
              <span className="mt-0.5 text-base">✓</span>
              <p className="text-sm text-white/95">{t("layout.feature1")}</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3">
              <span className="mt-0.5 text-base">✓</span>
              <p className="text-sm text-white/95">{t("layout.feature2")}</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3">
              <span className="mt-0.5 text-base">✓</span>
              <p className="text-sm text-white/95">{t("layout.feature3")}</p>
            </div>
          </div>

        
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;