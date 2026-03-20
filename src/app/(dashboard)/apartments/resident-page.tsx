"use client";

import { useAuth } from '@/shared/hooks/useAuth';
import { AccessError } from '@/shared/components/AccessError';
import { useEffect, useState } from 'react';
import { getApartment, updateApartment, removeTenantFromApartment, addOrInviteTenantToApartment } from '@/modules/apartments/services/apartmentsService';
import { getBuilding } from '@/modules/invoices/services/buildings/services/buildingsService';
import type { Apartment, Building, TenantAccess } from '@/shared/types';
import { useTranslations } from 'next-intl';
import Loading from '../../../shared/components/ui/loading';
import Header from '../../../shared/components/layout/heder';
import { logout } from '@/modules/auth/services/authService';
import { useRouter } from 'next/navigation';

export default function ResidentApartmentsPage() {
  const { user, loading, isResident } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [tenants, setTenants] = useState<TenantAccess[]>([]);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  // Для арендатора
  const [renterEmail, setRenterEmail] = useState('');
  const [renterFirstName, setRenterFirstName] = useState('');
  const [renterLastName, setRenterLastName] = useState('');
  const [renterDateFrom, setRenterDateFrom] = useState('');
  const [renterDateTo, setRenterDateTo] = useState('');
  const [showAddRenterForm, setShowAddRenterForm] = useState(false);
  const th = useTranslations();
  const t = useTranslations('dashboard.apartments');
  const getErrorMessage = (err: unknown, fallback: string) => err instanceof Error ? err.message : fallback;

  useEffect(() => {
    if (isResident && user?.apartmentId) {
      getApartment(user.apartmentId).then((apt) => {
        setApartment(apt);
        setTenants(apt?.tenants || []);
      });
    }
  }, [user, isResident]);

  useEffect(() => {
    if (apartment?.buildingId) {
      getBuilding(apartment.buildingId).then(setBuilding);
    }
  }, [apartment]);

  if (loading) return <Loading text={t('loading')} />;
  if (!user) return <AccessError type="loginRequired" />;
  if (!isResident) return <AccessError type="noAccess" />;

  const handleRemoveTenant = async (userId: string) => {
    if (!apartment?.id) return;
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await removeTenantFromApartment(apartment.id, userId);
      const updated = await getApartment(apartment.id);
      setTenants(updated.tenants || []);
      setSuccessMsg(t('successRemoveTenant'));
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, t('errorRemoveTenant')));
    } finally {
      setSaving(false);
    }
  };

  // Проверка: текущий пользователь — арендатор (только submitMeter)
  const currentUserIsRenter = tenants.some(
    (t) => t.userId === user?.uid && t.permissions.length === 1 && t.permissions[0] === 'submitMeter'
  );

  // Добавление арендатора с правом только submitMeter
  const handleAddRenter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (!apartment?.id || !renterEmail || !renterFirstName || !renterLastName || !renterDateFrom || !renterDateTo) return;
      // Добавляем или приглашаем арендатора
      await addOrInviteTenantToApartment(apartment.id, renterEmail);
      // После добавления обновим данные арендатора (имя, фамилия, срок)
      const updated = await getApartment(apartment.id);
      const lastTenant = updated.tenants?.find(t => t.email === renterEmail);
      if (lastTenant) {
        await updateApartment(apartment.id, {
          tenants: updated.tenants?.map(t =>
            t.email === renterEmail
              ? {
                  ...t,
                  name: `${renterFirstName} ${renterLastName}`,
                  firstName: renterFirstName,
                  lastName: renterLastName,
                  rentDateFrom: renterDateFrom,
                  rentDateTo: renterDateTo,
                  permissions: ['submitMeter']
                }
              : t
          )
        });
      }
      setTenants((await getApartment(apartment.id)).tenants || []);
      setSuccessMsg(t('successAddRenter'));
      setRenterEmail('');
      setRenterFirstName('');
      setRenterLastName('');
      setRenterDateFrom('');
      setRenterDateTo('');
      setShowAddRenterForm(false);
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, t('errorAddRenter')));
    } finally {
      setSaving(false);
    }
  };

  const cardClass = 'rounded-2xl border border-neutral-200 bg-white shadow-sm';
  const inputClass = 'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60';
  const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500';

  return (
    <div className="min-h-screen bg-neutral-100">
      <Header
        userName={user?.displayName || user?.email || undefined}
        userEmail={user?.email || undefined}
        pageTitle={th('dashboard.apartments.section')}
        onLogout={handleLogout}
      />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className={`${cardClass} p-5 sm:col-span-2`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t('apartmentNumber')}</div>
            <div className="mt-1 text-2xl font-bold text-neutral-900">#{apartment?.number || '—'}</div>
            <div className="mt-3 text-sm text-neutral-600">
              {t('building')}: <span className="font-medium text-neutral-800">{building?.address || '—'}</span>
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t('company')}</div>
            <div className="mt-1 line-clamp-3 text-sm font-medium text-neutral-800">{building?.managedBy?.companyName || '—'}</div>
          </div>
        </div>

        <div className={`${cardClass} p-6`}>

          {/* Информация о квартире — только не для арендатора */}
          {/* {!isRenter && (
            <div className="mb-8">
              <h3 className="font-semibold text-lg mb-2">Информация о квартире</h3>
              <form onSubmit={handleSaveInfo} className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Описание</label>
                  <textarea
                    className="border rounded px-2 py-1 w-full min-h-[60px] bg-white text-gray-900 placeholder-gray-400 focus:outline-blue-400"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Описание квартиры"
                    disabled={saving}
                    style={{resize: 'vertical'}}
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600 mb-1">Площадь (м²)</label>
                    <input
                      type="number"
                      min="0"
                      className="border rounded px-2 py-1 w-full bg-white text-gray-900 placeholder-gray-400 focus:outline-blue-400"
                      value={area}
                      onChange={e => setArea(e.target.value)}
                      placeholder="Площадь"
                      disabled={saving}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600 mb-1">Комнат</label>
                    <input
                      type="number"
                      min="0"
                      className="border rounded px-2 py-1 w-full bg-white text-gray-900 placeholder-gray-400 focus:outline-blue-400"
                      value={rooms}
                      onChange={e => setRooms(e.target.value)}
                      placeholder="Количество комнат"
                      disabled={saving}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                  disabled={saving}
                >Сохранить</button>
              </form>
            </div>
          )} */}

          {/* Добавить арендатора — только не для арендатора */}
          {!currentUserIsRenter && (
            <div className="mb-8">
              <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50/60 px-4 py-3">
                <h3 className="text-lg font-semibold text-neutral-900">{t('addRenter')}</h3>
                <button
                  type="button"
                  className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  onClick={() => setShowAddRenterForm((prev) => !prev)}
                >
                  {showAddRenterForm ? '−' : '+'}
                </button>
              </div>

              {showAddRenterForm && (
                <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 sm:p-5">
                  <form onSubmit={handleAddRenter} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div>
                      <label className={labelClass}>{t('firstName')}</label>
                      <input
                        type="text"
                        className={inputClass}
                        placeholder={t('firstName')}
                        value={renterFirstName}
                        onChange={e => setRenterFirstName(e.target.value)}
                        required
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t('lastName')}</label>
                      <input
                        type="text"
                        className={inputClass}
                        placeholder={t('lastName')}
                        value={renterLastName}
                        onChange={e => setRenterLastName(e.target.value)}
                        required
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t('renterEmail')}</label>
                      <input
                        type="email"
                        className={inputClass}
                        placeholder={t('renterEmail')}
                        value={renterEmail}
                        onChange={e => setRenterEmail(e.target.value)}
                        required
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t('dateFrom')}</label>
                      <input
                        type="date"
                        className={inputClass}
                        placeholder={t('dateFrom')}
                        value={renterDateFrom}
                        onChange={e => setRenterDateFrom(e.target.value)}
                        required
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t('dateTo')}</label>
                      <input
                        type="date"
                        className={inputClass}
                        placeholder={t('dateTo')}
                        value={renterDateTo}
                        onChange={e => setRenterDateTo(e.target.value)}
                        required
                        disabled={saving}
                      />
                    </div>
                    <button
                      type="submit"
                      className="mt-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2 xl:col-span-5"
                      disabled={saving || !renterEmail || !renterFirstName || !renterLastName || !renterDateFrom || !renterDateTo}
                    >
                      {t('add')}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Жильцы */}
          <div className="mb-2">
            <h3 className="mb-3 text-lg font-semibold text-neutral-900">{t('tenants')}</h3>
            <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-neutral-50">
                  <tr>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-600">{t('firstName')}</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-600">{t('lastName')}</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-600">{t('renterEmail')}</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-600">{t('dateFrom')}</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-600">{t('dateTo')}</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-600">{t('type')}</th>
                    {!currentUserIsRenter && <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-600">{t('actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {tenants.length === 0 && (
                    <tr>
                      <td colSpan={currentUserIsRenter ? 6 : 7} className="py-6 text-center text-neutral-400">{t('noTenants')}</td>
                    </tr>
                  )}
                  {tenants.map((tenant, idx) => {
                    const rowIsRenter = tenant.permissions.length === 1 && tenant.permissions[0] === 'submitMeter';
                    const [firstName, ...lastNameArr] = tenant.firstName ? [tenant.firstName, tenant.lastName] : (tenant.name ? tenant.name.split(' ') : ['','']);
                    const lastName = lastNameArr ? lastNameArr.join(' ') : '';
                    return (
                      <tr key={tenant.userId} className={
                        `transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'} hover:bg-blue-50/70`
                      }>
                        <td className="px-3 py-3 text-center text-neutral-800">{firstName}</td>
                        <td className="px-3 py-3 text-center text-neutral-800">{lastName}</td>
                        <td className="px-3 py-3 text-center text-neutral-700">{tenant.email}</td>
                        <td className="px-3 py-3 text-center text-neutral-700">{tenant.rentDateFrom || '—'}</td>
                        <td className="px-3 py-3 text-center text-neutral-700">{tenant.rentDateTo || '—'}</td>
                        <td className="px-3 py-3 text-center">
                          {rowIsRenter ? (
                            <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">{t('renter')}</span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">{t('resident')}</span>
                          )}
                        </td>
                        {!currentUserIsRenter && (
                          <td className="px-3 py-3 text-center">
                            <button
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                              onClick={() => handleRemoveTenant(tenant.userId)}
                              disabled={saving}
                            >{t('delete')}</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {successMsg && (
            <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {errorMsg}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
