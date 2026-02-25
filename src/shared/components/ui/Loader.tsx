import React from 'react';

interface LoaderProps {
  text?: string;
}

export const Loader: React.FC<LoaderProps> = ({ text = 'Загрузка...' }) => (
  <div className="flex flex-col items-center justify-center min-h-[120px] w-full">
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-3" />
    <span className="text-white text-lg font-medium opacity-80">{text}</span>
  </div>
);
