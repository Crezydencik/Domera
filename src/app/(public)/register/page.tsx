'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { registerUser } from '@/modules/auth/services/authService';
import { createCompany } from '@/modules/company/services/companyService';
import { useTranslations } from 'use-intl';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
  });
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const t = useTranslations('auth');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoadingStep('');

    // Validation
    if (!formData.companyName.trim()) {
      setError(t('enterCompanyName'));
      return;
    }

    if (!formData.email.trim()) {
      setError(t('enterEmail'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    if (formData.password.length < 6) {
      setError(t('passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      // Create company first
      setLoadingStep(t('creatingCompany'));
      console.log('Creating company:', formData.companyName);
      const company = await createCompany(formData.companyName);

      // Then register user as ManagementCompany
      setLoadingStep(t('creatingAccount'));
      const user = await registerUser(
        {
          email: formData.email,
          password: formData.password,
          token: '', // No invitation token for direct registration
        },
        'ManagementCompany',
        company.id
      );

      if (user) {
        setLoadingStep(t('registrationComplete'));
        setTimeout(() => {
          router.push('/dashboard');
        }, 500);
      } else {
        setError(t('registrationError'));
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        fullError: err
      });
      
      if (err.code === 'auth/email-already-in-use') {
        setError(t('emailInUse'));
      } else if (err.code === 'auth/weak-password') {
        setError(t('weakPassword'));
      } else if (err.code === 'auth/invalid-email') {
        setError(t('invalidEmail'));
      } else if (err.code === 'permission-denied') {
        setError(t('permissionDenied'));
      } else {
        setError(err.message || t('dbError'));
      }
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🏢 Domera</h1>
          <p className="text-gray-400">{t('register')}</p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
          {error && (
            <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('companyNameLabel')} 
              </label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder={t('companyNamePlaceholder')}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('emailLabel')}
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={t('emailPlaceholder')}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('passwordLabel')}
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={t('passwordPlaceholder')}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                required
              />
              <p className="text-xs text-gray-500 mt-1">{t('minPasswordLength')}</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('confirmPasswordLabel')}
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder={t('confirmPasswordPlaceholder')}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>

            {/* Terms */}
            <div className="flex items-start">
              <input
                type="checkbox"
                id="terms"
                className="mt-1"
                required
              />
              <label htmlFor="terms" className="text-sm text-gray-400 ml-2">
                {t('termsLabel')}
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-600 transition"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  {loadingStep || t('processing')}
                </span>
              ) : (
                t('register')
              )}
            </button>
          </form>

          {/* Sign In Link */}
          <p className="text-center text-gray-400 mt-6">
            {t('alreadyHaveAccount')}{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 transition">
              {t('signIn')}
            </Link>
          </p>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link href="/" className="text-gray-400 hover:text-gray-300 transition">
            ← {t('backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
