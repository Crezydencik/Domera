import React, { useState } from 'react';

interface InviteResidentFormProps {
  onInvite: (email: string, apartmentId: string, gdprConfirmed: boolean) => void;
  apartments: { id: string; number: string }[];
  loading: boolean;
  error: string;
  success: string;
}

export const InviteResidentForm: React.FC<InviteResidentFormProps> = ({
  onInvite,
  apartments,
  loading,
  error,
  success,
}) => {
  const [email, setEmail] = useState('');
  const [apartmentId, setApartmentId] = useState(apartments[0]?.id || '');
  const [gdprConfirmed, setGdprConfirmed] = useState(false);

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onInvite(email, apartmentId, gdprConfirmed);
      }}
      className="grid gap-4 md:grid-cols-2"
    >
      <div>
        <label className="block text-sm text-gray-300 mb-2">Email жильца</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="resident@example.com"
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-300 mb-2">Квартира</label>
        <select
          value={apartmentId}
          onChange={e => setApartmentId(e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
          required
        >
          {apartments.length === 0 ? (
            <option value="">Нет доступных квартир</option>
          ) : (
            apartments.map(apt => (
              <option key={apt.id} value={apt.id}>
                Квартира {apt.number}
              </option>
            ))
          )}
        </select>
      </div>
      <label className="md:col-span-2 flex items-start gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={gdprConfirmed}
          onChange={e => setGdprConfirmed(e.target.checked)}
          className="mt-1"
          required
        />
        Подтверждаю правовое основание обработки данных и факт уведомления жильца о политике конфиденциальности.
      </label>
      {error && (
        <div className="md:col-span-2 text-sm text-red-300 bg-red-900/30 border border-red-700 rounded-md px-3 py-2">{error}</div>
      )}
      {success && (
        <div className="md:col-span-2 text-sm text-green-300 bg-green-900/30 border border-green-700 rounded-md px-3 py-2">{success}</div>
      )}
      <div className="md:col-span-2 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading || apartments.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? 'Отправка...' : 'Отправить приглашение на email'}
        </button>
      </div>
    </form>
  );
};
