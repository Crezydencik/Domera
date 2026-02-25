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
  danger: 'bg-red-600 text-white hover:bg-red-700',
  warning: 'bg-amber-600 text-white hover:bg-amber-700',
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
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
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-300">{description}</p>

        {details.length > 0 && (
          <div className="mt-3 space-y-1 rounded-md border border-slate-700 bg-slate-800/70 p-3 text-sm text-slate-300">
            {details.map((line, index) => (
              <p key={`${line}-${index}`}>• {line}</p>
            ))}
          </div>
        )}

        {children && <div className="mt-3">{children}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${confirmButtonClassByVariant[confirmVariant]}`}
          >
            {loading ? 'Выполняется...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
