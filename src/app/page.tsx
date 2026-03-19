'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLanguage } from '@/shared/providers/LanguageProvider';
import { LanguageSwitcher } from '../shared/components/layout/LanguageSwitcher';

export default function Home() {
  const t = useTranslations('home');
  const ts = useTranslations('system');
  const tSidebar = useTranslations('dashboard.sidebar');

  const { locale, setLocale } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const faqItems = [
    {
      question: t('faq.faq1Question'),
      answer: t('faq.faq1Answer'),
    },
    {
      question: t('faq.faq2Question'),
      answer: t('faq.faq2Answer'),
    },
    {
      question: t('faq.faq3Question'),
      answer: t('faq.faq3Answer'),
    },
    {
      question: t('faq.faq4Question'),
      answer: t('faq.faq4Answer'),
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
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/login" className="text-slate-600 hover:text-blue-600 transition font-medium">
              {ts('button.login')}
            </Link>
            <Link href="/register" className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2 rounded-lg hover:shadow-lg transition duration-300">
              {ts('button.register')}
            </Link>
            <div className="relative">
                               <LanguageSwitcher value={locale} onChange={handleLanguageChange} />
            </div>
          </div>
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100"
            aria-label={isMobileMenuOpen ? tSidebar('closeMenu') : tSidebar('openMenu')}
            onClick={() => setIsMobileMenuOpen(prev => !prev)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label={tSidebar('closeMenu')}
            className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="fixed right-0 top-0 z-50 h-full w-80 max-w-[85vw] border-l border-slate-200 bg-white shadow-2xl md:hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <span className="text-lg font-semibold text-slate-900">Domera</span>
              <button
                type="button"
                aria-label={tSidebar('closeMenu')}
                className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex h-[calc(100%-73px)] flex-col gap-6 px-5 py-6">
              <div className="flex flex-col gap-3">
                <Link
                  href="/login"
                  className="rounded-lg border border-slate-200 px-4 py-3 text-center font-medium text-slate-700 transition hover:border-blue-600 hover:text-blue-600"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {ts('button.login')}
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center font-semibold text-white transition hover:shadow-lg"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {ts('button.register')}
                </Link>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <LanguageSwitcher variant="mob" value={locale} onChange={handleLanguageChange} />
              </div>
            </div>
          </aside>
        </>
      )}

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
                  ✨ {t('newWayToManage')}
                </div>
                <h1 className="text-6xl font-bold text-slate-900 leading-tight">
                  {t('subtitleManagement')}
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> {t('subtitleManagementHighlight')}</span>
                </h1>
                <p className="text-xl text-slate-600 leading-relaxed max-w-lg">
                  {t('subtitleResident')}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <span className="text-slate-700">{t('feature1')}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <span className="text-slate-700">{t('feature2')}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <span className="text-slate-700">{t('feature3')}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <span className="text-slate-700">{t('feature4')}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-4">
                <Link href="/register" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-lg hover:shadow-xl transition duration-300 font-semibold">
                  {t('startFree')}
                  <span>→</span>
                </Link>
                <Link href="/login" className="inline-flex items-center gap-2 border-2 border-slate-300 text-slate-700 px-8 py-3 rounded-lg hover:border-blue-600 hover:text-blue-600 transition duration-300 font-semibold">
                  {t('alreadyHaveAccount')} →
                </Link>
              </div>
            </div>

            {/* Right side - Visual Stats */}
            <div className="grid gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-8 hover:shadow-lg transition duration-300">
                <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">∞</div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{t('scalability')}</h3>
                <p className="text-slate-600">{t('growWithoutLimits')}</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-8 hover:shadow-lg transition duration-300">
                <div className="text-5xl mb-3">🔒</div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{t('security')}</h3>
                <p className="text-slate-600">{t('multiTenantArchitecture')}</p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-8 hover:shadow-lg transition duration-300">
                <div className="text-5xl mb-3">⚡</div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{t('performance')}</h3>
                <p className="text-slate-600">{t('cloudFirestoreSupport')}</p>
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
              {t('about.title')} <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Domera</span>
            </h2>
            <p className="text-xl text-slate-600">
              {t('about.description') }
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 border border-slate-200 rounded-xl hover:shadow-lg transition duration-300">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{t('about.forManagers')}</h3>
              <p className="text-slate-600 leading-relaxed">{t('about.manageHomesAndApartments')}</p>
            </div>

            <div className="p-8 border border-slate-200 rounded-xl hover:shadow-lg transition duration-300">
              <div className="text-4xl mb-4">🏠</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{t('about.forResidents')}</h3>
              <p className="text-slate-600 leading-relaxed">{t('about.residentsFeatures')}</p>
            </div>

            <div className="p-8 border border-slate-200 rounded-xl hover:shadow-lg transition duration-300">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{t('about.readyForExpansion')}</h3>
              <p className="text-slate-600 leading-relaxed">{t('about.modularArchitecture')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Advantages Section */}
      <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              {t('advantages.title')} <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Domera</span>
            </h2>
            <p className="text-xl text-slate-600">
              {t('advantages.description')}
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
                <h3 className="text-lg font-bold text-slate-900 mb-2">{t('advantages.analyticsReptitle')}</h3>
                <p className="text-slate-600">{t('advantages.analyticsRepdescr')}</p>
              </div>
            </div>

            <div className="flex gap-6 p-8 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition duration-300">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">
                  ⏰
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{t('advantages.automationtitle')}</h3>
                <p className="text-slate-600">{t('advantages.automationdescr')}</p>
              </div>
            </div>

            <div className="flex gap-6 p-8 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition duration-300">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">
                  💬
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{t('advantages.communicationtitle')}</h3>
                <p className="text-slate-600">{t('advantages.communicationdescr')}</p>
              </div>
            </div>

            <div className="flex gap-6 p-8 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition duration-300">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-2xl">
                  🌍
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{t('advantages.accessibilitytitle')}</h3>
                <p className="text-slate-600">{t('advantages.accessibilitydescr')}</p>
              </div>
            </div>

            <div className="flex gap-6 p-8 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition duration-300">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-2xl">
                  🔧
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{t('advantages.supporttitle')}</h3>
                <p className="text-slate-600">{t('advantages.supportdescr')}</p>
              </div>
            </div>

            <div className="flex gap-6 p-8 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition duration-300">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-2xl">
                  💳
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{t('advantages.paymentstitle')}</h3>
                <p className="text-slate-600">{t('advantages.paymentsdescr')}</p>
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
              {t('faq.title') }
            </h2>
            <p className="text-xl text-slate-600">
              {t('faq.description')}
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
            {t('readyToStart')}
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            {t('createManagerAccountOrRequestInvite')}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/register" className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-lg hover:shadow-xl transition duration-300 font-semibold text-lg">
              {ts('button.register')}
              <span>→</span>
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 border-2 border-white text-white px-8 py-4 rounded-lg hover:bg-white hover:text-blue-600 transition duration-300 font-semibold text-lg">
              {ts('button.login')}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-lg font-semibold text-white mb-2">© 2026 Domera. {t('allRightsReserved')}</p>
          <p className="text-sm">{t('saasPlatformForApartmentManagement')}</p>
        </div>
      </footer>
    </div>
  );
}
