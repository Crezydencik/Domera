import React from 'react';
import { toast } from 'react-toastify';
import { sendPasswordResetEmail } from '@/modules/auth/services/authService';
import type { Apartment } from '../../types';
import type { ApartmentInvitationMeta, ApartmentAccountStatus } from '../../types/index';

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
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [sendingInvite, setSendingInvite] = React.useState(false);
  const [inviteError, setInviteError] = React.useState("");
  const [showInviteSection, setShowInviteSection] = React.useState(false);
  const [showResetForm, setShowResetForm] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState(residentEmail || "");
  const [resetLoading, setResetLoading] = React.useState(false);
  const [resetError, setResetError] = React.useState("");

  // Форма отправки приглашения
  const handleSendInvite = async () => {
    setInviteError("");
    if (!inviteEmail || !inviteEmail.includes("@")) {
      setInviteError("Введите корректный email");
      return;
    }
    if (!apartment?.id) {
      setInviteError("Не удалось определить квартиру");
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
        setInviteError(data.error || "Ошибка при отправке приглашения");
      } else {
        toast.success(`Приглашение отправлено на ${inviteEmail}`);
        setInviteEmail("");
      }
    } catch {
      setInviteError("Ошибка при отправке приглашения");
    } finally {
      setSendingInvite(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl border-2 border-gray-100 bg-white p-0 shadow-2xl overflow-hidden">
        {/* Заголовок с градиентом */}
        <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
        
        <div className="p-6">
          {/* Заголовок и кнопка закрытия */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                Квартира #{apartment?.number || 'Неизвестно'}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
              title="Закрыть"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Информационные блоки */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Статус аккаунта</p>
              <p className="mt-2 text-sm font-medium text-gray-900">
                {accountStatus === 'activated' ? '✓ Активирован' : accountStatus === 'pending' ? '⏳ Ожидание' : '○ Не назначен'}
              </p>
            </div>
            
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Email жильца</p>
              <p className="mt-2 text-sm font-medium text-gray-900">
                {residentEmail || (
                  <span className="text-amber-600">новый жилец</span>
                )}
              </p>
            </div>

            {accountStatus === 'activated' && residentJoinedAt && (
              <div className="rounded-lg bg-cyan-50 border border-cyan-100 p-4">
                <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wide">Дата присоединения</p>
                <p className="mt-2 text-sm font-medium text-gray-900">
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

            <div className={`${accountStatus === 'activated' && residentJoinedAt ? 'md:col-span-1' : 'md:col-span-2'} rounded-lg bg-purple-50 border border-purple-100 p-4`}>
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Последнее приглашение</p>
              {invitationMeta && accountStatus === 'pending' ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-900">Email: <span className="font-medium">{invitationMeta.email}</span></p>
                  <p className="text-sm text-gray-700">Дата: {invitationMeta.sentAt ? new Date(invitationMeta.sentAt).toLocaleString('ru-RU') : '—'}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-600">Приглашения не отправлены</p>
              )}
            </div>
          </div>
        {/* Кнопки действий */}
        {(residentEmail || canUnassignResident || pendingInvitationId) && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {residentEmail && !showResetForm && (
              <button
                type="button"
                onClick={() => { setShowResetForm(true); setResetEmail(residentEmail || ''); setResetError(''); }}
                disabled={!canSendPasswordReset || sendingPasswordReset}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingPasswordReset ? 'Отправка...' : 'Сбросить пароль'}
              </button>
            )}

            {pendingInvitationId && onCancelInvitation && (
              <button
                type="button"
                onClick={onCancelInvitation}
                className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-600"
              >
                Отменить приглашение
              </button>
            )}

            <button
              type="button"
              onClick={onDelete}
              disabled={!canDelete || deleting}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? 'Удаление...' : 'Удалить квартиру'}
            </button>

            <button
              type="button"
              onClick={onUnassignResident}
              disabled={!canUnassignResident}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Удалить жильца
            </button>
          </div>
        )}

        {/* Форма приглашения нового жильца */}
        {(showInviteSection || accountStatus !== 'activated') && (
          <div className="mb-6 rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 p-4">
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
                className="flex-1 min-w-[200px] rounded-lg bg-white border-2 border-gray-200 text-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={sendingInvite}
              />
              <button
                type="button"
                onClick={async () => {
                  await handleSendInvite();
                }}
                disabled={sendingInvite || !inviteEmail}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50 transition"
              >
                {sendingInvite ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
            {inviteError && <p className="text-red-600 mt-2 text-sm font-medium">{inviteError}</p>}
          </div>
        )}

        {/* Форма сброса пароля */}
        {showResetForm && (
          <div className="mb-6 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 p-4">
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
                  setResetError('Введите корректный email');
                  return;
                }
                setResetLoading(true);
                try {
                  await sendPasswordResetEmail(email);
                  toast.success(`Письмо для сброса пароля отправлено на ${email}`);
                  setShowResetForm(false);
                } catch (err: unknown) {
                  console.error('Error sending reset email:', err);
                  const msg = err instanceof Error ? err.message : String(err ?? '');
                  setResetError(msg || 'Ошибка при отправке письма');
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
                  className="w-full rounded-lg bg-white border-2 border-gray-200 text-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={resetLoading}
                />

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition"
                  >
                    {resetLoading ? 'Отправка...' : 'Отправить'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowResetForm(false); setResetError(''); }}
                    className="rounded-lg border-2 border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 transition"
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
