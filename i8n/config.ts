export const locales = ['ru', 'en', 'lv'] as const;
export const defaultLocale = 'lv' as const;

export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  ru: 'Русский',
  en: 'English',
  lv: 'Latviešu',
};

export const localeFlags: Record<Locale, string> = {
  ru: '🇷🇺',
  en: '🇬🇧',
  lv: '🇱🇻',
};