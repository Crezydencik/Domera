'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLanguage } from '@/shared/providers/LanguageProvider';
import { locales, localeNames, localeFlags } from '@/../i8n/config';
import { LanguageSwitcher } from '../shared/components/layout/LanguageSwitcher';

export default function Home() {
  const t = useTranslations('');
  const { locale, setLocale } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openLangMenu, setOpenLangMenu] = useState(false);

  const faqItems = [
    {
      question: t('home.faq1Question') || 'Как начать пользоваться платформой?',
      answer: t('home.faq1Answer') || 'Создайте аккаунт менеджера за несколько минут и управляйте своими зданиями и квартирами.',
    },
    {
      question: t('home.faq2Question') || 'Какие функции доступны?',
      answer: t('home.faq2Answer') || 'Управление квартирами, отслеживание показаний счетчиков, выставление счетов и коммуникация с жильцами.',
    },
    {
      question: t('home.faq3Question') || 'Безопасны ли мои данные?',
      answer: t('home.faq3Answer') || 'Да, мы используем многоуровневую архитектуру безопасности и данные хранятся в защищенных облачных базах.',
    },
    {
      question: t('home.faq4Question') || 'Есть ли пробный период?',
      answer: t('home.faq4Answer') || 'Да, вы можете попробовать платформу бесплатно перед любыми платежами.',
    },
  ];
    const handleLanguageChange = (newLang: string) => {
    setLocale(newLang);
    };
    

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50 to-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center">
            <img src="/Logo1.png" alt="Domera Logo" className="w-56 h-12" />
          </div>
          <div className="flex items-center space-x-4">
            {/* Language Switcher */}

            <Link href="/login" className="text-slate-600 hover:text-blue-600 transition font-medium">
              {t('auth.login.title')}
            </Link>
            <Link href="/register" className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2 rounded-lg hover:shadow-lg transition duration-300">
              {t('auth.register.title')}
            </Link>
            <div className="relative">
                               <LanguageSwitcher value={locale} onChange={handleLanguageChange} />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute bottom-20 left-0 w-96 h-96 bg-indigo-200 rounded-full opacity-20 blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left side - Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-block bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold">
                  ✨ {t('home.newWayToManage') || 'Новый способ управления'}
                </div>
                <h1 className="text-6xl font-bold text-slate-900 leading-tight">
                  {t('home.subtitleManagement') || 'Управляйте зданиями'}
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> {t('home.subtitleManagementHighlight') || ' легко'}</span>
                </h1>
                <p className="text-xl text-slate-600 leading-relaxed max-w-lg">
                  {t('home.subtitleResident') || 'Современная платформа для управления жилыми комплексами и коммуникации с жильцами'}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <span className="text-slate-700">{t('home.feature1') || 'Управление квартирами'}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <span className="text-slate-700">{t('home.feature2') || 'Отслеживание показаний'}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <span className="text-slate-700">{t('home.feature3') || 'Выставление счетов'}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <span className="text-slate-700">{t('home.feature4') || 'Коммуникация с жильцами'}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-4">
                <Link href="/register" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-lg hover:shadow-xl transition duration-300 font-semibold">
                  {t('home.startFree') || 'Начать бесплатно'}
                  <span>→</span>
                </Link>
                <Link href="/login" className="inline-flex items-center gap-2 border-2 border-slate-300 text-slate-700 px-8 py-3 rounded-lg hover:border-blue-600 hover:text-blue-600 transition duration-300 font-semibold">
                  {t('home.alreadyHaveAccount')} →
                </Link>
              </div>
            </div>

            {/* Right side - Visual Stats */}
            <div className="grid gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-8 hover:shadow-lg transition duration-300">
                <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">∞</div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{t('home.scalability') || 'Масштабируемость'}</h3>
                <p className="text-slate-600">{t('home.growWithoutLimits') || 'Растите без ограничений'}</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-8 hover:shadow-lg transition duration-300">
                <div className="text-5xl mb-3">🔒</div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{t('home.security') || 'Безопасность'}</h3>
                <p className="text-slate-600">{t('home.multiTenantArchitecture') || 'Многоуровневая архитектура'}</p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-8 hover:shadow-lg transition duration-300">
                <div className="text-5xl mb-3">⚡</div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{t('home.performance') || 'Производительность'}</h3>
                <p className="text-slate-600">{t('home.cloudFirestoreSupport') || 'Поддержка облачных баз'}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              О платформе <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Domera</span>
            </h2>
            <p className="text-xl text-slate-600">
              Современное решение для управления жилыми комплексами, созданное с учетом потребностей менеджеров и жильцов
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 border border-slate-200 rounded-xl hover:shadow-lg transition duration-300">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{t('home.forManagers') || 'Для менеджеров'}</h3>
              <p className="text-slate-600 leading-relaxed">{t('home.manageHomesAndApartments') || 'Управляйте зданиями и квартирами из одного интерфейса'}</p>
            </div>

            <div className="p-8 border border-slate-200 rounded-xl hover:shadow-lg transition duration-300">
              <div className="text-4xl mb-4">🏠</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{t('home.forResidents') || 'Для жильцов'}</h3>
              <p className="text-slate-600 leading-relaxed">{t('home.residentsFeatures') || 'Простая система передачи показаний и просмотра счетов'}</p>
            </div>

            <div className="p-8 border border-slate-200 rounded-xl hover:shadow-lg transition duration-300">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{t('home.readyForExpansion') || 'Готово к расширению'}</h3>
              <p className="text-slate-600 leading-relaxed">{t('home.modularArchitecture') || 'Модульная архитектура для легкого добавления функций'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Advantages Section */}
      <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Преимущества <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Domera</span>
            </h2>
            <p className="text-xl text-slate-600">
              Все что вам нужно для эффективного управления жилым комплексом
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-6 p-8 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition duration-300">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                  📊
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Аналитика и отчеты</h3>
                <p className="text-slate-600">Получайте подробные отчеты о состоянии вашего имущества и доходах</p>
              </div>
            </div>

            <div className="flex gap-6 p-8 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition duration-300">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">
                  ⏰
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Автоматизация</h3>
                <p className="text-slate-600">Автоматизируйте рутинные задачи и сэкономьте время</p>
              </div>
            </div>

            <div className="flex gap-6 p-8 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition duration-300">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">
                  💬
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Коммуникация</h3>
                <p className="text-slate-600">Легко общайтесь с жильцами напрямую через платформу</p>
              </div>
            </div>

            <div className="flex gap-6 p-8 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition duration-300">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-2xl">
                  🌍
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Доступность</h3>
                <p className="text-slate-600">Управляйте из любого места, на любом устройстве</p>
              </div>
            </div>

            <div className="flex gap-6 p-8 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition duration-300">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-2xl">
                  🔧
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Поддержка</h3>
                <p className="text-slate-600">Быстрая поддержка и обновления функций нашей командой</p>
              </div>
            </div>

            <div className="flex gap-6 p-8 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition duration-300">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-2xl">
                  💳
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Платежи</h3>
                <p className="text-slate-600">Интегрированная система для выставления и отслеживания платежей</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Часто задаваемые вопросы
            </h2>
            <p className="text-xl text-slate-600">
              Найдите ответы на основные вопросы о нашей платформе
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map((item, index) => (
              <div key={index} className="border border-slate-200 rounded-lg overflow-hidden hover:border-blue-300 transition duration-300">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-4 bg-white hover:bg-slate-50 transition duration-300 flex items-center justify-between"
                >
                  <h3 className="text-lg font-semibold text-slate-900 text-left">{item.question}</h3>
                  <span className={`text-blue-600 text-2xl transition duration-300 flex-shrink-0 ml-4 ${openFaq === index ? 'rotate-180' : ''}`}>
                    ∨
                  </span>
                </button>
                {openFaq === index && (
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <p className="text-slate-600 leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-5xl font-bold text-white mb-6">
            {t('home.readyToStart') || 'Готовы начать?'}
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            {t('home.createManagerAccountOrRequestInvite') || 'Создайте аккаунт менеджера или запросите приглашение для жильцов'}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/register" className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-lg hover:shadow-xl transition duration-300 font-semibold text-lg">
              {t('home.register') || 'Зарегистрироваться'}
              <span>→</span>
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 border-2 border-white text-white px-8 py-4 rounded-lg hover:bg-white hover:text-blue-600 transition duration-300 font-semibold text-lg">
              {t('home.login') || 'Войти в аккаунт'}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-lg font-semibold text-white mb-2">© 2026 Domera. {t('home.allRightsReserved') || 'Все права защищены'}</p>
          <p className="text-sm">{t('home.saasPlatformForApartmentManagement') || 'SaaS платформа для управления жилыми комплексами'}</p>
        </div>
      </footer>
    </div>
  );
}
