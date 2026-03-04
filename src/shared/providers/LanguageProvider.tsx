"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { defaultLocale } from "../../../i8n/config";

interface LanguageContextProps {
  locale: string;
  setLocale: (locale: string) => void;
  messages: any;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1] || defaultLocale;
    }
    return defaultLocale;
  });
  const [messages, setMessages] = useState<any | null>(null);

  useEffect(() => {
    setMessages(null); // сбрасываем, чтобы показать лоадер
    (async () => {
      const msgs = (await import(`../../../messages/${locale}.json`)).default;
      setMessages(msgs);
      document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;
    })();
  }, [locale]);

  if (!messages) {
    return <div style={{padding: 32, textAlign: 'center'}}>Загрузка...</div>;
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, messages }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  );
}
