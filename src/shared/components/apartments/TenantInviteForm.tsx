import React, { useState } from 'react';
import { addOrInviteTenantToApartment } from '@/modules/apartments/services/apartmentsService';
import { toast } from 'react-toastify';

interface TenantInviteFormProps {
  apartmentId: string;
}

export const TenantInviteForm: React.FC<TenantInviteFormProps> = ({ apartmentId }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInvite = async () => {
    setError('');
    if (!email || !email.includes('@')) {
      setError('Введите корректный email');
      return;
    }
    setLoading(true);
    try {
      await addOrInviteTenantToApartment(apartmentId, email);
      toast.success(`Приглашение отправлено: ${email}`);
      setEmail(''); // поле очищается, форма остаётся
    } catch (e: any) {
      setError(e?.message || 'Ошибка при приглашении');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 items-center flex-wrap">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email арендатора"
        className="flex-1 min-w-50 rounded-xl bg-white border-2 border-gray-200 text-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
        disabled={loading}
      />
      <button
        type="button"
        onClick={handleInvite}
        disabled={loading || !email}
        className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-50 transition"
      >
        {loading ? 'Отправка...' : 'Пригласить арендатора'}
      </button>
      {error && <p className="text-red-600 mt-2 text-sm font-medium w-full">{error}</p>}
    </div>
  );
};