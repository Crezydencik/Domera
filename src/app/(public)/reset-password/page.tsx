'use client';

import Link from 'next/link';
import { useState } from 'react';
import { sendPasswordResetEmail } from '@/modules/auth/services/authService';
import { t } from '@/shared/i18n';
import { useUiPreferences } from '@/shared/hooks/useUiPreferences';

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { language, setLanguage } = useUiPreferences(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Введите email');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError('Введите корректный email');
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(normalizedEmail);
      setSuccess(`Письмо для сброса пароля отправлено на ${normalizedEmail}`);
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Не удалось отправить письмо для сброса пароля'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🔐 {t(language, 'resetPasswordTitle')}</h1>
          <p className="text-gray-400">{t(language, 'resetPasswordSubtitle')}</p>
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t(language, 'emailLabel')}</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="example@mail.com"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-600 transition"
            >
              {loading ? t(language, 'sending') : t(language, 'sendResetLink')}
            </button>
          </form>

          <p className="text-center text-gray-400 mt-6 text-sm">
            {t(language, 'rememberPassword')}{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 transition">
              {t(language, 'backToLogin')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
