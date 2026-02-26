"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ChooseCompanyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md bg-slate-800 rounded-lg p-8 border border-slate-700 text-white">
        <h1 className="text-2xl font-bold mb-6 text-center">Выберите действие</h1>
        <div className="space-y-6">
          <button
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-lg transition"
            onClick={() => router.push('/register-company')}
          >
            Создать новую компанию
          </button>
          <button
            className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold text-lg transition"
            onClick={() => router.push('/join-company')}
          >
            Присоединиться к существующей компании
          </button>
        </div>
        <div className="mt-8 text-center">
          <Link href="/dashboard" className="text-gray-400 hover:text-white">Вернуться в личный кабинет</Link>
        </div>
      </div>
    </div>
  );
}
