'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApartmentsFromDatabase, deleteApartment, unassignResidentFromApartment } from '@/modules/apartments/services/apartmentsService';
import { logout } from '@/modules/auth/services/authService';
import { getBuildingsFromDatabase } from '@/firebase/services/firestoreService';
import { revokeInvitation } from '@/modules/invitations/services/invitationsService';
import { doc, addDoc, collection, onSnapshot, query, where, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/shared/hooks/useAuth';
import { useTranslations } from 'next-intl';
import Header from '@/shared/components/layout/heder';
import type { Apartment, Building, Invitation, InvitationGdprMeta } from '@/shared/types';
type SelectedInvitation = Invitation & { sentAt?: Date };
type SelectedApartment = Apartment & { invitations?: SelectedInvitation[] };
import { ApartmentModal } from '@/shared/components/apartments/ApartmentModal';
import { BuildingSelector } from '@/shared/components/apartments/BuildingSelector';
import { ImportApartmentsModal } from '@/shared/components/apartments/ImportApartmentsModal';
import { ApartmentCard } from './ApartmentCard';
import { toast } from 'react-toastify';

export default function ApartmentsManagementPage() {
  const { user } = useAuth();
  const router = useRouter();
  const t = useTranslations();
  
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Ошибка при выходе');
    }
  };

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-blue-500 border-t-blue-300 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Загрузка...</p>
        </div>
      </div>
    );
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

  const handleCancelInvitation = async (invitationId: string) => {
    if (!window.confirm('Вы уверены, что хотите отменить это приглашение?')) {
      return;
    }

    try {
      await revokeInvitation(invitationId);
      setSelectedApartment(null);
      setIsModalOpen(false);
      toast.success('Приглашение успешно отменено');
    } catch (error) {
      console.error('Error canceling invitation:', error);
      toast.error('Ошибка при отмене приглашения');
    }
  };

  // Password reset is handled inside the ApartmentModal now

  // Building CRUD helpers removed from this page (not used here)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <Header 
        userName={user?.name || user?.email || t('user')} 
        userEmail={user?.email}
        onLogout={handleLogout}
        pageTitle={t('apartments') || 'Управление квартирами'}
      />

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Building Selector with Action Buttons */}
        <BuildingSelector
          buildings={buildings}
          selectedBuildingId={selectedBuildingId}
          onBuildingSelect={setSelectedBuildingId}
          onAddResident={() => setShowGlobalInvite((s) => !s)}
          onAddApartment={() => setIsAddingApartment((prev) => !prev)}
          onImport={() => setIsImportModalOpen(true)}
          showGlobalInvite={showGlobalInvite}
          isAddingApartment={isAddingApartment}
        />

        {showGlobalInvite && (
          <div className="mb-8 rounded-2xl border border-emerald-100 bg-white p-8 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Пригласить жильца</h2>
                <p className="text-gray-600 text-sm mt-1">Быстрое добавление нового жильца в квартиру</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-end">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email адрес</label>
                <input
                  type="email"
                  value={globalInviteEmail}
                  onChange={(e) => setGlobalInviteEmail(e.target.value)}
                  placeholder="example@domain.com"
                  className="w-full rounded-lg bg-gray-50 border-2 border-gray-200 text-gray-900 px-4 py-3 focus:border-emerald-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Выберите квартиру</label>
                <select
                  value={globalInviteApartmentId}
                  onChange={(e) => setGlobalInviteApartmentId(e.target.value || undefined)}
                  className="w-full rounded-lg bg-gray-50 border-2 border-gray-200 text-gray-900 px-4 py-3 focus:border-emerald-500 focus:outline-none transition"
                >
                  <option value="">Выберите квартиру...</option>
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
                        setInvitedApartmentIds(prev => Array.from(new Set([...prev, globalInviteApartmentId])));
                        setGlobalInviteApartmentId(undefined);
                      }
                    } catch (err) {
                      console.error('Invite error', err);
                      toast.error('Ошибка при отправке приглашения');
                    }
                  }}
                  className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg transition"
                >
                  Отправить приглашение
                </button>

                <button
                  type="button"
                  onClick={() => setShowGlobalInvite(false)}
                  className="px-4 py-3 rounded-lg border-2 border-gray-200 text-gray-900 font-semibold bg-white hover:bg-gray-50 transition"
                >
                  Отмена
                </button>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">💡 В списке показаны квартиры без привязанного жильца и без активных приглашений.</p>
          </div>
        )}
        {isAddingApartment && (
          <div className="mb-8 rounded-2xl border border-blue-100 bg-white p-8 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Добавить новую квартиру</h2>
                <p className="text-gray-600 text-sm mt-1">Создайте новую квартиру в выбранном доме</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-6">
              <div>
                <label htmlFor="apartmentNumber" className="block text-sm font-semibold text-gray-700 mb-2">
                  Номер квартиры
                </label>
                <input
                  type="text"
                  id="apartmentNumber"
                  value={newApartment.number}
                  onChange={(e) => setNewApartment({ ...newApartment, number: e.target.value })}
                  className="w-full rounded-lg bg-gray-50 border-2 border-gray-200 text-gray-900 px-4 py-3 focus:border-blue-500 focus:outline-none transition"
                  placeholder="Н-р: 101"
                  required
                />
              </div>
              <div>
                <label htmlFor="buildingId" className="block text-sm font-semibold text-gray-700 mb-2">
                  Выберите дом
                </label>
                <select
                  id="buildingId"
                  value={newApartment.buildingId}
                  onChange={(e) => setNewApartment({ ...newApartment, buildingId: e.target.value })}
                  className="w-full rounded-lg bg-gray-50 border-2 border-gray-200 text-gray-900 px-4 py-3 focus:border-blue-500 focus:outline-none transition"
                  required
                >
                  <option value="" disabled>Выберите дом...</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setIsAddingApartment(false)}
                className="px-6 py-3 rounded-lg border-2 border-gray-200 text-gray-900 font-semibold bg-white hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleAddApartment}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:shadow-lg transition"
              >
                Добавить квартиру
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {apartments
            .filter(a => !selectedBuildingId || a.buildingId === selectedBuildingId)
            .map((apartment) => (
              <ApartmentCard
                key={apartment.id}
                apartment={apartment}
                onDetails={handleOpenModal}
                onUnassign={handleUnassignResidentFor}
                onDelete={handleDeleteApartment}
              />
            ))}
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

            // Get resident joined date (acceptedAt from tenant)
            const residentJoinedAt = selectedApartment.tenants && selectedApartment.tenants[0]?.acceptedAt
              ? new Date(selectedApartment.tenants[0].acceptedAt)
              : undefined;

            // determine account status
            let accountStatus: 'activated' | 'pending' | 'notAssigned' = 'notAssigned';
            if (selectedApartment.residentId) accountStatus = 'activated';
            else if (invitations.length > 0) accountStatus = 'pending';

            // Find pending invitation (not accepted, not revoked)
            const pendingInvitation = invitations.find(inv => inv.status === 'pending');

            return (
              <ApartmentModal
                apartment={selectedApartment}
                invitationMeta={invitationMeta}
                accountStatus={accountStatus}
                residentEmail={residentEmail}
                residentJoinedAt={residentJoinedAt}
                onClose={handleCloseModal}
                onDelete={() => handleDeleteApartment(selectedApartment.id)}
                onUnassignResident={handleUnassignResident}
                onCancelInvitation={pendingInvitation ? () => handleCancelInvitation(pendingInvitation.id) : undefined}
                deleting={false}
                sendingPasswordReset={false}
                canDelete={true}
                canSendPasswordReset={true}
                canUnassignResident={true}
                pendingInvitationId={pendingInvitation?.id}
              />
            );
          })()
        )}

        <ImportApartmentsModal
          buildings={buildings}
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={fetchData}
        />
         
      </main>
    </div>
  );
}
