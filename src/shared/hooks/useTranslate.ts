import { useLanguage } from '../providers/LanguageProvider';

export function useTranslate() {
  const { messages } = useLanguage();
  function t(key: string, defaultValue?: string): string {
    // Поддержка вложенных ключей через точку
    const keys = key.split('.');
    let value: any = messages;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue || key;
      }
    }
    if (typeof value === 'string') return value;
    return defaultValue || key;
  }
  return { t };
}
