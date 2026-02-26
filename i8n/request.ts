import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, locales, type Locale } from './config';

export default getRequestConfig(async () => {
  // 1. Читаем cookie NEXT_LOCALE (который установил middleware.ts)
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value;
  
  // 2. Проверяем, что язык валидный (ru/en/de)
  const locale: Locale = 
    localeCookie && locales.includes(localeCookie as Locale)
      ? (localeCookie as Locale)
      : defaultLocale;

  // 3. Возвращаем язык и загружаем соответствующий JSON
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});