
import React, { useState } from "react";
import { validateConsumption, validateMeterReading } from '@/shared/validation';

interface WaterMeterInputFormProps {
  meterId: string;
  meterLabel: string;
  previousValue: number;
  onSubmit: (value: number) => Promise<void>;
  isSubmitting?: boolean;
}

export const WaterMeterInputForm: React.FC<WaterMeterInputFormProps> = ({
  meterId,
  meterLabel,
  previousValue,
  onSubmit,
  isSubmitting,
}) => {
  const [valueInt, setValueInt] = useState('');
  const [valueFrac, setValueFrac] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChangeInt = (val: string) => {
    setValueInt(val.replace(/\D/g, '').slice(0, 6));
    setSuccess(false);
    setError(null);
  };
  const handleChangeFrac = (val: string) => {
    setValueFrac(val.replace(/\D/g, '').slice(0, 3));
    setSuccess(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const intPart = valueInt || '0';
    let fracPart = valueFrac || '0';
    fracPart = fracPart.padEnd(3, '0');
    const rawValue = `${intPart}.${fracPart}`;
    const currentValue = Number(rawValue);

    // Валидация значения
    const meterReadingValidation = validateMeterReading(currentValue);
    if (!meterReadingValidation.isValid) {
      setError(meterReadingValidation.error ?? 'Некорректное значение');
      return;
    }
    const consumptionValidation = validateConsumption(currentValue, previousValue);
    if (!consumptionValidation.isValid) {
      setError(consumptionValidation.error ?? 'Некорректный расход');
      return;
    }

    try {
      await onSubmit(currentValue);
      setSuccess(true);
      setValueInt('');
      setValueFrac('');
    } catch (err: any) {
      setError(err?.message || 'Ошибка отправки');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`border rounded-xl p-4 mb-4 ${error ? 'border-red-400' : 'border-gray-200'}`}> 
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold">{meterLabel}</span>
        <span className="text-xs text-gray-500">Nr. {meterId}</span>
      </div>
      <div className="flex gap-2 items-end">
        <input
          type="text"
          className="w-24 px-2 py-2 border border-gray-300 rounded text-center text-lg font-mono"
          value={valueInt}
          onChange={e => handleChangeInt(e.target.value)}
          maxLength={6}
          disabled={isSubmitting}
        />
        <span className="text-2xl font-bold">,</span>
        <input
          type="text"
          className="w-16 px-2 py-2 border border-gray-300 rounded text-center text-lg font-mono"
          value={valueFrac}
          onChange={e => handleChangeFrac(e.target.value)}
          maxLength={3}
          disabled={isSubmitting}
        />
      </div>
      <div className="text-xs text-gray-500 mt-2">
        Предыдущее: {previousValue}
      </div>
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
      {success && <div className="text-xs text-green-600 mt-1">Показание успешно отправлено!</div>}
      <button
        type="submit"
        className="mt-3 px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
        disabled={isSubmitting}
      >
        Отправить показание
      </button>
    </form>
  );
};
