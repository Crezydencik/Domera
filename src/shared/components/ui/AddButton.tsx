import React from 'react';
import { FiPlus } from 'react-icons/fi';

export function AddButton({ onClick, tooltip }: { onClick: () => void, tooltip?: string }) {
  return (
    <button
      className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xl shadow transition relative"
      onClick={onClick}
      title={tooltip || 'Добавить'}
      type="button"
    >
      <FiPlus />
    </button>
  );
}
