import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, disabled }) => {
  return (
    <button
      type="button"
      className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none border border-slate-700 ${checked ? 'bg-blue-500' : 'bg-slate-600'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      onClick={e => { e.preventDefault(); e.stopPropagation(); if (!disabled) onChange(!checked); }}
      aria-pressed={checked}
      disabled={disabled}
      tabIndex={0}
    >
      <span
        className={`absolute left-0 top-0 h-6 w-11 rounded-full transition-colors duration-200 ${checked ? 'bg-blue-500' : 'bg-slate-600'}`}
        aria-hidden="true"
      />
      <span
        className={`inline-block w-5 h-5 z-10 transform bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-1'}`}
      />
    </button>
  );
};
