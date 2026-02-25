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
  onClose: () => void;
  onDelete: () => void;
  onUnassignResident: () => void;
  deleting: boolean;
  sendingPasswordReset: boolean;
  canDelete: boolean;
  canSendPasswordReset: boolean;
  canUnassignResident: boolean;
}

export const ApartmentModal: React.FC<ApartmentModalProps> = ({
  apartment,
  invitationMeta,
  accountStatus,
  residentEmail,
  onClose,
  onDelete,
  onUnassignResident,
  deleting,
  sendingPasswordReset,
  canDelete,
  canSendPasswordReset,
  canUnassignResident,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">
              Модальное окно: {apartment?.number || 'Неизвестно'}
            </h3>
            <p className="mt-1 text-sm text-gray-400">ID квартиры: {apartment?.id || 'Неизвестно'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowInviteSection((s) => !s)}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
            >
              {showInviteSection ? 'Скрыть форму' : 'Добавить жильца'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-slate-800"
            >
              Закрыть
            </button>
          </div>
        </div>
        <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/60 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Статус аккаунта</p>
            <p className="mt-1 text-sm text-white">{accountStatus}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Email жильца</p>
            <p className="mt-1 text-sm text-white">
              {residentEmail || (
                <span className="text-amber-400">новый жилец</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Последнее приглашение</p>
            {invitationMeta ? (
              <>
                <p className="mt-1 text-sm text-white">Приглашение отправлено на: {invitationMeta.email}</p>
                <p className="text-sm text-white">Дата отправки: {invitationMeta.sentAt ? new Date(invitationMeta.sentAt).toLocaleString('ru-RU') : '—'}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-white">Приглашения не отправлены</p>
            )}
          </div>
        </div>
        {(residentEmail || canUnassignResident) && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {residentEmail && !showResetForm && (
              <button
                type="button"
                onClick={() => { setShowResetForm(true); setResetEmail(residentEmail || ''); setResetError(''); }}
                disabled={!canSendPasswordReset || sendingPasswordReset}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingPasswordReset ? 'Отправка пароля...' : 'Сбросить пароль'}
              </button>
            )}

            <button
              type="button"
              onClick={onDelete}
              disabled={!canDelete || deleting}
              className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? 'Удаление...' : 'Удалить квартиру'}
            </button>

            <button
              type="button"
              onClick={onUnassignResident}
              disabled={!canUnassignResident}
              className="rounded-lg border border-amber-700 bg-amber-900/30 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-900/45 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Удалить жильца
            </button>
          </div>
        )}

        {/* Форма для нового жильца */}
        {(showInviteSection || !residentEmail) && (
          <div className="mt-6 rounded-lg border border-slate-700 bg-slate-800/60 p-4">
            <h4 className="text-md font-semibold text-white mb-2">Пригласить нового жильца</h4>
            <div className="flex gap-2 items-center">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="Email нового жильца"
                className="rounded-md bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={sendingInvite}
              />
              <button
                type="button"
                onClick={async () => {
                  await handleSendInvite();
                  // keep the section open so user can send more invites or close manually
                }}
                disabled={sendingInvite || !inviteEmail}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {sendingInvite ? 'Отправка...' : 'Отправить приглашение'}
              </button>
            </div>
            {inviteError && <p className="text-red-400 mt-2 text-sm">{inviteError}</p>}
          </div>
        )}
        {/* Форма сброса пароля (в модалке) */}
        {showResetForm && (
          <div className="mt-6 rounded-lg border border-slate-700 bg-slate-800/60 p-4">
            <h4 className="text-md font-semibold text-white mb-3">Сброс пароля</h4>
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
                <label className="text-xs uppercase tracking-wide text-slate-400">Email для сброса</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Email жильца"
                  className="w-full rounded-md bg-slate-900 border border-slate-700 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={resetLoading}
                />

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {resetLoading ? 'Отправка...' : 'Отправить'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowResetForm(false); setResetError(''); }}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-white bg-transparent hover:bg-slate-700 transition"
                  >
                    Отмена
                  </button>

                  <div className="ml-auto text-sm text-gray-400">Нажмите «Отправить», чтобы выслать письмо для сброса пароля</div>
                </div>

                {resetError && <p className="text-red-400 mt-1 text-sm">{resetError}</p>}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
