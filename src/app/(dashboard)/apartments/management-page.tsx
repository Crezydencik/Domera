"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getApartmentsFromDatabase, deleteApartment, unassignResidentFromApartment } from '@/modules/apartments/services/apartmentsService';
// meters helper removed from this page
import {  } from '@/modules/auth/services/authService';
import { getBuildingsFromDatabase } from '@/firebase/services/firestoreService';
import { doc, addDoc, collection, onSnapshot, query, where, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { Apartment, Building, Invitation, InvitationGdprMeta } from '@/shared/types';
type SelectedInvitation = Invitation & { sentAt?: Date };
type SelectedApartment = Apartment & { invitations?: SelectedInvitation[] };
import { ApartmentModal } from '@/shared/components/apartments/ApartmentModal';
import { toast } from 'react-toastify';

export default function ApartmentsManagementPage() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAddingApartment, setIsAddingApartment] = useState(false);
  const [showGlobalInvite, setShowGlobalInvite] = useState(false);
  const [globalInviteEmail, setGlobalInviteEmail] = useState('');
  const [globalInviteApartmentId, setGlobalInviteApartmentId] = useState<string | undefined>(undefined);
  const [invitedApartmentIds, setInvitedApartmentIds] = useState<string[]>([]);
  const [newApartment, setNewApartment] = useState({
    number: '',
    buildingId: '',
  });
  const [selectedApartment, setSelectedApartment] = useState<SelectedApartment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // metersByApartmentId removed — not used in current list layout
  // kept import/getMetersByApartment for potential future use

  // Вынес fetchData наружу, чтобы можно было вызывать после добавления квартиры
  const fetchData = async () => {
    try {
      const [apartmentData, buildingData] = await Promise.all([
        getApartmentsFromDatabase(),
        getBuildingsFromDatabase(),
      ]);
      console.log('Fetched apartments:', apartmentData); // Лог для проверки данных квартир
      console.log('Fetched buildings:', buildingData); // Лог для проверки данных зданий
      setApartments(
        apartmentData.map(ap => ({
          ...ap,
          companyIds: Array.isArray(ap.companyIds) ? ap.companyIds : [],
        })) 
      );
      // (meters loading removed — not needed in this view)
      console.log('buildingData:', buildingData);
      setBuildings(
        buildingData.map((building) => ({
          ...building,
          name: building.name || "Unnamed Building",
          apartmentIds: building.apartmentIds || [],
        }))
      );
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // subscribe to invitations so we can hide apartments that already have invites in the global invite selector
  useEffect(() => {
    const invitationsCollection = collection(db, 'invitations');
    const unsub = onSnapshot(invitationsCollection, (qs) => {
      const ids = Array.from(new Set(qs.docs
        .map(d => {
          const data = d.data() as Record<string, unknown>;
          return typeof data.apartmentId === 'string' ? data.apartmentId : undefined;
        })
        .filter(Boolean)));
      setInvitedApartmentIds(ids as string[]);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  const handleAddApartment = async () => {
    try {
      // companyId УК только из выбранного дома
      const selectedBuilding = buildings.find(b => b.id === newApartment.buildingId);
      // Проверка: нельзя добавить квартиру с уже существующим номером в этом доме
      const duplicate = apartments.some(
        (ap) => ap.buildingId === newApartment.buildingId && ap.number === newApartment.number
      );
      if (duplicate) {
        toast.error('Квартира с таким номером уже существует в этом доме!');
        return;
      }
      // companyId УК только из выбранного дома (берём из самого объекта дома)
      const companyId = selectedBuilding?.companyId;
      if (!companyId) {
        toast.error('У выбранного дома не найден идентификатор управляющей компании!');
        return;
      }
      const newApartmentData = {
        buildingId: newApartment.buildingId,
        companyIds: [companyId],
        number: newApartment.number,
      };
      const apartmentsCollection = collection(db, 'apartments');
      const docRef = await addDoc(apartmentsCollection, newApartmentData);

      // --- Гарантируем добавление id квартиры в apartmentIds дома ---
      try {
        const buildingDocRef = doc(db, 'buildings', newApartment.buildingId);
        // Получаем актуальные данные здания
        const buildingSnap = await getDoc(buildingDocRef);
        const buildingData = buildingSnap.exists() ? buildingSnap.data() : {};
        console.log('[handleAddApartment] buildingData:', buildingData);
        // apartmentIds всегда массив строк
        let currentApartmentIds = [];
        if (Array.isArray(buildingData.apartmentIds)) {
          currentApartmentIds = buildingData.apartmentIds;
        } else if (typeof buildingData.apartmentIds === 'object' && buildingData.apartmentIds !== null) {
          // Firestore может хранить объект вместо массива, если был ошибочный апдейт
          console.warn('[handleAddApartment] apartmentIds был объектом, а не массивом! Удалите поле вручную в консоли Firestore и повторите добавление.');
        }
        const updatedApartmentIds = [...new Set([...currentApartmentIds, docRef.id])];
        console.log('Обновляем apartmentIds:', updatedApartmentIds, Array.isArray(updatedApartmentIds));
        await updateDoc(buildingDocRef, {
          apartmentIds: updatedApartmentIds,
        });
        console.log('[handleAddApartment] Квартира добавлена в apartmentIds:', docRef.id);
      } catch (e) {
        console.error('[handleAddApartment] Ошибка при обновлении apartmentIds в доме:', e);
      }

      setNewApartment({ number: '', buildingId: '' });
      setIsAddingApartment(false);
      toast.success('Квартира успешно добавлена!');
      // meters loading skipped here
      // Обновляем данные после добавления квартиры
      await fetchData();
    } catch (error) {
      console.error('Error adding apartment:', error);
      toast.error('Ошибка при добавлении квартиры.');
    }
  };

  const handleDeleteApartment = async (apartmentId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту квартиру?')) {
      return;
    }

    try {
      await deleteApartment(apartmentId);
      setApartments((prev) => prev.filter((apartment) => apartment.id !== apartmentId));
      toast.success('Квартира успешно удалена!');
    } catch (error) {
      console.error('Error deleting apartment:', error);
      toast.error('Ошибка при удалении квартиры.');
    }
  };

  const handleUnassignResidentFor = async (apartmentId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить жильца из этой квартиры?')) return;
    try {
      const apt = apartments.find((a) => a.id === apartmentId);
      if (!apt || !apt.residentId) {
        toast.info('В этой квартире нет привязанного жильца');
        return;
      }

      await unassignResidentFromApartment(apartmentId);
      setApartments((prev) => prev.map((ap) => (ap.id === apartmentId ? { ...ap, residentId: undefined } : ap)));
      toast.success('Жилец удалён из квартиры');
    } catch (error) {
      console.error('Error unassigning resident:', error);
      toast.error('Ошибка при удалении жильца');
    }
  };

  const handleOpenModal = (apartment: Apartment) => {
    const apartmentDoc = doc(db, 'apartments', apartment.id);
    const invitationsCollection = collection(db, 'invitations');

    const unsubscribeApartment = onSnapshot(apartmentDoc, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const apartmentData = docSnapshot.data();
        setSelectedApartment({
          ...apartment,
          ...apartmentData,
        });
      } else {
        console.error('Apartment not found in Firestore');
        setIsModalOpen(false);
      }
    });

    const unsubscribeInvitations = onSnapshot(
      query(invitationsCollection, where('apartmentId', '==', apartment.id)),
      (querySnapshot) => {
        const convert = (v: unknown): Date | undefined => {
          if (!v) return undefined;
          // Firestore Timestamp has toDate(), otherwise could be ISO string or number
          if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate?: unknown }).toDate === 'function') {
            return (v as { toDate: () => Date }).toDate();
          }
          if (typeof v === 'string' || typeof v === 'number') return new Date(v as string | number);
          if (v instanceof Date) return v;
          return undefined;
        };

        const invitations: SelectedInvitation[] = querySnapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            apartmentId: data.apartmentId as string,
            email: data.email as string,
            status: (data.status as Invitation['status']) || 'pending',
            token: (data.token as string) || '',
            createdAt: (convert(data.createdAt) || new Date()) as Date,
            expiresAt: convert(data.expiresAt),
            invitedByUid: data.invitedByUid as string | undefined,
            acceptedAt: convert(data.acceptedAt),
            revokedAt: convert(data.revokedAt),
            gdpr: data.gdpr as InvitationGdprMeta | undefined,
            permissions: data.permissions as Invitation['permissions'] | undefined,
            sentAt: convert(data.sentAt),
          } as SelectedInvitation;
        });

        setSelectedApartment((prev) => prev ? { ...prev, invitations } : null);
      }
    );

    setIsModalOpen(true);

    // Cleanup listeners when modal is closed
    return () => {
      unsubscribeApartment();
      unsubscribeInvitations();
    };
  };

  const handleCloseModal = () => {
    setSelectedApartment(null);
    setIsModalOpen(false);
  };
 
  const handleUnassignResident = async () => {
    if (!selectedApartment) return;
    try {
      await unassignResidentFromApartment(selectedApartment.id);
      setApartments((prev) => {
        const updatedApartments = prev.map((apartment) =>
          apartment.id === selectedApartment.id
            ? { ...apartment, residentId: undefined }
            : apartment
        );
        console.log('Updated apartments after unassign:', updatedApartments); // Лог для проверки обновления состояния
        return updatedApartments;
      });
      console.log('Resident unassigned succes sfully from apartment:', selectedApartment.id);
    } catch (error) {
      console.error('Error unassigning resident:', error);
    }
  };

  // Password reset is handled inside the ApartmentModal now

  // Building CRUD helpers removed from this page (not used here)
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-400 hover:text-white">← Вернуться</Link>
          <h1 className="text-2xl font-bold text-white">Управление квартирами</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowGlobalInvite((s) => !s)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              Добавить жильца
            </button>
            <button
              type="button"
              onClick={() => setIsAddingApartment((prev) => !prev)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {isAddingApartment ? 'Отмена' : '+ Добавить квартиру'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {showGlobalInvite && (
          <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800/60 p-6">
            <h2 className="text-lg font-bold mb-3 text-white">Пригласить жильца (быстрый режим)</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 items-end">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={globalInviteEmail}
                  onChange={(e) => setGlobalInviteEmail(e.target.value)}
                  placeholder="email@domain.com"
                  className="w-full rounded-md bg-gray-800 border border-gray-600 text-white px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Квартира</label>
                <select
                  value={globalInviteApartmentId}
                  onChange={(e) => setGlobalInviteApartmentId(e.target.value || undefined)}
                  className="w-full rounded-md bg-gray-800 border border-gray-600 text-white px-3 py-2"
                >
                  <option value="">Выберите квартиру</option>
                  {apartments
                    .filter(a => !a.residentId && !invitedApartmentIds.includes(a.id || ''))
                    .map(a => (
                      <option key={a.id} value={a.id}>{`${a.number} — ${buildings.find(b => b.id === a.buildingId)?.name || 'Без дома'}`}</option>
                    ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    // send invite
                    const email = (globalInviteEmail || '').trim();
                    if (!email || !email.includes('@')) {
                      toast.error('Введите корректный email');
                      return;
                    }
                    if (!globalInviteApartmentId) {
                      toast.error('Выберите квартиру');
                      return;
                    }
                    try {
                      const response = await fetch('/api/invitations/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ apartmentId: globalInviteApartmentId, email, legalBasisConfirmed: true }),
                      });
                      const data = await response.json();
                      if (!response.ok) {
                        toast.error(data.error || 'Ошибка при отправке приглашения');
                      } else {
                        toast.success(`Приглашение отправлено на ${email}`);
                        setGlobalInviteEmail('');
                        // update invited list so apartment disappears from selector
                        setInvitedApartmentIds(prev => Array.from(new Set([...prev, globalInviteApartmentId])));
                        setGlobalInviteApartmentId(undefined);
                      }
                    } catch (err) {
                      console.error('Invite error', err);
                      toast.error('Ошибка при отправке приглашения');
                    }
                  }}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Отправить приглашение
                </button>

                <button
                  type="button"
                  onClick={() => setShowGlobalInvite(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-white bg-transparent hover:bg-slate-700"
                >
                  Закрыть
                </button>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-300">В списке показаны квартиры без привязанного жильца и без активных приглашений.</p>
          </div>
        )}
        {isAddingApartment && (
          <div className="mb-6 bg-slate-800 p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-bold mb-4">Добавить новую квартиру</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="apartmentNumber" className="block text-sm font-medium text-gray-300 mb-2">
                  Номер квартиры
                </label>
                <input
                  type="text"
                  id="apartmentNumber"
                  value={newApartment.number}
                  onChange={(e) => setNewApartment({ ...newApartment, number: e.target.value })}
                  className="mt-1 block w-full rounded-md bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Введите номер квартиры"
                  required
                />
              </div>
              <div>
                <label htmlFor="buildingId" className="block text-sm font-medium text-gray-300 mb-2">
                  Выберите дом
                </label>
                <select
                  id="buildingId"
                  value={newApartment.buildingId}
                  onChange={(e) => setNewApartment({ ...newApartment, buildingId: e.target.value })}
                  className="mt-1 block w-full rounded-md bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="" disabled>Выберите дом</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleAddApartment}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Добавить
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-8">
          {buildings.map((building) => {
            const buildingApartments = apartments.filter(a => a.buildingId === building.id);
            return (
              <div
                key={building.id}
                className="group relative bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition"
              >
                <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-xl border border-slate-600/70 bg-slate-900/70 p-1.5 shadow-lg shadow-slate-950/40 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => alert(`Дом: ${building.name}\nАдрес: ${building.address || '—'}`)}
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
                    onClick={() => { setIsAddingApartment(true); setNewApartment((p) => ({ ...p, buildingId: building.id })); }}
                    aria-label="Добавить квартиру"
                    title="Добавить квартиру"
                    className="group/btn relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 bg-green-700/80 text-white transition hover:bg-green-600"
                  >
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span className="pointer-events-none absolute -bottom-8 left-1/2 hidden -translate-x-1/2 rounded-md border border-slate-600 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200 shadow group-hover/btn:block whitespace-nowrap">
                      Добавить
                    </span>
                  </button>
                </div>

                <h3 className="text-lg font-semibold text-white">{building.name}</h3>
                <p className="text-gray-400">{building.address}</p>
                <p className="mt-2 text-sm text-slate-300">Управляет: {building.managedBy?.companyName || building.managedBy?.managerEmail || 'Не указано'}</p>

                <div className="mt-4">
                  <h4 className="text-sm text-gray-300 mb-2">Квартиры</h4>
                  {buildingApartments.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {buildingApartments.map((apartment) => {
                        const residentEmail = apartment.tenants?.[0]?.email ?? undefined;
                        const tenant0 = apartment.tenants?.[0] as unknown;
                        const residentPhone = (typeof tenant0 === 'object' && tenant0 !== null && 'phone' in tenant0) ? (tenant0 as { phone?: string }).phone : undefined;
                        return (
                          <div key={apartment.id} className="bg-slate-900/40 border border-slate-700 rounded-md p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-white font-medium">Квартира {apartment.number}</div>
                                <div className="text-sm text-gray-400">Email жильца: {residentEmail ?? '—'}</div>
                                <div className="text-sm text-gray-400">Телефон: {residentPhone ?? '—'}</div>
                             </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleOpenModal(apartment)} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">ℹ️</button>
                                <button onClick={() => handleUnassignResidentFor(apartment.id)} className="px-3 py-1 rounded bg-amber-600 text-white text-sm">✖</button>
                                <button onClick={() => handleDeleteApartment(apartment.id)} className="px-3 py-1 rounded bg-red-700 text-white text-sm">🗑</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">В этом доме пока нет квартир</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isModalOpen && selectedApartment && (
          (() => {
            // compute invitation meta (latest invitation) and account status + resident email
            const invitations: SelectedInvitation[] = selectedApartment.invitations ?? [];

            let invitationMeta: { email: string; sentAt?: string | Date } | undefined = undefined;
            if (invitations.length > 0) {
              const sorted = [...invitations].sort((a, b) => {
                const da = (a.createdAt || a.sentAt) instanceof Date ? (a.createdAt || a.sentAt) as Date : new Date(0);
                const db = (b.createdAt || b.sentAt) instanceof Date ? (b.createdAt || b.sentAt) as Date : new Date(0);
                return db.getTime() - da.getTime();
              });
              const latest = sorted[0];
              invitationMeta = {
                email: latest.email,
                sentAt: (latest.sentAt || latest.createdAt) as Date | undefined,
              };
            }

            // determine resident email: prefer tenant list or accepted invitation
            const residentEmail = (selectedApartment.tenants && selectedApartment.tenants[0]?.email)
              || invitations.find(inv => inv.status === 'accepted')?.email
              || undefined;

            // determine account status
            let accountStatus: 'activated' | 'pending' | 'notAssigned' = 'notAssigned';
            if (selectedApartment.residentId) accountStatus = 'activated';
            else if (invitations.length > 0) accountStatus = 'pending';

            return (
              <ApartmentModal
                apartment={selectedApartment}
                invitationMeta={invitationMeta}
                accountStatus={accountStatus}
                residentEmail={residentEmail}
                onClose={handleCloseModal}
                onDelete={() => handleDeleteApartment(selectedApartment.id)}
                onUnassignResident={handleUnassignResident}
                deleting={false}
                sendingPasswordReset={false}
                canDelete={true}
                canSendPasswordReset={true}
                canUnassignResident={true}
              />
            );
          })()
        )}
      </main>
    </div>
  );
}
