import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NotificationsDropdown, NotificationItem } from '../ui/NotificationsDropdown';
import { getInvitationByEmail } from '@/modules/invitations/services/invitationsService';
import Link from 'next/link';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../../providers/LanguageProvider';
import { HeaderProps } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useTranslations } from 'next-intl';



const Header: React.FC<HeaderProps> = ({ userName = '',  userAvatarUrl = '', userEmail = '', pageTitle = 'Dashboard', onLogout, right }) => {
  const ts = useTranslations('system');
  const tp = useTranslations('dashboard.profile');
  const { user, refreshUser } = useAuth();
  // Дефолтная функция выхода, если onLogout не передан
  const handleLogout = onLogout || (() => { window.location.href = '/login'; });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pendingInvitation, setPendingInvitation] = useState<null | { id: string; apartmentId: string; token?: string }>(null);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const LANGUAGES = [
    { code: 'lv', label: 'LV' },
    { code: 'ru', label: 'RU' },
    { code: 'en', label: 'EN' },
  ];
  const [lang, setLang] = useState('lv'); // TODO: get/set from user/profile/global
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { locale, setLocale } = useLanguage();
  const handleLanguageChange = (newLang: string) => {
    setLocale(newLang);
    };
    
  // Формируем массив уведомлений мемоизированно
  const notifications: NotificationItem[] = useMemo(() => {
    const notifs: NotificationItem[] = [];
    if (pendingInvitation) {
      notifs.push({
        id: 'invite',
        type: 'invite',
        title: 'Вам пришло приглашение!',
        message: 'Вас пригласили присоединиться к квартире.',
        link: pendingInvitation.token
          ? `/accept-invitation?token=${pendingInvitation.token}`
          : '/login',
        linkLabel: 'Принять приглашение'
      });
    }
    if (user && (!user.phone || !(user.displayName || user.name))) {
      notifs.push({
        id: 'profile-incomplete',
        type: 'warning',
        title: tp('profileIncompleteTitle'),
        message: tp('profileIncompleteMessage'),
        link: '/profile',
        linkLabel: tp('profileIncompleteAction')
      });
    }
    return notifs;
  }, [user, pendingInvitation, tp]);
    // Check for pending invitation on mount or when userEmail changes
    useEffect(() => {
      let ignore = false;
    async function checkInvitation() {
      if (!userEmail) return;
      try {
        const inv = await getInvitationByEmail(userEmail);
        if (!ignore && inv && inv.status === 'pending') {
          setPendingInvitation({ id: inv.id, apartmentId: inv.apartmentId, token: inv.token });
        } else if (!ignore) {
          setPendingInvitation(null);
        }
      } catch {
        if (!ignore) setPendingInvitation(null);
      }
    }
    checkInvitation();
    return () => { ignore = true; };
  }, [userEmail]);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Не закрывать, если клик был по элементу с data-dropdown-interactive
      const target = event.target as HTMLElement;
      if (target.closest('[data-dropdown-interactive]')) return;
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);



  return (
    <header className="bg-white w-full border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        {/* Left: Title and subtitle */}
        <div className="flex flex-col">
          <span className="text-3xl font-bold text-gray-900 leading-tight">{pageTitle}</span>
        </div>
        {/* Right: custom right prop + Search, theme, bell, user */}
        <div className="flex items-center gap-4">
          {right && <div>{right}</div>}
          {/* Search bar */}
          {/* <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search"
              className="pl-10 pr-4 py-2 rounded-full bg-gray-100 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 w-64"
            />
          </div> */}
          {/* Theme toggle */}
          {/* <div className="flex items-center bg-gray-100 rounded-full px-2 py-1 gap-1">
            <button className="p-2 rounded-full hover:bg-gray-200 text-gray-500">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>
            <button className="p-2 rounded-full hover:bg-gray-200 text-gray-500">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
              </svg>
            </button>
          </div> */}
          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button
              className="relative p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Открыть уведомления"
            >
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
            <NotificationsDropdown
              open={notifOpen}
              onClose={() => setNotifOpen(false)}
              anchorRef={notifRef}
              notifications={notifications}
            />
          </div>
          {/* User avatar, name, dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              className="flex items-center gap-2 focus:outline-none"
              onClick={() => setDropdownOpen((v) => !v)}
            >
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-400">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M6 20c0-2.21 3.58-4 6-4s6 1.79 6 4" />
                  </svg>
                )}
              </div>
              <span className="text-gray-700 font-medium">{userName}</span>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className={`text-gray-400 ml-1 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-3 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 animate-fade-in" data-dropdown-interactive>
                <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                    {userAvatarUrl ? (
                      <img src={userAvatarUrl} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-400">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M6 20c0-2.21 3.58-4 6-4s6 1.79 6 4" />
                      </svg>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-gray-900 truncate">{userName}</span>
                    <span className="text-gray-500 text-sm truncate">{userEmail}</span>
                  </div>
                </div>
                <div className="py-2">
                  <a href="/profile" className="w-full flex items-center gap-3 px-5 py-2 text-gray-700 hover:bg-gray-50 transition text-left" data-dropdown-interactive>
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M6 20c0-2.21 3.58-4 6-4s6 1.79 6 4" />
                    </svg>
                  {ts('viewprofile')}
                  </a>

                </div>
                <div className="border-t border-gray-100">
                  <button
                    className="w-full flex items-center gap-3 px-5 py-2 text-red-600 hover:bg-gray-50 transition text-left"
                    onClick={handleLogout}
                    data-dropdown-interactive
                  >
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17 16l4-4m0 0l-4-4m4 4H7" />
                      <path d="M3 12a9 9 0 0118 0 9 9 0 01-18 0z" />
                    </svg>
                    {ts('button.logout')}
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Language selector */}
                 <LanguageSwitcher value={locale} onChange={handleLanguageChange} />
        </div>
      </div>
    </header>
  );
};

export default Header;
