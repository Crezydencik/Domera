import React from 'react';
import type { TenantAccess } from '@/shared/types';

interface TenantsListProps {
  tenants?: TenantAccess[];
}

export const TenantsList: React.FC<TenantsListProps> = ({ tenants }) => (
  <>
    {Array.isArray(tenants) && tenants.length > 0 ? (
      <ul className="divide-y divide-slate-700">
        {tenants.map((tenant) => (
          <li key={tenant.userId} className="py-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <span className="text-white text-sm">{tenant.email}</span>
              <span className="text-xs text-slate-300">Права: {tenant.permissions?.join(', ') || 'нет'}</span>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-slate-400 text-sm">Нет арендаторов с доступом</p>
    )}
  </>
);
