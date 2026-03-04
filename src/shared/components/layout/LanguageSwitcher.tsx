'use-client'
import { useState, useTransition } from 'react';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'lv', label: 'Latviešu' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

type LanguageSwitcherProps = {
  variant?: 'desk' | 'mob';
  value?: string;
  onChange?: (lang: string) => void;
};

export function LanguageSwitcher({ variant = 'desk', value = 'lv', onChange }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const currentLang = value;

  const changeLanguage = (lang: string) => {
    if (onChange) {
      startTransition(() => {
        onChange(lang);
      });
    }
  };

  if (variant === 'desk') {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen(prev => !prev)}
          className="  flex items-center justify-center text-sm font-semibold text-black   transition"
          aria-label="Change language"
        >
          <Globe className="w-5 h-5 mr-1 text-black" />
          {currentLang.toUpperCase()}
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-20 rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden z-50">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => {
                  setOpen(false);
                  changeLanguage(l.code);
                }}
                disabled={l.code === currentLang || isPending}
                className={`w-full py-2 text-sm font-medium transition ${l.code === currentLang ? 'bg-black text-white cursor-default' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // MOBILE VARIANT
  return (
    <div className="w-full">
      <span className="block text-lgg text-black mb-3">Выберите язык</span>
      <button
        onClick={() => setMobileOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-m border border-blue-200 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl"><Globe /></span>
          <span className="font-medium">{LANGUAGES.find(l => l.code === currentLang)?.label}</span>
        </div>
      </button>
      {mobileOpen && (
        <div className="mt-2 flex flex-col gap-2">
          {LANGUAGES.filter(l => l.code !== currentLang).map(l => (
            <button
              key={l.code}
              onClick={() => {
                setMobileOpen(false);
                changeLanguage(l.code);
              }}
              disabled={l.code === currentLang || isPending}
              className={`flex items-center gap-3 px-4 py-3 rounded-m border text-left ${l.code === currentLang ? 'border-gray-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <span className="font-medium">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
