'use client';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLanguage } from '@/shared/providers/LanguageProvider';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useState } from 'react';

export function HeaderHome() {
  const ts = useTranslations('system');
  const tSidebar = useTranslations('dashboard.sidebar');
  const { locale, setLocale } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLanguageChange = (newLang: string) => {
    setLocale(newLang);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
      <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center">
          <img src="/Logo1.png" alt="Domera Logo" className="w-56 h-12" />
        </div>
        <div className="hidden md:flex items-center space-x-4">
          <Link href="/login" className="text-slate-600 hover:text-blue-600 transition font-medium">
            {ts('button.login')}
          </Link>
          <Link href="/register" className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2 rounded-lg hover:shadow-lg transition duration-300">
            {ts('button.register')}
          </Link>
          <div className="relative">
            <LanguageSwitcher value={locale} onChange={handleLanguageChange} />
          </div>
        </div>
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100"
          aria-label={isMobileMenuOpen ? tSidebar('closeMenu') : tSidebar('openMenu')}
          onClick={() => setIsMobileMenuOpen(prev => !prev)}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {isMobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label={tSidebar('closeMenu')}
            className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="fixed right-0 top-0 z-50 h-full w-80 max-w-[85vw] border-l border-slate-200 bg-white shadow-2xl md:hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <span className="text-lg font-semibold text-slate-900">Domera</span>
              <button
                type="button"
                aria-label={tSidebar('closeMenu')}
                className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex h-[calc(100%-73px)] flex-col gap-6 px-5 py-6">
              <div className="flex flex-col gap-3">
                <Link
                  href="/login"
                  className="rounded-lg border border-slate-200 px-4 py-3 text-center font-medium text-slate-700 transition hover:border-blue-600 hover:text-blue-600"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {ts('button.login')}
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center font-semibold text-white transition hover:shadow-lg"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {ts('button.register')}
                </Link>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <LanguageSwitcher variant="mob" value={locale} onChange={handleLanguageChange} />
              </div>
            </div>
          </aside>
        </>
      )}
    </nav>
  );
}
