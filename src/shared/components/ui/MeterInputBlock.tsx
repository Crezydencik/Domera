import React, { useRef, useEffect, useState } from 'react';

interface MeterInputBlockProps {
  type: 'cold' | 'hot';
  serial: string;
  value: string;
  onChange: (val: string) => void;
  label: string;
  validUntil: string;
  onSubmit: () => void;
  loading?: boolean;
  integerDigits?: number;
}

const colorMap = {
  cold: {
    border: 'border-blue-400',
    text: 'text-blue-700',
    bar: 'bg-blue-400',
  },
  hot: {
    border: 'border-red-400',
    text: 'text-red-700',
    bar: 'bg-red-400',
  },
};

export const MeterInputBlock: React.FC<MeterInputBlockProps> = ({
  type,
  serial,
  value,
  onChange,
  label,
  validUntil,
  onSubmit,
  loading,
  integerDigits = 6,
}) => {
  void validUntil;
  void onSubmit;
  const color = colorMap[type];
  const fractionDigits = 3;
  const totalDigits = integerDigits + fractionDigits;
  // value: '123456.789'
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const setInputRef = (idx: number) => (el: HTMLInputElement | null) => {
    inputRefs.current[idx] = el;
  };
  // Для управления фокусом без заеданий
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  // value: '123456.789'
  const [rawInt = '', rawFrac = ''] = value.split('.')
  const intPart = rawInt.replace(/\D/g, '').padStart(integerDigits, '0').slice(-integerDigits);
  const frac = rawFrac.replace(/\D/g, '').padEnd(fractionDigits, '0').slice(0, fractionDigits);
  const allDigits = (intPart + frac).split('').slice(0, totalDigits);


  // Оптимизированная функция: не дергает фокус без необходимости
  function setDigitsAndMaybeFocus(digits: string[], nextFocusIdx?: number, shouldFocus = false) {
    const newInt = digits.slice(0, integerDigits).join('');
    const newFrac = digits.slice(integerDigits, totalDigits).join('');
    const newValue = newInt + '.' + newFrac;
    if (newValue !== value) {
      onChange(newValue);
    }
    if (shouldFocus && typeof nextFocusIdx === 'number' && nextFocusIdx >= 0 && nextFocusIdx < totalDigits) {
      setFocusIdx(nextFocusIdx);
    }
  }

  // Управление фокусом через useEffect
  useEffect(() => {
    if (focusIdx !== null) {
      inputRefs.current[focusIdx]?.focus();
      inputRefs.current[focusIdx]?.select();
      setFocusIdx(null);
    }
  }, [focusIdx]);

  // Ввод цифры или вставка
  const handleInput = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    let digits = [...allDigits];
    const input = inputRefs.current[idx];
    let selectionStart = input?.selectionStart ?? 0;
    let selectionEnd = input?.selectionEnd ?? 0;

    // Если вставка или быстрое нажатие
    if (val.length > 1) {
      // Если выделено несколько ячеек — вставка распределяет по ним
      let startIdx = idx;
      let endIdx = idx;
      if (input && selectionStart !== selectionEnd) {
        startIdx = idx;
        endIdx = Math.min(idx + (selectionEnd - selectionStart) - 1, totalDigits - 1);
      }
      let before = digits.slice(0, startIdx);
      let after = digits.slice(endIdx + 1);
      let all = [...before, ...val.split(''), ...after].slice(0, totalDigits);
      let nextFocus = Math.min(startIdx + val.length, totalDigits - 1);
      setDigitsAndMaybeFocus(all, nextFocus, true);
    } else {
      // Если выделено несколько ячеек — заменяем все выделенные одной цифрой (первую), остальные очищаем
      if (input && selectionStart !== selectionEnd) {
        let startIdx = idx;
        let endIdx = Math.min(idx + (selectionEnd - selectionStart) - 1, totalDigits - 1);
        for (let i = startIdx; i <= endIdx; i++) {
          digits[i] = '';
        }
        digits[startIdx] = val;
        let nextFocus = endIdx < totalDigits - 1 ? endIdx + 1 : totalDigits - 1;
        setDigitsAndMaybeFocus(digits, nextFocus, true);
      } else {
        // Даже если курсор не в начале — всегда заменяем цифру
        digits[idx] = val;
        setDigitsAndMaybeFocus(digits);
        if (val && idx < totalDigits - 1) setFocusIdx(idx + 1);
      }
    }
  };

  // Вставка
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('Text').replace(/\D/g, '').slice(0, totalDigits);
    if (!pasted) return;
    const digits = pasted.split('').concat(Array(totalDigits).fill('')).slice(0, totalDigits);
    setDigitsAndMaybeFocus(digits, pasted.length < totalDigits ? pasted.length : totalDigits - 1, true);
  };

  // Удаление и стрелки
  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    let digits = [...allDigits];
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        digits[idx] = '';
        setDigitsAndMaybeFocus(digits);
        e.preventDefault();
      } else if (idx > 0) {
        digits[idx - 1] = '';
        setDigitsAndMaybeFocus(digits);
        setFocusIdx(idx - 1);
        e.preventDefault();
      }
    } else if (e.key === 'Delete') {
      digits[idx] = '';
      setDigitsAndMaybeFocus(digits);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      setFocusIdx(idx - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && idx < totalDigits - 1) {
      setFocusIdx(idx + 1);
      e.preventDefault();
    }
  };

  return (
    <div className={`relative flex flex-col items-center rounded-xl border ${color.border} bg-white p-4 shadow-md w-full max-w-xl mx-auto`}>
    <div>
      
      <div className="flex items-end gap-2 mb-2 w-full justify-center">
        <div className={`w-1 h-8 rounded ${color.bar} mr-2`} />
        <div className="flex gap-1">
          {Array.from({ length: totalDigits }).map((_, idx) => (
            idx === integerDigits ? (
              <React.Fragment key="," >
                <span className="text-2xl text-gray-400 mx-1">,</span>
                <input
                  ref={setInputRef(idx)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className={idx < integerDigits
                    ? "w-8 h-10 text-center text-2xl font-bold border border-gray-300 rounded bg-white text-gray-900 focus:bg-white focus:border-blue-500 transition"
                    : "w-6 h-10 text-center text-xl font-bold border border-gray-300 rounded bg-white text-gray-900 focus:bg-white focus:border-blue-500 transition"
                  }
                  value={allDigits[idx] ?? ''}
                  onChange={e => handleInput(idx, e)}
                  onKeyDown={e => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  disabled={loading}
                />
              </React.Fragment>
            ) : (
              <input
                key={idx}
                ref={setInputRef(idx)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className={idx < integerDigits
                  ? "w-8 h-10 text-center text-2xl font-bold border border-gray-300 rounded bg-white text-gray-900 focus:bg-white focus:border-blue-500 transition"
                  : "w-6 h-10 text-center text-xl font-bold border border-gray-300 rounded bg-white text-gray-900 focus:bg-white focus:border-blue-500 transition"
                }
                value={allDigits[idx] ?? ''}
                onChange={e => handleInput(idx, e)}
                onKeyDown={e => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                disabled={loading}
                />
              )
          ))}
        </div>
      </div>
      <div className="w-full flex flex-row justify-between items-center text-xs mt-2 px-4">
        <span className="text-gray-500">Nr. <b>{serial}</b></span>
        <span className={color.text}>{label}</span>
      </div>
   </div>
      </div>
  
  );
};
