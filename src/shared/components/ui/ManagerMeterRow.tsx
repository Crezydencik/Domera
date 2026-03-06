import React from 'react';

interface ManagerMeterRowProps {
  coldSerial: string;
  coldValue: string;
  coldOnChange: (val: string) => void;
  coldValidUntil: string;
  hotSerial: string;
  hotValue: string;
  hotOnChange: (val: string) => void;
  hotValidUntil: string;
  onSubmit: () => void;
  loading?: boolean;
}

export const ManagerMeterRow: React.FC<ManagerMeterRowProps> = ({
  coldSerial, coldValue, coldOnChange, coldValidUntil,
  hotSerial, hotValue, hotOnChange, hotValidUntil,
  onSubmit, loading
}) => {
  // Вспомогательная функция для рендера ячеек
  const renderMeter = (type: 'cold' | 'hot', serial: string, value: string, onChange: (v: string) => void, validUntil: string) => {
    const color = type === 'cold' ? 'blue' : 'red';
    const digits = value.padStart(6, '0').split('');
    const intPart = digits.slice(0, 6).join('');
    const frac = value.split('.')[1] || '000';
    return (
      <div className={`flex flex-col items-center flex-1 min-w-0 max-w-[340px]`}> 
        <div className="flex items-end gap-2 mb-2">
          <div className={`w-1 h-8 rounded ${color === 'blue' ? 'bg-blue-400' : 'bg-red-400'} mr-2`} />
          <div className="flex gap-1">
            {intPart.split('').map((d, i) => (
              <input
                key={i}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className="w-8 h-10 text-center text-2xl border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-blue-400 transition"
                value={d}
                onChange={e => {
                  const arr = intPart.split('');
                  arr[i] = e.target.value.replace(/\D/g, '').slice(0, 1);
                  onChange(arr.join('') + '.' + frac);
                }}
              />
            ))}
            <span className="text-2xl text-gray-400 mx-1">,</span>
            {[0,1,2].map(j => (
              <input
                key={j}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className="w-6 h-10 text-center text-xl border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-blue-400 transition"
                value={frac[j] || '0'}
                onChange={e => {
                  const arr = frac.split('');
                  arr[j] = e.target.value.replace(/\D/g, '').slice(0, 1);
                  onChange(intPart + '.' + arr.join(''));
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center w-full text-xs mt-1 mb-2">
          <span className={color === 'blue' ? 'text-blue-700' : 'text-red-700'}>{type === 'cold' ? 'Холодная' : 'Горячая'}</span>
          <span className="text-gray-700">Nr. <b>{serial}</b></span>
          <span className="text-gray-500">Действ. до: {validUntil}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full bg-white rounded-xl border border-gray-200 shadow-md p-6 items-start">
      <div className="flex-1 flex flex-col md:flex-row gap-8">
        {renderMeter('cold', coldSerial, coldValue, coldOnChange, coldValidUntil)}
        {renderMeter('hot', hotSerial, hotValue, hotOnChange, hotValidUntil)}
      </div>
      <div className="flex flex-col justify-end mt-4 md:mt-0">
        <button
          className="px-6 py-3 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60"
          onClick={onSubmit}
          disabled={loading}
        >
          {loading ? 'Сохраняем...' : 'Сдать показания'}
        </button>
      </div>
    </div>
  );
};
