import React, { useRef, useEffect, useState } from 'react';


interface WaterMeterInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  color?: 'red' | 'blue'; // для палочки слева
  meterNumber?: string;
  // validUntil убран
  previousValue?: string; // прошлое показание
}


// По макету: 5 целых, 3 дробных
const INTEGER_LENGTH = 5;
const FRACTION_LENGTH = 3;


export const WaterMeterInput: React.FC<WaterMeterInputProps> = ({
  onChange,
  color = 'blue',
  meterNumber,
  previousValue,
}) => {
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      {/* Крупное предыдущее показание удалено по просьбе пользователя */}
      <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 180 }}>
          <div style={{ fontSize: 14, color: '#222', fontWeight: 400 }}>
            Iepriekšējais skaitītājs: <span style={{ fontWeight: 700 }}>{previousValue !== undefined && previousValue !== '' ? previousValue : '________'}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 8, padding: '4px 12px', position: 'relative', boxShadow: '0 1px 4px #0001', marginTop: 8 }}>
        {/* Colored bar */}
        <div style={{ width: 4, height: 40, borderRadius: 2, marginRight: 8, background: color === 'red' ? '#f87171' : '#3b82f6' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
              style={{
                width: 40,
                height: 48,
                textAlign: 'center',
                fontSize: 30,
                fontWeight: 700,
                color: '#222',
                background: color === 'red' ? '#fff5f5' : '#f6faff',
                border: `1.5px solid ${color === 'red' ? '#ef4444' : '#3b82f6'}`,
                outline: 'none',
                marginRight: 0,
                boxShadow: color === 'red' ? '0 1px 4px #ef444422' : '0 1px 4px #3b82f622',
                borderRadius: 7,
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            />
          ))}
          <span style={{ fontSize: 28, margin: '0 4px', fontWeight: 700, color: '#888', alignSelf: 'center' }}>,</span>
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
              style={{
                width: 40,
                height: 48,
                textAlign: 'center',
                fontSize: 30,
                fontWeight: 700,
                color: '#222',
                background: color === 'red' ? '#fff5f5' : '#f6faff',
                border: `1.5px solid ${color === 'red' ? '#ef4444' : '#3b82f6'}`,
                outline: 'none',
                marginRight: 0,
                boxShadow: color === 'red' ? '0 1px 4px #ef444422' : '0 1px 4px #3b82f622',
                borderRadius: 7,
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            />
          ))}
        </div>
      </div>
      {/* Подпись только с номером счетчика */}
      <div style={{ display: 'flex', flexDirection: 'row', width: '100%', marginTop: 2, marginLeft: 18 }}>
        <div style={{ fontSize: 14, color: '#222', fontWeight: 400, minWidth: 120 }}>
          Karstais: Nr. <span style={{ fontWeight: 700 }}>{meterNumber || '________'}</span>
        </div>
      </div>
    </div>
  );
};



