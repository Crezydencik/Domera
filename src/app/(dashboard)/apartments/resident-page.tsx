"use client";

import { useAuth } from '@/shared/hooks/useAuth';
import { AccessError } from '@/shared/components/AccessError';
import { useEffect, useState } from 'react';
import { getApartment, getApartmentsByResidentId, updateApartment, removeTenantFromApartment, addOrInviteTenantToApartment } from '@/modules/apartments/services/apartmentsService';
import { getBuilding } from '@/modules/invoices/services/buildings/services/buildingsService';
import { getCompany } from '@/modules/company/services/companyService';
import { getUserById } from '@/modules/auth/services/authService';
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

  const [allApartments, setAllApartments] = useState<Apartment[]>([]);
  const [selectedApartmentId, setSelectedApartmentId] = useState<string | null>(null);
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [apartmentResolved, setApartmentResolved] = useState(false);
  const [building, setBuilding] = useState<Building | null>(null);
  const [companyContact, setCompanyContact] = useState<{
    companyName?: string;
    companyEmail?: string;
    companyPhone?: string;
    managerEmail?: string;
  } | null>(null);
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

  // Build the list of all apartment IDs for this resident
  const apartmentIds: string[] = user
    ? (user.apartmentIds && user.apartmentIds.length > 0
        ? user.apartmentIds
        : user.apartmentId
          ? [user.apartmentId]
          : [])
    : [];

  useEffect(() => {
    let cancelled = false;

    const loadAllApartments = async () => {
      if (!isResident || !user) {
        if (!cancelled) {
          setAllApartments([]);
          setApartment(null);
          setTenants([]);
          setApartmentResolved(true);
        }
        return;
      }

      try {
        // Query by residentId from Firestore (catches all apartments, even legacy ones without apartmentIds array)
        const [byResidentId, byIds] = await Promise.all([
          getApartmentsByResidentId(user.uid),
          apartmentIds.length > 0
            ? Promise.all(apartmentIds.map((id) => getApartment(id)))
            : Promise.resolve([] as (Apartment | null)[]),
        ]);

        // Merge and deduplicate; only include fallback IDs where user is still the resident
        const merged: Record<string, Apartment> = {};
        for (const a of byResidentId) {
          if (a) merged[a.id] = a;
        }
        for (const a of byIds) {
          if (a && a.residentId === user.uid) merged[a.id] = a;
        }
        const valid = Object.values(merged);

        if (cancelled) return;
        setAllApartments(valid);
        const knownIds = new Set([...apartmentIds, ...byResidentId.map((a) => a.id)]);
        const firstId = selectedApartmentId && knownIds.has(selectedApartmentId)
          ? selectedApartmentId
          : (valid[0]?.id ?? null);
        setSelectedApartmentId(firstId);
        const selected = valid.find((a) => a.id === firstId) ?? null;
        setApartment(selected);
        setTenants(selected?.tenants || []);
      } catch {
        if (cancelled) return;
        setAllApartments([]);
        setApartment(null);
        setTenants([]);
      } finally {
        if (!cancelled) setApartmentResolved(true);
      }
    };

    setApartmentResolved(false);
    void loadAllApartments();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isResident]);

  // When selected apartment changes, update apartment + tenants
  useEffect(() => {
    if (!selectedApartmentId) return;
    const found = allApartments.find((a) => a.id === selectedApartmentId) ?? null;
    setApartment(found);
    setTenants(found?.tenants || []);
    setBuilding(null);
    setCompanyContact(null);
    setSuccessMsg('');
    setErrorMsg('');
  }, [selectedApartmentId, allApartments]);

  useEffect(() => {
    if (apartment?.buildingId) {
      getBuilding(apartment.buildingId).then(setBuilding);
    }
  }, [apartment]);

  useEffect(() => {
    let cancelled = false;

    const loadCompanyContact = async () => {
      if (!building) {
        if (!cancelled) setCompanyContact(null);
        return;
      }

      const companyId = building.companyId || building.managedBy?.companyId;
      const managerUid = building.managedBy?.managerUid;

      let companyName = building.managedBy?.companyName;
      let companyEmail: string | undefined;
      let companyPhone: string | undefined;
      let managerEmail: string | undefined = building.managedBy?.managerEmail;

      try {
        if (companyId) {
          const company = await getCompany(companyId);
          if (company) {
            companyName = company.name || companyName;
            companyEmail = company.email;
            companyPhone = company.phone;
          }
        }
      } catch {
        // ignore company contact errors on UI level
      }

      try {
        if (managerUid) {
          const manager = await getUserById(managerUid);
          if (manager) {
            managerEmail = manager.email || managerEmail;
            if (!companyPhone && manager.phone) {
              companyPhone = manager.phone;
            }
          }
        }
      } catch {
        // ignore manager contact errors on UI level
      }

      if (!cancelled) {
        setCompanyContact({
          companyName,
          companyEmail,
          companyPhone,
          managerEmail,
        });
      }
    };

    void loadCompanyContact();

    return () => {
      cancelled = true;
    };
  }, [building]);

  if (loading) return <Loading text={t('loading')} />;
  if (!user) return <AccessError type="loginRequired" />;
  if (!isResident) return <AccessError type="noAccess" />;
  if (!apartmentResolved) return <Loading text={t('loading')} />;

  const handleRemoveTenant = async (userId: string) => {
    if (!apartment?.id) return;
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await removeTenantFromApartment(apartment.id, userId);
      const updated = await getApartment(apartment.id);
      const updatedTenants = updated?.tenants || [];
      setTenants(updatedTenants);
      setAllApartments((prev) => prev.map((a) => a.id === apartment.id ? { ...a, tenants: updatedTenants } : a));
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
      const finalApt = await getApartment(apartment.id);
      const finalTenants = finalApt?.tenants || [];
      setTenants(finalTenants);
      setAllApartments((prev) => prev.map((a) => a.id === apartment.id ? { ...a, tenants: finalTenants } : a));
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
  const displayValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string' && value.trim() === '') return '—';
    return String(value);
  };

  const companyEmail = companyContact?.companyEmail || companyContact?.managerEmail || building?.managedBy?.managerEmail;
  const companyPhone = companyContact?.companyPhone;

  return (
    <div className="min-h-screen bg-neutral-100">
      <Header
        userName={user?.displayName || user?.email || undefined}
        userEmail={user?.email || undefined}
        pageTitle={th('dashboard.apartments.section')}
        onLogout={handleLogout}
      />

      {!apartment && (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center shadow-sm">
          <svg className="mx-auto mb-3 h-12 w-12 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          <p className="text-lg font-medium text-gray-600">{t('noApartments')}</p>
        </div>
      </main>
      )}

      {apartment && (
      <main className="mx-auto max-w-5xl px-4 py-8">
        {allApartments.length > 1 && (
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm font-medium text-neutral-600" htmlFor="apartment-select">
              {t('selectApartment')}:
            </label>
            <select
              id="apartment-select"
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              value={selectedApartmentId ?? ''}
              onChange={(e) => setSelectedApartmentId(e.target.value)}
            >
              {allApartments.map((apt) => (
                <option key={apt.id} value={apt.id}>
                  {t('apartmentNumber')} {apt.number}
                  {apt.address ? ` — ${apt.address}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className={`${cardClass} p-5 sm:col-span-2`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t('apartmentNumber')}</div>
            <div className="mt-1 text-2xl font-bold text-neutral-900">#{apartment?.number || '—'}</div>
            <div className="mt-3 text-sm text-neutral-600">
              {t('building')}: <span className="font-medium text-neutral-800">{building?.address || '—'}</span>
            </div>

            <div className="mt-4 border-t border-neutral-200 pt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t('basicInfo')}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="text-sm text-neutral-700">
                  {t('apartmentAddress')}: <span className="font-medium text-neutral-900">{displayValue(apartment.address || building?.address)}</span>
                </div>
                <div className="text-sm text-neutral-700">
                  {t('floor')}: <span className="font-medium text-neutral-900">{displayValue(apartment.floor)}</span>
                </div>
                <div className="text-sm text-neutral-700">
                  {t('apartmentKind')}: <span className="font-medium text-neutral-900">{displayValue(apartment.apartmentType)}</span>
                </div>
                <div className="text-sm text-neutral-700">
                  {t('owner')}: <span className="font-medium text-neutral-900">{displayValue(apartment.owner)}</span>
                </div>
                <div className="text-sm text-neutral-700">
                  {t('ownerEmail')}: <span className="font-medium text-neutral-900">{displayValue(apartment.ownerEmail)}</span>
                </div>
                <div className="text-sm text-neutral-700">
                  {t('managerEmail')}: <span className="font-medium text-neutral-900">{displayValue(companyContact?.managerEmail || building?.managedBy?.managerEmail)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t('company')}</div>
            <div className="mt-1 line-clamp-2 text-sm font-medium text-neutral-800">
              {displayValue(companyContact?.companyName || building?.managedBy?.companyName)}
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-neutral-600">
              <div>
                {t('companyEmail')}: <span className="font-medium text-neutral-800">{displayValue(companyEmail)}</span>
              </div>
              <div>
                {t('companyPhone')}: <span className="font-medium text-neutral-800">{displayValue(companyPhone)}</span>
              </div>
            </div>
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
      )}
    </div>
  );
}
