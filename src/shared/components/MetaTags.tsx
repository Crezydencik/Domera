"use client";
import { useLanguage } from "@/shared/providers/LanguageProvider";

const metaByLocale = {
  lv: {
    title: "Domera — dzīvokļu pārvaldība kļuvusi vienkārša",
    description: "Domera platforma māju, dzīvokļu un maksājumu pārvaldībai. Tā nodrošina rīkus gan pārvaldniekiem, gan iedzīvotājiem, lai vienkāršotu saziņu un darbības procesus.",
    keywords: "dzīvokļu pārvaldība, māju apsaimniekošana, maksājumu pārvaldība, SaaS, nekustamā īpašuma pārvaldīšana, iedzīvotāju portāls, pārvaldnieka panelis"
  },
  ru: {
    title: "Domera — управление недвижимостью стало проще",
    description: "Domera платформа для управления домами, квартирами и платежами. Она предоставляет инструменты для управляющих и жильцов, упрощая общение и операционные процессы.",
    keywords: "управление квартирами, управление домом, управление платежами, SaaS, управление недвижимостью, портал для жильцов, панель управления"
  },
  en: {
    title: "Domera - Apartment management made easy",
    description: "Domera platform for managing houses, apartments, and payments. It provides tools for both managers and residents to streamline communication and operations.",
    keywords: "apartment management, house management, payment management, SaaS, property management, resident portal, manager dashboard"
  }
};

export default function MetaTags() {
  const { locale } = useLanguage();
  const meta = metaByLocale[locale] || metaByLocale.lv;
  return (
    <>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <meta name="keywords" content={meta.keywords} />
      <link rel="icon" href="/logo home.ico" type="image/x-icon" />
    </>
  );
}
