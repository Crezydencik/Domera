import React from 'react';

import type { Apartment, Building } from '../../types';
import type { ApartmentAccountStatus, ApartmentInvitationMeta } from '../../types/apartments';

interface ApartmentCardProps {
  apartment: Apartment;
  buildingName: string;
  invitationMeta?: ApartmentInvitationMeta;
  accountStatus: ApartmentAccountStatus;
  residentEmail?: string;
  isManagementCompany: boolean;
  onInfo: (apartment: Apartment) => void;
  onDelete: (apartment: Apartment) => void;
  onSendPasswordReset: (apartment: Apartment) => void;
  deleting: boolean;
  sendingPasswordReset: boolean;
}

export const ApartmentCard: React.FC<ApartmentCardProps> = ({
  apartment,
  buildingName,
  invitationMeta,
  accountStatus,
  residentEmail,
  isManagementCompany,
  onInfo,
  onDelete,
  onSendPasswordReset,
  deleting,
  sendingPasswordReset,
}) => {
  // Static content replacing translations
  const statusKey =
    accountStatus === 'activated'
      ? 'Активирован'
      : accountStatus === 'pending'
      ? 'Ожидает'
      : 'Неактивен';

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-800/80 p-6 shadow-lg shadow-slate-950/30 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-slate-500/80">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-linear-to-r from-blue-500/10 via-indigo-400/10 to-transparent" />
      <div className="relative text-left pr-36">
        <h3 className="text-xl font-semibold text-white tracking-tight">{apartment.number}</h3>
        <p className="text-gray-400 text-sm mt-1">{buildingName}</p>
        {invitationMeta ? (
          <>
            <p className="text-gray-300 text-sm mt-3">Отправлено на: {invitationMeta.email}</p>
            <p className="text-gray-400 text-sm">Дата отправки: {invitationMeta.sentAt?.toString() || 'Неизвестно'}</p>
          </>
        ) : (
          <p className="text-gray-400 text-sm mt-3">Приглашения не отправлены</p>
        )}
        <span className={`mt-4 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium`}>{statusKey}</span>
      </div>
      {isManagementCompany && (
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-xl border border-slate-600/70 bg-slate-900/70 p-1.5 shadow-lg shadow-slate-950/40 backdrop-blur">
          <button
            type="button"
            onClick={() => onInfo(apartment)}
            aria-label="Информация"
            title="Информация"
            className="group/btn relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 bg-slate-700/80 text-slate-100 transition hover:border-blue-500/60 hover:bg-slate-600"
          >
            {/* ...svg... */}
          </button>
          <button
            type="button"
            onClick={() => onDelete(apartment)}
            disabled={deleting}
            aria-label="Удалить"
            title="Удалить"
            className="group/btn relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-700/70 bg-red-900/30 text-red-300 transition hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {/* ...svg... */}
          </button>
          <button
            type="button"
            onClick={() => onSendPasswordReset(apartment)}
            disabled={sendingPasswordReset || accountStatus !== 'activated'}
            aria-label="Повторная отправка пароля"
            title="Повторная отправка пароля"
            className="group/btn relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-700/70 bg-blue-900/30 text-blue-300 transition hover:bg-blue-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {/* ...svg... */}
          </button>
        </div>
      )}
    </div>
  );
};
