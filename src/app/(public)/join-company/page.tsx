"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinCompanyPage() {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // TODO: Реализовать проверку приглашения по inviteCode
    // Пример:
    // const invitation = await checkInvitation(inviteCode);
    // if (!invitation) {
    //   setError('Приглашение не найдено или недействительно');
    //   setLoading(false);
    //   return;
    // }
    // ...добавить пользователя в компанию...

    setTimeout(() => {
      setLoading(false);
      setError('Для присоединения к компании требуется приглашение.');
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md bg-slate-800 rounded-lg p-8 border border-slate-700 text-white">
        <h1 className="text-2xl font-bold mb-6 text-center">Присоединиться к компании</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Код приглашения
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              placeholder="Введите код приглашения"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>
          {error && (
            <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold text-lg transition"
            disabled={loading}
          >
            {loading ? 'Проверка...' : 'Присоединиться'}
          </button>
        </form>
      </div>
    </div>
  );
}
