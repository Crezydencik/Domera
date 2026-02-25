import React from 'react';

interface AddTenantFormProps {
  addTenantEmail: string;
  setAddTenantEmail: (v: string) => void;
  addTenantLoading: boolean;
  addTenantError: string;
  onAddTenant: (e: React.FormEvent) => void;
}

export const AddTenantForm: React.FC<AddTenantFormProps> = ({
  addTenantEmail,
  setAddTenantEmail,
  addTenantLoading,
  addTenantError,
  onAddTenant,
}) => (
  <form onSubmit={onAddTenant} className="flex flex-col gap-2">
    <label className="text-sm text-gray-300">Добавить арендатора (email)</label>
    <input
      type="email"
      value={addTenantEmail}
      onChange={(e) => setAddTenantEmail(e.target.value)}
      placeholder="tenant@example.com"
      className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
      required
    />
    <button
      type="submit"
      disabled={addTenantLoading}
      className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-800 disabled:opacity-50"
    >
      {addTenantLoading ? 'Добавление...' : 'Добавить арендатора'}
    </button>
    {addTenantError && (
      <div className="text-red-400 text-xs mt-1">{addTenantError}</div>
    )}
  </form>
);
