'use client';


import { useState } from 'react';
import Input from '@/shared/components/ui/Input';
import { toast } from 'react-toastify';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { login } from '@/modules/auth/services/authService';
import { useAuth } from '@/shared/hooks/useAuth';
import AuthLayout from '@/shared/components/layout/AuthLayout';
import { useTranslations } from 'next-intl';
import { toSafeErrorDetails } from '@/shared/lib/safeLog';

export default function LoginPage() {
  
    const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Ошибки теперь только через toast
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  // Локализация отключена, все надписи статичные на русском
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Если пользователь уже залогинен, редиректим на dashboard
  if (!authLoading && isAuthenticated) {
    if (typeof window !== 'undefined') {
      router.replace(redirectTo || '/dashboard');
    }
    return null;
  }

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
        // Wait for auth persistence to save cookies
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err: any) {
      console.error('Login failed:', toSafeErrorDetails(err));
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
    <AuthLayout>
      <div className="w-full max-w-md mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">{t('welcome')}</h1>
          <p className="text-gray-500 text-center">{t('login.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <Input
            label={t('common.email')}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('common.emailPlaceholder')}
            autoComplete="email"
            required
          />
          {/* Password */}
          <Input
            label={t('common.password')}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t('common.passwordPlaceholder')}
            autoComplete="current-password"
            required
            showPasswordToggle
          />
          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center text-sm text-gray-600">
              <input type="checkbox" className="mr-2 accent-indigo-600" /> {t('resetPassword.remembered')}
            </label>
            <Link href="/reset-password" className="text-sm text-indigo-600 hover:underline">{t('login.forgotPassword')}</Link>
          </div>
          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition"
          >
            {loading ? t('login.inProgress') : t('login.submit')}
          </button>
        </form>
        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="grow h-px bg-gray-200" />
          <span className="mx-4 text-gray-400 text-sm">{t('or')}</span>
          <div className="grow h-px bg-gray-200" />
        </div>
        {/* Social Buttons (заглушки) */}
        {/* Register Link */}
        <p className="text-center text-gray-500 mt-4">
          {t('login.noAccount')}{' '}
          <Link href="/register" className="text-indigo-600 hover:underline">{t('register.title')}</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
