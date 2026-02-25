import React, { useState } from 'react';

interface CreateApartmentFormProps {
  onCreate: (apartmentNumber: string) => void;
  buildingName: string;
  loading: boolean;
  error: string;
  onCancel: () => void;
}

export const CreateApartmentForm: React.FC<CreateApartmentFormProps> = ({
  onCreate,
  buildingName,
  loading,
  error,
  onCancel,
}) => {
  const [apartmentNumber, setApartmentNumber] = useState('');

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onCreate(apartmentNumber);
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm text-gray-300 mb-2">Номер квартиры</label>
        <input
          type="text"
          value={apartmentNumber}
          onChange={e => setApartmentNumber(e.target.value)}
          placeholder="Например: 12"
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
          required
        />
      </div>
      <p className="text-xs text-gray-400">
        Дом для квартиры: {buildingName || 'не найден (сначала создайте дом)'}
      </p>
      {error && (
        <div className="text-sm text-red-300 bg-red-900/30 border border-red-700 rounded-md px-3 py-2">{error}</div>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? 'Сохранение...' : 'Сохранить квартиру'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 hover:bg-slate-600 transition"
        >
          Отмена
        </button>
      </div>
    </form>
  );
};
