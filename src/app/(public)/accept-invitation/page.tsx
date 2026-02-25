'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  acceptInvitation,
  acceptInvitationForAuthenticatedUser,
  getInvitationByToken,
} from '@/modules/invitations/services/invitationsService';
import { useAuth } from '@/shared/hooks/useAuth';

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [existingAccountDetected, setExistingAccountDetected] = useState(false);
  const [shouldLoginInstead, setShouldLoginInstead] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    gdprConsent: false,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Если пользователь не авторизован — редиректим на логин
    if (!user?.uid && !authLoading) {
      router.push(`/login?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`);
      return;
    }

    const validateToken = async () => {
      if (!token) {
        setError('Токен приглашения не найден');
        setLoading(false);
        return;
      }

      try {
        const invitation = await getInvitationByToken(token);
        console.log('[AcceptInvitationPage] invitation:', invitation);

        if (!invitation) {
          setError('Приглашение недействительно или истекло (токен не найден или срок действия истёк)');
          setLoading(false);
          return;
        }
        if (!invitation.email) {
          setError('В приглашении отсутствует email. Проверьте корректность приглашения.');
          setLoading(false);
          return;
        }

        setEmail(invitation.email);
        setExistingAccountDetected(Boolean(user?.email) && user.email.trim().toLowerCase() === invitation.email.trim().toLowerCase());
      } catch (err: any) {
        setError('Ошибка проверки приглашения: ' + (err?.message || err));
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token, user?.email, authLoading]);

  const handleAcceptForExistingAccount = async () => {
    setError('');
    setShouldLoginInstead(false);

    if (!formData.gdprConsent) {
      setError('Необходимо согласие на обработку персональных данных');
      return;
    }

    if (!user?.uid) {
      router.push(`/login?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`);
      return;
    }

    setSubmitting(true);
    try {
      await acceptInvitationForAuthenticatedUser(token, user.uid, true);
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка принятия приглашения');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (!formData.gdprConsent) {
      setError('Необходимо согласие на обработку персональных данных');
      return;
    }

    setSubmitting(true);

    try {
      await acceptInvitation(token, formData.password, true);
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка принятия приглашения';
      const normalized = message.toLowerCase();

      if (
        normalized.includes('email-already-in-use') ||
        normalized.includes('already in use') ||
        normalized.includes('уже используется')
      ) {
        setShouldLoginInstead(true);
        setError('Для этого email уже есть аккаунт. Войдите и примите доступ без повторной регистрации.');
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center text-white">
        Проверка приглашения...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Принять приглашение</h1>
        <p className="text-gray-400 text-sm mb-6">
          Вы приглашены как жилец: <span className="text-white">{email || '—'}</span>
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-300 bg-red-900/30 border border-red-700 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {existingAccountDetected ? (
          <div className="space-y-4">
            <div className="rounded-md border border-blue-700 bg-blue-900/25 px-3 py-2 text-sm text-blue-200">
              Этот email уже зарегистрирован. Вход выполнен — подтвердите доступ к квартире.
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={formData.gdprConsent}
                onChange={(e) => setFormData((prev) => ({ ...prev, gdprConsent: e.target.checked }))}
                className="mt-1"
                required
              />
              Даю согласие на обработку моих персональных данных для регистрации и обслуживания в Domera.
            </label>

            <button
              type="button"
              onClick={handleAcceptForExistingAccount}
              disabled={submitting || authLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {submitting ? 'Подтверждение доступа...' : 'Принять доступ к квартире'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Пароль</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Повторите пароль</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                required
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={formData.gdprConsent}
                onChange={(e) => setFormData((prev) => ({ ...prev, gdprConsent: e.target.checked }))}
                className="mt-1"
                required
              />
              Даю согласие на обработку моих персональных данных для регистрации и обслуживания в Domera.
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {submitting ? 'Завершение регистрации...' : 'Принять приглашение'}
            </button>
          </form>
        )}

        {!existingAccountDetected && (
          <div className="mt-4 rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
            Уже есть аккаунт?{' '}
            <Link href={`/login?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`} className="text-blue-300 underline">
              Войдите
            </Link>{' '}
            и примите доступ без создания нового пароля.
          </div>
        )}

        {shouldLoginInstead && (
          <div className="mt-3 rounded-md border border-blue-700 bg-blue-900/25 px-3 py-2 text-xs text-blue-200">
            Перейти ко входу:{' '}
            <Link href={`/login?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`} className="underline text-blue-100">
              войти и принять доступ
            </Link>
          </div>
        )}

        <div className="mt-4 text-center">
          <Link href="/login" className="text-sm text-blue-300 hover:text-blue-200">
            Вернуться ко входу
          </Link>
        </div>
      </div>
    </div>
  );
}
