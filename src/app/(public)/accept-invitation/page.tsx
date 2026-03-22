'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import PasswordStrengthMeter from '@/shared/components/ui/PasswordStrengthMeter';
import { getPasswordStrength } from '@/shared/validation';

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations('auth');
  const passwordStrength = getPasswordStrength(formData.password);
  const isWeakPassword = Boolean(formData.password) && !passwordStrength.isStrongEnoughToSave;
  useEffect(() => {
    const validateAndProceed = async () => {
      if (authLoading) return;

      if (!token) {
        setError(t('invalidToken'));
        setLoading(false);
        return;
      }

      try {
        const resolveResponse = await fetch(
          `/api/invitations/resolve?token=${encodeURIComponent(token)}`,
          { method: 'GET' }
        );

        const resolveData = await resolveResponse.json().catch(() => ({}));

        if (!resolveResponse.ok || !resolveData?.invitation) {
          setError(resolveData?.error || t('invitation.invalidToken'));
          setLoading(false);
          return;
        }

        const invitation = resolveData.invitation as { email: string };

        if (!invitation) {
          setError(t('invitation.invalidToken'));
          setLoading(false);
          return;
        }
        if (!invitation.email) {
          setError(t('invitation.invalidToken'));
          setLoading(false);
          return;
        }

        setEmail(invitation.email);

        // Если пользователь уже авторизован
        if (user?.uid) {
          const userEmail = user.email.trim().toLowerCase();
          const invitationEmail = invitation.email.trim().toLowerCase();
          
          if (userEmail === invitationEmail) {
            // Email совпадает - показываем форму принятия для авторизованного пользователя
            setExistingAccountDetected(true);
            setLoading(false);
            return;
          } else {
            // Email не совпадает - ошибка
            setError(t('invitation.emailMismatch', { currentEmail: userEmail, invitationEmail }));
            setLoading(false);
            return;
          }
        }

        // Если не авторизован - проверяем есть ли пользователь с таким email
        if (resolveData?.existingAccountDetected) {
          // Пользователь существует - редирект на login
          router.push(`/login?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`);
        } else {
          // Новый пользователь - показываем форму регистрации
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error('invitations.accept.page.error', err);
        const message = err instanceof Error ? err.message : String(err);
        setError(`${t('invitation.invitationError')}: ${message}`);
        setLoading(false);
      }
    };

    validateAndProceed();
  }, [token, user?.uid, user?.email, authLoading, router, t]);

  const handleAcceptForExistingAccount = async () => {
    setError('');
    setShouldLoginInstead(false);

    if (!formData.gdprConsent) {
      setError(t('invitation.gdprConsentRequired'));
      return;
    }

    if (!user?.uid) {
      router.push(`/login?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, gdprConsent: true }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || t('invitation.invitationError'));
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('invitation.invitationError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordStrength.isStrongEnoughToSave) {
      setError(t('validation.weakPassword'));
      return;
    }

    if (formData.password.length < 6) {
      setError(t('invitation.passwordTooShort'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('invitation.passwordsDoNotMatch'));
      return;
    }

    if (!formData.gdprConsent) {
      setError(t('invitation.gdprConsentRequired'));
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: formData.password, gdprConsent: true }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || t('invitation.invitationError'));
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('invitation.invitationError');
      const normalized = message.toLowerCase();

      if (
        normalized.includes('email-already-in-use') ||
        normalized.includes('already in use') ||
        normalized.includes('уже используется')
      ) {
        setShouldLoginInstead(true);
        setError(t('invitation.emailInUse'));
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center px-4 text-white">
        <div className="pointer-events-none absolute -left-24 top-8 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-8 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="z-10 rounded-2xl border border-white/15 bg-white/10 px-6 py-5 text-sm backdrop-blur-md">
          {t('invitation.validatingInvitation')}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-8">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg items-center justify-center">
        <div className="w-full rounded-2xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">{t('invitation.acceptInvitation')}</h1>
              <p className="mt-2 text-sm text-slate-200/90">{t('invitation.invitedAsResident')}</p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/15 text-emerald-100">
              <CheckCircle2 className="h-5 w-5" />
            </span>
          </div>

          <div className="mb-6 rounded-xl border border-white/15 bg-slate-900/30 px-3 py-3 text-sm text-slate-100">
            <div className="mb-1 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-300">
              <Mail className="h-3.5 w-3.5" />
              Email
            </div>
            <div className="font-medium break-all">{email || '—'}</div>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          )}

          {existingAccountDetected ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/15 px-3 py-2 text-sm text-blue-100">
                {t('invitation.emailInUse')}
              </div>

              <label className="flex items-start gap-2 text-sm text-slate-100">
                <input
                  type="checkbox"
                  checked={formData.gdprConsent}
                  onChange={(e) => setFormData((prev) => ({ ...prev, gdprConsent: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-800 text-blue-500"
                  required
                />
                {t('invitation.gdprConsent')}
              </label>

              <button
                type="button"
                onClick={handleAcceptForExistingAccount}
                disabled={submitting || authLoading}
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {submitting ? t('invitation.acceptingInvitation') : t('invitation.acceptAccess')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-100">{t('invitation.newPasswordLabel')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full rounded-xl border border-slate-500/60 bg-slate-900/50 px-3 py-2.5 pr-24 text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-400/50 p-1.5 text-slate-200 hover:bg-slate-700/40"
                    aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                    title={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                  >
                    <EyeIcon crossed={showPassword} />
                  </button>
                </div>
                <PasswordStrengthMeter
                  password={formData.password}
                  weakLabel={t('validation.weakPassword')}
                  mediumLabel="Medium"
                  strongLabel="Strong"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-100">{t('common.confirmPassword')}</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full rounded-xl border border-slate-500/60 bg-slate-900/50 px-3 py-2.5 pr-24 text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-400/50 p-1.5 text-slate-200 hover:bg-slate-700/40"
                    aria-label={showConfirmPassword ? t('common.hidePassword') : t('common.showPassword')}
                    title={showConfirmPassword ? t('common.hidePassword') : t('common.showPassword')}
                  >
                    <EyeIcon crossed={showConfirmPassword} />
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-2 text-sm text-slate-100">
                <input
                  type="checkbox"
                  checked={formData.gdprConsent}
                  onChange={(e) => setFormData((prev) => ({ ...prev, gdprConsent: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-800 text-blue-500"
                  required
                />
                {t('invitation.gdprConsent')}
              </label>

              <button
                type="submit"
                disabled={submitting || isWeakPassword}
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {submitting ? t('invitation.registrationInProgress') : t('invitation.acceptInvitation')}
              </button>
            </form>
          )}

          {!existingAccountDetected && (
            <div className="mt-4 rounded-xl border border-slate-500/40 bg-slate-900/40 px-3 py-2 text-xs text-slate-200">
              {t('register.alreadyHaveAccount')}{' '}
              <Link href={`/login?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`} className="text-blue-300 underline hover:text-blue-200">
                {t('login.submit')}
              </Link>{' '}
              {t('invitation.andAcceptAccessWithoutCreatingNewPassword')}
            </div>
          )}

          {shouldLoginInstead && (
            <div className="mt-3 rounded-xl border border-blue-500/30 bg-blue-500/15 px-3 py-2 text-xs text-blue-100">
              {t('invitation.loginInstead')}{' '}
              <Link href={`/login?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`} className="text-blue-200 underline hover:text-blue-100">
                {t('invitation.loginAndAcceptAccess')}
              </Link>
            </div>
          )}

          <div className="mt-5 border-t border-white/15 pt-4 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('invitation.gdprConsentRequired')}
            </div>
            <div>
              <Link href="/login" className="text-sm text-blue-300 hover:text-blue-200">
                {t('common.backToLogin')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
