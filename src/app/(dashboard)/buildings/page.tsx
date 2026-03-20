'use client';

import { useAuth } from '@/shared/hooks/useAuth';
import Header from '@/shared/components/layout/heder';
import React from 'react';
import Image from 'next/image';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Building, CompanyInvitation } from '@/shared/types';
import {
  createBuilding,
  deleteBuilding,
  getBuildingsByCompany,
  updateBuilding,
} from '@/modules/invoices/services/buildings/services/buildingsService';
import { getCompany } from '@/modules/company/services/companyService';
import { getApartmentsByBuilding } from '@/modules/apartments/services/apartmentsService';
import { getUserByEmail, updateUserProfile } from '@/modules/auth/services/authService';
import { logout } from '@/modules/auth/services/authService';
import { ConfirmationDialog } from '@/shared/components/ui/ConfirmationDialog';
import { toast } from 'react-toastify';

export default function BuildingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [buildingName, setBuildingName] = useState('');
  const [buildingAddress, setBuildingAddress] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyOwnerUid, setCompanyOwnerUid] = useState<string>('');
  const [selectedBuildingForModal, setSelectedBuildingForModal] = useState<Building | null>(null);
  const [selectedBuildingForUserModal, setSelectedBuildingForUserModal] = useState<Building | null>(null);
  const [buildingInvitations, setBuildingInvitations] = useState<CompanyInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [deletingBuildingId, setDeletingBuildingId] = useState<string | null>(null);
  const [confirmDeleteBuilding, setConfirmDeleteBuilding] = useState<Building | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [userEmailToAssign, setUserEmailToAssign] = useState('');
  const [roleToAssign, setRoleToAssign] = useState<'Accountant' | 'ManagementCompany'>('Accountant');
  const [assigningUser, setAssigningUser] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [apartmentCounts, setApartmentCounts] = useState<Record<string, number>>({});
  const canCreateBuilding = buildings.length === 0;

  const filteredBuildings = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return buildings;

    return buildings.filter((building) => {
      const name = building.name?.toLowerCase() ?? '';
      const address = building.address?.toLowerCase() ?? '';
      const managedBy = building.managedBy?.companyName?.toLowerCase() ?? '';
      return (
        name.includes(normalizedQuery) ||
        address.includes(normalizedQuery) ||
        managedBy.includes(normalizedQuery)
      );
    });
  }, [buildings, searchQuery]);

  const totalApartments = useMemo(() => {
    return filteredBuildings.reduce((sum, building) => {
      const count = apartmentCounts[building.id] ?? building.apartmentIds?.length ?? 0;
      return sum + count;
    }, 0);
  }, [filteredBuildings, apartmentCounts]);

  const normalizedAssignEmail = userEmailToAssign.trim().toLowerCase();
  const isAssignEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedAssignEmail);

  const isMainAdminForBuilding = (building: Building): boolean => {
    if (!user?.uid) return false;
    const companyOwnerMatch = Boolean(companyOwnerUid && companyOwnerUid === user.uid);
    const buildingOwnerMatch = Boolean(building.managedBy?.managerUid && building.managedBy.managerUid === user.uid);
    return companyOwnerMatch || buildingOwnerMatch;
  };

  const canInviteSelectedBuilding = selectedBuildingForUserModal
    ? isMainAdminForBuilding(selectedBuildingForUserModal)
    : false;

  const formatInvitationDate = (value: unknown): string => {
    if (!value) return '—';
    const date = new Date(value as string | Date);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Вынесенная функция загрузки домов
  const loadBuildings = async () => {
    if (!user?.companyId) return;
    setIsLoadingData(true);
    setLoadError('');
    try {
      const [data, company] = await Promise.all([
        getBuildingsByCompany(user.companyId),
        getCompany(user.companyId),
      ]);
      const nextCompanyName = company?.name ?? '';
      setCompanyName(nextCompanyName);
      setCompanyOwnerUid((company as { userId?: string } | null)?.userId ?? '');
      await Promise.all(
        data
          .filter((building) => !building.managedBy)
          .map((building) =>
            updateBuilding(building.id, {
              managedBy: {
                companyId: user.companyId,
                companyName: nextCompanyName || undefined,
                managerUid: user.uid,
                managerEmail: user.email,
              },
            })
          )
      );
      const hydratedData = data.map((building) =>
        building.managedBy
          ? building
          : {
              ...building,
              managedBy: {
                companyId: user.companyId,
                companyName: nextCompanyName || undefined,
                managerUid: user.uid,
                managerEmail: user.email,
              },
            }
      );
      setBuildings(hydratedData);

      const countsEntries = await Promise.all(
        hydratedData.map(async (building) => {
          const apartments = await getApartmentsByBuilding(building.id);
          return [building.id, apartments.length] as const;
        })
      );

      setApartmentCounts(Object.fromEntries(countsEntries));
    } catch (err) {
      console.error('Error loading buildings:', err);
      setLoadError('Не удалось загрузить список домов. Попробуйте снова.');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (!loading && user?.role !== 'ManagementCompany') {
      router.replace('/dashboard');
      return;
    }
    loadBuildings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, router, user?.companyId, user?.role]);

  useEffect(() => {
    const loadBuildingInvitations = async () => {
      if (!selectedBuildingForUserModal?.id || !user?.companyId) {
        setBuildingInvitations([]);
        return;
      }

      setLoadingInvitations(true);
      try {
        const response = await fetch(
          `/api/company-invitations?companyId=${encodeURIComponent(user.companyId)}&buildingId=${encodeURIComponent(
            selectedBuildingForUserModal.id
          )}`
        );

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result?.error ?? 'Не удалось загрузить приглашения');
        }

        setBuildingInvitations((result?.invitations ?? []) as CompanyInvitation[]);
      } catch (error) {
        console.error('Error loading building invitations:', error);
        setBuildingInvitations([]);
      } finally {
        setLoadingInvitations(false);
      }
    };

    loadBuildingInvitations();
  }, [selectedBuildingForUserModal?.id, user?.companyId]);

  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.companyId) {
      toast.error('Не найдена компания пользователя');
      return;
    }

    if (!buildingName.trim() || !buildingAddress.trim()) {
      toast.error('Заполните название и адрес дома');
      return;
    }

    setSubmitting(true);

    try {
      await createBuilding({
        companyId: user.companyId,
        name: buildingName.trim(),
        address: buildingAddress.trim(),
        managedBy: {
          companyId: user.companyId,
          companyName: companyName || undefined,
          managerUid: user.uid,
          managerEmail: user.email,
        },
      }, user.companyId);
      await loadBuildings();
      setBuildingName('');
      setBuildingAddress('');
      setShowCreateForm(false);
      toast.success('Дом успешно создан');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ошибка при создании дома');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBuilding = async (building: Building) => {
    if (!user?.companyId) {
      toast.error('Не найден идентификатор компании');
      return;
    }

    setDeletingBuildingId(building.id);

    try {
      const apartments = await getApartmentsByBuilding(building.id);
      if (apartments.length > 0) {
        throw new Error('Нельзя удалить дом: сначала удалите или перенесите все квартиры');
      }

      await deleteBuilding(building.id);

      setBuildings((prev) => prev.filter((item) => item.id !== building.id));
      setApartmentCounts((prev) => {
        const next = { ...prev };
        delete next[building.id];
        return next;
      });
      setSelectedBuildingForModal((prev) => (prev?.id === building.id ? null : prev));
      toast.success(`Дом «${building.name}» удалён`);
    } catch (deleteErr: unknown) {
      toast.error(deleteErr instanceof Error ? deleteErr.message : 'Ошибка удаления дома');
    } finally {
      setDeletingBuildingId(null);
    }
  };

  const handleAssignUserRole = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = userEmailToAssign.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error('Введите email пользователя');
      return;
    }

    if (!user?.companyId || !selectedBuildingForUserModal) {
      toast.error('Не найден контекст дома или компании');
      return;
    }

    if (!isMainAdminForBuilding(selectedBuildingForUserModal)) {
      toast.error('Приглашать пользователей может только главный администратор дома');
      return;
    }

    setAssigningUser(true);

    try {
      const existingUser = await getUserByEmail(normalizedEmail);
      if (!existingUser?.uid) {
        const invitationResponse = await fetch('/api/company-invitations/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: normalizedEmail,
            companyId: user.companyId,
            buildingId: selectedBuildingForUserModal.id,
            role: roleToAssign,
            buildingName: selectedBuildingForUserModal.name,
            invitedByUid: user.uid,
          }),
        });

        const invitationResult = await invitationResponse.json().catch(() => ({}));
        if (!invitationResponse.ok) {
          throw new Error(invitationResult?.error ?? 'Не удалось отправить приглашение на регистрацию');
        }

        setBuildingInvitations((prev) => [
          {
            id: invitationResult.invitationId as string,
            email: normalizedEmail,
            companyId: user.companyId,
            buildingId: selectedBuildingForUserModal.id,
            buildingName: selectedBuildingForUserModal.name,
            role: roleToAssign,
            status: 'pending',
            invitedByUid: user.uid,
            createdAt: new Date(),
          } as CompanyInvitation,
          ...prev,
        ]);

        toast.success('Пользователь не найден. Отправлено приглашение на регистрацию.');
        setUserEmailToAssign('');
        setRoleToAssign('Accountant');
        return;
      }

      await updateUserProfile(existingUser.uid, {
        role: roleToAssign,
        companyId: user.companyId,
      });

      const roleLabel = roleToAssign === 'Accountant' ? 'бухгалтер' : 'администратор';
      toast.success(`Пользователь назначен как ${roleLabel}`);

      setUserEmailToAssign('');
      setRoleToAssign('Accountant');
      setSelectedBuildingForUserModal(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Не удалось назначить роль пользователю');
    } finally {
      setAssigningUser(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-white via-green-50 to-blue-50 flex items-center justify-center">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-slate-700 shadow-sm">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return <div className="text-white">Требуется вход</div>;
  }

  if (user.role !== 'ManagementCompany') {
    return <div className="text-white">Недостаточно прав для просмотра раздела</div>;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-white via-green-50 to-blue-50">
      <Header
        userName={user?.displayName || user?.name || ''}
        userEmail={user?.email || ''}
        pageTitle="Управление домами"
        onLogout={handleLogout}
      />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск дома по названию, адресу или УК"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <span className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium">
              Всего квартир: {totalApartments}
            </span>
            {canCreateBuilding ? (
              <button
                type="button"
                onClick={() => setShowCreateForm((prev) => !prev)}
                className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                title="Добавить дом"
              >
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="2.2" fill="none"/>
                  <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2.2"/>
                  <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2.2"/>
                </svg>
              </button>
            ) : (
              <span className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm">Лимит: 1 дом</span>
            )}
          </div>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={loadBuildings}
              className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              Повторить
            </button>
          </div>
        )}

        {showCreateForm && canCreateBuilding && (
          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-2xl font-bold text-slate-900">Новый дом</h2>
            <form onSubmit={handleCreateBuilding} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Название дома</label>
                <input
                  type="text"
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  placeholder="Majas nosaukums"
                  className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Адрес</label>
                <input
                  type="text"
                  value={buildingAddress}
                  onChange={(e) => setBuildingAddress(e.target.value)}
                  placeholder="A.ČAKA IELA 123, RĪGA, LV-1010"
                  className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white"
                  required
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-base font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Сохранение...' : 'Сохранить дом'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-base font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoadingData ? (
          <div className="grid gap-4">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm animate-pulse"
              >
                <div className="h-5 w-48 rounded bg-slate-200" />
                <div className="mt-3 h-4 w-72 rounded bg-slate-100" />
                <div className="mt-4 h-4 w-56 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : buildings.length === 0 ? (
          <div className="text-center py-12">
            <Image src="/Logo1.png" alt="Domera Logo" width={96} height={96} className="w-24 h-24 mx-auto mb-4 object-contain" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Нет домов</h2>
            <p className="text-slate-500 mb-6">Можно создать только один дом для одного управляющего</p>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Создать дом
            </button>
          </div>
        ) : filteredBuildings.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-slate-800">Ничего не найдено</h2>
            <p className="mt-2 text-sm text-slate-500">
              По запросу «{searchQuery}» дома не найдены.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Сбросить поиск
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredBuildings.map((building) => (
              <div
                key={building.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-linear-to-r from-blue-500 via-cyan-500 to-emerald-500" />

                <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setSelectedBuildingForUserModal(building)}
                    aria-label="Добавить пользователя"
                    title={isMainAdminForBuilding(building) ? 'Добавить бухгалтера или администратора' : 'Только главный админ может приглашать'}
                    className={`group/btn relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition ${
                      isMainAdminForBuilding(building)
                        ? 'hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
                        : 'opacity-70'
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                    <span className="pointer-events-none absolute -bottom-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-700 shadow group-hover/btn:block">
                      Пользователь
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedBuildingForModal(building)}
                    aria-label="Информация о доме"
                    title="Информация о доме"
                    className="group/btn relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <line x1="12" y1="10" x2="12" y2="16" />
                      <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
                    </svg>
                    <span className="pointer-events-none absolute -bottom-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-700 shadow group-hover/btn:block">
                      Инфо
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmDeleteBuilding(building)}
                    disabled={deletingBuildingId === building.id}
                    aria-label="Удалить дом"
                    title="Удалить дом"
                    className="group/btn relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingBuildingId === building.id ? (
                      <span className="text-xs">…</span>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                        <path d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    )}
                    <span className="pointer-events-none absolute -bottom-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-700 shadow group-hover/btn:block">
                      Удалить
                    </span>
                  </button>
                </div>

                <div className="flex items-start gap-4 pr-24">
                  <div className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 21h18" />
                      <path d="M5 21V7l7-4 7 4v14" />
                      <path d="M9 10h6" />
                      <path d="M9 14h6" />
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-xl font-semibold text-slate-900">{building.name}</h3>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        Квартир: {apartmentCounts[building.id] ?? building.apartmentIds?.length ?? 0}
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        {building.waterSubmissionIsMonthly ? 'Подача: ежемесячно' : 'Подача: по периоду'}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <p className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="mt-0.5 text-slate-400">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                        </span>
                        <span className="wrap-break-word">{building.address || 'Адрес не указан'}</span>
                      </p>

                      <p className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="mt-0.5 text-slate-400">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 21V7a2 2 0 0 0-2-2h-4" />
                            <path d="M14 21V3a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" />
                            <path d="M2 21h20" />
                          </svg>
                        </span>
                        <span>
                          Управляет:{' '}
                          <span className="font-medium text-slate-800">
                            {building.managedBy?.companyName || building.managedBy?.managerEmail || 'Не указано'}
                          </span>
                        </span>
                      </p>

                      <p className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="mt-0.5 text-slate-400">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 4h16v16H4z" />
                            <path d="M4 7l8 6 8-6" />
                          </svg>
                        </span>
                        <span className="wrap-break-word">{building.managedBy?.managerEmail || 'Email управляющего не указан'}</span>
                      </p>

                      <p className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="mt-0.5 text-slate-400">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        </span>
                        <span>
                          Период подачи:{' '}
                          <span className="font-medium text-slate-800">
                            {building.waterSubmissionOpenDate && building.waterSubmissionCloseDate
                              ? `${building.waterSubmissionOpenDate} — ${building.waterSubmissionCloseDate}`
                              : 'не задан'}
                          </span>
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedBuildingForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
            <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedBuildingForModal.name}</h3>
                  <p className="mt-1 text-sm text-gray-400">{selectedBuildingForModal.address}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBuildingForModal(null)}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-slate-800"
                >
                  Закрыть
                </button>
              </div>

              <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/60 p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Название дома</p>
                  <p className="mt-1 text-sm text-white">{selectedBuildingForModal.name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Адрес</p>
                  <p className="mt-1 text-sm text-white">{selectedBuildingForModal.address}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Управляющая организация</p>
                  <p className="mt-1 text-sm text-white">
                    {selectedBuildingForModal.managedBy?.companyName || 'Не указано'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Контакт управляющего</p>
                  <p className="mt-1 text-sm text-white">
                    {selectedBuildingForModal.managedBy?.managerEmail || 'Не указано'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Количество квартир</p>
                  <p className="mt-1 text-sm text-white">{apartmentCounts[selectedBuildingForModal.id] ?? selectedBuildingForModal.apartmentIds?.length ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Период подачи показаний</p>
                  <p className="mt-1 text-sm text-white">
                    {selectedBuildingForModal.waterSubmissionOpenDate && selectedBuildingForModal.waterSubmissionCloseDate
                      ? `${selectedBuildingForModal.waterSubmissionOpenDate} — ${selectedBuildingForModal.waterSubmissionCloseDate}`
                      : 'Не задан'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Режим подачи показаний</p>
                  <p className="mt-1 text-sm text-white">{selectedBuildingForModal.waterSubmissionIsMonthly ? 'Ежемесячный' : 'По установленному периоду'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedBuildingForUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Добавить пользователя к дому</h3>
                    <p className="mt-1 text-sm text-slate-500">Выберите роль и назначьте доступ по email</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (assigningUser) return;
                      setSelectedBuildingForUserModal(null);
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={assigningUser}
                  >
                    Закрыть
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    Дом: {selectedBuildingForUserModal.name}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                    Квартир: {apartmentCounts[selectedBuildingForUserModal.id] ?? selectedBuildingForUserModal.apartmentIds?.length ?? 0}
                  </span>
                </div>
              </div>

              <form onSubmit={handleAssignUserRole} className="space-y-5 px-6 py-6">
                {!canInviteSelectedBuilding && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    Приглашать новых пользователей может только главный администратор дома.
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Email пользователя</label>
                  <input
                    type="email"
                    value={userEmailToAssign}
                    onChange={(e) => setUserEmailToAssign(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                    required
                    disabled={!canInviteSelectedBuilding || assigningUser}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Если пользователя нет в системе — ему автоматически отправится приглашение на регистрацию.
                  </p>
                  {userEmailToAssign.trim().length > 0 && !isAssignEmailValid && (
                    <p className="mt-1 text-xs text-red-400">Введите корректный email.</p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Роль</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setRoleToAssign('Accountant')}
                      disabled={!canInviteSelectedBuilding || assigningUser}
                      className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        roleToAssign === 'Accountant'
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                          : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                      }`}
                    >
                      <p className="text-sm font-semibold">Бухгалтер</p>
                      <p className="mt-1 text-xs text-slate-500">Работа со счетами и финансовыми данными</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRoleToAssign('ManagementCompany')}
                      disabled={!canInviteSelectedBuilding || assigningUser}
                      className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        roleToAssign === 'ManagementCompany'
                          ? 'border-blue-400 bg-blue-50 text-blue-800'
                          : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                      }`}
                    >
                      <p className="text-sm font-semibold">Администратор дома</p>
                      <p className="mt-1 text-xs text-slate-500">Управление домом и доступом пользователей</p>
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Изменение роли применяется к профилю пользователя в рамках вашей компании.
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={assigningUser || !isAssignEmailValid || !canInviteSelectedBuilding}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {assigningUser ? 'Назначение...' : 'Назначить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (assigningUser) return;
                      setSelectedBuildingForUserModal(null);
                    }}
                    className="rounded-xl border border-slate-300 px-5 py-2.5 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={assigningUser}
                  >
                    Отмена
                  </button>
                </div>

                <div className="pt-2">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">Приглашённые в дом</h4>
                    {loadingInvitations && <span className="text-xs text-slate-500">Загрузка...</span>}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Email</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Роль</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Статус</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Отправлено</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {buildingInvitations.length === 0 && !loadingInvitations ? (
                          <tr>
                            <td className="px-3 py-3 text-slate-500" colSpan={4}>
                              Пока нет приглашений для этого дома.
                            </td>
                          </tr>
                        ) : (
                          buildingInvitations.map((invite) => (
                            <tr key={invite.id}>
                              <td className="px-3 py-2 text-slate-700">{invite.email}</td>
                              <td className="px-3 py-2 text-slate-700">{invite.role === 'Accountant' ? 'Бухгалтер' : 'Администратор дома'}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    invite.status === 'accepted'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : invite.status === 'revoked'
                                      ? 'bg-slate-200 text-slate-600'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {invite.status === 'accepted' ? 'Принято' : invite.status === 'revoked' ? 'Отозвано' : 'Ожидает'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-600">{formatInvitationDate(invite.createdAt)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmationDialog
          isOpen={Boolean(confirmDeleteBuilding)}
          title={`Удалить дом ${confirmDeleteBuilding?.name ?? ''}?`}
          description="Подтвердите удаление дома. Действие нельзя отменить."
          details={[
            'Удаление возможно только если в доме нет квартир.',
            'Если квартиры есть — сначала удалите или перенесите их.',
          ]}
          confirmLabel="Удалить"
          confirmVariant="danger"
          loading={Boolean(deletingBuildingId)}
          onCancel={() => setConfirmDeleteBuilding(null)}
          onConfirm={async () => {
            if (!confirmDeleteBuilding) return;
            const current = confirmDeleteBuilding;
            setConfirmDeleteBuilding(null);
            await handleDeleteBuilding(current);
          }}
        />
      </main>
    </div>
  );
}
