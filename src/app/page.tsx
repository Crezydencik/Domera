'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-white">
          🏢 Domera
        </div>
        <div className="space-x-4">
          <Link href="/test-login" className="text-amber-400 hover:text-amber-300 transition text-sm">
            Тест
          </Link>
          <Link href="/login" className="text-white hover:text-blue-400 transition">
            Вход
          </Link>
          <Link href="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            Регистрация
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left side - Content */}
          <div className="space-y-6">
            <h1 className="text-5xl font-bold text-white leading-tight">
              Управляйте домом <span className="text-blue-400">легко</span>
            </h1>
            
            <p className="text-xl text-gray-300">
              Облачная SaaS-платформа для управляющих компаний и жильцов многоквартирных домов
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <span className="text-blue-400">✓</span>
                <span className="text-gray-200">Управление домами и квартирами</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-blue-400">✓</span>
                <span className="text-gray-200">Передача показаний счётчиков</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-blue-400">✓</span>
                <span className="text-gray-200">Архив счетов и платежей</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-blue-400">✓</span>
                <span className="text-gray-200">Приглашение жильцов</span>
              </div>
            </div>

            <div className="pt-4 space-x-4">
              <Link href="/register" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition font-semibold">
                Начать бесплатно
              </Link>
              <Link href="/login" className="inline-block border-2 border-blue-400 text-blue-400 px-8 py-3 rounded-lg hover:bg-blue-400 hover:text-white transition font-semibold">
                У меня уже есть аккаунт
              </Link>
            </div>
          </div>

          {/* Right side - Stats */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-8 text-white shadow-lg">
              <div className="text-4xl font-bold">∞</div>
              <p className="text-blue-100 mt-2">Масштабируемость</p>
              <p className="text-sm text-blue-200 mt-1">Растите без ограничений</p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-8 text-white shadow-lg">
              <div className="text-4xl font-bold">🔒</div>
              <p className="text-green-100 mt-2">Безопасность</p>
              <p className="text-sm text-green-200 mt-1">Multi-tenant архитектура</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-8 text-white shadow-lg">
              <div className="text-4xl font-bold">⚡</div>
              <p className="text-purple-100 mt-2">Производительность</p>
              <p className="text-sm text-purple-200 mt-1">Cloud Firestore при поддержке</p>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="text-3xl mb-4">👥</div>
            <h3 className="text-xl font-bold text-white mb-2">Для управляющей компании</h3>
            <p className="text-gray-400">Управляйте домами, квартирами и жильцами. Просматривайте все показания и счета в одном месте.</p>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="text-3xl mb-4">🏠</div>
            <h3 className="text-xl font-bold text-white mb-2">Для жилца</h3>
            <p className="text-gray-400">Передавайте показания счётчиков, просматривайте счета и скачивайте документы онлайн.</p>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="text-3xl mb-4">🚀</div>
            <h3 className="text-xl font-bold text-white mb-2">Готово к расширению</h3>
            <p className="text-gray-400">Модульная архитектура позволяет добавлять новые функции быстро и безопасно.</p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Готовы начать?
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            Создайте аккаунт управляющей компании или запросите приглашение жилца
          </p>
          <div className="space-x-4">
            <Link href="/register" className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-gray-100 transition font-semibold">
              Регистрация
            </Link>
            <Link href="/login" className="inline-block border-2 border-white text-white px-8 py-3 rounded-lg hover:bg-white hover:text-blue-600 transition font-semibold">
              Вход
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-400">
          <p>© 2026 Domera. Все права защищены.</p>
          <p className="text-sm mt-2">SaaS платформа для управления многоквартирными домами</p>
        </div>
      </footer>
    </div>
  );
}
