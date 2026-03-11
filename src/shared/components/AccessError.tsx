'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface AccessErrorProps {
  type?: 'noAccess' | 'loginRequired';
  showActions?: boolean;
}

export function AccessError({ type = 'loginRequired', showActions = true }: AccessErrorProps) {
  const t = useTranslations('');

  const errorConfig = {
    loginRequired: {
      icon: '🔐',
      title: t('home.loginRequired') || 'Требуется авторизация',
      description: t('home.loginDescription') || 'Пожалуйста, выполните вход в свою учетную запись, чтобы продолжить',
      primaryAction: { label: t('auth.login.title') || 'Войти', href: '/login' },
      secondaryAction: { label: t('auth.register.title') || 'Регистрация', href: '/register' },
    },
    noAccess: {
      icon: '🚫',
      title: t('home.noAccess') || 'Нет доступа',
      description: t('home.noAccessDescription') || 'У вас нет прав для доступа к этому ресурсу. Пожалуйста, свяжитесь с администратором.',
      primaryAction: { label: t('home.backButton') || 'Вернуться', href: '/' },
    },
  };

  const config = errorConfig[type];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50 to-white flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="mb-6 text-8xl animate-bounce">{config.icon}</div>
        <h1 className="text-5xl font-bold text-slate-900 mb-4">{config.title}</h1>
        <p className="text-xl text-slate-600 mb-8 leading-relaxed">{config.description}</p>

        {showActions && (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={config.primaryAction.href}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-lg hover:shadow-xl transition duration-300 font-semibold"
            >
              {config.primaryAction.label}
              <span>→</span>
            </Link>

            {config.secondaryAction && (
              <Link
                href={config.secondaryAction.href}
                className="inline-flex items-center justify-center gap-2 border-2 border-slate-300 text-slate-700 px-8 py-4 rounded-lg hover:border-blue-600 hover:text-blue-600 transition duration-300 font-semibold"
              >
                {config.secondaryAction.label}
                <span>→</span>
              </Link>
            )}
          </div>
        )}

        {/* Decorative elements */}
        <div className="mt-12 pt-8 border-t border-slate-200">
          <p className="text-slate-500 text-sm">
            {t('home.needHelp') || 'Нужна помощь?'}{' '}
            <a href="/" className="text-blue-600 hover:text-blue-700 font-semibold">
              {t('home.contactSupport') || 'Свяжитесь с поддержкой'}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
