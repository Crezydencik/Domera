'use-client'
import { useState, useTransition } from 'react';
import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
  const ts = useTranslations('system');

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

  // MOBILE VARIANT (селектор)
  return (
    <div className="w-full relative">
      <span className="block text-base font-semibold text-black mb-3">{ts('changeLanguage')}</span>
      <button
        onClick={() => setMobileOpen(prev => !prev)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-200 text-left font-medium text-[#1A2A49] text-lg bg-white relative z-10 shadow"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={mobileOpen}
      >
        <span className="text-2xl"><Globe /></span>
        <span>{LANGUAGES.find(l => l.code === currentLang)?.label}</span>
        <svg className={`ml-auto w-5 h-5 transition-transform ${mobileOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {mobileOpen && (
        <div className="absolute top-0 left-0 w-full bg-white rounded-xl border border-gray-200 shadow-2xl z-50 flex flex-col" style={{marginTop: 0}}>
          {LANGUAGES.filter(l => l.code !== currentLang).map(l => (
            <button
              key={l.code}
              onClick={() => {
                setMobileOpen(false);
                changeLanguage(l.code);
              }}
              disabled={isPending}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-medium text-[#1A2A49] text-lg hover:bg-gray-50"
              role="option"
            >
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
