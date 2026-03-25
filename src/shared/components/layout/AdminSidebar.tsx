'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ROUTES } from '@/shared/constants';
import { FiHome, FiLayers, FiClipboard, FiUsers, FiBarChart2, FiUser } from 'react-icons/fi';
import type { User } from '@/shared/types';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../../providers/LanguageProvider';
// import { LanguageSwitcher } from '../../components/LanguageSwitcher';

interface AdminSidebarProps {
  user: User;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}




export function AdminSidebar({ user, open, setOpen }: AdminSidebarProps) {
  // Оверлей для мобильного сайдбара
  const showOverlay = typeof open === 'boolean' && open && !!setOpen;
  const pathname = usePathname();
   const t = useTranslations('dashboard');
  const MANAGEMENT_NAV_ITEMS = [
    { href: ROUTES.DASHBOARD, label: t('sidebar.home'), icon: <FiHome /> },
    { href: ROUTES.BUILDINGS, label: t('sidebar.buildings'), icon: <FiLayers /> },
    { href: ROUTES.APARTMENTS, label: t('sidebar.apartments'), icon: <FiClipboard /> },
    { href: ROUTES.METER_READINGS, label: t('sidebar.readings'), icon: <FiBarChart2 /> },
    { href: ROUTES.PROFILE, label: t('sidebar.profile'), icon: <FiUser /> },
  ];
  const RESIDENT_NAV_ITEMS = [
    { href: ROUTES.DASHBOARD, label: t('sidebar.home'), icon: <FiHome /> },
    { href: ROUTES.APARTMENTS, label: t('sidebar.apartment'), icon: <FiClipboard /> },
    { href: ROUTES.METER_READINGS, label: t('sidebar.readings'), icon: <FiBarChart2 /> },
    { href: ROUTES.PROFILE, label: t('sidebar.profile'), icon: <FiUser /> },
  ];
  const roleItems = user.role === 'Resident' ? RESIDENT_NAV_ITEMS : MANAGEMENT_NAV_ITEMS;
 
   const { locale, setLocale } = useLanguage();
     const handleLanguageChange = (newLang: string) => {
    setLocale(newLang);
    };
  return (
    <>
      {/* Overlay for mobile */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-40 md:hidden transition-opacity duration-300"
          onClick={() => setOpen(false)}
          aria-label="Закрыть меню"
        />
      )}
      <aside
        className={`fixed top-0 left-0 z-40 bg-white border-r border-gray-100 flex flex-col shadow-sm transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          w-screen h-screen p-0 m-0
          md:translate-x-0 md:w-full md:h-screen md:max-w-[18rem] md:max-h-screen
        `}
      >
      {/* Кнопка закрытия только на мобильных */}
      {setOpen && (
        <button
          className="absolute top-4 right-4 z-50 p-2 bg-gray-200 rounded-full md:hidden"
          onClick={() => setOpen(false)}
          aria-label="Закрыть меню"
        >
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
        </button>
      )}
      {/* Логотип */}
      <div className="flex items-center justify-between border-b border-gray-100 w-full px-4 md:px-7 py-4">
        <div className="flex items-center gap-2">
          <img src="/Logo1.png" alt="Domera Logo" className="h-8 w-auto object-contain" />
         </div>
        {setOpen && (
          <button
            className="p-2 bg-gray-200 rounded-full md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Закрыть меню"
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
          </button>
        )}
      </div>
      <nav className="flex-1 px-0 py-6 md:px-4 overflow-y-auto">
        <ul className="space-y-3 px-4 md:px-0">
          {roleItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-xl px-0 py-3 text-lg font-bold transition
                    ${isActive ? 'text-blue-600' : 'text-gray-900'}
                  `}
                  onClick={setOpen ? () => setOpen(false) : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* Блок внизу сайдбара для мобильной версии */}
      <div className="block sm:hidden w-full px-4 pb-6 mt-auto sticky bottom-0 bg-white">
        <LanguageSwitcher variant="mob" value={locale} onChange={handleLanguageChange} />
        <button
          className="w-full rounded-full bg-red-300 text-[#1A2A49] font-bold py-2 text-base mt-4"
          onClick={async () => {
            try {
              const { logout } = await import('@/modules/auth/services/authService');
              await logout();
              await fetch('/api/auth/clear-cookies', { method: 'POST', credentials: 'include' });
              window.location.href = '/login';
            } catch (e) {
              // Можно добавить обработку ошибок
            }
          }}
        >Log out</button>
      </div>
    </aside>
    </>
)}
