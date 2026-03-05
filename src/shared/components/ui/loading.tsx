// src/shared/components/ui/Loader.tsx
import React from 'react';

export const Loader: React.FC<{ text?: string }> = ({ text = 'Ielāde...' }) => (
  <div className="fixed inset-0 flex flex-col items-center justify-center z-50 bg-white bg-opacity-80">
    <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-blue-700 border-opacity-80 mb-4"></div>
    <span className="text-lg text-gray-700 font-semibold">{text}</span>
  </div>
);

export default Loader;