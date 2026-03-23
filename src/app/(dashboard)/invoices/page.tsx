'use client';
import { usePageTitle } from '@/shared/context/PageTitleContext';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/shared/hooks/useAuth';
import Link from 'next/link';
import { useState } from 'react';
import React from 'react';

export default function InvoicesPage() {
  const t = useTranslations('dashboard');
  const { setPageTitle } = usePageTitle();
  React.useEffect(() => { setPageTitle(t('myInvoices')); }, [setPageTitle, t]);
  const { user, loading } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);

  if (loading) {
    return <div className="text-white">Загрузка...</div>;
  }

  if (!user) {
    return <div className="text-white">Требуется вход</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">


      <main className="max-w-7xl mx-auto px-4 py-8">
        {invoices.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-2xl font-bold text-white mb-2">Нет счетов</h2>
            <p className="text-gray-400">Счета появятся после создания услуг</p>
          </div>
        ) : (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-6 flex items-center justify-between hover:border-slate-600 transition"
              >
                <div>
                  <h3 className="text-white font-semibold">Счет #{invoice.number}</h3>
                  <p className="text-gray-400">{invoice.date}</p>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold">{invoice.amount} ₽</div>
                  <div className={`text-sm ${invoice.paid ? 'text-green-400' : 'text-red-400'}`}>
                    {invoice.paid ? 'Оплачено' : 'Не оплачено'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
