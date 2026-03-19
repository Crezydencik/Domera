'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { useTranslations } from 'next-intl';
import AuthLayout from '@/shared/components/layout/AuthLayout';

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

const validateNewPassword = (value: string, t: (key: string) => string): string | null => {
  if (!value) return t('alert.resetPasswordEnterNewPassword');
  if (value.length < 6) return t('alert.resetPasswordPasswordTooShort');
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
  const [invalidLink, setInvalidLink] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const t = useTranslations('auth');

  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode) {
        setError(t('alert.resetPasswordInvalidLink'));
        setInvalidLink(true);

        setLoadingCode(false);
        return;
      }

      try {
        const resolvedEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(resolvedEmail);
        setInvalidLink(false);
      } catch {
        setError(t('alert.resetPasswordInvalidLink'));
        setInvalidLink(true);
      } finally {
        setLoadingCode(false);
      }
    };

    verifyCode();
  }, [oobCode, t]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const passwordError = validateNewPassword(newPassword, t);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError(t('alert.resetPasswordPasswordsDoNotMatch'));
      return;
    }

    if (!oobCode) {
      setError(t('alert.resetPasswordInvalidLink'));
      setInvalidLink(true);
      return;
    }

    setSubmitting(true);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(t('alert.resetPasswordChangedSuccess'));
      setInvalidLink(false);
      setTimeout(() => router.push('/login'), 1400);
    } catch {
      setError(t('alert.resetPasswordError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">{t('resetPassword.title')}</h1>
          <p className="text-gray-500 text-center">{t('resetPassword.subtitle2')}</p>
        </div>

        <div className="bg-white rounded-lg p-8 border border-gray-200 shadow">
          {loadingCode ? (
            <p className="text-sm text-gray-500">{t('loading')}</p>
          ) : (
            <>
              {email && (
                <p className="mb-4 text-sm text-gray-700">
                  {t('resetPassword.accountLabel')}: <span className="font-medium text-gray-900">{email}</span>
                </p>
              )}

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-100 border border-green-400 text-green-800 px-4 py-3 rounded-lg mb-6 text-sm">
                  {success}
                </div>
              )}

              {!success && !invalidLink && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('resetPassword.newPasswordLabel')}</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-2 pr-24 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-200"
                        aria-label={showNewPassword ? t('resetPassword.hidePassword') : t('resetPassword.showPassword')}
                        title={showNewPassword ? t('resetPassword.hidePassword') : t('resetPassword.showPassword')}
                      >
                        <EyeIcon crossed={showNewPassword} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('resetPassword.repeatPasswordLabel')}</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-2 pr-24 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-200"
                        aria-label={showConfirmPassword ? t('resetPassword.hidePassword') : t('resetPassword.showPassword')}
                        title={showConfirmPassword ? t('resetPassword.hidePassword') : t('resetPassword.showPassword')}
                      >
                        <EyeIcon crossed={showConfirmPassword} />
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-all duration-150"
                  >
                    {submitting ? t('resetPassword.saving') : t('resetPassword.saveNew')}
                  </button>
                </form>
              )}

              <p className="text-center text-gray-500 mt-6 text-sm">
                <Link href="/login" className="text-indigo-600 hover:underline">
                  {t('resetPassword.backToLogin')}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
