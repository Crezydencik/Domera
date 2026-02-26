'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { login } from '@/modules/auth/services/authService';
import { useTranslations } from 'use-intl';
// ...existing code...



export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Ошибки теперь только через toast
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  // Локализация отключена, все надписи статичные на русском
  const t = useTranslations('auth');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Ошибки теперь только через toast
    setLoading(true);

    try {
      // Validate inputs

      if (!email.trim()) {
        toast.error(t('enterEmail'), { className: 'border border-red-500' });
        setLoading(false);
        return;
      }
      // Простая email-валидация
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
        toast.error(t('invalidEmail'), { className: 'border border-red-500' });
        setLoading(false);
        return;
      }
      if (!password) {
        toast.error(t('enterPassword'), { className: 'border border-red-500' });
        setLoading(false);
        return;
      }

      const user = await login({ email, password });
      if (user) {
        // Successfully logged in
        console.log('Login successful for user:', user.email);
        // Wait for auth persistence to save cookies
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('Redirecting to dashboard');
        router.push(redirectTo || '/dashboard');
      } else {
        toast.error(t('invalidEmailOrPassword'), { className: 'border border-red-500' });
      }
    } catch (err: any) {
      console.error('Login error:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        fullError: err
      });
      const errorMessage = err.message || t('loginError');
      // Handle Firebase auth errors
      if (err.code === 'auth/user-not-found') {
        toast.error(t('userNotFound'), { className: 'border border-red-500' });
      } else if (err.code === 'auth/wrong-password') {
        toast.error(t('wrongPassword'), { className: 'border border-red-500' });
      } else if (err.code === 'auth/invalid-email') {
        toast.error(t('invalidEmail') , { className: 'border border-red-500' });
      } else if (err.code === 'auth/user-disabled') {
        toast.error(t('userDisabled'), { className: 'border border-red-500' });
      } else if (err.code === 'permission-denied') {
        toast.error(t('noAccess'), { className: 'border border-red-500' });
      } else {
        toast.error(errorMessage, { className: 'border border-red-500' });
      }
    } finally {
      setLoading(false);
    }
  };


  // Локализация отключена

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🏢 Domera</h1>
          <p className="text-gray-400">{t('login')}</p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
          {/* Языки убраны */}



          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('emailLabel')}
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.com"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('passwordLabel')}  
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <Link href="/reset-password" className="text-sm text-blue-400 hover:text-blue-300 transition">
                {t('forgotPassword')}
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-600 transition"
            >
              {loading ? t('loginInProgress') : t('loginButton')}
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center text-gray-400 mt-6">
            {t('noAccount')}{' '}
            <Link href="/register" className="text-blue-400 hover:text-blue-300 transition">
              {t('register')}
            </Link>
          </p>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link href="/" className="text-gray-400 hover:text-gray-300 transition">
            ← {t('backHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
