'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { registerUser, updateUserProfile } from '@/modules/auth/services/authService';
import { createCompany } from '@/modules/company/services/companyService';
import AuthLayout from '@/shared/components/layout/AuthLayout';
import { useTranslations } from 'next-intl';
import { auth } from '@/firebase/config';
import { useLanguage } from '@/shared/providers/LanguageProvider';
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

export default function RegisterPage() {
  const t = useTranslations('auth');
  const ts = useTranslations('system');
  const { locale } = useLanguage();

  const searchParams = useSearchParams();
  const invitedRoleParam = searchParams.get('inviteRole');
  const invitedCompanyId = searchParams.get('companyId');
  const invitedEmailParam = searchParams.get('email');
  const invitedInvitationId = searchParams.get('invitationId');
  const isInvitedRole = invitedRoleParam === 'Accountant' || invitedRoleParam === 'ManagementCompany';
  const isCompanyInvite = Boolean(isInvitedRole && invitedCompanyId && invitedEmailParam);

  const [role, setRole] = useState<'resident' | 'uk'>('resident');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: invitedEmailParam ?? '',
    password: '',
    confirmPassword: '',
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [codeExpiresInSeconds, setCodeExpiresInSeconds] = useState(3600);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const passwordStrength = getPasswordStrength(formData.password);
  const isWeakPassword = Boolean(formData.password) && !passwordStrength.isStrongEnoughToSave;

  const totalSteps = isCompanyInvite ? 2 : 3;

  const PHONE_CODES = [
    { code: '+371', country: '🇱🇻' },
  ];
  const [phoneCode, setPhoneCode] = useState(PHONE_CODES[0].code);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Если email меняется на втором шаге — сбрасываем step на 1 для повторной проверки
    if (name === 'email' && step === 2) {
      setStep(1);
    }
    if (name === 'email') {
      // no-op: kept for possible future inline email status
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const showEmailExistsToast = () => {
    toast.info(
      <div>
        <div>{t('validation.emailInUse')}</div>
        <div className="mt-2 flex gap-2">
          <button
            className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            onClick={() => router.push('/login')}
          >
            {t('login.submit')}
          </button>
          <button
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            onClick={() => router.push('/reset-password')}
          >
            {t('login.forgotPassword')}
          </button>
        </div>
      </div>,
      { autoClose: false }
    );
  };

  async function checkEmailExists(email: string): Promise<boolean> {
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);
      return methods && methods.length > 0;
    } catch (err) {
      console.error('Ошибка проверки email в Firebase:', err);
      return false;
    }
  }

  const requestEmailCode = async (): Promise<boolean> => {
    setSendingCode(true);
    try {
      const response = await fetch('/api/auth/register-email-code/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, locale }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) {
          showEmailExistsToast();
          return false;
        }

        toast.error(data?.error || t('register.verification.requestError'));
        return false;
      }

      setCodeExpiresInSeconds(Number(data?.expiresInSeconds ?? 3600));
      toast.success(t('register.verification.codeSent'));
      return true;
    } catch (error) {
      console.error('Code request error:', error);
      toast.error(t('register.verification.requestError'));
      return false;
    } finally {
      setSendingCode(false);
    }
  };

  const handleNextFromCredentials = async () => {
    if (!formData.email.trim()) return toast.error(ts('validation.requiredEmail'));
    if (formData.password !== formData.confirmPassword) return toast.error(ts('validation.passwordsDoNotMatch'));
    if (formData.password.length < 6) return toast.error(ts('validation.passwordTooShort'));
    if (!passwordStrength.isStrongEnoughToSave) return toast.error(t('validation.weakPassword'));

    setLoading(true);
    try {
      const exists = await checkEmailExists(formData.email);
      if (exists) {
        showEmailExistsToast();
        return;
      }

      const sent = await requestEmailCode();
      if (!sent) return;

      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      toast.error(t('register.verification.required'));
      return;
    }

    setVerifyingCode(true);
    try {
      const response = await fetch('/api/auth/register-email-code/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, code: verificationCode }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 410) {
          toast.error(t('register.verification.codeExpired'));
          return;
        }
        toast.error(data?.error || t('register.verification.invalidCode'));
        return;
      }

      setVerificationToken(String(data?.verificationToken ?? ''));
      toast.success(t('register.verification.codeVerified'));

      if (isCompanyInvite && invitedCompanyId && isInvitedRole) {
        setLoading(true);
        try {
          const user = await registerUser(
            {
              email: formData.email,
              password: formData.password,
              token: '',
            },
            invitedRoleParam as 'Accountant' | 'ManagementCompany',
            invitedCompanyId
          );

          if (!user || !user.uid) {
            toast.error(t('register.status.error'));
            return;
          }

          if (invitedInvitationId) {
            await fetch('/api/company-invitations/accept', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ invitationId: invitedInvitationId }),
            });
          }

          toast.success(t('register.status.complete'));
          setTimeout(() => {
            router.push('/dashboard');
          }, 500);
        } finally {
          setLoading(false);
        }
        return;
      }

      setStep(3);
    } catch (error) {
      console.error('Code verify error:', error);
      toast.error(t('register.verification.verifyError'));
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleFinalRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verificationToken) {
      toast.error(t('register.verification.requiredBeforeContinue'));
      return;
    }

    if (role === 'uk') {
      if (!formData.companyName.trim()) return toast.error(ts('validation.requiredCompanyName'));
      if (!formData.companyAddress.trim()) return toast.error(ts('placeholder.address'));
      if (!formData.companyPhone.trim()) return toast.error(ts('placeholder.phone'));
    }

    if (role === 'resident') {
      if (!formData.firstName.trim()) return toast.error(ts('placeholder.firstName'));
      if (!formData.lastName.trim()) return toast.error(ts('placeholder.lastName'));
      if (!formData.phone.trim()) return toast.error(ts('placeholder.phone'));
    }

    setLoading(true);
    try {
      const user = await registerUser(
        {
          email: formData.email,
          password: formData.password,
          token: '',
        },
        role === 'uk' ? 'ManagementCompany' : 'Resident'
      );

      if (!user || !user.uid) {
        toast.error(t('register.status.error'));
        return;
      }

      if (role === 'uk') {
        const company = await createCompany(formData.companyName.trim(), user.uid, {
          address: formData.companyAddress.trim(),
          phone: `${phoneCode}${formData.companyPhone.trim()}`,
          email: formData.email.trim().toLowerCase(),
        });

        await updateUserProfile(user.uid, {
          companyId: company.id,
          name: formData.companyName.trim(),
          phone: `${phoneCode}${formData.companyPhone.trim()}`,
          address: formData.companyAddress.trim(),
        });
      }

      toast.success(t('register.status.complete'));
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string };
      if (authErr.code === 'auth/email-already-in-use') {
        showEmailExistsToast();
      } else if (authErr.code === 'auth/weak-password') {
        toast.error(ts('validation.passwordTooShort'));
      } else if (authErr.code === 'auth/invalid-email') {
        toast.error(ts('validation.invalidEmail'));
      } else {
        toast.error(authErr.message || t('register.status.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">{t('register.title')}</h1>
          <p className="text-gray-500 text-center">{t('register.description')}</p>
        </div>

        {/* Индикатор шагов */}
        <div className="flex flex-col items-center mb-6 select-none">
          <span className="text-sm text-gray-500 mb-2">{ts('steps.steps')} {step} {ts('steps.from')} {totalSteps}</span>
          <div className="flex gap-2">
            <div className={`w-8 h-2 rounded-full transition-all duration-200 ${step === 1 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
            <div className={`w-8 h-2 rounded-full transition-all duration-200 ${step === 2 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
            {!isCompanyInvite && (
              <div className={`w-8 h-2 rounded-full transition-all duration-200 ${step === 3 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
            )}
          </div>
        </div>

        <form onSubmit={handleFinalRegistration} className="space-y-6">
          {/* Шаг 1: Email и пароль */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{ts('form.email')}</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="example@mail.com"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition"
                  autoComplete="email"
                  readOnly={isCompanyInvite}
                  required
                />
                {isCompanyInvite && (
                  <p className="text-xs text-indigo-600 mt-1">{ts('form.emailFixedByInvite')}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{ts('form.password')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 pr-24 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-200"
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
                <p className="text-xs text-gray-500 mt-1">{ts('form.passwordHint')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{ts('form.confirmPassword')}</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 pr-24 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-200"
                    aria-label={showConfirmPassword ? t('common.hidePassword') : t('common.showPassword')}
                    title={showConfirmPassword ? t('common.hidePassword') : t('common.showPassword')}
                  >
                    <EyeIcon crossed={showConfirmPassword} />
                  </button>
                </div>
              </div>
                        {/* Выбор роли */}
          {!isCompanyInvite && (
          <div className="flex justify-center gap-3 mb-2 mt-4">
            <button
              type="button"
              onClick={() => {setRole('resident'); setStep(1);}}
              className={`px-4 py-2 rounded-4 border font-semibold transition-all duration-150 text-sm
                ${role==='resident' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
            >{t('register.resident.title')}</button>
            <button
              type="button"
              onClick={() => {setRole('uk'); setStep(1);}}
              className={`px-4 py-2 rounded-4 border font-semibold transition-all duration-150 text-sm
                ${role==='uk' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
            >{t('register.company.title')}</button>
          </div>
          )}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  disabled={loading || sendingCode || isWeakPassword}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-all duration-150"
                  onClick={handleNextFromCredentials}
                >
                  {sendingCode ? t('register.verification.sendingCode') : ts('button.next')}
                </button>
              </div>
            </>
          )}

          {/* Шаг 2: подтверждение кода */}
          {step === 2 && (
            <>
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-800">
                {t('register.verification.description')} <b>{formData.email}</b>. {t('register.verification.expiresHint')}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('register.verification.codeLabel')}</label>
                <input
                  type="text"
                  name="verificationCode"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t('register.verification.codePlaceholder')}
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition tracking-[0.2em] text-center"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">{t('register.verification.ttlHint')}: {Math.ceil(codeExpiresInSeconds / 60)}m</p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition duration-150"
                >
                  {ts('button.back')}
                </button>
                <button
                  type="button"
                  onClick={requestEmailCode}
                  disabled={sendingCode}
                  className="flex-1 px-4 py-2 bg-white text-indigo-700 border border-indigo-300 rounded-lg font-semibold hover:bg-indigo-50 disabled:opacity-60 transition duration-150"
                >
                  {sendingCode ? t('register.verification.sendingCode') : t('register.verification.resendCode')}
                </button>
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={verifyingCode || loading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition duration-150"
                >
                  {verifyingCode ? t('register.verification.verifyingCode') : t('register.verification.verifyCode')}
                </button>
              </div>
            </>
          )}

          {/* Шаг 2: УК */}
          {role === 'uk' && step === 3 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('register.company.nameLabel')}</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="SIA Pārvaldnieks"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{ts('form.address')}</label>
                <input
                  type="text"
                  name="companyAddress"
                  value={formData.companyAddress}
                  onChange={handleChange}
                  placeholder="Rīga, Brīvības iela 100"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{ts('form.phone')}</label>
                <div className="flex gap-2">
                  <select
                    className="px-2 py-2 rounded-lg border border-gray-300 bg-gray-100 text-gray-900"
                    value={phoneCode}
                    onChange={e => setPhoneCode(e.target.value)}
                  >
                    {PHONE_CODES.map(opt => (
                      <option key={opt.code + opt.country} value={opt.code}>{opt.country} {opt.code}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    name="companyPhone"
                    value={formData.companyPhone}
                    onChange={handleChange}
                    placeholder="(___) ___-__-__"
                    className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>
            </>
          )}

          {/* Шаг 2: Жилец */}
          {role === 'resident' && step === 3 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{ts('form.firstName')}</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Jānis"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{ts('form.lastName')}</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Pētersons"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{ts('form.phone')}</label>
                <div className="flex gap-2">
                  <select
                    className="px-2 py-2 rounded-lg border border-gray-300 bg-gray-100 text-gray-900"
                    value={phoneCode}
                    onChange={e => setPhoneCode(e.target.value)}
                  >
                    {PHONE_CODES.map(opt => (
                      <option key={opt.code + opt.country} value={opt.code}>{opt.country} {opt.code}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder=""
                    className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

              </div>
            </>

          )}

          {!isCompanyInvite && step === 3 && (
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition duration-150"
              >
                {ts('button.back')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-all duration-150"
              >
                {loading ? ts('button.registering') : ts('button.register')}
              </button>
            </div>
          )}

                </form>

          {/* Кнопки управления (Назад / Далее / Регистрация) */}

        <p className="text-center text-gray-500 mt-4">
          {ts('button.alreadyHaveAccount')}{' '}
          <Link href="/login" className="text-indigo-600 hover:underline">{ts('button.login')}</Link>
        </p>
      </div>
    </AuthLayout>
  );
}