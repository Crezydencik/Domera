import React, { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'use-intl';


interface WaterMeterInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  color?: 'red' | 'blue'; // для палочки слева
  meterNumber?: string;
  // validUntil убран
  previousValue?: string; // прошлое показание
  previousPeriodLabel?: string;
  currentPeriodLabel?: string;
  waterType?: 'hot' | 'cold'; // тип воды для подписи
}


// По макету: 5 целых, 3 дробных
const INTEGER_LENGTH = 5;
const FRACTION_LENGTH = 3;


export const WaterMeterInput: React.FC<WaterMeterInputProps> = ({
  onChange,
  color = 'blue',
  meterNumber,
  previousValue,
  previousPeriodLabel,
  currentPeriodLabel,
  waterType = 'hot',
}) => {
  const t = useTranslations('dashboard.meterReadings');
  // Локальное состояние для каждой ячейки (всегда длина 5 и 3)
  const [intArr, setIntArr] = useState<string[]>(() => Array(INTEGER_LENGTH).fill(''));
  const [fracArr, setFracArr] = useState<string[]>(() => Array(FRACTION_LENGTH).fill(''));

  // useEffect для контроля длины массивов не нужен, так как useState гарантирует нужную длину

  // refs для автофокуса (правильно по правилам хуков)
  const intRefs = useRef<Array<HTMLInputElement | null>>([]);
  const fracRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Не синхронизируем с value — всегда пусто


  // Обработчик изменения одной ячейки целой части
  const handleIntChange = (idx: number, digit: string) => {
    if (!/^[0-9]?$/.test(digit)) return;
    setIntArr(prev => {
      const arr = [...prev];
      arr[idx] = digit;
      onChange(arr.join('') + '.' + fracArr.join(''));
      return arr;
    });
    // Автофокус вперёд только при вводе цифры, но не при удалении
    if (digit !== '' && idx < INTEGER_LENGTH - 1) {
      intRefs.current[idx + 1]?.focus();
    }
  };
  // Обработчик изменения одной ячейки дробной части
  const handleFracChange = (idx: number, digit: string) => {
    if (!/^[0-9]?$/.test(digit)) return;
    setFracArr(prev => {
      const arr = [...prev];
      arr[idx] = digit;
      onChange(intArr.join('') + '.' + arr.join(''));
      return arr;
    });
    // Автофокус вперёд только при вводе цифры, но не при удалении
    if (digit !== '' && idx < FRACTION_LENGTH - 1) {
      fracRefs.current[idx + 1]?.focus();
    }
  };


  // Обработчик стрелок и backspace
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
    refs: Array<HTMLInputElement | null>,
    maxLen: number
  ) => {
    if (e.key === 'ArrowLeft' && idx > 0) {
      refs[idx - 1]?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && idx < maxLen - 1) {
      refs[idx + 1]?.focus();
      e.preventDefault();
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && idx > 0 && (e.target as HTMLInputElement).value === '') {
      refs[idx - 1]?.focus();
      e.preventDefault();
    }
  };



 


  return (
    <div className="flex flex-col items-start gap-1 w-full">
      {/* Крупное предыдущее показание удалено по просьбе пользователя */}
      <div className="flex flex-row w-full">
        <div className="flex flex-col items-start min-w-[120px] sm:min-w-[180px]">
          <div className="text-[13px] sm:text-[14px] text-[#222] font-normal">
            {t('previousValue')}{previousPeriodLabel ? ` > ${previousPeriodLabel}` : ''}: <span className="font-bold">{previousValue !== undefined && previousValue !== '' ? previousValue : '________'}</span>
          </div>
          <div className="text-[13px] sm:text-[14px] text-[#222] font-normal mt-1">
            {t('currentValue')}{currentPeriodLabel ? ` > ${currentPeriodLabel}` : ''}
          </div>
        </div>
      </div>
      <div
        className="flex items-center gap-1 bg-white rounded-lg px-1 py-1 relative shadow-sm mt-2 w-full overflow-x-auto"
        style={{ boxShadow: '0 1px 4px #0001', WebkitOverflowScrolling: 'touch' }}
      >
        {/* Colored bar */}
        <div
          className="rounded w-1 h-6 mr-2"
          style={{ background: color === 'red' ? '#f87171' : '#3b82f6' }}
        />
        <div className="flex items-center gap-0.5 flex-nowrap w-full">
          {intArr.map((digit, idx) => (
            <input
              key={idx}
              ref={(el: HTMLInputElement | null) => { intRefs.current[idx] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleIntChange(idx, e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => handleKeyDown(e, idx, intRefs.current, INTEGER_LENGTH)}
              className={`text-center font-bold text-[#222] outline-none transition-all border border-gray-300 rounded focus:ring-2 focus:ring-blue-200
                ${color === 'red' ? 'bg-red-50 border-red-400' : 'bg-blue-50 border-blue-400'}
                w-[clamp(1.8rem,5vw,2.5rem)] h-[clamp(2.2rem,7vw,2.8rem)] min-w-[1.5rem] min-h-[2rem] text-base sm:text-lg
              `}
              style={{ marginRight: 0 }}
            />
          ))}
          <span className="text-base sm:text-lg mx-1 font-bold text-[#888] align-middle">,</span>
          {fracArr.map((digit, idx) => (
            <input
              key={idx}
              ref={(el: HTMLInputElement | null) => { fracRefs.current[idx] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleFracChange(idx, e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => handleKeyDown(e, idx, fracRefs.current, FRACTION_LENGTH)}
              className={`text-center font-bold text-[#222] outline-none transition-all border border-gray-300 rounded focus:ring-2 focus:ring-blue-200
                ${color === 'red' ? 'bg-red-50 border-red-400' : 'bg-blue-50 border-blue-400'}
                w-[clamp(1.8rem,5vw,2.5rem)] h-[clamp(2.2rem,7vw,2.8rem)] min-w-[1.5rem] min-h-[2rem] text-base sm:text-lg
              `}
              style={{ marginRight: 0 }}
            />
          ))}
        </div>
      </div>
      {/* Подпись только с номером счетчика и типом воды */}
      <div className="flex flex-row w-full mt-1 ml-4 sm:mt-0 sm:ml-5">
        <div className="text-[13px] sm:text-[14px] text-[#222] font-normal min-w-[80px] sm:min-w-[120px]">
          {waterType === 'hot' ? t('hotWater') : t('coldWater')}: Nr. <span className="font-bold">{meterNumber || '________'}</span>
        </div>
      </div>
    </div>
  );
};



