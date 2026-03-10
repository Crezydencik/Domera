'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import { getAuth, fetchSignInMethodsForEmail } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { registerUser } from '@/modules/auth/services/authService';
import AuthLayout from '@/shared/components/layout/AuthLayout';

export default function RegisterPage() {
  const [role, setRole] = useState<'resident' | 'uk'>('resident');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [emailExists, setEmailExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      setEmailExists(false);
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Проверка email при потере фокуса
  const handleEmailBlur = async () => {
    if (!formData.email.trim()) return;
    setLoading(true);
    const exists = await checkEmailExists(formData.email);
    if (exists) {
      setEmailExists(true);
      toast.info(
        <div>
          <div>Email уже используется.</div>
          <div className="mt-2 flex gap-2">
            <button
              className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              onClick={() => router.push('/login')}
            >Войти</button>
            <button
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              onClick={() => router.push('/reset-password')}
            >Сменить пароль</button>
          </div>
        </div>,
        { autoClose: false }
      );
    } else {
      setEmailExists(false);
    }
    setLoading(false);
  };

  async function checkEmailExists(email: string): Promise<boolean> {
    // Используем singleton auth из '@/firebase/config'
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { auth } = require('../../../firebase/config');
      const methods = await fetchSignInMethodsForEmail(auth, email);
      return methods && methods.length > 0;
    } catch (err) {
      console.error('Ошибка проверки email в Firebase:', err);
      return false;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Общая валидация для 1 шага
    if (!formData.email.trim()) return toast.error('Введите email');
    if (formData.password !== formData.confirmPassword) return toast.error('Пароли не совпадают');
    if (formData.password.length < 6) return toast.error('Пароль должен быть не менее 6 символов');

    if (step === 1) {
      setLoading(true);
      try {
        const exists = await checkEmailExists(formData.email);
        if (exists) {
          setEmailExists(true);
          toast.info(
            <div>
              <div>Email уже используется.</div>
              <div className="mt-2 flex gap-2">
                <button
                  className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  onClick={() => router.push('/login')}
                >Войти</button>
                <button
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  onClick={() => router.push('/reset-password')}
                >Сменить пароль</button>
              </div>
            </div>,
            { autoClose: false }
          );
          setLoading(false);
          return; // Блокируем переход на второй этап
        }
        setStep(2);
      } catch {
              setEmailExists(true);
        toast.error('Ошибка проверки email');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Валидация для 2 шага
    if (role === 'uk' && step === 2) {
      if (!formData.companyName.trim()) return toast.error('Введите название компании');
      if (!formData.companyAddress.trim()) return toast.error('Введите адрес');
      if (!formData.companyPhone.trim()) return toast.error('Введите телефон');
    }
    if (role === 'resident' && step === 2) {
      if (!formData.firstName.trim()) return toast.error('Введите имя');
      if (!formData.lastName.trim()) return toast.error('Введите фамилию');
      if (!formData.phone.trim()) return toast.error('Введите телефон');
    }

    setLoading(true);
    try {
      const user = await registerUser(
        {
          email: formData.email,
          password: formData.password,
          token: '',
        },
        role === 'uk' ? 'ManagementCompany' : 'Resident',
        ''
      );
      if (!user || !user.uid) {
        toast.error('Ошибка регистрации');
        setLoading(false);
        return;
      }
      toast.success('Регистрация успешна!');
      setTimeout(() => {
        router.push(role === 'uk' ? '/dashboard' : '/choose-company');
      }, 500);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        toast.info(
          <div>
            <div>Email уже используется.</div>
            <div className="mt-2 flex gap-2">
              <button
                className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                onClick={() => router.push('/login')}
              >Войти</button>
              <button
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                onClick={() => router.push('/reset-password')}
              >Сменить пароль</button>
            </div>
          </div>,
          { autoClose: false }
        );
      } else if (err.code === 'auth/weak-password') {
        toast.error('Слабый пароль');
      } else if (err.code === 'auth/invalid-email') {
        toast.error('Некорректный email');
      } else {
        toast.error(err.message || 'Ошибка регистрации');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Регистрация</h1>
          <p className="text-gray-500 text-center">Создайте аккаунт для доступа к системе</p>
        </div>

        {/* Индикатор шагов */}
        <div className="flex flex-col items-center mb-6 select-none">
          <span className="text-sm text-gray-500 mb-2">Шаг {step} из 2</span>
          <div className="flex gap-2">
            <div className={`w-8 h-2 rounded-full transition-all duration-200 ${step === 1 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
            <div className={`w-8 h-2 rounded-full transition-all duration-200 ${step === 2 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Шаг 1: Email и пароль */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleEmailBlur}
                  placeholder="example@mail.com"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Пароль</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition"
                  autoComplete="new-password"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Минимум 6 символов</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Повторите пароль</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition"
                  autoComplete="new-password"
                  required
                />
              </div>
                        {/* Выбор роли */}
          <div className="flex justify-center gap-3 mb-2 mt-4">
            <button
              type="button"
              onClick={() => {setRole('resident'); setStep(1);}}
              className={`px-4 py-2 rounded-4 border font-semibold transition-all duration-150 text-sm
                ${role==='resident' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
            >Жилец</button>
            <button
              type="button"
              onClick={() => {setRole('uk'); setStep(1);}}
              className={`px-4 py-2 rounded-4 border font-semibold transition-all duration-150 text-sm
                ${role==='uk' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
            >УК</button>
          </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-all duration-150"
                  onClick={async () => {
                    if (!formData.email.trim()) return toast.error('Введите email');
                    if (formData.password !== formData.confirmPassword) return toast.error('Пароли не совпадают');
                    if (formData.password.length < 6) return toast.error('Пароль должен быть не менее 6 символов');
                    setLoading(true);
                    const exists = await checkEmailExists(formData.email);
                    if (exists) {
                      setEmailExists(true);
                      toast.info(
                        <div>
                          <div>Email уже используется.</div>
                          <div className="mt-2 flex gap-2">
                            <button
                              className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                              onClick={() => router.push('/login')}
                            >Войти</button>
                            <button
                              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                              onClick={() => router.push('/reset-password')}
                            >Сменить пароль</button>
                          </div>
                        </div>,
                        { autoClose: false }
                      );
                      setLoading(false);
                      return;
                    }
                    setStep(2);
                    setLoading(false);
                  }}
                >
                  Далее
                </button>
              </div>
            </>
          )}

          {/* Шаг 2: УК */}
          {role === 'uk' && step === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Название компании</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="ООО УК Пример"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Адрес</label>
                <input
                  type="text"
                  name="companyAddress"
                  value={formData.companyAddress}
                  onChange={handleChange}
                  placeholder="г. Город, ул. Пример, д. 1"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Телефон</label>
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
          {role === 'resident' && step === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Имя</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Иван"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Фамилия</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Петров"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Телефон</label>
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
                    placeholder="(___) ___-__-__"
                    className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
            <div className="flex gap-3 mt-6">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition duration-150"
                >
                  Назад
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-2 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-all duration-150"
              >
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
            </div>
              </div>
            </>

          )}

                </form>

          {/* Кнопки управления (Назад / Далее / Регистрация) */}

        <p className="text-center text-gray-500 mt-4">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-indigo-600 hover:underline">Войти</Link>
        </p>
      </div>
    </AuthLayout>
  );
}