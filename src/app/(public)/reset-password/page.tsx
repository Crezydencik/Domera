'use client';

import Link from 'next/link';
import { useState } from 'react';
import { sendPasswordResetEmail } from '@/modules/auth/services/authService';
import { useTranslations } from 'next-intl';


const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

import AuthLayout from '@/shared/components/layout/AuthLayout';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const t = useTranslations('auth');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError(t('resetPasswordEmailPlaceholder'));
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError(t('resetPasswordInvalidEmail'));
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(normalizedEmail);
      setSuccess(t('resetPasswordSuccess', { email: normalizedEmail }));
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t('resetPasswordError')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">{t('resetPasswordTitle')}</h1>
          <p className="text-gray-500 text-center">{t('resetPasswordSubtitle')}</p>
        </div>

        <div className="bg-white rounded-lg p-8 border border-gray-200 shadow">
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('emailLabel')}</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('emailPlaceholder')}
                className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-all duration-150"
            >
              {loading ? t('sending') : t('sendResetLink')}
            </button>
          </form>

          <p className="text-center text-gray-500 mt-6 text-sm">
            {t('rememberPassword')}{' '}
            <Link href="/login" className="text-indigo-600 hover:underline">
              {t('backToLogin')}
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
