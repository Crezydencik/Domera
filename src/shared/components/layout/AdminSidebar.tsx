'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ROUTES } from '@/shared/constants';
import { FiHome, FiLayers, FiClipboard, FiUsers, FiBarChart2, FiUser } from 'react-icons/fi';
import type { User } from '@/shared/types';
import { useTranslations } from 'next-intl';


interface AdminSidebarProps {
  user: User;
}




export function AdminSidebar({ user }: AdminSidebarProps) {
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

  return (
    <aside className="fixed top-0 left-0 z-40 h-screen w-72 bg-white border-r border-gray-100 flex flex-col shadow-sm">
      {/* Логотип и название */}
      <div className="flex items-center gap-3 px-7 py-7 border-b border-gray-100">
        <span className="inline-block w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-400 to-indigo-500 flex items-center justify-center">
          {/* SVG-логотип */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><ellipse cx="14" cy="14" rx="14" ry="14" fill="#fff"/><path d="M7 21V7h7a7 7 0 110 14H7z" fill="#6366F1"/><path d="M21 21a7 7 0 01-7-7V7h7v14z" fill="#38BDF8"/></svg>
        </span>
        <span className="font-extrabold text-2xl text-gray-900 tracking-tight">Modernize</span>
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
                >
                  <span className={`text-2xl shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} aria-hidden="true">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
             