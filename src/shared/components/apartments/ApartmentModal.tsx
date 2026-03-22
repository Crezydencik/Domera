import React from 'react';
import { toast } from 'react-toastify';
import { useTranslations } from 'next-intl';
import { sendPasswordResetEmail } from '@/modules/auth/services/authService';
import type { Apartment } from '../../types';
import type { ApartmentInvitationMeta, ApartmentAccountStatus } from '../../types/index';

type FirestoreDateLike = Date | string | number | { toDate?: () => Date } | null | undefined;

const formatDateTime = (value: FirestoreDateLike): string => {
  if (!value) return '—';
  try {
    if (value instanceof Date) return value.toLocaleString('ru-RU');
    if (typeof value === 'string' || typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ru-RU');
    }
    if (typeof value === 'object' && typeof value.toDate === 'function') {
      return value.toDate().toLocaleString('ru-RU');
    }
  } catch {
    return '—';
  }
  return '—';
};

const normalizeValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  return String(value);
};

interface ApartmentModalProps {
  apartment?: Apartment; // Сделал apartment необязательным
  invitationMeta?: ApartmentInvitationMeta;
  accountStatus: ApartmentAccountStatus;
  residentEmail?: string;
  residentJoinedAt?: Date; // Когда жилец присоединился
  onClose: () => void;
  onDelete: () => void;
  onUnassignResident: () => void;
  onCancelInvitation?: () => void;
  deleting: boolean;
  sendingPasswordReset: boolean;
  canDelete: boolean;
  canSendPasswordReset: boolean;
  canUnassignResident: boolean;
  pendingInvitationId?: string;
}

export const ApartmentModal: React.FC<ApartmentModalProps> = ({
  apartment,
  invitationMeta,
  accountStatus,
  residentEmail,
  residentJoinedAt,
  onClose,
  onDelete,
  onUnassignResident,
  onCancelInvitation,
  deleting,
  sendingPasswordReset,
  canDelete,
  canSendPasswordReset,
  canUnassignResident,
  pendingInvitationId,
}) => {
  const t = useTranslations();
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [sendingInvite, setSendingInvite] = React.useState(false);
  const [inviteError, setInviteError] = React.useState("");
  const [showInviteSection, setShowInviteSection] = React.useState(false);
  const [showResetForm, setShowResetForm] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState(residentEmail || "");
  const [resetLoading, setResetLoading] = React.useState(false);
  const [resetError, setResetError] = React.useState("");

  const apartmentWithMeta = apartment as (Apartment & {
    createdAt?: FirestoreDateLike;
    updatedAt?: FirestoreDateLike;
  }) | undefined;

  const managementAreaValue = typeof apartment?.managementArea === 'number' ? `${apartment.managementArea} м²` : '—';
  const heatingAreaValue = typeof apartment?.heatingArea === 'number' ? `${apartment.heatingArea} м²` : '—';

  const fullInfoRows = [
    { label: 'Адрес', value: normalizeValue(apartment?.address) },
    { label: 'Собственник', value: normalizeValue(apartment?.owner) },
    { label: 'Email собственника', value: normalizeValue(apartment?.ownerEmail) },
    { label: 'Номер квартиры', value: apartment?.number ? `#${apartment.number}` : '—' },
    { label: 'Этаж', value: normalizeValue(apartment?.floor) },
    { label: 'Площадь управления', value: managementAreaValue },
    { label: 'Площадь отопления', value: heatingAreaValue },
    { label: 'Декларированные жильцы', value: normalizeValue(apartment?.declaredResidents) },
    { label: 'Тип квартиры', value: normalizeValue(apartment?.apartmentType) },
    { label: 'Кадастровый номер', value: normalizeValue(apartment?.cadastralNumber) },
    { label: 'Кадастровая часть', value: normalizeValue(apartment?.cadastralPart) },
    { label: 'Доля общ. собственности', value: normalizeValue(apartment?.commonPropertyShare) },
    { label: 'Создано', value: formatDateTime(apartmentWithMeta?.createdAt) },
    { label: 'Обновлено', value: formatDateTime(apartmentWithMeta?.updatedAt) },
  ];

  // Форма отправки приглашения
  const handleSendInvite = async () => {
    setInviteError("");
    if (!inviteEmail || !inviteEmail.includes("@")) {
      setInviteError(t('auth.alert.invalidEmail'));
      return;
    }
    if (!apartment?.id) {
      setInviteError(t('auth.alert.apartmentNotDetermined'));
      return;
    }
    setSendingInvite(true);
    try {
      const response = await fetch("/api/invitations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apartmentId: apartment.id,
          email: inviteEmail,
          legalBasisConfirmed: true
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setInviteError(data.error || t('auth.alert.inviteSendError'));
      } else {
        toast.success(t('auth.alert.invitationSentToEmail', { email: inviteEmail }));
        setInviteEmail("");
      }
    } catch {
      setInviteError(t('auth.alert.inviteSendError'));
    } finally {
      setSendingInvite(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl">
        <div className="h-2 bg-linear-to-r from-blue-600 via-cyan-500 to-emerald-500"></div>

        <div className="max-h-[88vh] overflow-y-auto p-6 sm:p-8">
          {/* Заголовок и кнопка закрытия */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Квартира #{apartment?.number || 'Неизвестно'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">Детальная карточка квартиры и статуса жильца</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
              title="Закрыть"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Информационные блоки */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Статус аккаунта</p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                {accountStatus === 'activated' ? '✅ Активирован' : accountStatus === 'pending' ? '⏳ Ожидание' : '⚪ Не назначен'}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Email жильца</p>
              <p className="mt-2 text-base font-semibold text-slate-900 break-all">
                {residentEmail || <span className="text-amber-600">новый жилец</span>}
              </p>
            </div>

            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Последнее приглашение</p>
              {invitationMeta && accountStatus === 'pending' ? (
                <div className="mt-2 space-y-1 text-sm text-slate-800">
                  <p className="break-all font-medium">{invitationMeta.email}</p>
                  <p className="text-slate-600">{invitationMeta.sentAt ? new Date(invitationMeta.sentAt).toLocaleString('ru-RU') : '—'}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">Приглашения не отправлены</p>
              )}
            </div>

            {accountStatus === 'activated' && residentJoinedAt && (
              <div className="md:col-span-3 rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Дата присоединения жильца</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {new Date(residentJoinedAt).toLocaleString('ru-RU', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}

            <details className="group md:col-span-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-sm">ℹ️</span>
                  <p className="text-sm font-bold uppercase tracking-wide text-slate-700">Вся информация по квартире</p>
                </div>
                <svg className="h-5 w-5 text-slate-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>

              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <dl className="divide-y divide-slate-100">
                  {fullInfoRows.map((item) => (
                    <div key={item.label} className="grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[260px_1fr] md:gap-4">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</dt>
                      <dd className="text-sm font-semibold text-slate-900 wrap-break-word">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          </div>

        {/* Кнопки действий */}
        {(residentEmail || canUnassignResident || pendingInvitationId) && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {residentEmail && !showResetForm && (
              <button
                type="button"
                onClick={() => { setShowResetForm(true); setResetEmail(residentEmail || ''); setResetError(''); }}
                disabled={!canSendPasswordReset || sendingPasswordReset}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingPasswordReset ? 'Отправка...' : 'Сбросить пароль'}
              </button>
            )}

            {pendingInvitationId && onCancelInvitation && (
              <button
                type="button"
                onClick={onCancelInvitation}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                Отменить приглашение
              </button>
            )}

            <button
              type="button"
              onClick={onDelete}
              disabled={!canDelete || deleting}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? 'Удаление...' : 'Удалить квартиру'}
            </button>

            <button
              type="button"
              onClick={onUnassignResident}
              disabled={!canUnassignResident}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Удалить жильца
            </button>
          </div>
        )}

        {/* Форма приглашения нового жильца */}
        {(showInviteSection || accountStatus !== 'activated') && (
          <div className="mb-6 rounded-2xl bg-linear-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 p-4">
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Пригласить нового жильца
            </h4>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="Email нового жильца"
                className="flex-1 min-w-50 rounded-xl bg-white border-2 border-gray-200 text-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={sendingInvite}
              />
              <button
                type="button"
                onClick={async () => {
                  await handleSendInvite();
                }}
                disabled={sendingInvite || !inviteEmail}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
              >
                {sendingInvite ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
            {inviteError && <p className="text-red-600 mt-2 text-sm font-medium">{inviteError}</p>}
          </div>
        )}

        {/* Форма сброса пароля */}
        {showResetForm && (
          <div className="mb-6 rounded-2xl bg-linear-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 p-4">
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Сброс пароля
            </h4>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setResetError('');
                const email = (resetEmail || '').trim().toLowerCase();
                if (!email || !email.includes('@')) {
                  setResetError(t('auth.alert.invalidEmail'));
                  return;
                }
                setResetLoading(true);
                try {
                  await sendPasswordResetEmail(email);
                  toast.success(t('auth.alert.resetEmailSentTo', { email }));
                  setShowResetForm(false);
                } catch (err: unknown) {
                  console.error('Error sending reset email:', err);
                  const msg = err instanceof Error ? err.message : String(err ?? '');
                  setResetError(msg || t('auth.alert.resetEmailSendError'));
                } finally {
                  setResetLoading(false);
                }
              }}
            >
              <div className="grid grid-cols-1 gap-3">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Email для сброса</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Email жильца"
                  className="w-full rounded-xl bg-white border-2 border-gray-200 text-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={resetLoading}
                />

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {resetLoading ? 'Отправка...' : 'Отправить'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowResetForm(false); setResetError(''); }}
                    className="rounded-xl border-2 border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 transition"
                  >
                    Отмена
                  </button>
                </div>

                {resetError && <p className="text-red-600 mt-2 text-sm font-medium">{resetError}</p>}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};
