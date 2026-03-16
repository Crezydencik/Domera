'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';

type ConfirmationVariant = 'danger' | 'warning' | 'primary';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  details?: string[];
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmationVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const confirmButtonClassByVariant: Record<ConfirmationVariant, string> = {
  danger: 'border border-red-500 bg-red-500 text-white shadow-sm hover:bg-red-600 hover:border-red-600',
  warning: 'border border-amber-500 bg-amber-500 text-white shadow-sm hover:bg-amber-600 hover:border-amber-600',
  primary: 'border border-blue-500 bg-blue-500 text-white shadow-sm hover:bg-blue-600 hover:border-blue-600',
};

const iconWrapClassByVariant: Record<ConfirmationVariant, string> = {
  danger: 'bg-red-100 text-red-600',
  warning: 'bg-amber-100 text-amber-600',
  primary: 'bg-blue-100 text-blue-600',
};

export function ConfirmationDialog({
  isOpen,
  title,
  description,
  details = [],
  children,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  confirmVariant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600" />

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconWrapClassByVariant[confirmVariant]}`}>
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.71-3.14l-7.5-13a2 2 0 0 0-3.42 0Z" />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
            </div>
          </div>

          {details.length > 0 && (
            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="space-y-2 text-sm text-gray-700">
                {details.map((line, index) => (
                  <p key={`${line}-${index}`} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
                    <span>{line}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {children && <div className="mt-4">{children}</div>}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${confirmButtonClassByVariant[confirmVariant]}`}
            >
              {loading ? 'Выполняется...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
