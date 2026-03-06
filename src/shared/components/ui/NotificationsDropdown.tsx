import React, { use } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export interface NotificationItem {
  id: string;
  type: 'info' | 'warning' | 'invite';
  title: string;
  message: string;
  link?: string;
  linkLabel?: string;
}

interface NotificationsDropdownProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLDivElement>;
  notifications: NotificationItem[];
}

const iconMap = {
  info: '🔔',
  warning: '⚠️',
  invite: '🏠',
};

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ open, onClose, anchorRef, notifications }) => {
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (anchorRef.current && !anchorRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, anchorRef, onClose]);
  const t = useTranslations('system.notifications');
  if ( !open) return null;

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 animate-fade-in p-4">
      <div className="flex flex-col gap-4">
        {notifications.length === 0 && (
          <div className="flex items-start gap-3 bg-yellow-50 rounded-xl p-4 shadow-sm">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-yellow-100 text-yellow-600 text-2xl">🔔</span>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">{t('noNewNotifications')}</div>
              <div className="text-gray-500 text-sm">{t('allEventsViewed')}</div>
            </div>
          </div>
        )}
        {notifications.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 rounded-xl p-4 shadow-sm ${n.type === 'warning' ? 'bg-yellow-50' : n.type === 'invite' ? 'bg-blue-50' : 'bg-gray-50'}`}>
            <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${n.type === 'warning' ? 'bg-yellow-100 text-yellow-600' : n.type === 'invite' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'} text-2xl`}>{iconMap[n.type]}</span>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 text-lg mb-1">{n.title}</div>
              <div className="text-gray-500 text-sm mb-1">{n.message}</div>
              {n.link && n.linkLabel && (
                <Link href={n.link} className="inline-block text-blue-600 hover:underline text-sm font-semibold mt-1" onClick={onClose}>
                  {n.linkLabel}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
