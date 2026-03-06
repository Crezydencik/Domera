"use client";

import { useAuth } from '@/shared/hooks/useAuth';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApartment, updateApartment, addTenantToApartment, removeTenantFromApartment, addOrInviteTenantToApartment } from '@/modules/apartments/services/apartmentsService';
import { getBuilding } from '@/modules/invoices/services/buildings/services/buildingsService';
import type { Apartment, Building, TenantAccess } from '@/shared/types';
import { useTranslations } from 'use-intl';
import Loading from '../../../shared/components/ui/loading';
import Header from '../../../shared/components/layout/heder';

export default function ResidentApartmentsPage() {
  const { user, loading, isResident } = useAuth();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [tenants, setTenants] = useState<TenantAccess[]>([]);
  const [newTenantEmail, setNewTenantEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  // Для арендатора
  const [renterEmail, setRenterEmail] = useState('');
  const [renterFirstName, setRenterFirstName] = useState('');
  const [renterLastName, setRenterLastName] = useState('');
  const [renterDateFrom, setRenterDateFrom] = useState('');
  const [renterDateTo, setRenterDateTo] = useState('');
  // Состояния для информации о квартире
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('');
  const [rooms, setRooms] = useState('');
  const t = useTranslations('dashboard.apartments');

  useEffect(() => {
    if (isResident && user?.apartmentId) {
      getApartment(user.apartmentId).then((apt) => {
        setApartment(apt);
        setTenants(apt?.tenants || []);
        setDescription(apt?.description || '');
        setArea(apt?.area ? String(apt.area) : '');
        setRooms(apt?.rooms ? String(apt.rooms) : '');
      });
    }
  }, [user, isResident]);
  // Сохранение информации о квартире
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apartment?.id) return;
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await updateApartment(apartment.id, {
        description,
        area: area ? Number(area) : undefined,
        rooms: rooms ? Number(rooms) : undefined,
      });
      setSuccessMsg('Информация о квартире сохранена!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка при сохранении информации');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (apartment?.buildingId) {
      getBuilding(apartment.buildingId).then(setBuilding);
    }
  }, [apartment]);

  if (loading) return <Loading text={t('loading')} />;
  if (!user) return <div className="text-white">{t('loginRequired')}</div>;
  if (!isResident) return <div className="text-white">{t('noAccess')}</div>;

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (!apartment?.id || !newTenantEmail) return;
      await addTenantToApartment(apartment.id, newTenantEmail);
      const updated = await getApartment(apartment.id);
      setTenants(updated.tenants || []);
      setSuccessMsg('Жилец успешно приглашён!');
      setNewTenantEmail('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка при добавлении жильца');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTenant = async (userId: string) => {
    if (!apartment?.id) return;
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await removeTenantFromApartment(apartment.id, userId);
      const updated = await getApartment(apartment.id);
      setTenants(updated.tenants || []);
      setSuccessMsg('Жилец удалён!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка при удалении жильца');
    } finally {
      setSaving(false);
    }
  };

  // Проверка: текущий пользователь — арендатор (только submitMeter)
  const isRenter = tenants.some(
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
      setSuccessMsg('Арендатор успешно добавлен!');
      setRenterEmail('');
      setRenterFirstName('');
      setRenterLastName('');
      setRenterDateFrom('');
      setRenterDateTo('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка при добавлении арендатора');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-blue-50">
      <Header userName={user?.displayName || user?.email || undefined} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white border border-blue-100 rounded-lg p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-blue-700 mb-2 flex items-center gap-2">
            🏠 Квартира № {apartment?.number || '—'}
          </h2>
          <div className="mb-1 text-gray-500">Дом: <span className="font-semibold">{building?.address || '—'}</span></div>
          <div className="mb-4 text-gray-400">УК: {building?.managedBy?.companyName || '—'}</div>

          {/* Информация о квартире — только не для арендатора */}
          {!isRenter && (
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
          )}

          {/* Добавить арендатора — только не для арендатора */}
          {!isRenter && (
            <div className="mb-6">
              <h3 className="font-semibold text-lg mb-2">Добавить арендатора</h3>
              <form onSubmit={handleAddRenter} className="grid grid-cols-1 md:grid-cols-5 gap-2 mt-2 items-end">
                <input
                  type="text"
                  className="border rounded px-2 py-1 bg-white text-gray-900 placeholder-gray-400"
                  placeholder="Имя"
                  value={renterFirstName}
                  onChange={e => setRenterFirstName(e.target.value)}
                  required
                  disabled={saving}
                />
                <input
                  type="text"
                  className="border rounded px-2 py-1 bg-white text-gray-900 placeholder-gray-400"
                  placeholder="Фамилия"
                  value={renterLastName}
                  onChange={e => setRenterLastName(e.target.value)}
                  required
                  disabled={saving}
                />
                <input
                  type="email"
                  className="border rounded px-2 py-1 bg-white text-gray-900 placeholder-gray-400"
                  placeholder="Email арендатора"
                  value={renterEmail}
                  onChange={e => setRenterEmail(e.target.value)}
                  required
                  disabled={saving}
                />
                <input
                  type="date"
                  className="border rounded px-2 py-1 bg-white text-gray-900 placeholder-gray-400"
                  placeholder="Срок с"
                  value={renterDateFrom}
                  onChange={e => setRenterDateFrom(e.target.value)}
                  required
                  disabled={saving}
                />
                <input
                  type="date"
                  className="border rounded px-2 py-1 bg-white text-gray-900 placeholder-gray-400"
                  placeholder="Срок по"
                  value={renterDateTo}
                  onChange={e => setRenterDateTo(e.target.value)}
                  required
                  disabled={saving}
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 disabled:opacity-50 md:col-span-5"
                  disabled={saving || !renterEmail || !renterFirstName || !renterLastName || !renterDateFrom || !renterDateTo}
                >Добавить</button>
              </form>
            </div>
          )}

          {/* Жильцы */}
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-2">Жильцы</h3>
            <div className="overflow-x-auto rounded-lg shadow border border-blue-100 bg-white">
              <table className="min-w-full text-sm rounded-lg overflow-hidden">
                <thead className="bg-blue-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-gray-700 text-center">Имя</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 text-center">Фамилия</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 text-center">Email</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 text-center">Срок с</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 text-center">Срок по</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 text-center">Тип</th>
                    {!isRenter && <th className="px-3 py-2 font-semibold text-gray-700 text-center">Действия</th>}
                  </tr>
                </thead>
                <tbody>
                  {tenants.length === 0 && (
                    <tr><td colSpan={7} className="text-gray-400 text-center py-4">Нет жильцов</td></tr>
                  )}
                  {tenants.map((tenant, idx) => {
                    const isRenter = tenant.permissions.length === 1 && tenant.permissions[0] === 'submitMeter';
                    const [firstName, ...lastNameArr] = tenant.firstName ? [tenant.firstName, tenant.lastName] : (tenant.name ? tenant.name.split(' ') : ['','']);
                    const lastName = lastNameArr ? lastNameArr.join(' ') : '';
                    return (
                      <tr key={tenant.userId} className={
                        `transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'} hover:bg-blue-100`
                      }>
                        <td className="px-3 py-2 text-center">{firstName}</td>
                        <td className="px-3 py-2 text-center">{lastName}</td>
                        <td className="px-3 py-2 text-center">{tenant.email}</td>
                        <td className="px-3 py-2 text-center">{tenant.rentDateFrom || ''}</td>
                        <td className="px-3 py-2 text-center">{tenant.rentDateTo || ''}</td>
                        <td className="px-3 py-2 text-center">{isRenter ? <span className="text-blue-600 font-medium">арендатор</span> : <span className="text-green-600 font-medium">житель</span>}</td>
                        {!isRenter && (
                          <td className="px-3 py-2 text-center">
                            <button
                              className="text-red-600 hover:bg-red-50 border border-red-200 rounded px-2 py-1 transition disabled:opacity-50"
                              onClick={() => handleRemoveTenant(tenant.userId)}
                              disabled={saving}
                            >Удалить</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {successMsg && <div className="text-green-600 mb-2">{successMsg}</div>}
          {errorMsg && <div className="text-red-600 mb-2">{errorMsg}</div>}

        </div>
      </main>
    </div>
  );
}
