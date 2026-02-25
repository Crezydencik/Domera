'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { t } from '@/shared/i18n';
import { useUiPreferences } from '@/shared/hooks/useUiPreferences';

function EyeIcon({ crossed = false }: { crossed?: boolean }) {
  if (crossed) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.9 4.24A10.94 10.94 0 0112 4c5.05 0 9.27 3.11 10.5 8-1.05 4.15-4.32 7-8.24 7-1.05 0-2.05-.2-2.98-.57"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.61 6.61C4.67 7.85 3.31 9.73 2.5 12c.59 1.66 1.47 3.08 2.56 4.19"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M2.5 12C3.73 7.11 6.95 4 12 4s8.27 3.11 9.5 8c-1.23 4.89-4.45 8-9.5 8s-8.27-3.11-9.5-8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

const validateNewPassword = (value: string): string | null => {
  if (!value) return 'Введите новый пароль';
  if (value.length < 6) return 'Пароль должен быть не менее 6 символов';
  return null;
};

export default function ResetPasswordConfirmPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const oobCode = useMemo(() => searchParams.get('oobCode') ?? '', [searchParams]);

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loadingCode, setLoadingCode] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { language, setLanguage } = useUiPreferences(null);

  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode) {
        setError('Ссылка сброса пароля недействительна или повреждена');
        setLoadingCode(false);
        return;
      }

      try {
        const resolvedEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(resolvedEmail);
      } catch {
        setError('Ссылка сброса недействительна или уже истекла');
      } finally {
        setLoadingCode(false);
      }
    };

    verifyCode();
  }, [oobCode]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const passwordError = validateNewPassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (!oobCode) {
      setError('Ссылка сброса недействительна');
      return;
    }

    setSubmitting(true);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess('Пароль успешно изменён. Сейчас перенаправим на вход...');
      setTimeout(() => router.push('/login'), 1400);
    } catch {
      setError('Не удалось изменить пароль. Возможно, ссылка уже истекла.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🔐 {t(language, 'resetPasswordTitle')}</h1>
          <p className="text-gray-400">Domera</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
          <div className="mb-4 grid grid-cols-3 gap-2" aria-label="Language">
            {[
              { code: 'lv', label: 'LV' },
              { code: 'en', label: 'ENG' },
              { code: 'ru', label: 'RU' },
            ].map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setLanguage(item.code as 'lv' | 'en' | 'ru')}
                className={[
                  'rounded-lg px-3 py-2 text-sm font-semibold border transition',
                  language === item.code
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loadingCode ? (
            <p className="text-sm text-gray-300">{t(language, 'loading')}</p>
          ) : (
            <>
              {email && (
                <p className="mb-4 text-sm text-slate-300">
                  Аккаунт: <span className="font-medium text-white">{email}</span>
                </p>
              )}

              {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-500/20 border border-green-500 text-green-200 px-4 py-3 rounded-lg mb-6 text-sm">
                  {success}
                </div>
              )}

              {!success && !error.includes('недействительна') && !error.includes('истекла') && (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">{t(language, 'newPasswordLabel')}</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-2 pr-24 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-500 p-1.5 text-slate-200 hover:bg-slate-600"
                        aria-label={showNewPassword ? 'Скрыть пароль' : 'Показать пароль'}
                        title={showNewPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      >
                        <EyeIcon crossed={showNewPassword} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">{t(language, 'repeatPasswordLabel')}</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-2 pr-24 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-500 p-1.5 text-slate-200 hover:bg-slate-600"
                        aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                        title={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      >
                        <EyeIcon crossed={showConfirmPassword} />
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-600 transition"
                  >
                    {submitting ? t(language, 'savingNewPassword') : t(language, 'saveNewPassword')}
                  </button>
                </form>
              )}

              <p className="text-center text-gray-400 mt-6 text-sm">
                <Link href="/login" className="text-blue-400 hover:text-blue-300 transition">
                  {t(language, 'backToLogin')}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
