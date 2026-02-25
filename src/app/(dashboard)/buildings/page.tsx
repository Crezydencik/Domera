'use client';

import { useAuth } from '@/shared/hooks/useAuth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Building } from '@/shared/types';
import {
  createBuilding,
  deleteBuilding,
  getBuildingsByCompany,
  updateBuilding,
} from '@/modules/invoices/services/buildings/services/buildingsService';
import { getCompany } from '@/modules/company/services/companyService';
import { getApartmentsByBuilding } from '@/modules/apartments/services/apartmentsService';
import { ConfirmationDialog } from '@/shared/components/ui/ConfirmationDialog';
import { toast } from 'react-toastify';

export default function BuildingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [buildingName, setBuildingName] = useState('');
  const [buildingAddress, setBuildingAddress] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedBuildingForModal, setSelectedBuildingForModal] = useState<Building | null>(null);
  const [deletingBuildingId, setDeletingBuildingId] = useState<string | null>(null);
  const [confirmDeleteBuilding, setConfirmDeleteBuilding] = useState<Building | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canCreateBuilding = buildings.length === 0;

  useEffect(() => {
    if (!loading && user?.role !== 'ManagementCompany') {
      router.replace('/dashboard');
      return;
    }

    const loadBuildings = async () => {
      if (!user?.companyId) return;

      try {
        const [data, company] = await Promise.all([
          getBuildingsByCompany(user.companyId),
          getCompany(user.companyId),
        ]);

        const nextCompanyName = company?.name ?? '';
        setCompanyName(nextCompanyName);

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
      } catch (err) {
        console.error('Error loading buildings:', err);
      }
    };

    loadBuildings();
  }, [loading, router, user?.companyId, user?.role]);

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
      const newBuilding = await createBuilding({
        companyId: user.companyId,
        name: buildingName.trim(),
        address: buildingAddress.trim(),
        managedBy: {
          companyId: user.companyId,
          companyName: companyName || undefined,
          managerUid: user.uid,
          managerEmail: user.email,
        },
      });

      setBuildings([newBuilding]);
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
      setSelectedBuildingForModal((prev) => (prev?.id === building.id ? null : prev));
      toast.success(`Дом «${building.name}» удалён`);
    } catch (deleteErr: unknown) {
      toast.error(deleteErr instanceof Error ? deleteErr.message : 'Ошибка удаления дома');
    } finally {
      setDeletingBuildingId(null);
    }
  };

  if (loading) {
    return <div className="text-white">Загрузка...</div>;
  }

  if (!user) {
    return <div className="text-white">Требуется вход</div>;
  }

  if (user.role !== 'ManagementCompany') {
    return <div className="text-white">Недостаточно прав для просмотра раздела</div>;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-400 hover:text-white">
            ← Вернуться
          </Link>
          <h1 className="text-2xl font-bold text-white">Управление домами</h1>
          <button
            disabled={!canCreateBuilding}
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {canCreateBuilding ? '+ Добавить дом' : 'Лимит: 1 дом'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {showCreateForm && canCreateBuilding && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Новый дом</h2>
            <form onSubmit={handleCreateBuilding} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Название дома</label>
                <input
                  type="text"
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  placeholder="Например: Дом на Ленина"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Адрес</label>
                <input
                  type="text"
                  value={buildingAddress}
                  onChange={(e) => setBuildingAddress(e.target.value)}
                  placeholder="г. Москва, ул. Ленина, 10"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Сохранение...' : 'Сохранить дом'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 hover:bg-slate-600 transition"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {buildings.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏢</div>
            <h2 className="text-2xl font-bold text-white mb-2">Нет домов</h2>
            <p className="text-gray-400 mb-6">Можно создать только один дом для одного управляющего</p>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Создать дом
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {buildings.map((building) => (
              <div
                key={building.id}
                className="group relative bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition"
              >
                <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-xl border border-slate-600/70 bg-slate-900/70 p-1.5 shadow-lg shadow-slate-950/40 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setSelectedBuildingForModal(building)}
                    aria-label="Информация о доме"
                    title="Информация о доме"
                    className="group/btn relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 bg-slate-700/80 text-slate-100 transition hover:border-blue-500/60 hover:bg-slate-600"
                  >
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <line x1="12" y1="10" x2="12" y2="16" />
                      <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
                    </svg>
                    <span className="pointer-events-none absolute -bottom-8 left-1/2 hidden -translate-x-1/2 rounded-md border border-slate-600 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200 shadow group-hover/btn:block whitespace-nowrap">
                      Инфо
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmDeleteBuilding(building)}
                    disabled={deletingBuildingId === building.id}
                    aria-label="Удалить дом"
                    title="Удалить дом"
                    className="group/btn relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-700/70 bg-red-900/30 text-red-300 transition hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-50"
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
                    <span className="pointer-events-none absolute -bottom-8 left-1/2 hidden -translate-x-1/2 rounded-md border border-slate-600 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200 shadow group-hover/btn:block whitespace-nowrap">
                      Удалить
                    </span>
                  </button>
                </div>

                <h3 className="text-lg font-semibold text-white">{building.name}</h3>
                <p className="text-gray-400">{building.address}</p>
                <p className="mt-2 text-sm text-slate-300">
                  Управляет:{' '}
                  {building.managedBy?.companyName || building.managedBy?.managerEmail || 'Не указано'}
                </p>
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
              </div>
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
