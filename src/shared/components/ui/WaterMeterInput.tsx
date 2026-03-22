import React, { useRef } from 'react';

interface WaterMeterInputProps {
  value: string;
  onChange: (val: string) => void;
  integerLength?: number;
  fractionLength?: number;
  disabled?: boolean;
  color?: 'red' | 'blue'; // для палочки слева
}
export const WaterMeterInput: React.FC<WaterMeterInputProps> = ({
  value,
  onChange,
  integerLength = 5,
  fractionLength = 3,
  disabled = false,
  color = 'blue',
}) => {
  // Разделяем value на целую и дробную части
  const [intPart, fracPart] = value.split('.') as [string, string?];
  const intArr = (intPart || '').padStart(integerLength, '0').slice(-integerLength).split('');
  const fracArr = (fracPart || '').padEnd(fractionLength, '0').slice(0, fractionLength).split('');

  // refs для автофокуса
  const intRefs = Array.from({ length: integerLength }, () => useRef<HTMLInputElement>(null));
  const fracRefs = Array.from({ length: fractionLength }, () => useRef<HTMLInputElement>(null));
  // refs для хранения предыдущего значения ячейки
  const intPrevVals = useRef<string[]>([...intArr]);
  const fracPrevVals = useRef<string[]>([...fracArr]);

  // Обработчик изменения одной ячейки

  const handleIntChange = (idx: number, digit: string) => {
    if (!/^[0-9]?$/.test(digit)) return;
    const arr = [...intArr];
    // Если был '0' и вводится новая цифра, заменяем '0' на цифру
    if (arr[idx] === '0' && digit.length === 1 && digit !== '0') {
      arr[idx] = digit;
    } else {
      arr[idx] = digit || '';
    }
    onChange(arr.join('') + '.' + fracArr.join(''));
    // Автофокус вперёд
    if (digit && idx < integerLength - 1) {
      intRefs[idx + 1].current?.focus();
    }
  };
  const handleIntFocus = (idx: number, e: React.FocusEvent<HTMLInputElement>) => {
    intPrevVals.current[idx] = e.target.value;
  };
  const handleIntBlur = (idx: number, e: React.FocusEvent<HTMLInputElement>) => {
    // Разрешаем пустое значение, не сбрасываем к 0
  };

  const handleFracChange = (idx: number, digit: string) => {
    if (!/^[0-9]?$/.test(digit)) return;
    const arr = [...fracArr];
    // Если был '0' и вводится новая цифра, заменяем '0' на цифру
    if (arr[idx] === '0' && digit.length === 1 && digit !== '0') {
      arr[idx] = digit;
    } else {
      arr[idx] = digit || '';
    }
    onChange(intArr.join('') + '.' + arr.join(''));
    // Автофокус вперёд
    if (digit && idx < fractionLength - 1) {
      fracRefs[idx + 1].current?.focus();
    }
  };
  const handleFracFocus = (idx: number, e: React.FocusEvent<HTMLInputElement>) => {
    fracPrevVals.current[idx] = e.target.value;
  };
  const handleFracBlur = (idx: number, e: React.FocusEvent<HTMLInputElement>) => {
    // Разрешаем пустое значение, не сбрасываем к 0
  };

  // Обработчик стрелок и backspace
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
    refs: React.RefObject<HTMLInputElement>[],
    maxLen: number
  ) => {
    if (e.key === 'ArrowLeft' && idx > 0) {
      refs[idx - 1].current?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && idx < maxLen - 1) {
      refs[idx + 1].current?.focus();
      e.preventDefault();
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && idx > 0 && (e.target as HTMLInputElement).value === '') {
      refs[idx - 1].current?.focus();
      e.preventDefault();
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 8, padding: '4px 12px', position: 'relative', boxShadow: '0 1px 4px #0001' }}>
      {/* Colored bar */}
      <div style={{ width: 4, height: 40, borderRadius: 2, marginRight: 8, background: color === 'red' ? '#f87171' : '#3b82f6' }} />
      {intArr.map((digit, idx) => (
        <input
          key={idx}
          ref={intRefs[idx]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={e => handleIntChange(idx, e.target.value.replace(/\D/g, ''))}
          onFocus={e => handleIntFocus(idx, e)}
          onBlur={e => handleIntBlur(idx, e)}
          onKeyDown={e => handleKeyDown(e, idx, intRefs, integerLength)}
          style={{
            width: 36,
            height: 44,
            textAlign: 'center',
            fontSize: 28,
            fontWeight: 700,
            color: '#222',
            background: '#fff',
            border: 'none',
            outline: 'none',
            borderBottom: '2px solid #bbb',
            marginRight: idx === intArr.length - 1 ? 0 : 4,
            boxShadow: '0 1px 2px #0001',
            borderRadius: 4,
          }}
        />
      ))}
      <span style={{ fontSize: 28, margin: '0 4px', fontWeight: 700, color: '#888' }}>,</span>
      {fracArr.map((digit, idx) => (
        <input
          key={idx}
          ref={fracRefs[idx]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={e => handleFracChange(idx, e.target.value.replace(/\D/g, ''))}
          onFocus={e => handleFracFocus(idx, e)}
          onBlur={e => handleFracBlur(idx, e)}
          onKeyDown={e => handleKeyDown(e, idx, fracRefs, fractionLength)}
          style={{
            width: 36,
            height: 44,
            textAlign: 'center',
            fontSize: 28,
            fontWeight: 700,
            color: '#222',
            background: '#fff',
            border: 'none',
            outline: 'none',
            borderBottom: '2px solid #bbb',
            marginRight: idx === fracArr.length - 1 ? 0 : 4,
            boxShadow: '0 1px 2px #0001',
            borderRadius: 4,
          }}
        />
      ))}
    </div>
  );
};
