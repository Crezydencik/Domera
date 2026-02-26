"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { createCompany } from '@/modules/company/services/companyService';
import { updateDocument } from '@/firebase/services/firestoreService';

export default function RegisterCompanyPage() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!user?.uid) {
      setError('Ошибка: пользователь не найден.');
      return;
    }
    if (!name.trim()) {
      setError('Введите название компании.');
      return;
    }
    if (!address.trim()) {
      setError('Введите адрес компании.');
      return;
    }
    if (!phone.trim()) {
      setError('Введите телефон компании.');
      return;
    }
    setLoading(true);
    try {
      const company = await createCompany(name, user.uid, {
        address,
        phone,
        email: user.email || '',
      });
      await updateDocument('users', user.uid, { companyId: company.id, role: 'ManagementCompany' });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Ошибка при создании компании');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md bg-slate-800 rounded-lg p-8 border border-slate-700 text-white">
        <h1 className="text-2xl font-bold mb-6 text-center">Создать новую компанию</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
			 <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition opacity-60 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Название компании</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Введите название компании"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Адрес</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Введите адрес компании"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Телефон</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Введите телефон компании"
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
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-lg transition"
            disabled={loading}
          >
            {loading ? 'Создание...' : 'Создать компанию'}
          </button>
        </form>
      </div>
    </div>
  );
}
