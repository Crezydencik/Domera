'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { useTranslations } from 'next-intl';
import { Mail, ShieldCheck } from 'lucide-react';
import PasswordStrengthMeter from '@/shared/components/ui/PasswordStrengthMeter';
import { getPasswordStrength } from '@/shared/validation';
import AuthLayout from '@/shared/components/layout/AuthLayout';
import Input from '@/shared/components/ui/Input';
import { ConsentCheckbox } from '@/shared/components/ui/ConsentCheckbox';

// Removed broken EyeIcon and duplicate render logic

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
  const t = useTranslations('auth');
  const ts = useTranslations('system');
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
            setExistingAccountDetected(true);
            setLoading(false);
            return;
          } else {
            setError(t('invitation.emailMismatch', { currentEmail: userEmail, invitationEmail }));
            setLoading(false);
            return;
          }
        }

        // Если не авторизован - проверяем есть ли пользователь с таким email
        if (resolveData?.existingAccountDetected) {
          router.push(`/login?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`);
        } else {
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
      <AuthLayout>
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('invitation.validatingInvitation')}</h1>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-md mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">{t('invitation.acceptInvitation')}</h1>
          <p className="text-gray-600 text-center">{t('invitation.invitedAsResident')}</p>
        </div>
        <div className="mb-6 rounded-xl border border-indigo-200 bg-white px-3 py-3 text-sm text-gray-900">
          <div className="mb-1 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-indigo-400">
            <Mail className="h-3.5 w-3.5" />
            Email
          </div>
          <div className="font-medium break-all">{email || '—'}</div>
        </div>
        {error && (
          <div className="mb-5 rounded-xl border border-red-400 bg-red-100 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {existingAccountDetected ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              {t('invitation.emailInUse')}
            </div>
            <ConsentCheckbox
              checked={formData.gdprConsent}
              onChange={checked => setFormData(prev => ({ ...prev, gdprConsent: checked }))}
              error={!formData.gdprConsent && submitting ? t('invitation.gdprConsentRequired') : undefined}
            />
            <button
              type="button"
              onClick={handleAcceptForExistingAccount}
              disabled={submitting || authLoading}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition"
            >
              {submitting ? t('invitation.acceptingInvitation') : t('invitation.acceptAccess')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label={t('invitation.newPasswordLabel')}
              type="password"
              value={formData.password}
              onChange={e => setFormData((prev) => ({ ...prev, password: e.target.value }))}
              placeholder={t('invitation.newPasswordLabel')}
              autoComplete="new-password"
              required
              showPasswordToggle
            />
            <PasswordStrengthMeter
              password={formData.password}
              weakLabel={t('validation.weakPassword')}
              mediumLabel="Medium"
              strongLabel="Strong"
            />
            <Input
              label={t('common.confirmPassword')}
              type="password"
              value={formData.confirmPassword}
              onChange={e => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder={t('common.confirmPassword')}
              autoComplete="new-password"
              required
              showPasswordToggle
            />
            <ConsentCheckbox
              checked={formData.gdprConsent}
              onChange={checked => setFormData(prev => ({ ...prev, gdprConsent: checked }))}
              error={!formData.gdprConsent && submitting ? t('invitation.gdprConsentRequired') : undefined}
            />
            <button
              type="submit"
              disabled={submitting || isWeakPassword}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition"
            >
              {submitting ? t('invitation.registrationInProgress') : t('invitation.acceptInvitation')}
            </button>
          </form>
        )}
        {!existingAccountDetected && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-gray-700">
            {t('register.alreadyHaveAccount')}{' '}
            <Link href={`/login?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`} className="text-indigo-600 underline hover:text-indigo-500">
              {ts('button.login')}
            </Link>{' '}
            {t('invitation.andAcceptAccessWithoutCreatingNewPassword')}
          </div>
        )}
        {shouldLoginInstead && (
          <div className="mt-3 rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
            {t('invitation.loginInstead')}{' '}
            <Link href={`/login?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`} className="text-indigo-600 underline hover:text-indigo-500">
              {t('invitation.loginAndAcceptAccess')}
            </Link>
          </div>
        )}
        <div className="mt-5 border-t border-indigo-200 pt-4 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('invitation.gdprConsentRequired')}
          </div>

        </div>
      </div>
    </AuthLayout>
  );
}
