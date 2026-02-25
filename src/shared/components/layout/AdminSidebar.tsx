'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ROUTES } from '@/shared/constants';
import { logout } from '@/modules/auth/services/authService';
import type { User } from '@/shared/types';

const MANAGEMENT_NAV_ITEMS = [
  { href: ROUTES.DASHBOARD, label: 'Главная', icon: '🏠' },
  { href: ROUTES.BUILDINGS, label: 'Здания', icon: '🏢' },
  { href: ROUTES.APARTMENTS, label: 'Квартиры', icon: '🏠' },
  { href: ROUTES.METER_READINGS, label: 'Показания', icon: '📊' },
  // ...удалено: ссылка на настройки...
  { href: ROUTES.INVOICES, label: 'Счета', icon: '📄' },
  { href: ROUTES.PROFILE, label: 'Профиль', icon: '👤' },
];

const RESIDENT_NAV_ITEMS = [
  { href: ROUTES.DASHBOARD, label: 'Главная', icon: '🏠' },
  { href: ROUTES.APARTMENTS, label: 'Квартира', icon: '🏠' },
  { href: ROUTES.METER_READINGS, label: 'Показания', icon: '📊' },
  { href: ROUTES.INVOICES, label: 'Счета', icon: '📄' },
  { href: ROUTES.PROFILE, label: 'Профиль', icon: '👤' },
];

interface AdminSidebarProps {
  user: User;
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [search, setSearch] = useState('');

  const roleItems = user.role === 'Resident' ? RESIDENT_NAV_ITEMS : MANAGEMENT_NAV_ITEMS;

  const filteredItems = roleItems.filter((item) =>
    item.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await logout();
      await fetch('/api/auth/clear-cookies', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const toggleTheme = () => {
    // Theme toggle logic can be implemented here if needed
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMenuOpen((prev) => !prev)}
        className="md:hidden fixed top-4 left-4 z-50 px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700"
        aria-label="Открыть навигацию"
      >
        {isMenuOpen ? '✕' : '☰'}
      </button>

      {isMenuOpen && (
        <button
          type="button"
          aria-label="Закрыть меню"
          onClick={() => setIsMenuOpen(false)}
          className="md:hidden fixed inset-0 bg-black/50 z-30"
        />
      )}

      <aside
        className={[
          'fixed top-0 left-0 z-40 h-screen w-72 bg-slate-900 border-r border-slate-700 transition-transform duration-300',
          isMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <div className="h-full flex flex-col">
          <div className="px-4 py-4 border-b border-slate-700">
            <div className="overflow-hidden">
              <h1 className="text-2xl font-bold text-white whitespace-nowrap">🏢 Domera</h1>
              <p className="text-sm text-gray-400 mt-1">
                {user.role === 'Resident' ? 'Резидент' : 'Управляющий'}
              </p>
            </div>
            <input
              type="text"
              placeholder="Поиск"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-3 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500"
            />
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
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition',
                    isActive
                      ? 'bg-blue-600 text-white border border-blue-500'
                      : 'text-gray-300 hover:bg-slate-800 hover:text-white border border-transparent',
                  ].join(' ')}
                >
                  <span className="text-base shrink-0" aria-hidden="true">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
            {!filteredItems.length && (
              <p className="px-3 pt-3 text-sm text-slate-400">Ничего не найдено</p>
            )}
          </nav>

          <div className="px-4 py-4 border-t border-slate-700 bg-slate-900">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full mb-3 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-200 hover:bg-slate-700 transition"
            >
              Сменить тему
            </button>
            <p className="text-xs text-gray-400 mb-1">Пользователь</p>
            <p className="text-sm text-white truncate mb-3">{user.email}</p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 transition disabled:opacity-60"
            >
              {isLoggingOut ? 'Выход...' : 'Выйти'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
