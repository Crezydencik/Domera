'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ROUTES } from '@/shared/constants';
import { logout } from '@/modules/auth/services/authService';
import type { User } from '@/shared/types';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '@/shared/providers/LanguageProvider';


interface AdminSidebarProps {
  user: User;
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false); 
  const [search, setSearch] = useState('');
  const t = useTranslations('dashboard');
  const { locale, setLocale } = useLanguage();
  const handleLanguageChange = (newLang: string) => {
    setLocale(newLang);
  };
  const MANAGEMENT_NAV_ITEMS = [
    { href: ROUTES.DASHBOARD, label: t('sidebar.home'), icon: '🏠' },
    { href: ROUTES.BUILDINGS, label: t('sidebar.buildings'), icon: '🏢' },
    { href: ROUTES.APARTMENTS, label: t('sidebar.apartments'), icon: '🏠' },
    { href: ROUTES.METER_READINGS, label: t('sidebar.readings'), icon: '📊' },
    // ...удалено: ссылка на настройки...
    // { href: ROUTES.INVOICES, label: t('sidebar.invoices'), icon: '📄' },
    { href: ROUTES.PROFILE, label: t('sidebar.profile'), icon: '👤' },
  ];
  
  const RESIDENT_NAV_ITEMS = [
    { href: ROUTES.DASHBOARD, label: t('sidebar.home'), icon: '🏠' },
    { href: ROUTES.APARTMENTS, label: t('sidebar.apartment'), icon: '🏠' },
    { href: ROUTES.METER_READINGS, label: t('sidebar.readings'), icon: '📊' },
    // { href: ROUTES.INVOICES, label: t('sidebar.invoices'), icon: '📄' },
    { href: ROUTES.PROFILE, label: t('sidebar.profile'), icon: '👤' },
  ];
  const roleItems = user.role === 'Resident' ? RESIDENT_NAV_ITEMS : MANAGEMENT_NAV_ITEMS;

  const filteredItems = roleItems.filter((item) =>
    item.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  // const handleLogout = async () => {
  //   if (isLoggingOut) return;

  //   setIsLoggingOut(true);
  //   try {
  //     await logout();
  //     await fetch('/api/auth/clear-cookies', { method: 'POST' });
  //     router.push('/login');
  //     router.refresh();
  //   } catch (error) {
  //     console.error('Logout error:', error);
  //   } finally {
  //     setIsLoggingOut(false);
  //   }
  // };

  // const toggleTheme = () => {
  //   // Theme toggle logic can be implemented here if needed
  // };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMenuOpen((prev) => !prev)}
        className="md:hidden fixed top-4 left-4 z-50 px-3 py-2 bg-white text-blue-700 rounded-lg border border-blue-200 shadow"
        aria-label={isMenuOpen ? t('sidebar.closeMenu') : t('sidebar.openMenu')}
      >
        {isMenuOpen ? '✕' : '☰'}
      </button>

      {isMenuOpen && (
        <button
          type="button"
          aria-label={t('sidebar.closeMenu')}
          onClick={() => setIsMenuOpen(false)}
          className="md:hidden fixed inset-0 bg-black/50 z-30"
        />
      )}

      <aside
        className={[ 
          'fixed top-0 left-0 z-40 h-screen w-72 bg-white border-r border-gray-200 transition-transform duration-300 shadow-lg',
          isMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <div className="h-full flex flex-col">
          {/* Language Switcher */}
          <div className="px-4 py-2 border-b border-gray-100 bg-gradient-to-tr from-green-50 to-blue-50 flex justify-end">
  
          </div>
          <div className="px-4 py-4 border-b border-gray-200 bg-gradient-to-tr from-green-50 to-blue-50">
            <div className="overflow-hidden flex items-center gap-2">
              <span className="inline-block w-8 h-8 rounded-full bg-gradient-to-tr from-green-300 to-blue-400 flex items-center justify-center text-white text-xl font-bold shadow mr-1">🏢</span>
              <h1 className="text-2xl font-bold text-blue-700 whitespace-nowrap">Domera</h1>
            </div>
            <p className="text-sm text-green-700 mt-1 font-semibold">
              {user.role === 'Resident' ? t('sidebar.resident') : t('sidebar.manager')}
            </p>
            {/* <input
              type="text"
              placeholder={t('sidebar.search')} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-3 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500"
            /> */}
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {filteredItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={[ 
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-base transition font-medium',
                    isActive
                      ? 'bg-gradient-to-tr from-green-400 to-blue-500 text-white border border-blue-400 shadow'
                      : 'text-blue-700 hover:bg-green-50 hover:text-green-700 border border-transparent',
                  ].join(' ')}
                >
                  <span className="text-lg shrink-0" aria-hidden="true">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
            {!filteredItems.length && (
              <p className="px-3 pt-3 text-sm text-gray-400">{t('sidebar.noResults')}</p>
            )}
          </nav>

          <div className="px-4 py-4 border-t border-gray-200 bg-gradient-to-tr from-green-50 to-blue-50">
            {/* <button
              type="button"
              onClick={toggleTheme}
              className="w-full mb-3 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-200 hover:bg-slate-700 transition"
            >
              {t('sidebar.changeTheme')}
            </button> */}
            {/* <p className="text-xs text-blue-700 mb-1 font-semibold">{t('sidebar.user')}</p>
            <p className="text-sm text-gray-700 truncate mb-3">{user.email}</p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full px-3 py-2 rounded-lg bg-gradient-to-tr from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white font-semibold shadow transition disabled:opacity-60"
            >
              {isLoggingOut ? t('sidebar.loggingOut') : t('sidebar.logout')}
            </button> */}
          </div>
        </div>
      </aside>
    </>
  );
}
