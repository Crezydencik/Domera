import React from 'react';

interface CustomToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

const icons = {
  success: (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500/80 text-white mr-4">
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </span>
  ),
  error: (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/80 text-white mr-4">
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </span>
  ),
  warning: (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400/80 text-white mr-4">
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </span>
  ),
  info: (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/80 text-white mr-4">
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </span>
  ),
};

const bgColors = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-yellow-50 border-yellow-200',
  info: 'bg-blue-50 border-blue-200',
};

const titleColors = {
  success: 'text-green-800',
  error: 'text-red-800',
  warning: 'text-yellow-900',
  info: 'text-blue-900',
};

export const CustomToast: React.FC<CustomToastProps> = ({ type, title, message }) => (
  <div className={`flex items-start rounded-xl border p-4 shadow-lg min-w-[320px] max-w-[400px] ${bgColors[type]}`}
    style={{ fontFamily: 'inherit' }}>
    {icons[type]}
    <div>
      <div className={`font-semibold mb-1 ${titleColors[type]}`}>{title}</div>
      {message && <div className="text-gray-700 text-sm leading-snug">{message}</div>}
    </div>
  </div>
);

// Универсальный вызов для показа тоста
import { toast } from 'react-toastify';
export function showCustomToast({ type, title, message }: CustomToastProps) {
  toast(<CustomToast type={type} title={title} message={message} />, {
    position: 'bottom-right',
    autoClose: 5000,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    hideProgressBar: true,
  });
}
