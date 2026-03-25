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
    <aside
      className={`fixed top-0 left-0 z-40 h-screen w-72 bg-white border-r border-gray-100 flex flex-col shadow-sm transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
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
      <div className="flex items-center justify-center px-7 py-7 border-b border-gray-100">
        <img src="/Logo1.png" alt="Domera Logo" className="w-56 h-12  object-contain" />
      </div>
      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <ul className="space-y-1">
          {roleItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base transition font-medium
                    ${isActive ? 'bg-blue-500 text-white shadow' : 'bg-white text-gray-700 hover:bg-blue-50'}
                  `}
                  style={{ marginBottom: isActive ? '16px' : '0' }}
                  onClick={setOpen ? () => setOpen(false) : undefined} // Закрывать меню при переходе
                >
                  <span className={`text-2xl shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} aria-hidden="true">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* Mobile-only user controls at the bottom */}
      <div className="block sm:hidden mt-auto px-4 pb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          {/* Notification bell */}
          <button
            className="relative p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500"
            aria-label="Уведомления"
            // TODO: Add onClick logic for notifications dropdown if needed
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          {/* User avatar */}
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
            {/* TODO: Replace with actual user avatar if available */}
            <span className="text-lg font-bold text-gray-500">{user?.name?.[0] || user?.displayName?.[0] || 'U'}</span>
          </div>
        </div>
        {/* Language switcher */}
        <div>
          {/* Use mobile variant of LanguageSwitcher */}
               <LanguageSwitcher value={locale} onChange={handleLanguageChange} />
        </div>
      </div>
    </aside>
  );
}
